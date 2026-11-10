import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  DAILY_PROMPTS,
  getPromptSlug,
  getPromptBySlug,
  getPromptSeoDetails,
} from './src/data/prompts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface StoredOneTimeShare {
  shareId: string;
  encryptedContent: string;
  iv: string;
  salt: string;
  pinVerifierHash: string;
  targetLang: string;
  senderName: string;
  date: string;
  createdAt: string;
  burned: boolean;
  burnedAt?: string;
  failedAttempts: number;
}

const SHARES_STORAGE_PATH = '/tmp/momenty_one_time_shares.json';

function loadSharesFromDisk(): Map<string, StoredOneTimeShare> {
  try {
    if (fs.existsSync(SHARES_STORAGE_PATH)) {
      const raw = fs.readFileSync(SHARES_STORAGE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Map(parsed);
      }
    }
  } catch (err) {
    console.warn('[Shares] Failed to load shares from disk:', err);
  }
  return new Map<string, StoredOneTimeShare>();
}

function saveSharesToDisk(map: Map<string, StoredOneTimeShare>): void {
  try {
    const entries = Array.from(map.entries()).slice(-500);
    fs.writeFileSync(SHARES_STORAGE_PATH, JSON.stringify(entries), 'utf-8');
  } catch (err) {
    console.warn('[Shares] Failed to save shares to disk:', err);
  }
}

// Lightweight LRU cache helper to avoid redundant Gemini calls for identical inputs
class SimpleLRUCache<V> {
  private map = new Map<string, V>();
  constructor(private maxSize: number = 80) {}

  get(key: string): V | undefined {
    const val = this.map.get(key);
    if (val !== undefined) {
      this.map.delete(key);
      this.map.set(key, val);
    }
    return val;
  }

  set(key: string, val: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, val);
  }
}

export const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const spellCache = new SimpleLRUCache<string>(80);
  const hintsCache = new SimpleLRUCache<string[]>(80);

  let geminiQuotaBlockedUntil = 0;

  // Strip Polish diacritics for base-letter comparison
  function stripDiacritics(s: string): string {
    return s
      .replace(/ą/g, 'a').replace(/Ą/g, 'A')
      .replace(/ć/g, 'c').replace(/Ć/g, 'C')
      .replace(/ę/g, 'e').replace(/Ę/g, 'E')
      .replace(/ł/g, 'l').replace(/Ł/g, 'L')
      .replace(/ń/g, 'n').replace(/Ń/g, 'N')
      .replace(/ó/g, 'o').replace(/Ó/g, 'O')
      .replace(/ś/g, 's').replace(/Ś/g, 'S')
      .replace(/ź/g, 'z').replace(/Ź/g, 'Z')
      .replace(/ż/g, 'z').replace(/Ż/g, 'Z');
  }

  function damerauLevenshtein(a: string, b: string): number {
    const alen = a.length;
    const blen = b.length;
    const dp = Array.from({ length: alen + 1 }, () => new Array<number>(blen + 1).fill(0));
    for (let i = 0; i <= alen; i++) dp[i][0] = i;
    for (let j = 0; j <= blen; j++) dp[0][j] = j;
    for (let i = 1; i <= alen; i++) {
      for (let j = 1; j <= blen; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
        }
      }
    }
    return dp[alen][blen];
  }

  function pickBestLTReplacement(
    original: string,
    replacements: { value?: string }[] | undefined,
    ruleId?: string
  ): string | null {
    if (!replacements || replacements.length === 0) return null;

    const isSpellRule =
      ruleId === 'MORFOLOGIK_RULE_PL_PL' ||
      ruleId?.startsWith('MORFOLOGIK_') ||
      ruleId?.startsWith('HUNSPELL_') ||
      ruleId?.startsWith('SPELLER_');

    if (!isSpellRule) {
      if (ruleId === 'ZE_Z_SPOL' && /^ze\s+/i.test(original)) {
        return original.replace(/^ze/i, m => (m[0] === 'Z' ? 'Że' : 'że'));
      }
      return replacements[0]?.value || null;
    }

    const isCapitalized = /^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(original);
    const origLower = original.toLowerCase();
    const origBase = stripDiacritics(origLower);

    // 1. Pure missing Polish diacritics match (e.g. "Myśle" -> "Myślę", "biore" -> "biorę", "duzo" -> "dużo")
    for (const r of replacements.slice(0, 6)) {
      if (r.value && stripDiacritics(r.value.toLowerCase()) === origBase) {
        return r.value;
      }
    }

    // 2. Pure letter transposition (metathesis) with optional diacritics (e.g. "zbey" -> "żeby")
    const sortedOrig = origBase.split('').sort().join('');
    for (const r of replacements.slice(0, 6)) {
      if (!r.value) continue;
      const candBase = stripDiacritics(r.value.toLowerCase());
      if (
        candBase.length === origBase.length &&
        candBase.split('').sort().join('') === sortedOrig &&
        damerauLevenshtein(origBase, candBase) === 1
      ) {
        return r.value;
      }
    }

    // 3. Edit distance check on base letters so proper nouns aren't replaced with unrelated words
    const top = replacements[0]?.value;
    if (!top) return null;
    const topBase = stripDiacritics(top.toLowerCase());
    const dist = damerauLevenshtein(origBase, topBase);
    const maxAllowedDist = origBase.length <= 4 ? 1 : 2;
    if (dist <= maxAllowedDist) {
      return top;
    }

    for (const r of replacements.slice(1, 5)) {
      if (!r.value) continue;
      const rBase = stripDiacritics(r.value.toLowerCase());
      if (damerauLevenshtein(origBase, rBase) <= 1) {
        return r.value;
      }
    }

    return isCapitalized ? null : top;
  }

  async function checkWithLanguageTool(text: string, lang: string): Promise<string> {
    const ltLang =
      lang === 'en' ? 'en-US' : lang === 'es' ? 'es' : lang === 'fr' ? 'fr' : 'pl-PL';
    const params = new URLSearchParams({ text, language: ltLang });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`LanguageTool HTTP ${response.status}`);
      }
      const data: any = await response.json();
      let out = text;
      const matches = Array.isArray(data?.matches)
        ? [...data.matches].sort((a, b) => b.offset - a.offset)
        : [];
      let lastOffset = Infinity;
      for (const m of matches) {
        if (typeof m.offset !== 'number' || typeof m.length !== 'number') continue;
        if (m.offset + m.length > lastOffset) continue;
        const orig = out.slice(m.offset, m.offset + m.length);
        const rep = pickBestLTReplacement(orig, m.replacements, m.rule?.id);
        if (rep && rep !== orig) {
          out = out.slice(0, m.offset) + rep + out.slice(m.offset + m.length);
          lastOffset = m.offset;
        }
      }
      return out;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Fast, cost-optimized Gemini caller using gemini-3.1-flash-lite as primary model
  async function generateWithFallback(
    prompt: string,
    systemInstruction?: string,
    temperature: number = 0.1
  ): Promise<string> {
    if (Date.now() < geminiQuotaBlockedUntil) {
      throw new Error('Gemini quota temporarily paused');
    }

    const models: { name: string; thinkingLevel?: ThinkingLevel }[] = [
      { name: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
      { name: 'gemini-3.8-flash', thinkingLevel: ThinkingLevel.LOW },
      { name: 'gemini-flash-latest' },
    ];

    for (const { name, thinkingLevel } of models) {
      try {
        const response = await ai.models.generateContent({
          model: name,
          contents: prompt,
          config: {
            temperature,
            ...(thinkingLevel
              ? { thinkingConfig: { thinkingLevel } }
              : { thinkingConfig: { thinkingBudget: 0 } }),
            ...(systemInstruction ? { systemInstruction } : {}),
          },
        });
        if (response.text && response.text.trim()) {
          return response.text.trim();
        }
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (err?.status === 429 && msg.includes('spending cap')) {
          // Project-level spending cap affects all Gemini models — pause retries for 5 minutes
          geminiQuotaBlockedUntil = Date.now() + 5 * 60 * 1000;
          break;
        }
        console.warn(`[AI] Model ${name} unavailable (${err?.status || msg.slice(0, 80)}), trying next...`);
      }
    }
    throw new Error('All Gemini models temporarily unavailable');
  }

  // 1. Strict Spelling, Typo & Diacritic Fixer (NO meaning or style changes) — supports PL, EN, ES & FR
  app.post('/api/fix-spelling', async (req, res) => {
    const { text, lang = 'pl' } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.json({ correctedText: text || '', isSuccess: true });
    }

    const trimmedInput = text.trim();
    const cacheKey = `${lang}::${trimmedInput}`;
    const cachedCorrection = spellCache.get(cacheKey);
    if (cachedCorrection) {
      return res.json({ correctedText: cachedCorrection, isSuccess: true, cached: true });
    }

    // Run LanguageTool morphological & orthographic check first (fast, deterministic, $0 Gemini cost, never alters style)
    try {
      const ltCorrected = await checkWithLanguageTool(text, lang);
      if (ltCorrected && ltCorrected.trim()) {
        spellCache.set(cacheKey, ltCorrected);
        return res.json({
          correctedText: ltCorrected,
          isSuccess: true,
          engine: 'languagetool',
        });
      }
    } catch (ltErr) {
      console.warn('[Spellcheck] LanguageTool fallback to Gemini:', ltErr);
    }

    const isEn = lang === 'en';
    const isEs = lang === 'es';
    const isFr = lang === 'fr';

    try {
      const systemInstruction = isEn
        ? `Proofread English text: fix ONLY typos, spelling, missing apostrophes in contractions, and basic punctuation. Do NOT change meaning, tone, vocabulary, or line breaks. Return ONLY the corrected text.`
        : isEs
        ? `Corrector ortográfico en español: corrige SOLO erratas, faltas de ortografía, tildes faltantes y puntuación básica. NO cambies el significado, estilo, vocabulario ni saltos de línea. Devuelve SOLO el texto corregido.`
        : isFr
        ? `Correcteur orthographique français : corrige UNIQUEMENT les fautes de frappe, d'orthographe, les accents manquants et la ponctuation de base. NE change NI le sens, NI le style, NI les sauts de ligne. Renvoie UNIQUEMENT le texte corrigé.`
        : `Korektor pisowni w języku polskim: napraw WYŁĄCZNIE literówki, błędy ortograficzne, brakujące znaki diakrytyczne (ą,ć,ę,ł,ń,ó,ś,ź,ż) i podstawową interpunkcję. NIE zmieniaj znaczenia, stylu, słownictwa ani podziału na linie. Zwróć WYŁĄCZNIE poprawiony tekst.`;

      const raw = await generateWithFallback(text, systemInstruction, 0.1);

      let cleaned = raw;
      if (cleaned.startsWith('"') && cleaned.endsWith('"') && !text.startsWith('"')) {
        cleaned = cleaned.slice(1, -1);
      }
      if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
        cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
      }

      const finalResult = cleaned.trim() ? cleaned : text;
      spellCache.set(cacheKey, finalResult);

      res.json({
        correctedText: finalResult,
        isSuccess: true,
        engine: 'gemini',
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to correct spelling via server',
        fallback: true,
      });
    }
  });

  // 2. Dynamic Margin Questions Generator (on-demand only, cached, 900-char context window)
  app.post('/api/dynamic-hints', async (req, res) => {
    const { text, prompt: dailyPrompt, lang = 'pl' } = req.body;
    const cleanText = typeof text === 'string' ? text.trim() : '';

    // Skip Gemini API when text is too short — client uses local prompt-matched questions
    if (cleanText.length < 25) {
      return res.json({ questions: [], source: 'local-short' });
    }

    const contextSlice = cleanText.slice(-900);
    const cacheKey = `${lang}::${dailyPrompt || ''}::${contextSlice}`;
    const cachedQuestions = hintsCache.get(cacheKey);
    if (cachedQuestions && cachedQuestions.length > 0) {
      return res.json({ questions: cachedQuestions, source: 'cache' });
    }

    const isEn = lang === 'en';
    const isEs = lang === 'es';
    const isFr = lang === 'fr';

    try {
      const systemInstruction = isEn
        ? `Journal companion: generate 4 short follow-up questions (8–14 words each, in English) based directly on the author's text and main question. One question per line, no bullets or numbers.`
        : isEs
        ? `Compañero de diario: genera 4 preguntas breves de seguimiento (8–14 palabras, en español) basadas directamente en el texto del autor y la pregunta principal. Una por línea, sin numeración.`
        : isFr
        ? `Compagnon de journal : génère 4 courtes questions de suivi (8–14 mots, en français) basées directement sur le texte de l'auteur et la question principale. Une par ligne, sans puces.`
        : `Uważny towarzysz dziennika: wygeneruj 4 krótkie pytania pomocnicze (8–14 słów, po polsku) odnoszące się bezpośrednio do tekstu autora w nawiązaniu do pytania głównego. Jedno pytanie w linii, bez numeracji i myślników.`;

      const userMessage = `Prompt: "${dailyPrompt || ''}"\nText:\n${contextSlice}`;

      const raw = await generateWithFallback(userMessage, systemInstruction, 0.35);
      const questions = raw
        .split('\n')
        .map(q => q.replace(/^[-*•→\d\.\)\s]+/, '').trim())
        .filter(q => q.length > 6 && q.length < 140)
        .slice(0, 4);

      if (questions.length > 0) {
        hintsCache.set(cacheKey, questions);
      }

      res.json({ questions, source: 'ai' });
    } catch (error) {
      res.status(500).json({ questions: [], fallback: true });
    }
  });

  // 3. Feedback email forwarder to mazurekbartosz1@gmail.com
  app.post('/api/send-feedback', async (req, res) => {
    const { message, userEmail, includeEmail, userName, lang = 'pl' } = req.body || {};
    const cleanMessage = typeof message === 'string' ? message.trim() : '';
    if (!cleanMessage) {
      return res.status(400).json({ error: 'Feedback message is required' });
    }

    const recipient = 'mazurekbartosz1@gmail.com';
    const senderEmail = includeEmail && typeof userEmail === 'string' && userEmail.trim()
      ? userEmail.trim()
      : 'anonymous@momenty.app';

    try {
      // Forward via FormSubmit Ajax API to mazurekbartosz1@gmail.com
      const response = await fetch(`https://formsubmit.co/ajax/${recipient}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Referer: 'https://momenty.app/',
          Origin: 'https://momenty.app',
        },
        body: JSON.stringify({
          _subject: `Momenty — Nowy feedback od ${includeEmail && userEmail ? userEmail : userName || 'użytkownika'}`,
          message: cleanMessage,
          email: senderEmail,
          includeEmail: includeEmail ? 'Tak' : 'Nie (anonimowo)',
          language: lang,
          _template: 'table',
        }),
      });

      const data = await response.json().catch(() => ({}));
      res.json({ ok: true, recipient, delivery: data });
    } catch (err) {
      console.warn('[Feedback] Email relay warning (stored in Firestore):', err);
      res.json({ ok: true, recipient, storedInDatabase: true });
    }
  });

  // 4. Sparkle ("Gwiazdki") — Warm buddy-style summary of the last few days using low-cost Gemini model
  app.post('/api/sparkle-summary', async (req, res) => {
    const { entries = [], userName = '', lang = 'pl' } = req.body || {};
    const validEntries = Array.isArray(entries)
      ? entries
          .filter(
            (e: any) =>
              e &&
              typeof e.content === 'string' &&
              e.content.trim().length > 0 &&
              typeof e.date === 'string'
          )
          .slice(0, 7)
      : [];

    if (validEntries.length === 0) {
      return res.status(400).json({ error: 'No entries provided for summary' });
    }

    const sortedByDate = [...validEntries].sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = sortedByDate[0].date;
    const lastDate = sortedByDate[sortedByDate.length - 1].date;
    const periodLabel = firstDate === lastDate ? firstDate : `${firstDate} – ${lastDate}`;
    const cleanName = typeof userName === 'string' ? userName.trim().split(' ')[0] : '';

    const isEn = lang === 'en';
    const isEs = lang === 'es';
    const isFr = lang === 'fr';

    const entriesContext = sortedByDate
      .map(
        (e, i) =>
          `[${i + 1}] Data: ${e.date}\nPytanie: "${(e.promptText || '').slice(0, 160)}"\nWpis: ${e.content
            .replace(/[\u200B-\u200D\uFEFF\u2062\u2063\u2064]/g, '')
            .trim()
            .slice(0, 800)}`
      )
      .join('\n\n---\n\n');

    try {
      const systemInstruction = isEn
        ? `You are a warm, observant, supportive friend ("Sparkle") reviewing the user's recent journal entries.
Write directly to the user like a close buddy saying: "Hey man/friend, you did great because of this, this, and this."
Return strictly valid JSON with keys:
- "greeting": a warm buddy-style opening line (e.g. "Hey ${cleanName || 'friend'}, you did really well these past days!")
- "content": 3–5 warm, natural sentences summarizing what they wrote over the last days, what mattered most, and why it was genuinely good. Refer to concrete details from their entries.
- "highlights": an array of 2 to 3 short bullet strings (max 18 words each) naming specific things they did well or noticed.`
        : isEs
        ? `Eres un amigo cercano, cálido y atento ("Sparkle") que lee las entradas recientes del diario del usuario.
Háblale directamente como un buen amigo diciendo: "Oye amigo, lo hiciste genial por esto, esto y esto".
Devuelve únicamente JSON válido con las claves:
- "greeting": saludo cercano (ej. "¡Oye ${cleanName || 'amigo'}, lo hiciste muy bien estos días!")
- "content": 3–5 frases cálidas y naturales resumiendo lo más importante que escribió y por qué estuvo bien, citando detalles reales.
- "highlights": lista de 2 a 3 puntos breves con cosas concretas que hizo bien.`
        : isFr
        ? `Tu es un ami proche, chaleureux et attentif ("Sparkle") qui lit les entrées récentes du journal de l'utilisateur.
Parle-lui directement comme un bon pote : "Hé mon vieux, tu as bien fait parce que ceci, cela et cela."
Renvoie uniquement un JSON valide avec les clés :
- "greeting": salutation chaleureuse
- "content": 3 à 5 phrases naturelles résumant l'essentiel de ces derniers jours et pourquoi c'était bien.
- "highlights": tableau de 2 à 3 points courts sur ce qu'il a bien fait.`
        : `Jesteś ciepłym, uważnym, wspierającym kumplem ("Sparkle"), który czyta ostatnie wpisy użytkownika z dziennika.
Twoim zadaniem jest odezwać się do niego bezpośrednio i naturalnie — jak dobry znajomy, który bierze te rzeczy i mówi: "Hej ${
            cleanName || 'stary'
          }, dobrze zrobiłeś, bo to i to i to".
Podsumuj, co napisał przez ostatnie dni, co było najważniejsze i dlaczego to było dobre. Odwołaj się do konkretnych myśli, spacerów, decyzji lub obserwacji z jego wpisów, bez sztucznego patosu.
Zwróć WYŁĄCZNIE poprawny obiekt JSON z kluczami:
- "greeting": bezpośrednie, kumplowskie przywitanie (np. "Hej ${cleanName || 'stary'}, naprawdę dobra robota przez te ostatnie dni!")
- "content": 3–5 ciepłych, konkretnych zdań podsumowania (dlaczego dobrze zrobił, co ważnego zauważył i za co może siebie docenić)
- "highlights": tablica 2 lub 3 krótkich punktów (po 1 zdaniu), które konkretnie wymieniają, co zrobił dobrze.`;

      const raw = await generateWithFallback(
        `Oto wpisy z ostatnich dni (${periodLabel}):\n\n${entriesContext}`,
        systemInstruction,
        0.6
      );

      let cleaned = raw.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
      }
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }

      const parsed = JSON.parse(cleaned);
      const greeting =
        typeof parsed.greeting === 'string' && parsed.greeting.trim()
          ? parsed.greeting.trim()
          : isEn
          ? `Hey ${cleanName || 'friend'}, you did great these past days!`
          : `Hej ${cleanName || 'stary'}, dobrze zrobiłeś przez te ostatnie dni!`;
      const summaryContent =
        typeof parsed.content === 'string' && parsed.content.trim()
          ? parsed.content.trim()
          : cleaned;
      const highlights = Array.isArray(parsed.highlights)
        ? parsed.highlights
            .filter((h: any) => typeof h === 'string' && h.trim().length > 0)
            .map((h: string) => h.replace(/^[-*•\d.)\s]+/, '').trim())
            .slice(0, 3)
        : [];

      return res.json({
        greeting,
        content: summaryContent,
        highlights,
        periodLabel,
        source: 'ai',
      });
    } catch (err) {
      console.warn('[Sparkle] Fallback local summary used:', err);
      // Local intelligent fallback so Sparkle always works even if quota is paused
      const snippets = sortedByDate
        .map(e =>
          e.content
            .replace(/[\u200B-\u200D\uFEFF\u2062\u2063\u2064]/g, '')
            .split(/[.!?\n]+/)
            .map((s: string) => s.trim())
            .find((s: string) => s.length > 18)
        )
        .filter(Boolean) as string[];

      const fallbackGreeting = isEn
        ? `Hey ${cleanName || 'friend'}, you did really well these past days!`
        : isEs
        ? `¡Oye ${cleanName || 'amigo'}, lo hiciste genial estos días!`
        : isFr
        ? `Hé ${cleanName || 'mon ami'}, tu as super bien fait ces derniers jours !`
        : `Hej ${cleanName || 'stary'}, dobrze zrobiłeś przez te ostatnie dni!`;

      const fallbackContent = isEn
        ? `You paused and gave yourself space across ${sortedByDate.length} ${
            sortedByDate.length === 1 ? 'day' : 'days'
          } (${periodLabel}) to put your honest thoughts on paper. ${
            snippets[0]
              ? `Especially when you noted: "${snippets[0].slice(0, 120)}" — noticing these moments is exactly what builds real self-awareness.`
              : `Every time you close a day here, you're taking care of your own head.`
          }`
        : `Zatrzymałeś się i znalazłeś chwilę dla siebie przez ${sortedByDate.length} ${
            sortedByDate.length === 1 ? 'dzień' : 'ostatnie dni'
          } (${periodLabel}), żeby szczerze nazwać to, co siedzi Ci w głowie. Dobrze zrobiłeś, bo zamiast lecieć na autopilocie, wyłapałeś ważne dla siebie rzeczy${
            snippets[0] ? ` — choćby wtedy, gdy zapisałeś: „${snippets[0].slice(0, 120)}”` : ''
          }. To właśnie z takich małych, uczciwych obserwacji składa się spokój i dobra perspektywa.`;

      const fallbackHighlights = isEn
        ? [
            `Consistent reflection across ${sortedByDate.length} ${sortedByDate.length === 1 ? 'entry' : 'entries'} (${periodLabel}).`,
            snippets[0] ? `Captured an honest thought: "${snippets[0].slice(0, 90)}"` : 'Took time to listen to yourself.',
          ]
        : [
            `Znalazłeś czas na szczerą rozmowę ze sobą (${sortedByDate.length} ${
              sortedByDate.length === 1 ? 'zamknięty dzień' : 'wpisy z ostatnich dni'
            }).`,
            snippets[0]
              ? `Nazwałeś wprost ważną myśl: „${snippets[0].slice(0, 90)}”`
              : 'Zatrzymałeś się w biegu i zamknąłeś dzień z uważnością.',
          ];

      return res.json({
        greeting: fallbackGreeting,
        content: fallbackContent,
        highlights: fallbackHighlights,
        periodLabel,
        source: 'fallback',
      });
    }
  });

  // 5. Translate entry & prompt for One-Time Share in the recipient's language
  app.post('/api/translate-share', async (req, res) => {
    const {
      content = '',
      promptText = '',
      sourceLang = 'pl',
      targetLang = 'pl',
    } = req.body || {};

    const cleanContent = typeof content === 'string' ? content.trim() : '';
    const cleanPrompt = typeof promptText === 'string' ? promptText.trim() : '';

    if (!cleanContent) {
      return res.json({ translatedContent: '', translatedPrompt: cleanPrompt, targetLang });
    }

    if (sourceLang === targetLang) {
      return res.json({
        translatedContent: cleanContent,
        translatedPrompt: cleanPrompt,
        targetLang,
      });
    }

    const langNames: Record<string, string> = {
      pl: 'Polish (polski)',
      en: 'English',
      es: 'Spanish (español)',
      fr: 'French (français)',
    };
    const targetLanguageLabel = langNames[targetLang] || 'English';

    try {
      const systemInstruction = `You are a literary translator for a personal journal. Translate the daily question ("prompt") and the author's journal entry ("content") faithfully into ${targetLanguageLabel}.
Preserve the author's personal tone, intimacy, paragraph breaks, and meaning.
CRITICAL: Strictly preserve all Markdown formatting in "content" such as **bold**, *italic*, and ***bold italic*** (including on inline follow-up questions) in the exact corresponding translated phrases.
Return strictly valid JSON with two keys:
- "translatedPrompt": string
- "translatedContent": string`;

      const raw = await generateWithFallback(
        JSON.stringify({ prompt: cleanPrompt, content: cleanContent }),
        systemInstruction,
        0.2
      );

      let cleaned = raw.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
      }
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }

      const parsed = JSON.parse(cleaned);
      return res.json({
        translatedContent:
          typeof parsed.translatedContent === 'string' && parsed.translatedContent.trim()
            ? parsed.translatedContent.trim()
            : cleanContent,
        translatedPrompt:
          typeof parsed.translatedPrompt === 'string' && parsed.translatedPrompt.trim()
            ? parsed.translatedPrompt.trim()
            : cleanPrompt,
        targetLang,
      });
    } catch (err) {
      console.warn('[TranslateShare] Translation fallback to original:', err);
      return res.json({
        translatedContent: cleanContent,
        translatedPrompt: cleanPrompt,
        targetLang,
        fallback: true,
      });
    }
  });

  // 6. One-Time Encrypted Entry Sharing with PIN (Self-destructs immediately upon first valid read)
  const sharesMap = loadSharesFromDisk();

  app.use('/api/shares', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.post('/api/shares', (req, res) => {
    const {
      shareId: requestedShareId,
      encryptedContent,
      iv,
      salt,
      pinVerifierHash,
      targetLang = 'pl',
      senderName = '',
      date = '',
    } = req.body || {};

    if (
      typeof encryptedContent !== 'string' ||
      !encryptedContent ||
      typeof iv !== 'string' ||
      !iv ||
      typeof salt !== 'string' ||
      !salt ||
      typeof pinVerifierHash !== 'string' ||
      !pinVerifierHash
    ) {
      return res.status(400).json({ error: 'Missing encrypted payload or PIN verifier' });
    }

    const shareId =
      typeof requestedShareId === 'string' && /^[a-f0-9]{24}$/.test(requestedShareId)
        ? requestedShareId
        : crypto.randomBytes(12).toString('hex');
    const record: StoredOneTimeShare = {
      shareId,
      encryptedContent: encryptedContent.slice(0, 100000),
      iv: iv.slice(0, 64),
      salt: salt.slice(0, 64),
      pinVerifierHash: pinVerifierHash.slice(0, 128),
      targetLang: ['pl', 'en', 'es', 'fr'].includes(targetLang) ? targetLang : 'pl',
      senderName: typeof senderName === 'string' ? senderName.slice(0, 60) : '',
      date: typeof date === 'string' ? date.slice(0, 16) : new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      burned: false,
      failedAttempts: 0,
    };

    sharesMap.set(shareId, record);
    saveSharesToDisk(sharesMap);

    return res.json({ shareId });
  });

  app.get('/api/shares/:shareId/status', (req, res) => {
    const { shareId } = req.params;
    const record = sharesMap.get(shareId);
    if (!record) {
      return res.status(404).json({ exists: false, burned: true });
    }
    return res.json({
      exists: true,
      burned: record.burned,
      targetLang: record.targetLang,
      senderName: record.senderName,
      date: record.date,
      salt: record.burned ? '' : record.salt,
      remainingAttempts: Math.max(0, 5 - record.failedAttempts),
    });
  });

  app.post('/api/shares/:shareId/consume', (req, res) => {
    const { shareId } = req.params;
    const { pinVerifierHash } = req.body || {};
    const record = sharesMap.get(shareId);

    if (!record) {
      return res.status(404).json({ error: 'not_found', burned: true });
    }

    if (record.burned || !record.encryptedContent) {
      return res.status(410).json({
        error: 'already_burned',
        burned: true,
        targetLang: record.targetLang,
      });
    }

    if (typeof pinVerifierHash !== 'string' || pinVerifierHash !== record.pinVerifierHash) {
      record.failedAttempts += 1;
      if (record.failedAttempts >= 5) {
        record.burned = true;
        record.burnedAt = new Date().toISOString();
        record.encryptedContent = '';
        record.iv = '';
        record.salt = '';
        record.pinVerifierHash = '';
      }
      saveSharesToDisk(sharesMap);
      return res.status(403).json({
        error: 'invalid_pin',
        burned: record.burned,
        remainingAttempts: Math.max(0, 5 - record.failedAttempts),
      });
    }

    // Valid PIN! Atomically extract payload and immediately burn/wipe ciphertext forever
    const payload = {
      ok: true,
      encryptedContent: record.encryptedContent,
      iv: record.iv,
      salt: record.salt,
      targetLang: record.targetLang,
      senderName: record.senderName,
      date: record.date,
    };

    record.burned = true;
    record.burnedAt = new Date().toISOString();
    record.encryptedContent = '';
    record.iv = '';
    record.salt = '';
    record.pinVerifierHash = '';
    saveSharesToDisk(sharesMap);

    return res.json(payload);
  });

  // 7. Android TWA / Google Play Digital Asset Links (/.well-known/assetlinks.json)
  const ANDROID_CONFIG_PATH = '/tmp/momenty_android_twa.json';
  const PUBLIC_ASSETLINKS_PATH = path.resolve(__dirname, 'public', '.well-known', 'assetlinks.json');

  interface AndroidTWAConfig {
    packageName: string;
    sha256Fingerprints: string[];
    updatedAt?: string;
  }

  function loadAndroidTWAConfig(): AndroidTWAConfig {
    const defaultPkg = process.env.ANDROID_PACKAGE_NAME || 'app.momenty.dziennik';
    const envFingerprints = process.env.ANDROID_SHA256_FINGERPRINTS
      ? process.env.ANDROID_SHA256_FINGERPRINTS.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    try {
      if (fs.existsSync(ANDROID_CONFIG_PATH)) {
        const raw = JSON.parse(fs.readFileSync(ANDROID_CONFIG_PATH, 'utf-8'));
        if (raw && typeof raw.packageName === 'string') {
          return {
            packageName: raw.packageName.trim() || defaultPkg,
            sha256Fingerprints: Array.isArray(raw.sha256Fingerprints)
              ? raw.sha256Fingerprints.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
              : envFingerprints,
            updatedAt: raw.updatedAt,
          };
        }
      }
    } catch {
      // ignore
    }

    try {
      if (fs.existsSync(PUBLIC_ASSETLINKS_PATH)) {
        const parsed = JSON.parse(fs.readFileSync(PUBLIC_ASSETLINKS_PATH, 'utf-8'));
        const first = Array.isArray(parsed) ? parsed[0] : null;
        if (first?.target?.package_name) {
          const fps = Array.isArray(first.target.sha256_cert_fingerprints)
            ? first.target.sha256_cert_fingerprints.filter(
                (f: unknown): f is string =>
                  typeof f === 'string' &&
                  f.trim().length > 0 &&
                  !f.startsWith('00:00:00:00:')
              )
            : [];
          return {
            packageName: String(first.target.package_name),
            sha256Fingerprints: fps.length > 0 ? fps : envFingerprints,
          };
        }
      }
    } catch {
      // ignore
    }

    return {
      packageName: defaultPkg,
      sha256Fingerprints: envFingerprints,
    };
  }

  function buildAssetLinksPayload(cfg: AndroidTWAConfig) {
    const fingerprints =
      cfg.sha256Fingerprints.length > 0
        ? cfg.sha256Fingerprints
        : [
            '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00',
          ];
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: cfg.packageName || 'app.momenty.dziennik',
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ];
  }

  app.get('/.well-known/assetlinks.json', (_req, res) => {
    const cfg = loadAndroidTWAConfig();
    const payload = buildAssetLinksPayload(cfg);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.send(JSON.stringify(payload, null, 2));
  });

  app.get('/api/android-twa-config', (_req, res) => {
    const cfg = loadAndroidTWAConfig();
    return res.json({
      ...cfg,
      assetLinks: buildAssetLinksPayload(cfg),
    });
  });

  app.post('/api/android-twa-config', (req, res) => {
    const { packageName, sha256Fingerprints } = req.body || {};
    const cleanPkg =
      typeof packageName === 'string' && /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/.test(packageName.trim())
        ? packageName.trim()
        : 'app.momenty.dziennik';

    const rawFps: string[] = Array.isArray(sha256Fingerprints)
      ? sha256Fingerprints
      : typeof sha256Fingerprints === 'string'
      ? sha256Fingerprints.split(/[\n,]+/)
      : [];

    const cleanFps = rawFps
      .map(s => String(s).trim().toUpperCase())
      .filter(s => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));

    const updated: AndroidTWAConfig = {
      packageName: cleanPkg,
      sha256Fingerprints: cleanFps,
      updatedAt: new Date().toISOString(),
    };

    try {
      fs.writeFileSync(ANDROID_CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
      const assetLinksJson = JSON.stringify(buildAssetLinksPayload(updated), null, 2);
      const wellKnownDir = path.dirname(PUBLIC_ASSETLINKS_PATH);
      if (!fs.existsSync(wellKnownDir)) {
        fs.mkdirSync(wellKnownDir, { recursive: true });
      }
      fs.writeFileSync(PUBLIC_ASSETLINKS_PATH, assetLinksJson, 'utf-8');
    } catch (err) {
      console.warn('[AndroidTWA] Could not persist assetlinks to disk:', err);
    }

    return res.json({
      ok: true,
      ...updated,
      assetLinks: buildAssetLinksPayload(updated),
    });
  });

  // 8. Programmatic SEO: /robots.txt, /sitemap.xml & Server-Side Pre-Rendering for /prompts/:slug
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  app.get('/robots.txt', (_req, res) => {
    const baseUrl = 'https://www.dailymoments.app';
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(
      `User-agent: *\nAllow: /\nAllow: /prompts\nAllow: /prompts/\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', (_req, res) => {
    const baseUrl = 'https://www.dailymoments.app';
    const todayIso = new Date().toISOString().slice(0, 10);
    const urls = [
      `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${todayIso}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
      `  <url>\n    <loc>${baseUrl}/prompts</loc>\n    <lastmod>${todayIso}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>`,
      ...DAILY_PROMPTS.map(p => {
        const slug = getPromptSlug(p);
        return `  <url>\n    <loc>${baseUrl}/prompts/${slug}</loc>\n    <lastmod>${todayIso}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
      }),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join(
      '\n'
    )}\n</urlset>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.send(xml);
  });

  function injectProgrammaticPromptSeo(rawHtml: string, reqPath: string): string {
    const baseUrl = 'https://www.dailymoments.app';
    if (reqPath === '/prompts' || reqPath === '/prompts/') {
      const title = 'Biblioteka pytań do dziennika i codziennej refleksji (47 Prompts) | Momenty';
      const desc =
        'Odkryj 47 pytań do codziennej refleksji, wdzięczności, uważności i radzenia sobie z wypaleniem (Overcoming Burnout, Evening Gratitude). Zacznij pisać od razu na stronie bez logowania.';
      const canonicalUrl = `${baseUrl}/prompts`;

      const listItemsHtml = DAILY_PROMPTS.map(p => {
        const s = getPromptSlug(p);
        return `<li><a href="/prompts/${escapeHtml(s)}">${escapeHtml(p.promptPl)} — ${escapeHtml(
          p.promptEn
        )}</a></li>`;
      }).join('\n');

      const prerenderedRoot = `<div id="root"><main class="seo-prerender-fallback max-w-5xl mx-auto px-6 py-14 font-serif"><header class="mb-8"><a href="/">← Momenty / Moments</a></header><h1>${escapeHtml(
        title
      )}</h1><p>${escapeHtml(desc)}</p><ul>${listItemsHtml}</ul></main></div>`;

      return rawHtml
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
        .replace(
          /<meta name="description" content="[^"]*"\s*\/?>/i,
          `<meta name="description" content="${escapeHtml(desc)}" />`
        )
        .replace(
          /<link rel="canonical" href="[^"]*"\s*\/?>/i,
          `<link rel="canonical" href="${canonicalUrl}" />`
        )
        .replace(
          /<meta property="og:title" content="[^"]*"\s*\/?>/i,
          `<meta property="og:title" content="${escapeHtml(title)}" />`
        )
        .replace(
          /<meta property="og:description" content="[^"]*"\s*\/?>/i,
          `<meta property="og:description" content="${escapeHtml(desc)}" />`
        )
        .replace(
          /<meta property="og:url" content="[^"]*"\s*\/?>/i,
          `<meta property="og:url" content="${canonicalUrl}" />`
        )
        .replace(/<div id="root">[\s\S]*?<\/div>\s*(?=<script)/i, `${prerenderedRoot}\n    `);
    }

    if (reqPath.startsWith('/prompts/')) {
      const slug = decodeURIComponent(reqPath.slice('/prompts/'.length).replace(/\/+$/, ''));
      const matched = getPromptBySlug(slug);
      if (matched) {
        const seoPl = getPromptSeoDetails(matched, 'pl');
        const seoEn = getPromptSeoDetails(matched, 'en');
        const title = `${matched.promptPl} (${matched.promptEn}) | Momenty`;
        const desc = `${matched.hintPl} ${matched.hintEn}`;
        const canonicalUrl = `${baseUrl}/prompts/${seoPl.slug}`;

        const followUpsHtml = seoPl.followUpQuestions
          .map(q => `<li>${escapeHtml(q)}</li>`)
          .join('');

        const prerenderedRoot = `<div id="root"><article class="seo-prerender-fallback max-w-4xl mx-auto px-6 py-14 font-serif"><nav><a href="/">Momenty</a> · <a href="/prompts">Prompts</a> · <span>${escapeHtml(
          seoPl.categoryLabel
        )}</span></nav><h1>${escapeHtml(matched.promptPl)}</h1><h2>${escapeHtml(
          matched.promptEn
        )}</h2><p>${escapeHtml(matched.hintPl)}</p><p>${escapeHtml(
          seoPl.reflectionGuide
        )}</p><h3>Pytania pomocnicze na marginesie:</h3><ul>${followUpsHtml}</ul></article></div>`;

        return rawHtml
          .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
          .replace(
            /<meta name="description" content="[^"]*"\s*\/?>/i,
            `<meta name="description" content="${escapeHtml(desc)}" />`
          )
          .replace(
            /<link rel="canonical" href="[^"]*"\s*\/?>/i,
            `<link rel="canonical" href="${canonicalUrl}" />`
          )
          .replace(
            /<meta property="og:title" content="[^"]*"\s*\/?>/i,
            `<meta property="og:title" content="${escapeHtml(title)}" />`
          )
          .replace(
            /<meta property="og:description" content="[^"]*"\s*\/?>/i,
            `<meta property="og:description" content="${escapeHtml(desc)}" />`
          )
          .replace(
            /<meta property="og:url" content="[^"]*"\s*\/?>/i,
            `<meta property="og:url" content="${canonicalUrl}" />`
          )
          .replace(/<div id="root">[\s\S]*?<\/div>\s*(?=<script)/i, `${prerenderedRoot}\n    `);
      }
    }

    return rawHtml;
  }

  // Handle SSR SEO injection for /prompts and /prompts/:slug in production & Vercel serverless
  app.get(['/prompts', '/prompts/:slug'], (req, res, next) => {
    const distHtmlPath = path.resolve(__dirname, 'dist', 'index.html');
    const rootHtmlPath = path.resolve(__dirname, 'index.html');
    const targetPath = fs.existsSync(distHtmlPath) ? distHtmlPath : rootHtmlPath;

    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      try {
        const rawHtml = fs.readFileSync(targetPath, 'utf-8');
        const injected = injectProgrammaticPromptSeo(rawHtml, req.path);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(injected);
      } catch {
        return next();
      }
    }
    return next();
  });

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.get(['/prompts', '/prompts/:slug'], async (req, res, next) => {
      try {
        const rawHtml = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        const injected = injectProgrammaticPromptSeo(transformed, req.path);
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(injected);
      } catch (e) {
        next(e);
      }
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      const distHtmlPath = path.resolve(__dirname, 'dist', 'index.html');
      try {
        const rawHtml = fs.readFileSync(distHtmlPath, 'utf-8');
        const injected = injectProgrammaticPromptSeo(rawHtml, req.path);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(injected);
      } catch {
        return res.sendFile(distHtmlPath);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
