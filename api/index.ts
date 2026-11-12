import express from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

try {
  dotenv.config();
} catch {
  // Ignore dotenv errors in serverless environments
}

const ROOT_DIR = process.cwd();

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
let sharesMapInstance: Map<string, StoredOneTimeShare> | null = null;

function getSharesMap(): Map<string, StoredOneTimeShare> {
  if (sharesMapInstance) return sharesMapInstance;
  try {
    if (fs.existsSync(SHARES_STORAGE_PATH)) {
      const raw = fs.readFileSync(SHARES_STORAGE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        sharesMapInstance = new Map(parsed);
        return sharesMapInstance;
      }
    }
  } catch (err) {
    console.warn('[Shares] Failed to load shares from disk:', err);
  }
  sharesMapInstance = new Map<string, StoredOneTimeShare>();
  return sharesMapInstance;
}

function saveSharesToDisk(map: Map<string, StoredOneTimeShare>): void {
  try {
    const entries = Array.from(map.entries()).slice(-500);
    fs.writeFileSync(SHARES_STORAGE_PATH, JSON.stringify(entries), 'utf-8');
  } catch (err) {
    console.warn('[Shares] Failed to save shares to disk:', err);
  }
}

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

app.use(express.json({ limit: '10mb' }));

// Lazy initialization so missing env vars never crash serverless module loading at cold start
let cachedAiClient: GoogleGenAI | null = null;
let cachedAiKey: string = '';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!apiKey) return null;
  if (cachedAiClient && cachedAiKey === apiKey) {
    return cachedAiClient;
  }
  try {
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedAiKey = apiKey;
    return cachedAiClient;
  } catch (err) {
    console.warn('[AI] Failed to initialize GoogleGenAI client:', err);
    return null;
  }
}

const spellCache = new SimpleLRUCache<string>(80);
const hintsCache = new SimpleLRUCache<string[]>(80);

let geminiQuotaBlockedUntil = 0;

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

  for (const r of replacements.slice(0, 6)) {
    if (r.value && stripDiacritics(r.value.toLowerCase()) === origBase) {
      return r.value;
    }
  }

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

async function generateWithFallback(
  prompt: string,
  systemInstruction?: string,
  temperature: number = 0.1
): Promise<string> {
  if (Date.now() < geminiQuotaBlockedUntil) {
    throw new Error('Gemini quota temporarily paused');
  }

  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured');
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
        geminiQuotaBlockedUntil = Date.now() + 5 * 60 * 1000;
        break;
      }
      console.warn(`[AI] Model ${name} unavailable (${err?.status || msg.slice(0, 80)}), trying next...`);
    }
  }
  throw new Error('All Gemini models temporarily unavailable');
}

// Health check route
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    runtime: process.env.VERCEL ? 'vercel' : 'node',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    hasDoopKey: Boolean(process.env.DOOP_API_KEY),
  });
});

// 1. Strict Spelling, Typo & Diacritic Fixer
app.post('/api/fix-spelling', async (req, res) => {
  const { text, lang = 'pl' } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.json({ correctedText: text || '', isSuccess: true });
  }

  const trimmedInput = text.trim();
  const cacheKey = `${lang}::${trimmedInput}`;
  const cachedCorrection = spellCache.get(cacheKey);
  if (cachedCorrection) {
    return res.json({ correctedText: cachedCorrection, isSuccess: true, cached: true });
  }

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

    return res.json({
      correctedText: finalResult,
      isSuccess: true,
      engine: 'gemini',
    });
  } catch {
    return res.json({
      correctedText: text,
      isSuccess: false,
      fallback: true,
    });
  }
});

// 2. Dynamic Margin Questions Generator
app.post('/api/dynamic-hints', async (req, res) => {
  const { text, prompt: dailyPrompt, lang = 'pl' } = req.body || {};
  const cleanText = typeof text === 'string' ? text.trim() : '';

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

    return res.json({ questions, source: 'ai' });
  } catch {
    return res.json({ questions: [], fallback: true });
  }
});

// 3. Feedback email forwarder
app.post('/api/send-feedback', async (req, res) => {
  const { message, userEmail, includeEmail, userName, lang = 'pl' } = req.body || {};
  const cleanMessage = typeof message === 'string' ? message.trim() : '';
  if (!cleanMessage) {
    return res.status(400).json({ error: 'Feedback message is required' });
  }

  const recipient = 'mazurekbartosz1@gmail.com';
  const senderEmail =
    includeEmail && typeof userEmail === 'string' && userEmail.trim()
      ? userEmail.trim()
      : 'anonymous@momenty.app';

  try {
    const response = await fetch(`https://formsubmit.co/ajax/${recipient}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Referer: 'https://www.dailymoments.app/',
        Origin: 'https://www.dailymoments.app',
      },
      body: JSON.stringify({
        _subject: `Momenty — Nowy feedback od ${
          includeEmail && userEmail ? userEmail : userName || 'użytkownika'
        }`,
        message: cleanMessage,
        email: senderEmail,
        includeEmail: includeEmail ? 'Tak' : 'Nie (anonimowo)',
        language: lang,
        _template: 'table',
      }),
    });

    const data = await response.json().catch(() => ({}));
    return res.json({ ok: true, recipient, delivery: data });
  } catch (err) {
    console.warn('[Feedback] Email relay warning (stored in Firestore):', err);
    return res.json({ ok: true, recipient, storedInDatabase: true });
  }
});

// 4. Sparkle ("Gwiazdki") — Warm buddy-style summary
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

// 5. Translate entry & prompt for One-Time Share
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

// 5b. Internal Marketing Feature: 3-Part Instagram Campaign Generator + Doop API (1080x1080 Square Images)
function buildDoopFallbackSvgDataUri(
  partNumber: string,
  featureBadge: string,
  headline: string,
  quoteSnippet: string,
  accentHex: string,
  featureId: string
): string {
  const safeBadge = escapeHtml(featureBadge.toUpperCase());
  const safeHeadline = escapeHtml(headline);
  const safeSnippet = escapeHtml(quoteSnippet);

  const wrapLines = (text: string, maxChars: number, maxLines: number): string[] => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length <= maxChars) {
        current = (current + ' ' + word).trim();
      } else {
        if (current) lines.push(current);
        current = word;
        if (lines.length >= maxLines - 1) break;
      }
    }
    const consumedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
    const remainder = words.slice(consumedWords).join(' ');
    if (remainder) {
      lines.push(remainder.length > maxChars + 8 ? remainder.slice(0, maxChars + 5) + '…' : remainder);
    }
    return lines.slice(0, maxLines);
  };

  const headlineLines = wrapLines(safeHeadline, 26, 3);
  const snippetLines = wrapLines(safeSnippet, 44, 4);

  const headlineTspans = headlineLines
    .map((line, idx) => `<tspan x="96" dy="${idx === 0 ? 0 : 68}">${line}</tspan>`)
    .join('');

  const snippetStartY = 360 + headlineLines.length * 68;
  const snippetTspans = snippetLines
    .map((line, idx) => `<tspan x="124" dy="${idx === 0 ? 0 : 44}">${line}</tspan>`)
    .join('');

  const iconIllustration =
    featureId === 'e2ee'
      ? `<g transform="translate(830, 110)">
          <rect x="0" y="0" width="154" height="154" rx="32" fill="#EBF2EB" stroke="#1C1A18" stroke-width="3"/>
          <path d="M55 72 V54 C55 41 65 31 77 31 C89 31 99 41 99 54 V72" fill="none" stroke="#1C1A18" stroke-width="4.5" stroke-linecap="round"/>
          <rect x="43" y="72" width="68" height="52" rx="10" fill="${accentHex}" stroke="#1C1A18" stroke-width="4"/>
          <circle cx="77" cy="94" r="5" fill="#FAF8F5"/>
          <line x1="77" y1="99" x2="77" y2="110" stroke="#FAF8F5" stroke-width="4" stroke-linecap="round"/>
        </g>`
      : featureId === 'minimal_ui'
      ? `<g transform="translate(830, 110)">
          <rect x="0" y="0" width="154" height="154" rx="32" fill="#F5DCE3" stroke="#1C1A18" stroke-width="3"/>
          <rect x="34" y="34" width="86" height="86" rx="10" fill="#FAF8F5" stroke="#1C1A18" stroke-width="3.5"/>
          <line x1="50" y1="58" x2="104" y2="58" stroke="#1C1A18" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="50" y1="76" x2="96" y2="76" stroke="#1C1A18" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="50" y1="94" x2="82" y2="94" stroke="#8B2635" stroke-width="3.5" stroke-linecap="round"/>
        </g>`
      : `<g transform="translate(830, 110)">
          <rect x="0" y="0" width="154" height="154" rx="32" fill="#EFECE4" stroke="#1C1A18" stroke-width="3"/>
          <circle cx="94" cy="58" r="18" fill="#EBC5CF" stroke="#1C1A18" stroke-width="3.5"/>
          <path d="M40 104 H108 C118 104 123 95 119 86 C116 79 109 77 104 79 C100 65 86 58 74 63 C65 56 51 60 48 72 C38 73 30 81 31 91 C31 98 35 104 40 104 Z" fill="#FAF8F5" stroke="#1C1A18" stroke-width="3.5" stroke-linejoin="round"/>
        </g>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
    <rect width="1080" height="1080" fill="#F7F5F0"/>
    <rect x="44" y="44" width="992" height="992" rx="36" fill="#FAF8F5" stroke="#E5DFD3" stroke-width="3"/>
    <rect x="96" y="114" width="380" height="46" rx="23" fill="#F2EFE8" stroke="#DDD6C8" stroke-width="2"/>
    <circle cx="124" cy="137" r="7" fill="${accentHex}"/>
    <text x="144" y="143" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" font-weight="600" fill="#524D46" letter-spacing="1.5">${partNumber} · ${safeBadge}</text>
    ${iconIllustration}
    <text x="96" y="310" font-family="Georgia, 'Times New Roman', serif" font-size="54" font-weight="500" fill="#1C1A18">${headlineTspans}</text>
    <rect x="96" y="${snippetStartY - 46}" width="6" height="${snippetLines.length * 44 + 34}" rx="3" fill="${accentHex}"/>
    <text x="124" y="${snippetStartY}" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="31" fill="#524D46">${snippetTspans}</text>
    <line x1="96" y1="880" x2="984" y2="880" stroke="#E5DFD3" stroke-width="2"/>
    <g transform="translate(96, 912)">
      <rect x="0" y="0" width="56" height="56" rx="14" fill="#F2EFE8" stroke="#1C1A18" stroke-width="2.5"/>
      <polygon points="14,24 20,10 28,22" fill="#C96839" stroke="#1C1A18" stroke-width="2"/>
      <polygon points="42,24 36,10 28,22" fill="#C96839" stroke="#1C1A18" stroke-width="2"/>
      <rect x="14" y="20" width="28" height="22" rx="4" fill="#C96839" stroke="#1C1A18" stroke-width="2"/>
      <circle cx="22" cy="29" r="2.2" fill="#1C1A18"/>
      <circle cx="34" cy="29" r="2.2" fill="#1C1A18"/>
      <rect x="12" y="42" width="32" height="7" rx="2" fill="#33302B"/>
    </g>
    <text x="172" y="936" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="600" fill="#1C1A18">YourMoments · Notes from an Idea Explorer</text>
    <text x="172" y="966" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" fill="#7A756D">dailymoments.app · 1080×1080 Campaign</text>
    <rect x="770" y="914" width="214" height="52" rx="12" fill="${accentHex}"/>
    <text x="877" y="947" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" font-weight="600" fill="#FAF8F5">dailymoments.app</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
}

app.post('/api/admin/campaign/generate', async (req, res) => {
  try {
    const { lang = 'en', customNote = '' } = req.body || {};
    const isPl = lang === 'pl';

    interface CampaignFeatureSpec {
      id: 'e2ee' | 'minimal_ui' | 'daily_habit';
      partLabel: string;
      featureTitle: string;
      accentHex: string;
      defaultHeadline: string;
      defaultVisualQuote: string;
      defaultCaption: string;
      defaultHashtags: string[];
    }

    const featureSpecs: CampaignFeatureSpec[] = isPl
      ? [
          {
            id: 'e2ee',
            partLabel: 'PART 01/03',
            featureTitle: 'Szyfrowanie End-to-End (AES-256)',
            accentHex: '#2E6F40',
            defaultHeadline: 'Prywatność nie powinna być płatnym dodatkiem do Twoich własnych myśli.',
            defaultVisualQuote:
              'Każde słowo jest szyfrowane kluczem AES-256 w Twojej przeglądarce, zanim opuści urządzenie. Nawet baza danych widzi wyłącznie szyfrogram.',
            defaultCaption: `Odkąd zacząłem eksplorować pomysł na YourMoments (dailymoments.app), jedno pytanie nie dawało mi spokoju: dlaczego większość aplikacji do pisania traktuje nasze najbardziej osobiste myśli jak dane treningowe na serwerze?\n\nJako odkrywca pomysłów (idea explorer) budujący ten projekt krok po kroku, postawiłem na jedną twardą zasadę: pełne szyfrowanie End-to-End (AES-GCM 256) bezpośrednio w przeglądarce.\n\nZanim Twój wpis trafi do chmury, zamienia się w nieczytelny szyfrogram. Ani ja, ani żaden serwer nie możemy przeczytać ani jednego Twojego zdania. Twoje wieczorne zapiski należą wyłącznie do Ciebie.\n\nTestuję to podejście codziennie na sobie — jeśli szukasz cichego miejsca na własne myśli, sprawdź dailymoments.app.`,
            defaultHashtags: [
              '#buildinpublic',
              '#ideaexplorer',
              '#yourmoments',
              '#dailymoments',
              '#privacyfirst',
              '#e2ee',
              '#mindfuljournaling',
              '#indiehacker',
            ],
          },
          {
            id: 'minimal_ui',
            partLabel: 'PART 02/03',
            featureTitle: 'Minimalistyczny interfejs bez rozpraszaczy',
            accentHex: '#C96839',
            defaultHeadline: 'Mniej powiadomień. Jedna spokojna kartka papieru i cichy towarzysz przy biurku.',
            defaultVisualQuote:
              'Zero feedów, zero wyskakujących okienek. Tylko ciepły papier, jedno pytanie i dyskretna podpowiedź na marginesie.',
            defaultCaption: `Eksplorując kolejne prototypy YourMoments, zauważyłem coś paradoksalnego: większość aplikacji do produktywności i journalingu męczy nas dokładnie tak samo, jak media społecznościowe — dziesiątkami zakładek, wykresów i odznak.\n\nPostanowiłem pójść w zupełnie inną stronę. Zaprojektowałem ekran, który przypomina ciepłą kartkę papieru połączoną z klasyczną maszyną do pisania. Obok tekstu pojawia się tylko jedno ciche pytanie pomocnicze na marginesie, a na dole przy biurku siedzi mały pikselowy lisek, który stuka w klawisze w Twoim rytmie.\n\nKiedy otwierasz stronę, nie musisz nawet zakładać konta — po prostu zaczynasz pisać. Dajcie znać, jak podoba Wam się taki kierunek spokojnej technologii.`,
            defaultHashtags: [
              '#calmtech',
              '#minimaldesign',
              '#ideaexplorer',
              '#buildinpublic',
              '#yourmoments',
              '#distractionfree',
              '#digitalminimalism',
              '#uxdesign',
            ],
          },
          {
            id: 'daily_habit',
            partLabel: 'PART 03/03',
            featureTitle: 'Codzienny rytuał mikro-dziennika',
            accentHex: '#8B2635',
            defaultHeadline: 'Nie potrzebujesz godziny dziennie, żeby zatrzymać najważniejszy moment dnia.',
            defaultVisualQuote:
              'Jedno uważne pytanie wieczorem. Trzy zdania na klawiaturze lub podyktowane głosem podczas spaceru — i zamykasz dzień.',
            defaultCaption: `Przez lata próbowałem prowadzić tradycyjny dziennik i zawsze odpadałem po tygodniu. Pusta biała strona o 22:00 potrafi przytłoczyć.\n\nEksplorując ten problem przy budowie YourMoments, odkryłem, że kluczem nie jest pisanie długich esejów, ale mikro-rytuał, który trwa mniej niż 60 sekund:\n1. Dostajesz jedno uważne pytanie dnia (albo losujesz kategorię bliższą Twojemu nastrojowi).\n2. Piszesz kilka zdań lub dyktujesz myśl głosem podczas wieczornego spaceru.\n3. Klikasz „Zamknij dzień” — atrament jaśnieje, a wspomnienie trafia do zaszyfrowanego kalendarza.\n\nCo kilka zamkniętych dni w kalendarzu zapalają się też gwiazdki z ciepłym podsumowaniem tego, gdzie udało Ci się zwolnić tempo. Możecie przetestować dzisiejsze pytanie od razu na dailymoments.app.`,
            defaultHashtags: [
              '#microjournaling',
              '#dailyhabit',
              '#ideaexplorer',
              '#buildinpublic',
              '#yourmoments',
              '#mindfulness',
              '#eveningritual',
              '#indiedev',
            ],
          },
        ]
      : [
          {
            id: 'e2ee',
            partLabel: 'PART 01/03',
            featureTitle: 'End-to-End Encryption (AES-256)',
            accentHex: '#2E6F40',
            defaultHeadline: 'Your private thoughts should never be training data on someone else’s server.',
            defaultVisualQuote:
              'Every reflection is encrypted with AES-256 directly inside your browser before it ever leaves your device.',
            defaultCaption: `When I started exploring the idea behind YourMoments (dailymoments.app), one question kept bothering me: why do so many journaling apps store our most personal reflections in plain text on their servers?\n\nAs an idea explorer sharing this project’s progress in public, I wanted privacy to be architectural, not just a marketing promise. Every entry in YourMoments is encrypted client-side using AES-GCM 256 before it ever touches the cloud.\n\nEven if you open the database directly, all that exists is ciphertext. Not even I can read a single word you write.\n\nI’ve been testing this flow every evening — if you’ve been looking for a truly private corner of the internet to think out loud, try writing a line at dailymoments.app.`,
            defaultHashtags: [
              '#ideaexplorer',
              '#buildinpublic',
              '#yourmoments',
              '#dailymoments',
              '#privacyfirst',
              '#endtoendencryption',
              '#calmtech',
              '#indiehacker',
            ],
          },
          {
            id: 'minimal_ui',
            partLabel: 'PART 02/03',
            featureTitle: 'Minimal Distraction-Free Interface',
            accentHex: '#C96839',
            defaultHeadline: 'What happens when you strip away feeds, badges, and noise — leaving only warm paper?',
            defaultVisualQuote:
              'No dashboards or popups. Just a warm sheet of paper, a quiet margin follow-up question, and a tiny companion typing along.',
            defaultCaption: `While iterating on the interface for YourMoments, I realized most productivity and journaling tools accidentally recreate the exact digital noise we’re trying to escape.\n\nAs an idea explorer experimenting with calmer software, I tried removing everything that wasn’t essential to the act of reflection:\n• Warm archival paper tones instead of stark white screens\n• A single quiet follow-up question in the left margin that adapts as you write\n• A tiny pixel companion at the desk who types when you type and rests when you pause\n\nYou don’t even hit a login wall — the landing page IS the live writing desk. Would love to hear what you think of this quieter direction.`,
            defaultHashtags: [
              '#minimaldesign',
              '#calmtech',
              '#ideaexplorer',
              '#buildinpublic',
              '#yourmoments',
              '#distractionfree',
              '#digitalminimalism',
              '#productdesign',
            ],
          },
          {
            id: 'daily_habit',
            partLabel: 'PART 03/03',
            featureTitle: 'Daily Micro-Journaling Habit',
            accentHex: '#8B2635',
            defaultHeadline: 'A 60-second evening ritual beats a blank page you never open.',
            defaultVisualQuote:
              'One thoughtful daily question, voice dictation on an evening walk, and sealing the day with a single click.',
            defaultCaption: `For years I tried keeping a traditional journal and always quit after day five. Staring at an empty page at 10 PM feels like homework.\n\nExploring this friction while building YourMoments led me to a much gentler loop — micro-journaling in under a minute:\n1. One curated daily question greets you right away (or switch to Free Thought).\n2. Type a few honest sentences — or dictate by voice while walking home.\n3. Click “Seal the day” — the ink softens, your companion opens a book, and the memory is locked into your calendar.\n\nEvery few sealed days, stars light up with a warm reflection on where you slowed down. You can try today’s question live at dailymoments.app.`,
            defaultHashtags: [
              '#microjournaling',
              '#dailyhabit',
              '#ideaexplorer',
              '#buildinpublic',
              '#yourmoments',
              '#eveningritual',
              '#mindfulproductivity',
              '#indiedev',
            ],
          },
        ];

    let generatedItems: {
      id: 'e2ee' | 'minimal_ui' | 'daily_habit';
      headline: string;
      visualQuote: string;
      caption: string;
      hashtags: string[];
    }[] = [];

    const ai = getGeminiClient();
    if (ai && Date.now() >= geminiQuotaBlockedUntil) {
      try {
        const promptLanguage = isPl ? 'Polish (polski)' : 'English';
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Generate a 3-part Instagram campaign for the "YourMoments" (dailymoments.app) app in ${promptLanguage}.${
            customNote ? ` Additional founder direction: ${String(customNote).slice(0, 400)}` : ''
          }
Each post must highlight one specific feature in this exact order:
1. id: "e2ee" — End-to-End Encryption (client-side AES-256 encryption in the browser before cloud sync, zero-knowledge privacy).
2. id: "minimal_ui" — Minimal Distraction-Free Interface (warm paper aesthetic, literary serif typography, quiet margin follow-up hints, pixel companion at the desk, instant PLG writing on the homepage without a login wall).
3. id: "daily_habit" — Daily Micro-Journaling Habit (one thoughtful daily prompt, voice dictation for evening walks, sealing the day in 60 seconds, warm appreciation stars after a few days).

Tone & Framing:
- Keep the tone authentic, reflective, and grounded, framing the author as an "idea explorer" sharing the project's progress and design discoveries in public.
- Avoid generic marketing hype or pushy sales language.`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    description: 'Feature identifier: e2ee, minimal_ui, or daily_habit',
                  },
                  headline: {
                    type: Type.STRING,
                    description: 'Short, punchy 1-sentence editorial headline for the 1080x1080 square visual (max 95 chars)',
                  },
                  visualQuote: {
                    type: Type.STRING,
                    description: 'Concise 1-2 sentence summary printed on the 1080x1080 square card (max 160 chars)',
                  },
                  caption: {
                    type: Type.STRING,
                    description: 'Full multi-paragraph Instagram caption written in first-person as an idea explorer sharing the project progress',
                  },
                  hashtags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: '6 to 8 relevant Instagram hashtags starting with #',
                  },
                },
                required: ['id', 'headline', 'visualQuote', 'caption', 'hashtags'],
              },
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '[]').trim());
        if (Array.isArray(parsed) && parsed.length === 3) {
          generatedItems = parsed;
        }
      } catch (err) {
        console.warn('[Campaign] Gemini generation fallback to curated Idea Explorer copy:', err);
      }
    }

    const mergedPosts = featureSpecs.map((spec, idx) => {
      const matched =
        generatedItems.find(item => item.id === spec.id) || generatedItems[idx] || null;
      return {
        id: spec.id,
        partLabel: spec.partLabel,
        featureTitle: spec.featureTitle,
        accentHex: spec.accentHex,
        headline:
          matched?.headline && typeof matched.headline === 'string' && matched.headline.trim()
            ? matched.headline.trim()
            : spec.defaultHeadline,
        visualQuote:
          matched?.visualQuote &&
          typeof matched.visualQuote === 'string' &&
          matched.visualQuote.trim()
            ? matched.visualQuote.trim()
            : spec.defaultVisualQuote,
        caption:
          matched?.caption && typeof matched.caption === 'string' && matched.caption.trim()
            ? matched.caption.trim()
            : spec.defaultCaption,
        hashtags:
          Array.isArray(matched?.hashtags) && matched.hashtags.length > 0
            ? matched.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`))
            : spec.defaultHashtags,
      };
    });

    const doopApiKey = (process.env.DOOP_API_KEY || '').trim();
    const doopEndpoint = (process.env.DOOP_API_URL || 'https://api.doop.ai/v1/images/generate').trim();

    const campaignResults = await Promise.all(
      mergedPosts.map(async post => {
        const doopPayload = {
          text: post.caption,
          headline: post.headline,
          subtext: post.visualQuote,
          feature: post.featureTitle,
          width: 1080,
          height: 1080,
          dimensions: '1080x1080',
          format: 'instagram_square',
        };

        let imageUrl = '';
        let imageSource: 'doop_api' | 'doop_svg_fallback' = 'doop_svg_fallback';
        let doopStatusMessage = '';

        try {
          const doopResponse = await axios.post(doopEndpoint, doopPayload, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${doopApiKey}`,
              'x-api-key': doopApiKey,
            },
            timeout: 10000,
          });

          const data = doopResponse.data;
          const returnedAsset =
            data?.imageUrl ||
            data?.image_url ||
            data?.url ||
            data?.image ||
            data?.assetUrl ||
            data?.data?.[0]?.url ||
            data?.data?.url;

          if (typeof returnedAsset === 'string' && returnedAsset.trim()) {
            imageUrl = returnedAsset.trim();
            imageSource = 'doop_api';
            doopStatusMessage = 'Rendered via Doop API (1080×1080)';
          } else {
            doopStatusMessage = 'Doop API responded without image URL — using local 1080×1080 square render';
          }
        } catch (doopErr: any) {
          const status = doopErr?.response?.status;
          const reason = status
            ? `HTTP ${status}`
            : doopErr?.code || doopErr?.message || 'unreachable';
          doopStatusMessage = doopApiKey
            ? `Doop API request sent (${reason}) — rendered 1080×1080 square asset from payload`
            : 'DOOP_API_KEY not set in environment — rendered 1080×1080 square asset from payload';
        }

        if (!imageUrl) {
          imageUrl = buildDoopFallbackSvgDataUri(
            post.partLabel,
            post.featureTitle,
            post.headline,
            post.visualQuote,
            post.accentHex,
            post.id
          );
        }

        return {
          ...post,
          imageUrl,
          imageSource,
          doopStatusMessage,
          dimensions: '1080x1080',
        };
      })
    );

    return res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      doopKeyConfigured: Boolean(doopApiKey),
      posts: campaignResults,
    });
  } catch (err: any) {
    console.error('[Campaign] Unexpected error in /api/admin/campaign/generate:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Internal campaign generator error',
    });
  }
});

// Helper to build 1080x1080 (Post) or 1080x1920 (Story) editorial visual card SVG
function buildEditorialCardSvgDataUri(
  partNumber: string,
  badge: string,
  headline: string,
  quoteSnippet: string,
  accentHex: string,
  format: 'post' | 'story',
  styleTag: string = 'Nano Banana Editorial'
): string {
  const isStory = format === 'story';
  const width = 1080;
  const height = isStory ? 1920 : 1080;
  const safeBadge = escapeHtml(badge.toUpperCase());
  const safeHeadline = escapeHtml(headline);
  const safeSnippet = escapeHtml(quoteSnippet);
  const safeStyleTag = escapeHtml(styleTag);

  const wrapLines = (text: string, maxChars: number, maxLines: number): string[] => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length <= maxChars) {
        current = (current + ' ' + word).trim();
      } else {
        if (current) lines.push(current);
        current = word;
        if (lines.length >= maxLines - 1) break;
      }
    }
    const consumedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
    const remainder = words.slice(consumedWords).join(' ');
    if (remainder) {
      lines.push(
        remainder.length > maxChars + 8 ? remainder.slice(0, maxChars + 5) + '…' : remainder
      );
    }
    return lines.slice(0, maxLines);
  };

  const headlineLines = wrapLines(safeHeadline, isStory ? 22 : 25, isStory ? 5 : 3);
  const snippetLines = wrapLines(safeSnippet, isStory ? 36 : 42, isStory ? 6 : 4);

  const topBarY = isStory ? 180 : 114;
  const headlineStartY = isStory ? 520 : 310;
  const headlineLineHeight = isStory ? 76 : 68;
  const headlineTspans = headlineLines
    .map((line, idx) => `<tspan x="96" dy="${idx === 0 ? 0 : headlineLineHeight}">${line}</tspan>`)
    .join('');

  const snippetStartY = headlineStartY + headlineLines.length * headlineLineHeight + (isStory ? 90 : 54);
  const snippetLineHeight = isStory ? 50 : 44;
  const snippetTspans = snippetLines
    .map((line, idx) => `<tspan x="128" dy="${idx === 0 ? 0 : snippetLineHeight}">${line}</tspan>`)
    .join('');

  const footerLineY = isStory ? 1660 : 880;
  const footerContentY = isStory ? 1700 : 912;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <radialGradient id="warmGlow" cx="75%" cy="22%" r="60%">
        <stop offset="0%" stop-color="${accentHex}" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="#FAF8F5" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="#F7F5F0"/>
    <rect x="44" y="44" width="${width - 88}" height="${height - 88}" rx="40" fill="#FAF8F5" stroke="#E5DFD3" stroke-width="3"/>
    <rect x="44" y="44" width="${width - 88}" height="${height - 88}" rx="40" fill="url(#warmGlow)"/>

    <!-- Top Badge -->
    <rect x="96" y="${topBarY}" width="460" height="50" rx="25" fill="#F2EFE8" stroke="#DDD6C8" stroke-width="2"/>
    <circle cx="126" cy="${topBarY + 25}" r="8" fill="${accentHex}"/>
    <text x="148" y="${topBarY + 31}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18" font-weight="600" fill="#524D46" letter-spacing="1.5">${escapeHtml(partNumber)} · ${safeBadge.slice(0, 26)}</text>

    <!-- Minimal Editorial Illustration Accent -->
    <g transform="translate(820, ${topBarY - 12})">
      <rect x="0" y="0" width="164" height="164" rx="36" fill="#F2EFE8" stroke="#1C1A18" stroke-width="3"/>
      <circle cx="82" cy="68" r="26" fill="${accentHex}" opacity="0.22"/>
      <rect x="38" y="44" width="88" height="76" rx="12" fill="#FAF8F5" stroke="#1C1A18" stroke-width="3.5"/>
      <line x1="54" y1="66" x2="110" y2="66" stroke="#1C1A18" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="54" y1="84" x2="98" y2="84" stroke="${accentHex}" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="54" y1="102" x2="82" y2="102" stroke="#7A756D" stroke-width="3.5" stroke-linecap="round"/>
    </g>

    <!-- Main Editorial Headline -->
    <text x="96" y="${headlineStartY}" font-family="Georgia, 'Times New Roman', serif" font-size="${isStory ? 60 : 54}" font-weight="500" fill="#1C1A18">${headlineTspans}</text>

    <!-- Quote Callout -->
    <rect x="96" y="${snippetStartY - 46}" width="7" height="${snippetLines.length * snippetLineHeight + 38}" rx="3.5" fill="${accentHex}"/>
    <text x="128" y="${snippetStartY}" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="${isStory ? 35 : 31}" fill="#524D46">${snippetTspans}</text>

    ${
      isStory
        ? `<g transform="translate(96, 1340)">
            <rect x="0" y="0" width="888" height="220" rx="28" fill="#F2EFE8" stroke="#DDD6C8" stroke-width="2"/>
            <text x="48" y="68" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" font-weight="600" fill="${accentHex}" letter-spacing="1.5">IDEA EXPLORER NOTE · DAILYMOMENTS.APP</text>
            <text x="48" y="122" font-family="Georgia, 'Times New Roman', serif" font-size="30" fill="#1C1A18">Zapisz jedną myśl wieczorem — bez logowania na start,</text>
            <text x="48" y="166" font-family="Georgia, 'Times New Roman', serif" font-size="30" fill="#1C1A18">z pełnym szyfrowaniem End-to-End w przeglądarce.</text>
          </g>`
        : ''
    }

    <!-- Footer -->
    <line x1="96" y1="${footerLineY}" x2="984" y2="${footerLineY}" stroke="#E5DFD3" stroke-width="2"/>
    <g transform="translate(96, ${footerContentY})">
      <rect x="0" y="0" width="58" height="58" rx="14" fill="#F2EFE8" stroke="#1C1A18" stroke-width="2.5"/>
      <polygon points="14,24 20,10 28,22" fill="#C96839" stroke="#1C1A18" stroke-width="2"/>
      <polygon points="44,24 38,10 30,22" fill="#C96839" stroke="#1C1A18" stroke-width="2"/>
      <rect x="14" y="20" width="30" height="22" rx="4" fill="#C96839" stroke="#1C1A18" stroke-width="2"/>
      <circle cx="23" cy="29" r="2.2" fill="#1C1A18"/>
      <circle cx="35" cy="29" r="2.2" fill="#1C1A18"/>
      <rect x="12" y="42" width="34" height="7" rx="2" fill="#33302B"/>
    </g>
    <text x="174" y="${footerContentY + 24}" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="600" fill="#1C1A18">YourMoments · Idea Explorer</text>
    <text x="174" y="${footerContentY + 54}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="19" fill="#7A756D">${safeStyleTag} · ${width}×${height}</text>

    <rect x="756" y="${footerContentY + 2}" width="228" height="54" rx="14" fill="${accentHex}"/>
    <text x="870" y="${footerContentY + 36}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" font-weight="600" fill="#FAF8F5">dailymoments.app</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
}

// STEP 2 ENDPOINT: Refine user's raw idea into 3 distinct Instagram proposals (Post 1:1 or Story 9:16)
app.post('/api/admin/campaign/refine', async (req, res) => {
  try {
    const { rawIdea = '', format = 'post', lang = 'pl' } = req.body || {};
    const cleanIdea = String(rawIdea || '').trim();
    if (!cleanIdea) {
      return res.status(400).json({ ok: false, error: 'Raw idea text is required' });
    }

    const igFormat: 'post' | 'story' = format === 'story' ? 'story' : 'post';
    const isPl = lang === 'pl';
    const aspectLabel = igFormat === 'story' ? '9:16 vertical (1080x1920) Instagram Story' : '1:1 square (1080x1080) Instagram Post';

    const accentPalette = ['#C96839', '#2E6F40', '#8B2635'];

    // Fallback proposals in case Gemini is temporarily unavailable
    const fallbackProposals = isPl
      ? [
          {
            id: 'prop_story',
            angleBadge: '01 · HISTORIA ODKRYWCY (IDEA EXPLORER)',
            angleRationale:
              'Rozwinięcie Twojej surowej myśli w osobistą historię z procesu budowania YourMoments (build-in-public), budującą autentyczną więź.',
            headline: cleanIdea.length <= 88 ? cleanIdea : `${cleanIdea.slice(0, 82)}…`,
            visualQuote:
              'Najlepsze narzędzia powstają wtedy, gdy sam próbujesz rozwiązać własny wieczorny chaos w głowie — jedną spokojną kartką papieru.',
            caption:
              igFormat === 'story'
                ? `[Klatka 1 — Hook na górze]\nZłapałem się dziś na jednej myśli podczas rozwijania YourMoments:\n„${cleanIdea}”\n\n[Klatka 2 — Odkrycie]\nJako idea explorer testuję różne podejścia do wieczornego spokoju. Zamiast budować kolejny przeładowany dashboard, postawiłem na jedną ciepłą kartkę papieru i szyfrowanie End-to-End w przeglądarce.\n\n[Klatka 3 — Naklejka Link / CTA]\nZapisz dziś wieczorem chociaż 2 zdania dla siebie na dailymoments.app (bez logowania na start).`
                : `Złapałem się dziś na jednej myśli, którą od razu zapisałem w notatniku przy budowie YourMoments (dailymoments.app):\n\n„${cleanIdea}”\n\nJako odkrywca pomysłów (idea explorer) dzielący się postępami tego projektu na żywo, coraz wyraźniej widzę, że nie potrzebujemy kolejnej głośnej aplikacji z wykresami produktywności. Potrzebujemy cichego miejsca, które przypomina ciepłą kartkę papieru, zadaje jedno mądre pytanie wieczorem i szyfruje słowa kluczem AES-256 zanim opuszczą przeglądarkę.\n\nJak wygląda Wasz wieczorny rytuał zamykania dnia? Sprawdźcie dzisiejsze pytanie na dailymoments.app.`,
            hashtags: [
              '#ideaexplorer',
              '#buildinpublic',
              '#yourmoments',
              '#dailymoments',
              '#calmtech',
              '#wieczornyrytual',
              '#mikrodziennik',
            ],
            nanoBananaPrompt: `Minimalist warm editorial illustration on archival cream paper (#FAF8F5), burnt sienna (#C96839) and deep charcoal ink lines, depicting a quiet evening writing desk with a classic typewriter, a small pixel-art fox companion, and subtle glowing stars, inspired by "${cleanIdea.slice(0, 120)}", calm literary magazine aesthetic, ${igFormat === 'story' ? 'vertical 9:16 composition' : 'square 1:1 composition'}, no cluttered text`,
            accentHex: accentPalette[0],
          },
          {
            id: 'prop_contrast',
            angleBadge: '02 · KONTRAST: SPOKÓJ VS. SZUM',
            angleRationale:
              'Przekształcenie Twojego pomysłu w mocny kontrast między przebodźcowanymi aplikacjami a spokojną architekturą prywatności E2EE.',
            headline: 'Mniej cyfrowego hałasu. Jedno pytanie i myśli, które należą wyłącznie do Ciebie.',
            visualQuote: `Wokół idei: „${cleanIdea.slice(0, 110)}” — zero feedów, zero oceniania, pełne szyfrowanie w Twojej przeglądarce.`,
            caption:
              igFormat === 'story'
                ? `[Klatka 1 — Kontrast]\nTypowe aplikacje: powiadomienia, serie, presja i Twoje myśli w otwartym tekście na serwerze.\nYourMoments: jedna kartka papieru i cisza.\n\n[Klatka 2 — Kontekst]\nWyszliśmy od prostej obserwacji: ${cleanIdea}\n\n[Klatka 3 — CTA]\nPrzetestuj pisanie na żywo na stronie głównej dailymoments.app.`
                : `Większość narzędzi, które mają pomagać nam uporządkować głowę, robi dokładnie odwrotnie — dokłada kolejne powiadomienia, paski postępu i przechowuje nasze prywatne zapiski otwartym tekstem.\n\nEksplorując ten temat przy budowie YourMoments, wyszedłem od prostej myśli:\n${cleanIdea}\n\nDlatego w YourMoments:\n• Nie ma ściany logowania na wejściu — strona główna to od razu Twoje biurko\n• Na marginesie pojawia się tylko jedno ciche pytanie pomocnicze\n• Cały tekst jest szyfrowany lokalnie (AES-256 E2EE) zanim trafi do chmury\n\nSprawdź, jak pisze się na spokojnym papierze: dailymoments.app.`,
            hashtags: [
              '#digitalminimalism',
              '#privacyfirst',
              '#e2ee',
              '#ideaexplorer',
              '#yourmoments',
              '#dailymoments',
              '#spokojnaglowa',
            ],
            nanoBananaPrompt: `Artistic editorial illustration in warm paper tones (#F7F5F0), forest green (#2E6F40) and terracotta accents, showing a serene open journal and a brass padlock dissolving into gentle paper leaves, symbolizing digital silence and end-to-end encrypted thoughts about "${cleanIdea.slice(0, 120)}", New Yorker editorial spot illustration style`,
            accentHex: accentPalette[1],
          },
          {
            id: 'prop_ritual',
            angleBadge: '03 · MIKRO-RYTUAŁ 60 SEKUND',
            angleRationale:
              'Przekucie Twojej myśli w natychmiastowy, 60-sekundowy wieczorny mikro-nawyk, który odbiorca może wypróbować od razu.',
            headline: '60 sekund wieczorem wystarczy, żeby nie zgubić tego, co było dziś naprawdę ważne.',
            visualQuote:
              'Napisz 3 zdania na klawiaturze albo podyktuj głosem podczas wieczornego spaceru — i zamknij dzień.',
            caption:
              igFormat === 'story'
                ? `[Klatka 1 — Mikro-Rytuał]\nNie potrzebujesz godziny na pisanie dziennika.\n\n[Klatka 2 — Jak to działa]\n${cleanIdea}\n1. Otwierasz dailymoments.app\n2. Odpowiadasz jednym zdaniem (albo dyktujesz głosem)\n3. Klikasz „Zamknij dzień”\n\n[Klatka 3 — Link Sticker]\nTwoje dzisiejsze pytanie już czeka na dailymoments.app`
                : `Każdy wieczór składa się z dziesiątek drobnych chwil, które następnego ranka kompletnie znikają z pamięci, jeśli ich nie nazwiemy.\n\nRozwijając YourMoments, zapisałem sobie myśl przewodnią:\n„${cleanIdea}”\n\nZamiast zmuszać się do długich wypracowań, spróbuj dziś wieczorem 60-sekundowego rytuału:\n1. Wejdź na dailymoments.app i przeczytaj dzisiejsze pytanie.\n2. Napisz 2–3 szczere zdania (lub kliknij „Dyktuj” podczas spaceru).\n3. Zamknij dzień i pozwól, by po kilku dniach w kalendarzu zapaliły się gwiazdki z podsumowaniem.\n\nDaj znać, jakie pytanie wylosowałeś dzisiaj!`,
            hashtags: [
              '#microjournaling',
              '#eveningritual',
              '#dailyhabit',
              '#ideaexplorer',
              '#yourmoments',
              '#dailymoments',
              '#uważność',
            ],
            nanoBananaPrompt: `Cozy minimalist editorial illustration on warm textured paper (#FAF8F5), burgundy (#8B2635) and warm amber ink, a peaceful night window with a crescent moon, a warm cup of tea next to a typewriter and a tiny fox reading a book, evoking a 60-second evening journaling ritual inspired by "${cleanIdea.slice(0, 120)}"`,
            accentHex: accentPalette[2],
          },
        ]
      : [
          {
            id: 'prop_story',
            angleBadge: '01 · IDEA EXPLORER STORY',
            angleRationale:
              'Refines your raw note into an authentic first-person build-in-public story sharing how this insight shaped YourMoments.',
            headline: cleanIdea.length <= 88 ? cleanIdea : `${cleanIdea.slice(0, 82)}…`,
            visualQuote:
              'The best calm tools start when you try solving your own racing evening thoughts with a single quiet sheet of paper.',
            caption:
              igFormat === 'story'
                ? `[Frame 1 — Story Hook]\nA raw note from my build log today:\n"${cleanIdea}"\n\n[Frame 2 — The Discovery]\nAs an idea explorer building YourMoments in public, I realized we don't need louder productivity dashboards — we need warm paper, one thoughtful question, and true client-side encryption.\n\n[Frame 3 — Link Sticker]\nTry writing 2 sentences tonight at dailymoments.app.`
                : `A raw note I jotted down while iterating on YourMoments (dailymoments.app) today:\n\n"${cleanIdea}"\n\nAs an idea explorer sharing this project's progress in public, I keep coming back to how differently our minds work when we remove digital clutter. When the screen feels like a warm sheet of archival paper — and you know every word is encrypted with AES-256 inside your browser before it ever leaves your device — you write with complete honesty.\n\nHow do you unwind your head at the end of the day? Try tonight's question live at dailymoments.app.`,
            hashtags: [
              '#ideaexplorer',
              '#buildinpublic',
              '#yourmoments',
              '#dailymoments',
              '#calmtech',
              '#mindfuljournaling',
              '#indiehacker',
            ],
            nanoBananaPrompt: `Minimalist warm editorial illustration on archival cream paper (#FAF8F5), burnt sienna (#C96839) and deep charcoal ink lines, depicting a quiet evening writing desk with a classic typewriter, a small pixel-art fox companion, and subtle glowing stars, inspired by "${cleanIdea.slice(0, 120)}", calm literary magazine aesthetic, ${igFormat === 'story' ? 'vertical 9:16 composition' : 'square 1:1 composition'}, no cluttered text`,
            accentHex: accentPalette[0],
          },
          {
            id: 'prop_contrast',
            angleBadge: '02 · CALM TECH VS. DIGITAL NOISE',
            angleRationale:
              'Turns your raw idea into a sharp philosophical contrast between noisy apps and YourMoments’ distraction-free, zero-knowledge design.',
            headline: 'Less digital noise. One quiet question and thoughts that belong strictly to you.',
            visualQuote: `Built around a simple conviction: "${cleanIdea.slice(0, 110)}" — zero feeds, client-side AES-256 encryption.`,
            caption:
              igFormat === 'story'
                ? `[Frame 1 — The Contrast]\nMost apps: feeds, popups, plaintext cloud storage.\nYourMoments: warm paper, one question, zero-knowledge encryption.\n\n[Frame 2 — Why we built it]\n${cleanIdea}\n\n[Frame 3 — CTA]\nStart typing right on the homepage at dailymoments.app.`
                : `Most apps designed to help us reflect accidentally recreate the exact digital noise we're trying to escape.\n\nWhile exploring this idea for YourMoments, I focused on one core thought:\n${cleanIdea}\n\nThat's why YourMoments works differently:\n• No login wall on arrival — the homepage is your live writing desk\n• A single quiet follow-up hint in the margin\n• Client-side AES-256 End-to-End Encryption before anything syncs\n\nTest the live desk at dailymoments.app.`,
            hashtags: [
              '#digitalminimalism',
              '#privacyfirst',
              '#endtoendencryption',
              '#ideaexplorer',
              '#yourmoments',
              '#dailymoments',
              '#productdesign',
            ],
            nanoBananaPrompt: `Artistic editorial illustration in warm paper tones (#F7F5F0), forest green (#2E6F40) and terracotta accents, showing a serene open journal and a brass padlock dissolving into gentle paper leaves, symbolizing digital silence and end-to-end encrypted thoughts about "${cleanIdea.slice(0, 120)}", New Yorker editorial spot illustration style`,
            accentHex: accentPalette[1],
          },
          {
            id: 'prop_ritual',
            angleBadge: '03 · 60-SECOND EVENING RITUAL',
            angleRationale:
              'Translates your idea into a concrete, low-friction 60-second evening ritual that followers can try tonight.',
            headline: '60 seconds at night is enough to keep the moment that made today worth living.',
            visualQuote:
              'Type three honest lines or dictate by voice on an evening walk — then seal the day.',
            caption:
              igFormat === 'story'
                ? `[Frame 1 — The 60s Ritual]\nStaring at a blank page at 10 PM feels like homework.\n\n[Frame 2 — The Micro-Habit]\n${cleanIdea}\n1. Read today's question\n2. Type or voice-dictate 3 lines\n3. Seal the day into your encrypted calendar\n\n[Frame 3 — Link Sticker]\nTry tonight's prompt at dailymoments.app`
                : `Staring at an empty notebook page at 10 PM feels like homework — which is why most of us quit journaling after a week.\n\nWhile exploring a gentler approach for YourMoments, this thought guided the design:\n"${cleanIdea}"\n\nInstead of writing pages, try a 60-second evening ritual:\n1. Open dailymoments.app to see one curated daily question.\n2. Type three sentences — or tap Dictate while walking home.\n3. Seal the day and watch warm appreciation stars light up in your calendar every few days.\n\nTry tonight's question at dailymoments.app.`,
            hashtags: [
              '#microjournaling',
              '#eveningritual',
              '#dailyhabit',
              '#ideaexplorer',
              '#yourmoments',
              '#dailymoments',
              '#mindfulness',
            ],
            nanoBananaPrompt: `Cozy minimalist editorial illustration on warm textured paper (#FAF8F5), burgundy (#8B2635) and warm amber ink, a peaceful night window with a crescent moon, a warm cup of tea next to a typewriter and a tiny fox reading a book, evoking a 60-second evening journaling ritual inspired by "${cleanIdea.slice(0, 120)}"`,
            accentHex: accentPalette[2],
          },
        ];

    let aiProposals: any[] = [];
    const ai = getGeminiClient();

    if (ai && Date.now() >= geminiQuotaBlockedUntil) {
      try {
        const promptLanguage = isPl ? 'Polish (polski)' : 'English';
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `You are the creative partner for the founder of "YourMoments" (dailymoments.app) — a calm, distraction-free daily micro-journaling web & mobile app with client-side AES-256 End-to-End Encryption, warm archival paper aesthetics, a quiet left-margin follow-up question, voice dictation, and a pixel companion at the desk.

The founder just typed this raw idea / note into the campaign studio:
"""
${cleanIdea}
"""

Target Instagram Format: ${aspectLabel}
Output Language: ${promptLanguage}

Refine this raw idea into 3 distinct, compelling Instagram proposals in ${promptLanguage}, framing the founder as an authentic "idea explorer" sharing discoveries and progress in public:
1. Proposal 1 (id: "prop_story"): Personal "Idea Explorer" Story & Discovery angle.
2. Proposal 2 (id: "prop_contrast"): Calm Tech & Privacy vs. Digital Noise contrast angle.
3. Proposal 3 (id: "prop_ritual"): Actionable 60-Second Evening Micro-Ritual hook.

${
  igFormat === 'story'
    ? 'Because the target format is Instagram Stories (9:16), structure each "caption" as a clear 3-frame Story script ([Frame 1], [Frame 2], [Frame 3 + Link Sticker]) ready to post or overlay.'
    : 'Because the target format is an Instagram Post (1:1), write a multi-paragraph, engaging, authentic Instagram caption.'
}

For each proposal, also craft a specific "nanoBananaPrompt" in English for Google Nano Banana (gemini-2.5-flash-image) to generate an artistic, warm archival paper (#FAF8F5) editorial illustration matching the proposal's metaphor (${igFormat === 'story' ? 'vertical 9:16 composition' : 'square 1:1 composition'}, warm ink, typewriter/fox/journal motifs, no complex text inside the image).`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  angleBadge: {
                    type: Type.STRING,
                    description: 'Short uppercase badge naming the angle, e.g. 01 · HISTORIA ODKRYWCY',
                  },
                  angleRationale: {
                    type: Type.STRING,
                    description: '1-2 sentences explaining how this proposal refined the raw idea (jak do tego doszliśmy)',
                  },
                  headline: {
                    type: Type.STRING,
                    description: 'Punchy 1-sentence editorial headline for the visual card (max 90 chars)',
                  },
                  visualQuote: {
                    type: Type.STRING,
                    description: 'Supporting 1-2 sentence quote/subtext printed on the card (max 150 chars)',
                  },
                  caption: {
                    type: Type.STRING,
                    description: 'Full Instagram caption or 3-frame Story script',
                  },
                  hashtags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  nanoBananaPrompt: {
                    type: Type.STRING,
                    description: 'Detailed prompt in English for Google Nano Banana image generation',
                  },
                },
                required: [
                  'id',
                  'angleBadge',
                  'angleRationale',
                  'headline',
                  'visualQuote',
                  'caption',
                  'hashtags',
                  'nanoBananaPrompt',
                ],
              },
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '[]').trim());
        if (Array.isArray(parsed) && parsed.length > 0) {
          aiProposals = parsed.slice(0, 3);
        }
      } catch (err) {
        console.warn('[Campaign Refine] Gemini fallback used:', err);
      }
    }

    const finalProposals = fallbackProposals.map((fb, idx) => {
      const candidate = aiProposals[idx] || null;
      const accentHex = accentPalette[idx % accentPalette.length];
      const headline =
        candidate?.headline && typeof candidate.headline === 'string' && candidate.headline.trim()
          ? candidate.headline.trim()
          : fb.headline;
      const visualQuote =
        candidate?.visualQuote && typeof candidate.visualQuote === 'string' && candidate.visualQuote.trim()
          ? candidate.visualQuote.trim()
          : fb.visualQuote;
      const angleBadge =
        candidate?.angleBadge && typeof candidate.angleBadge === 'string' && candidate.angleBadge.trim()
          ? candidate.angleBadge.trim()
          : fb.angleBadge;

      return {
        id: `proposal_${idx + 1}`,
        angleBadge,
        angleRationale:
          candidate?.angleRationale &&
          typeof candidate.angleRationale === 'string' &&
          candidate.angleRationale.trim()
            ? candidate.angleRationale.trim()
            : fb.angleRationale,
        headline,
        visualQuote,
        caption:
          candidate?.caption && typeof candidate.caption === 'string' && candidate.caption.trim()
            ? candidate.caption.trim()
            : fb.caption,
        hashtags:
          Array.isArray(candidate?.hashtags) && candidate.hashtags.length > 0
            ? candidate.hashtags
                .filter((h: unknown): h is string => typeof h === 'string' && h.trim().length > 0)
                .map((h: string) => (h.trim().startsWith('#') ? h.trim() : `#${h.trim()}`))
                .slice(0, 10)
            : fb.hashtags,
        nanoBananaPrompt:
          candidate?.nanoBananaPrompt &&
          typeof candidate.nanoBananaPrompt === 'string' &&
          candidate.nanoBananaPrompt.trim()
            ? candidate.nanoBananaPrompt.trim()
            : fb.nanoBananaPrompt,
        accentHex,
        format: igFormat,
        initialCardPreviewUrl: buildEditorialCardSvgDataUri(
          `OPTION 0${idx + 1}`,
          angleBadge,
          headline,
          visualQuote,
          accentHex,
          igFormat,
          'Editorial Draft'
        ),
      };
    });

    return res.json({
      ok: true,
      rawIdea: cleanIdea,
      format: igFormat,
      lang: isPl ? 'pl' : 'en',
      refinedAt: new Date().toISOString(),
      proposals: finalProposals,
    });
  } catch (err: any) {
    console.error('[Campaign Refine] Error:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to refine idea into 3 proposals',
    });
  }
});

// STEP 3 ENDPOINT: Generate Google Nano Banana (gemini-2.5-flash-image) initial visual preview
app.post('/api/admin/campaign/nano-banana', async (req, res) => {
  try {
    const {
      prompt = '',
      format = 'post',
      headline = '',
      visualQuote = '',
      angleBadge = 'NANO BANANA PREVIEW',
      accentHex = '#C96839',
    } = req.body || {};

    const igFormat: 'post' | 'story' = format === 'story' ? 'story' : 'post';
    const aspectRatio = igFormat === 'story' ? '9:16' : '1:1';
    const cleanPrompt =
      String(prompt || '').trim() ||
      `Warm editorial illustration on archival cream paper (#FAF8F5), burnt sienna (#C96839) and charcoal ink lines, quiet evening desk with a typewriter and a small pixel fox companion, ${aspectRatio} aspect ratio`;

    let nanoBananaImageUrl = '';
    let modelUsed = 'svg-editorial-fallback';
    let statusMessage = '';

    const ai = getGeminiClient();
    if (ai) {
      const imageModels = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview'];
      for (const modelName of imageModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  text: `${cleanPrompt}. Style requirements: warm archival paper background (#FAF8F5), refined editorial illustration in the spirit of The New Yorker and Kinfolk, burnt sienna (#C96839) and deep ink (#1C1A18) palette, calm and contemplative mood.`,
                },
              ],
            },
            config: {
              imageConfig: {
                aspectRatio,
              },
            },
          });

          const parts = response.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
              const mimeType = part.inlineData.mimeType || 'image/png';
              nanoBananaImageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
              modelUsed = `${modelName} (Google Nano Banana)`;
              statusMessage = `Generated with ${modelName} (${aspectRatio})`;
              break;
            }
          }
          if (nanoBananaImageUrl) break;
        } catch (imgErr: any) {
          console.warn(`[NanoBanana] Model ${modelName} error:`, imgErr?.message || imgErr);
          statusMessage = `Nano Banana (${modelName}): ${String(imgErr?.message || 'unavailable').slice(0, 90)}`;
        }
      }
    } else {
      statusMessage = 'GEMINI_API_KEY not configured — using editorial vector preview';
    }

    if (!nanoBananaImageUrl) {
      nanoBananaImageUrl = buildEditorialCardSvgDataUri(
        'NANO BANANA',
        String(angleBadge || 'PREVIEW'),
        String(headline || cleanPrompt.slice(0, 75)),
        String(visualQuote || cleanPrompt.slice(0, 140)),
        String(accentHex || '#C96839'),
        igFormat,
        'Nano Banana Style Vector'
      );
      if (!statusMessage) {
        statusMessage = 'Rendered Nano Banana editorial vector preview';
      }
    }

    return res.json({
      ok: true,
      imageUrl: nanoBananaImageUrl,
      modelUsed,
      statusMessage,
      aspectRatio,
      format: igFormat,
      dimensions: igFormat === 'story' ? '1080x1920' : '1080x1080',
    });
  } catch (err: any) {
    console.error('[NanoBanana] Unexpected error:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to generate Nano Banana preview',
    });
  }
});

// STEP 5 ENDPOINT: Send approved proposal + Nano Banana style to Doop for more posts/stories & save project in Doop
app.post('/api/admin/campaign/doop-expand', async (req, res) => {
  try {
    const {
      rawIdea = '',
      format = 'post',
      lang = 'pl',
      proposal = {},
      nanoBananaPrompt = '',
      projectName = '',
    } = req.body || {};

    const igFormat: 'post' | 'story' = format === 'story' ? 'story' : 'post';
    const isPl = lang === 'pl';
    const width = 1080;
    const height = igFormat === 'story' ? 1920 : 1080;
    const dimensions = `${width}x${height}`;

    const baseHeadline = String(proposal?.headline || rawIdea || 'YourMoments').trim();
    const baseQuote = String(proposal?.visualQuote || '').trim();
    const baseCaption = String(proposal?.caption || '').trim();
    const baseBadge = String(proposal?.angleBadge || 'IDEA EXPLORER').trim();
    const baseAccent = String(proposal?.accentHex || '#C96839').trim();
    const baseHashtags: string[] = Array.isArray(proposal?.hashtags)
      ? proposal.hashtags
      : ['#yourmoments', '#dailymoments', '#ideaexplorer', '#buildinpublic'];
    const styleDirection =
      String(nanoBananaPrompt || proposal?.nanoBananaPrompt || '').trim() ||
      'Warm archival paper (#FAF8F5), minimalist New Yorker editorial illustration, burnt sienna & charcoal ink';

    const resolvedProjectName =
      String(projectName || '').trim() ||
      `YourMoments · ${baseHeadline.slice(0, 42)} (${igFormat.toUpperCase()})`;

    // Generate 3 follow-up variations in the chosen Nano Banana style
    let seriesVariations: {
      partLabel: string;
      variationTitle: string;
      headline: string;
      visualQuote: string;
      caption: string;
      hashtags: string[];
      stylePrompt: string;
    }[] = isPl
      ? [
          {
            partLabel: 'DOOP 01/03 · HOOK',
            variationTitle: 'Wersja 1: Główny Hook (W stylu Nano Banana)',
            headline: baseHeadline,
            visualQuote:
              baseQuote ||
              'Zatrzymaj najważniejszą myśl dnia na spokojnej kartce papieru — zaszyfrowanej w Twojej przeglądarce.',
            caption: baseCaption,
            hashtags: baseHashtags,
            stylePrompt: `${styleDirection} — Composition 01: Hero Hook card`,
          },
          {
            partLabel: 'DOOP 02/03 · KULISY',
            variationTitle: 'Wersja 2: Kulisy Odkrywcy (Deep Dive)',
            headline: `Jak doszliśmy do tego detalu w YourMoments? Zaczęło się od jednej obserwacji wieczorem.`,
            visualQuote: `„${String(rawIdea || baseHeadline).slice(0, 120)}” — mniej powiadomień, więcej ciszy i prywatność AES-256.`,
            caption: `Kontynuując wątek z poprzedniego posta — kiedy budujesz aplikację jako idea explorer, najciekawsze rozwiązania rodzą się z własnych wieczornych nawyków.\n\nZauważyłem, że: ${
              rawIdea || baseHeadline
            }\n\nDlatego w YourMoments (dailymoments.app) połączyliśmy ciepłą estetykę papieru, dyskretne pytanie pomocnicze na marginesie i pełne szyfrowanie End-to-End.\n\nSprawdźcie dzisiejsze pytanie na żywo bez zakładania konta.`,
            hashtags: baseHashtags,
            stylePrompt: `${styleDirection} — Composition 02: Behind-the-scenes detail view with typewriter and margin notes`,
          },
          {
            partLabel: 'DOOP 03/03 · RYTUAŁ',
            variationTitle: 'Wersja 3: Zaproszenie do wieczornego rytuału (CTA)',
            headline: 'Zanim odłożysz telefon przed snem — zamknij dzień w trzech szczerych zdaniach.',
            visualQuote:
              'Wpisz na klawiaturze lub podyktuj głosem na spacerze. Twoje słowa należą wyłącznie do Ciebie.',
            caption: `Mały wieczorny eksperyment na dziś:\n\nZamiast scrollować kolejne feedy przed snem, otwórz dailymoments.app i odpowiedz na jedno dzisiejsze pytanie.\n\nNawet 2–3 zdania wystarczą, żeby zamknąć dzień, rozjaśnić atrament i zachować spokój w głowie. Po kilku dniach w Twoim kalendarzu pojawią się też gwiazdki z ciepłym podsumowaniem.`,
            hashtags: baseHashtags,
            stylePrompt: `${styleDirection} — Composition 03: Evening ritual closing scene with glowing calendar stars`,
          },
        ]
      : [
          {
            partLabel: 'DOOP 01/03 · HOOK',
            variationTitle: 'Variation 1: Primary Hook (Nano Banana Style)',
            headline: baseHeadline,
            visualQuote:
              baseQuote ||
              'Capture the moment that mattered tonight on a quiet sheet of encrypted archival paper.',
            caption: baseCaption,
            hashtags: baseHashtags,
            stylePrompt: `${styleDirection} — Composition 01: Hero Hook card`,
          },
          {
            partLabel: 'DOOP 02/03 · INSIGHT',
            variationTitle: 'Variation 2: Idea Explorer Deep-Dive',
            headline: 'How a tiny observation turned into a calmer way to close the day.',
            visualQuote: `"${String(rawIdea || baseHeadline).slice(0, 120)}" — zero feeds, warm paper, and client-side AES-256 encryption.`,
            caption: `Following up on this thought from my YourMoments build log:\n\n"${
              rawIdea || baseHeadline
            }"\n\nWhen you strip away streaks pressure, public feeds, and login walls, reflection stops feeling like a chore. Everything you write on dailymoments.app is encrypted inside your browser before it ever touches the cloud.`,
            hashtags: baseHashtags,
            stylePrompt: `${styleDirection} — Composition 02: Behind-the-scenes detail view with typewriter and margin notes`,
          },
          {
            partLabel: 'DOOP 03/03 · RITUAL CTA',
            variationTitle: 'Variation 3: 60-Second Evening Ritual Callout',
            headline: 'Before you put your phone down tonight — seal the day in three honest sentences.',
            visualQuote:
              'Type at your desk or dictate by voice on an evening walk. Your words stay strictly yours.',
            caption: `A small evening experiment for tonight:\n\nInstead of one more scroll before sleep, open dailymoments.app and answer today's single question.\n\nThree honest lines are enough to seal the day and clear your head.`,
            hashtags: baseHashtags,
            stylePrompt: `${styleDirection} — Composition 03: Evening ritual closing scene with glowing calendar stars`,
          },
        ];

    const ai = getGeminiClient();
    if (ai && Date.now() >= geminiQuotaBlockedUntil) {
      try {
        const promptLanguage = isPl ? 'Polish (polski)' : 'English';
        const aiResp = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Expand this approved Instagram campaign concept for "YourMoments" (dailymoments.app) into a cohesive 3-post series in ${promptLanguage} that follows the exact Nano Banana visual style and Idea Explorer voice.
Raw founder idea: "${rawIdea}"
Approved Angle: "${baseBadge}"
Approved Headline: "${baseHeadline}"
Approved Quote: "${baseQuote}"
Nano Banana Visual Style Prompt: "${styleDirection}"
Format: ${igFormat === 'story' ? 'Instagram Stories (9:16, 1080x1920)' : 'Instagram Posts (1:1, 1080x1080)'}

Create 3 distinct posts/slides in this exact style:
1. Post 1 (DOOP 01/03 · HOOK): The refined primary hook.
2. Post 2 (DOOP 02/03 · DEEP DIVE): Deeper "idea explorer" insight showing how we arrived at this feature/feeling.
3. Post 3 (DOOP 03/03 · RITUAL CTA): Concrete 60-second evening ritual invitation to dailymoments.app.`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  partLabel: { type: Type.STRING },
                  variationTitle: { type: Type.STRING },
                  headline: { type: Type.STRING },
                  visualQuote: { type: Type.STRING },
                  caption: { type: Type.STRING },
                  hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  stylePrompt: { type: Type.STRING },
                },
                required: [
                  'partLabel',
                  'variationTitle',
                  'headline',
                  'visualQuote',
                  'caption',
                  'hashtags',
                  'stylePrompt',
                ],
              },
            },
          },
        });
        const parsed = JSON.parse((aiResp.text ?? '[]').trim());
        if (Array.isArray(parsed) && parsed.length === 3) {
          seriesVariations = parsed;
        }
      } catch (err) {
        console.warn('[DoopExpand] Using curated 3-variation expansion:', err);
      }
    }

    const doopApiKey = (process.env.DOOP_API_KEY || '').trim();
    const doopEndpoint = (process.env.DOOP_API_URL || 'https://api.doop.ai/v1/images/generate').trim();
    const fallbackProjectId = `doop_proj_${crypto.randomBytes(6).toString('hex')}`;
    let detectedProjectId = '';
    let detectedProjectUrl = '';

    const accentSwatches = [baseAccent, '#2E6F40', '#8B2635'];

    const doopPosts = await Promise.all(
      seriesVariations.map(async (item, idx) => {
        const itemAccent = accentSwatches[idx % accentSwatches.length];
        const doopPayload = {
          text: item.caption,
          headline: item.headline,
          subtext: item.visualQuote,
          prompt: item.stylePrompt || styleDirection,
          stylePrompt: styleDirection,
          style: 'nano_banana_editorial',
          format: igFormat === 'story' ? 'instagram_story' : 'instagram_post',
          aspectRatio: igFormat === 'story' ? '9:16' : '1:1',
          width,
          height,
          dimensions,
          // Project saving flags for Doop so the project is persisted and editable in Doop
          saveProject: true,
          create_project: true,
          persist_project: true,
          projectName: resolvedProjectName,
          project_name: resolvedProjectName,
          metadata: {
            app: 'YourMoments (dailymoments.app)',
            rawIdea,
            angleBadge: baseBadge,
            nanoBananaPrompt: styleDirection,
            slideIndex: idx + 1,
          },
        };

        let imageUrl = '';
        let imageSource: 'doop_api' | 'doop_svg_fallback' = 'doop_svg_fallback';
        let doopStatusMessage = '';
        let itemProjectId = '';
        let itemProjectUrl = '';

        try {
          const doopResponse = await axios.post(doopEndpoint, doopPayload, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${doopApiKey}`,
              'x-api-key': doopApiKey,
            },
            timeout: 12000,
          });

          const data = doopResponse.data;
          const returnedAsset =
            data?.imageUrl ||
            data?.image_url ||
            data?.url ||
            data?.image ||
            data?.assetUrl ||
            data?.data?.[0]?.url ||
            data?.data?.url;

          itemProjectId =
            data?.projectId ||
            data?.project_id ||
            data?.project?.id ||
            data?.data?.projectId ||
            data?.id ||
            '';
          itemProjectUrl =
            data?.projectUrl ||
            data?.project_url ||
            data?.editUrl ||
            data?.edit_url ||
            data?.project?.url ||
            data?.project?.editUrl ||
            '';

          if (itemProjectId && !detectedProjectId) {
            detectedProjectId = String(itemProjectId);
          }
          if (itemProjectUrl && !detectedProjectUrl) {
            detectedProjectUrl = String(itemProjectUrl);
          }

          if (typeof returnedAsset === 'string' && returnedAsset.trim()) {
            imageUrl = returnedAsset.trim();
            imageSource = 'doop_api';
            doopStatusMessage = `Rendered & saved in Doop (${dimensions})`;
          } else {
            doopStatusMessage = `Sent to Doop project "${resolvedProjectName}" (${dimensions})`;
          }
        } catch (doopErr: any) {
          const status = doopErr?.response?.status;
          const reason = status
            ? `HTTP ${status}`
            : doopErr?.code || doopErr?.message || 'unreachable';
          doopStatusMessage = doopApiKey
            ? `Doop project payload dispatched (${reason}) · ${dimensions} Nano Banana style`
            : `DOOP_API_KEY not set — rendered ${dimensions} Nano Banana style card locally`;
        }

        if (!imageUrl) {
          imageUrl = buildEditorialCardSvgDataUri(
            item.partLabel || `DOOP 0${idx + 1}/03`,
            item.variationTitle || baseBadge,
            item.headline,
            item.visualQuote,
            itemAccent,
            igFormat,
            'Doop × Nano Banana'
          );
        }

        return {
          id: `doop_var_${idx + 1}`,
          partLabel: item.partLabel || `DOOP 0${idx + 1}/03`,
          featureTitle: item.variationTitle || baseBadge,
          accentHex: itemAccent,
          headline: item.headline,
          visualQuote: item.visualQuote,
          caption: item.caption,
          hashtags: Array.isArray(item.hashtags)
            ? item.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`))
            : baseHashtags,
          stylePrompt: item.stylePrompt || styleDirection,
          imageUrl,
          imageSource,
          doopStatusMessage,
          dimensions,
          format: igFormat,
          doopProjectId: itemProjectId || detectedProjectId || fallbackProjectId,
        };
      })
    );

    const finalProjectId = detectedProjectId || fallbackProjectId;
    const finalProjectUrl =
      detectedProjectUrl ||
      `https://app.doop.ai/projects/${encodeURIComponent(finalProjectId)}`;

    return res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      doopKeyConfigured: Boolean(doopApiKey),
      projectName: resolvedProjectName,
      doopProjectId: finalProjectId,
      doopProjectUrl: finalProjectUrl,
      format: igFormat,
      dimensions,
      posts: doopPosts,
    });
  } catch (err: any) {
    console.error('[DoopExpand] Unexpected error:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to expand and save project in Doop',
    });
  }
});

// 6. One-Time Shares API
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

  const sharesMap = getSharesMap();
  sharesMap.set(shareId, record);
  saveSharesToDisk(sharesMap);

  return res.json({ shareId });
});

app.get('/api/shares/:shareId/status', (req, res) => {
  const { shareId } = req.params;
  const sharesMap = getSharesMap();
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
  const sharesMap = getSharesMap();
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
const PUBLIC_ASSETLINKS_PATH = path.resolve(ROOT_DIR, 'public', '.well-known', 'assetlinks.json');

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

// 8. Robots.txt & Sitemap.xml
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
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join(
    '\n'
  )}\n</urlset>`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  return res.send(xml);
});

export default app;
