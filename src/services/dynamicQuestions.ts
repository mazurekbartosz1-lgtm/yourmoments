/**
 * Dynamic AI & Contextual Question Generator for Kronika
 *
 * Priority rules:
 * 1. When user has written text: Priority #1 is the WRITTEN TEXT in connection to the MAIN QUESTION.
 * 2. When text is empty: Questions derive directly from the context of the MAIN QUESTION.
 */

function getQuestionsForPromptContext(promptText: string): string[] {
  const p = promptText.toLowerCase();

  if (
    p.includes('wolna myśl') ||
    p.includes('free thought') ||
    p.includes('pensamiento libre') ||
    p.includes('pensée libre')
  ) {
    return [
      'Co dziś najmocniej domaga się Twojej uwagi lub zapisania?',
      'Jaka jedna chwila z dzisiejszego dnia najbardziej została Ci w głowie?',
      'Jakie uczucie towarzyszy Ci teraz, gdy siadasz do pisania?',
      'O czym chciałbyś dziś pamiętać za kilka miesięcy?',
    ];
  }

  if (
    p.includes('gest') ||
    p.includes('życzliw') ||
    p.includes('wdzięczn') ||
    p.includes('dobro') ||
    p.includes('docen')
  ) {
    return [
      'Kto wykonał ten gest i w jakich okolicznościach to się wydarzyło?',
      'Co dokładnie poczułeś w tamtej chwili, gdy to zauważyłeś?',
      'Dlaczego właśnie ten drobiazg tak mocno zapadł Ci w pamięć?',
      'Jaki mały gest możesz dziś wykonać w stronę bliskiej osoby?',
    ];
  }

  if (
    p.includes('rozmow') ||
    p.includes('słow') ||
    p.includes('zdani') ||
    p.includes('usłysz') ||
    p.includes('powiedz') ||
    p.includes('blisk') ||
    p.includes('relacj')
  ) {
    return [
      'Kto wypowiedział te słowa i w jakiej byliście wtedy sytuacji?',
      'Co sprawiło, że to zdanie zostało w Tobie na dłużej?',
      'Czego nie powiedziałeś wtedy na głos, a dziś chciałbyś dopowiedzieć?',
      'Jak ta rozmowa zmieniła Twoje spojrzenie na tę relację?',
    ];
  }

  if (
    p.includes('dzieciństw') ||
    p.includes('kryjówk') ||
    p.includes('wspomnien') ||
    p.includes('kiedyś') ||
    p.includes('przeszłoś') ||
    p.includes('lat')
  ) {
    return [
      'Jaki pierwszy obraz lub zapach przychodzi Ci na myśl, gdy wracasz tam pamięcią?',
      'Kto był wtedy obok Ciebie albo przed kim chowałeś ten swój świat?',
      'Jakie uczucie dawało Ci tamto miejsce lub tamta chwila?',
      'Czego z tamtego doświadczenia najbardziej brakuje Ci dzisiaj?',
    ];
  }

  if (
    p.includes('spacer') ||
    p.includes('miejsce') ||
    p.includes('drog') ||
    p.includes('cisz') ||
    p.includes('spokój') ||
    p.includes('odpocz')
  ) {
    return [
      'Opisz mi miejsce, gdzie chodzisz — jak tam wygląda?',
      'O jakiej godzinie i dlaczego właśnie o tej porze tam bywasz?',
      'Co dzieje się w Twojej głowie, gdy pozwalasz sobie na tę chwilę ciszy?',
      'Co daje Ci ten spokój po powrocie do codziennych obowiązków?',
    ];
  }

  if (
    p.includes('decyzj') ||
    p.includes('zmian') ||
    p.includes('odwag') ||
    p.includes('obaw') ||
    p.includes('odkład') ||
    p.includes('wybór') ||
    p.includes('błąd')
  ) {
    return [
      'Co do tej pory najbardziej powstrzymywało Cię przed tym krokiem?',
      'Jaki byłby najmniejszy pierwszy ruch, który możesz zrobić już dziś?',
      'Co zmieni się w Twoim codziennym samopoczuciu, gdy już to zamkniesz?',
      'Czego nauczyła Cię ta sytuacja o tym, co jest dla Ciebie naprawdę ważne?',
    ];
  }

  if (p.includes('drobna') || p.includes('przyjemnoś') || p.includes('rytuał') || p.includes('poran')) {
    return [
      'Jaki drobny szczegół sprawia, że ta chwila daje Ci tyle przyjemności?',
      'O jakiej porze dnia najczęściej pozwalasz sobie na ten moment?',
      'Co czujesz w ciele i w myślach, kiedy się na tym zatrzymujesz?',
      'Jak ten mały rytuał zmienia Twoje nastawienie do reszty dnia?',
    ];
  }

  return [
    'Jaka konkretna sytuacja z ostatnich dni najmocniej wiąże się z tym pytaniem?',
    'Co dokładnie poczułeś w pierwszym momencie, gdy o tym pomyślałeś?',
    'Kto jeszcze był częścią tej historii i jaką odegrał w niej rolę?',
    'Jaki jeden wniosek chcesz z tej myśli zabrać dla siebie na jutro?',
  ];
}

export function generateLocalDynamicQuestions(text: string, promptText: string): string[] {
  const clean = text.trim();
  const promptQuestions = getQuestionsForPromptContext(promptText);

  // 1. When text is empty or just started: return questions grounded directly in the main prompt
  if (clean.length < 8) {
    return promptQuestions;
  }

  const lower = clean.toLowerCase();
  const questions: string[] = [];

  // Extract latest sentences to prioritize what the user JUST wrote
  const sentences = clean
    .split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 3);
  const lastSentence = (sentences[sentences.length - 1] || clean).toLowerCase();

  // 2. Priority #1: React to the user's written text in connection with the main question
  if (
    lower.includes('buziak') ||
    lower.includes('kochan') ||
    lower.includes('miło') ||
    lower.includes('milo') ||
    lower.includes('powitani') ||
    lower.includes('gest') ||
    lower.includes('blisk') ||
    lower.includes('sprawi')
  ) {
    questions.push('Jaki konkretny drobiazg możesz zrobić dzisiaj, żeby sprawić jej taką samą radość?');
    questions.push('Co dokładnie czujesz w środku, kiedy doświadczasz takiej czułości na co dzień?');
    questions.push('Jakie inne małe gesty w Waszej codzienności mają dla Ciebie największe znaczenie?');
  }

  if (
    lower.includes('powinienem') ||
    lower.includes('powiniem') ||
    lower.includes('powinnam') ||
    lower.includes('częściej') ||
    lower.includes('czesciej') ||
    lower.includes('innego')
  ) {
    questions.push('Jaka jedna mała rzecz przychodzi Ci teraz do głowy, którą mógłbyś zrobić już jutro?');
    questions.push('Co do tej pory sprawiało, że w pośpiechu dnia łatwo o takich gestach zapomnieć?');
  }

  if (
    lower.includes('chodz') ||
    lower.includes('spacer') ||
    lower.includes('miejsc') ||
    lower.includes('park') ||
    lower.includes('las') ||
    lower.includes('ulic') ||
    lower.includes('drog') ||
    lower.includes('bieg')
  ) {
    questions.push('Opisz mi dokładniej miejsce, gdzie chodzisz — co tam mijasz po drodze?');
    questions.push('O jakiej godzinie i dlaczego właśnie o tej porze się tam wybierasz?');
  }

  if (
    lower.includes('czysc') ||
    lower.includes('czyści') ||
    lower.includes('czysta') ||
    lower.includes('głow') ||
    lower.includes('glow') ||
    lower.includes('spokój') ||
    lower.includes('spokoj') ||
    lower.includes('myśl') ||
    lower.includes('mysl')
  ) {
    questions.push('Co to dokładnie znaczy, że „czyści głowę” — jakie myśli wtedy znikają?');
    questions.push('Co daje Ci taka czysta głowa później w pracy lub w domu?');
  }

  if (
    lower.includes('dziękuj') ||
    lower.includes('dziekuj') ||
    lower.includes('wdzięcz') ||
    lower.includes('czerp') ||
    lower.includes('radoś') ||
    lower.includes('przyjemn') ||
    lower.includes('kaw') ||
    lower.includes('herbat')
  ) {
    questions.push('Z czego dokładnie czerpiesz w tej chwili największą energię i spokój?');
    questions.push('Jak ten moment wpływa na Twoje nastawienie do reszty dnia?');
  }

  if (
    lower.includes('prac') ||
    lower.includes('projekt') ||
    lower.includes('zadań') ||
    lower.includes('zadani') ||
    lower.includes('biur') ||
    lower.includes('spotkan') ||
    lower.includes('stres')
  ) {
    questions.push('Co w dzisiejszej pracy wymaga od Ciebie najwięcej spokoju i skupienia?');
    questions.push('Jak czujesz różnicę w pracy, gdy zaczynasz dzień z uporządkowaną głową?');
  }

  if (
    lower.includes('rozmow') ||
    lower.includes('powiedz') ||
    lower.includes('ludzi') ||
    lower.includes('przyjaci') ||
    lower.includes('spotka')
  ) {
    questions.push('Jakie jedno zdanie z tej sytuacji najbardziej zostało Ci w pamięci?');
    questions.push('Czego nie powiedziałeś wtedy na głos, choć przeszło Ci przez myśl?');
  }

  // React to the very last sentence written
  if (lastSentence.includes('bo ') || lastSentence.includes('ponieważ') || lastSentence.includes('dlatego')) {
    questions.push('Kiedy po raz pierwszy zauważyłeś u siebie tę zależność?');
  }
  if (lastSentence.includes('może') || lastSentence.includes('moze') || lastSentence.includes('chcę') || lastSentence.includes('chce')) {
    questions.push('Jaki konkretny krok sprawi, że ta myśl zamieni się dziś w działanie?');
  }

  // Fill remaining slots with questions tied to the main prompt context
  for (const pq of promptQuestions) {
    if (questions.length >= 4) break;
    if (!questions.includes(pq)) {
      questions.push(pq);
    }
  }

  return Array.from(new Set(questions)).slice(0, 4);
}

function getEnglishQuestionsForPromptContext(promptText: string): string[] {
  const p = promptText.toLowerCase();

  if (
    p.includes('kindness') ||
    p.includes('gesture') ||
    p.includes('gratitude') ||
    p.includes('thank') ||
    p.includes('convenience')
  ) {
    return [
      'Who offered this gesture, and what were the circumstances around it?',
      'What did you feel in that exact moment when you noticed it?',
      'Why did this small detail stay with you so vividly?',
      'What small gesture could you offer someone close to you today?',
    ];
  }

  if (
    p.includes('conversation') ||
    p.includes('sentence') ||
    p.includes('listen') ||
    p.includes('heard') ||
    p.includes('word')
  ) {
    return [
      'Who spoke those words, and what was happening around you then?',
      'What made that sentence linger in your thoughts afterward?',
      'What did you leave unsaid at the time that you would say today?',
      'How did that moment shift the way you see this relationship?',
    ];
  }

  if (
    p.includes('childhood') ||
    p.includes('memory') ||
    p.includes('photograph') ||
    p.includes('past') ||
    p.includes('scent') ||
    p.includes('object')
  ) {
    return [
      'What is the very first image or scent that comes back when you recall it?',
      'Who else was there with you, or what lay just outside the frame?',
      'What feeling did that place or moment give you back then?',
      'What part of that experience do you miss most today?',
    ];
  }

  if (
    p.includes('sound') ||
    p.includes('taste') ||
    p.includes('texture') ||
    p.includes('light') ||
    p.includes('evening') ||
    p.includes('waking')
  ) {
    return [
      'Where were you when you noticed this detail, and what did the space look like?',
      'What time of day was it, and what else was happening in the background?',
      'What happens in your mind when you allow yourself this quiet pause?',
      'How does noticing this change your mood for the rest of the day?',
    ];
  }

  return [
    'What specific moment from recent days connects most strongly to this question?',
    'What did you feel in the very first instant this thought crossed your mind?',
    'Who else was part of this story, and what role did they play?',
    'What single takeaway from this reflection would you like to carry into tomorrow?',
  ];
}

function generateLocalEnglishQuestions(text: string, promptText: string): string[] {
  const clean = text.trim();
  const promptQuestions = getEnglishQuestionsForPromptContext(promptText);

  if (clean.length < 8) {
    return promptQuestions;
  }

  const lower = clean.toLowerCase();
  const questions: string[] = [];

  if (
    lower.includes('walk') ||
    lower.includes('place') ||
    lower.includes('park') ||
    lower.includes('street') ||
    lower.includes('outside')
  ) {
    questions.push('Describe the place where you go in more detail — what do you pass along the way?');
    questions.push('What time of day do you usually go there, and why that hour?');
  }

  if (
    lower.includes('clear') ||
    lower.includes('head') ||
    lower.includes('mind') ||
    lower.includes('calm') ||
    lower.includes('peace') ||
    lower.includes('quiet')
  ) {
    questions.push('What does having a clear mind feel like for you — which thoughts fade away first?');
    questions.push('How does that sense of calm help you later at work or at home?');
  }

  if (
    lower.includes('work') ||
    lower.includes('project') ||
    lower.includes('task') ||
    lower.includes('office') ||
    lower.includes('stress')
  ) {
    questions.push('What part of your work today asks for the most patience and focus?');
    questions.push('How do you notice the difference when you begin the day with a clear head?');
  }

  if (
    lower.includes('friend') ||
    lower.includes('talk') ||
    lower.includes('said') ||
    lower.includes('love') ||
    lower.includes('kind') ||
    lower.includes('smile')
  ) {
    questions.push('What small gesture could you do today to bring them that same warmth?');
    questions.push('Which single sentence or look from that moment stayed with you the most?');
  }

  for (const pq of promptQuestions) {
    if (questions.length >= 4) break;
    if (!questions.includes(pq)) {
      questions.push(pq);
    }
  }

  return Array.from(new Set(questions)).slice(0, 4);
}

function getSpanishQuestionsForPromptContext(promptText: string): string[] {
  const p = promptText.toLowerCase();

  if (
    p.includes('amabilidad') ||
    p.includes('gesto') ||
    p.includes('gratitud') ||
    p.includes('agradec') ||
    p.includes('escuchar')
  ) {
    return [
      '¿Quién tuvo ese gesto y en qué circunstancias ocurrió?',
      '¿Qué sentiste exactamente en ese momento cuando lo notaste?',
      '¿Por qué ese pequeño detalle se quedó tan grabado en tu memoria?',
      '¿Qué pequeño gesto podrías tener hoy con alguien cercano?',
    ];
  }

  if (
    p.includes('conversación') ||
    p.includes('palabra') ||
    p.includes('frase') ||
    p.includes('decir') ||
    p.includes('escuch')
  ) {
    return [
      '¿Quién pronunció esas palabras y en qué situación estaban?',
      '¿Qué hizo que esa frase permaneciera contigo tanto tiempo?',
      '¿Qué dejaste sin decir en voz alta que hoy te gustaría añadir?',
      '¿Cómo cambió esa conversación tu forma de ver la relación?',
    ];
  }

  if (
    p.includes('infancia') ||
    p.includes('recuerdo') ||
    p.includes('fotografía') ||
    p.includes('pasado') ||
    p.includes('aroma') ||
    p.includes('objeto')
  ) {
    return [
      '¿Cuál es la primera imagen o aroma que vuelve a ti al recordarlo?',
      '¿Quién más estaba allí contigo o qué había justo fuera del encuadre?',
      '¿Qué sensación te daba aquel lugar o aquel momento entonces?',
      '¿Qué parte de esa experiencia echas más de menos hoy?',
    ];
  }

  return [
    '¿Qué momento concreto de los últimos días conecta más con esta pregunta?',
    '¿Qué sentiste en el primer instante en que este pensamiento cruzó tu mente?',
    '¿Quién más formó parte de esta historia y qué papel jugó?',
    '¿Qué conclusión tranquila te gustaría llevarte de esta reflexión para mañana?',
  ];
}

function generateLocalSpanishQuestions(text: string, promptText: string): string[] {
  const clean = text.trim();
  const promptQuestions = getSpanishQuestionsForPromptContext(promptText);

  if (clean.length < 8) {
    return promptQuestions;
  }

  const lower = clean.toLowerCase();
  const questions: string[] = [];

  if (
    lower.includes('caminar') ||
    lower.includes('paseo') ||
    lower.includes('parque') ||
    lower.includes('calle') ||
    lower.includes('lugar')
  ) {
    questions.push('Describe con más detalle el lugar por donde fuiste: ¿qué viste en el camino?');
    questions.push('¿A qué hora del día sueles ir allí y por qué eliges ese momento?');
  }

  if (
    lower.includes('calma') ||
    lower.includes('silencio') ||
    lower.includes('paz') ||
    lower.includes('tranquil') ||
    lower.includes('mente')
  ) {
    questions.push('¿Cómo se siente tener la mente despejada y qué pensamientos se desvanecen primero?');
    questions.push('¿Cómo te ayuda esa sensación de calma durante el resto del día?');
  }

  if (
    lower.includes('trabajo') ||
    lower.includes('proyecto') ||
    lower.includes('tarea') ||
    lower.includes('oficina') ||
    lower.includes('estrés')
  ) {
    questions.push('¿Qué parte de tu día requiere hoy más paciencia y atención?');
    questions.push('¿Qué pequeño descanso podrías darte hoy al terminar?');
  }

  if (
    lower.includes('amig') ||
    lower.includes('hablar') ||
    lower.includes('dijo') ||
    lower.includes('cariño') ||
    lower.includes('sonrisa')
  ) {
    questions.push('¿Qué pequeño gesto podrías hacer hoy para devolver esa misma calidez?');
    questions.push('¿Qué frase o mirada de ese momento se quedó más grabada en ti?');
  }

  for (const pq of promptQuestions) {
    if (questions.length >= 4) break;
    if (!questions.includes(pq)) {
      questions.push(pq);
    }
  }

  return Array.from(new Set(questions)).slice(0, 4);
}

function getFrenchQuestionsForPromptContext(promptText: string): string[] {
  const p = promptText.toLowerCase();

  if (
    p.includes('bienveillance') ||
    p.includes('geste') ||
    p.includes('gratitude') ||
    p.includes('remercier') ||
    p.includes('écouter')
  ) {
    return [
      'Qui a eu ce geste et dans quelles circonstances cela s’est-il produit ?',
      'Qu’avez-vous ressenti à cet instant précis en le remarquant ?',
      'Pourquoi ce petit détail est-il resté si gravé dans votre mémoire ?',
      'Quel petit geste pourriez-vous offrir aujourd’hui à quelqu’un de proche ?',
    ];
  }

  if (
    p.includes('conversation') ||
    p.includes('mot') ||
    p.includes('phrase') ||
    p.includes('dire') ||
    p.includes('entendu')
  ) {
    return [
      'Qui a prononcé ces mots et quelle était la situation autour de vous ?',
      'Qu’est-ce qui a fait que cette phrase est restée si longtemps en vous ?',
      'Qu’avez-vous gardé pour vous à ce moment-là que vous aimeriez dire aujourd’hui ?',
      'Comment cette conversation a-t-elle changé votre regard sur cette relation ?',
    ];
  }

  if (
    p.includes('enfance') ||
    p.includes('souvenir') ||
    p.includes('photographie') ||
    p.includes('passé') ||
    p.includes('odeur') ||
    p.includes('objet')
  ) {
    return [
      'Quelle est la toute première image ou odeur qui vous revient en y pensant ?',
      'Qui d’autre était là avec vous, ou que se passait-il juste hors du cadre ?',
      'Quel sentiment ce lieu ou ce moment vous procurait-il à l’époque ?',
      'Quelle part de cette expérience vous manque le plus aujourd’hui ?',
    ];
  }

  return [
    'Quel moment précis de ces derniers jours résonne le plus avec cette question ?',
    'Qu’avez-vous ressenti à la toute première seconde où cette pensée vous a traversé ?',
    'Qui d’autre faisait partie de cette histoire et quel rôle y a-t-il joué ?',
    'Quelle conclusion apaisante aimeriez-vous garder de cette réflexion pour demain ?',
  ];
}

function generateLocalFrenchQuestions(text: string, promptText: string): string[] {
  const clean = text.trim();
  const promptQuestions = getFrenchQuestionsForPromptContext(promptText);

  if (clean.length < 8) {
    return promptQuestions;
  }

  const lower = clean.toLowerCase();
  const questions: string[] = [];

  if (
    lower.includes('marcher') ||
    lower.includes('promenade') ||
    lower.includes('parc') ||
    lower.includes('rue') ||
    lower.includes('endroit')
  ) {
    questions.push('Décrivez plus en détail l’endroit où vous êtes allé : qu’avez-vous croisé en chemin ?');
    questions.push('À quelle heure de la journée aimez-vous y aller et pourquoi ce moment ?');
  }

  if (
    lower.includes('calme') ||
    lower.includes('silence') ||
    lower.includes('paix') ||
    lower.includes('tranquil') ||
    lower.includes('esprit')
  ) {
    questions.push('Que ressentez-vous lorsque votre esprit s’apaise et quelles pensées s’effacent en premier ?');
    questions.push('Comment ce sentiment de calme vous accompagne-t-il pour le reste de la journée ?');
  }

  if (
    lower.includes('travail') ||
    lower.includes('projet') ||
    lower.includes('tâche') ||
    lower.includes('bureau') ||
    lower.includes('stress')
  ) {
    questions.push('Quelle partie de votre journée demande aujourd’hui le plus de patience et d’attention ?');
    questions.push('Quel petit moment de répit pourriez-vous vous accorder une fois terminé ?');
  }

  if (
    lower.includes('ami') ||
    lower.includes('parler') ||
    lower.includes('dit') ||
    lower.includes('tendresse') ||
    lower.includes('sourire')
  ) {
    questions.push('Quel petit geste pourriez-vous faire aujourd’hui pour rendre cette même chaleur ?');
    questions.push('Quelle phrase ou quel regard de cet instant vous a le plus marqué ?');
  }

  for (const pq of promptQuestions) {
    if (questions.length >= 4) break;
    if (!questions.includes(pq)) {
      questions.push(pq);
    }
  }

  return Array.from(new Set(questions)).slice(0, 4);
}

export function generateLocalDynamicQuestionsForLang(
  text: string,
  promptText: string,
  lang: 'pl' | 'en' | 'es' | 'fr' = 'pl'
): string[] {
  if (lang === 'en') {
    return generateLocalEnglishQuestions(text, promptText);
  }
  if (lang === 'es') {
    return generateLocalSpanishQuestions(text, promptText);
  }
  if (lang === 'fr') {
    return generateLocalFrenchQuestions(text, promptText);
  }
  return generateLocalDynamicQuestions(text, promptText);
}

// Client-side LRU cache to prevent duplicate API calls for identical text & prompt
const clientHintsCache = new Map<string, string[]>();
const MAX_CLIENT_HINTS_CACHE = 50;

export const MIN_TEXT_LENGTH_FOR_AI_HINTS = 30;
export const MIN_CHAR_DELTA_FOR_AI_REFETCH = 60;

/**
 * Fetch dynamic AI questions from server (Gemini), prioritizing written text in relation to the prompt.
 * Skips network requests for empty/short entries (< 30 chars) and caches results in memory.
 */
export async function fetchDynamicQuestions(
  text: string,
  promptText: string,
  lang: 'pl' | 'en' | 'es' | 'fr' = 'pl'
): Promise<string[]> {
  const localQuestions = generateLocalDynamicQuestionsForLang(text, promptText, lang);
  const cleanText = text.trim();

  // For empty or very short text, use local contextual questions (0 API calls)
  if (cleanText.length < MIN_TEXT_LENGTH_FOR_AI_HINTS) {
    return localQuestions;
  }

  const contextSlice = cleanText.slice(-900);
  const cacheKey = `${lang}::${promptText}::${contextSlice}`;
  const cached = clientHintsCache.get(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('/api/dynamic-hints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: contextSlice,
        prompt: promptText,
        lang,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        const result = data.questions.slice(0, 4);
        if (clientHintsCache.size >= MAX_CLIENT_HINTS_CACHE) {
          const oldest = clientHintsCache.keys().next().value;
          if (oldest !== undefined) clientHintsCache.delete(oldest);
        }
        clientHintsCache.set(cacheKey, result);
        return result;
      }
    }
  } catch {
    // Graceful fallback to local contextual questions
  }

  return localQuestions;
}

