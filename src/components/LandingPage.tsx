import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  KeyRound,
  ArrowRight,
  Globe,
  Feather,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Smartphone,
  Download,
  Check,
  X,
  User,
  Mic,
  MicOff,
  Unlock,
  BookOpen,
} from 'lucide-react';
import { CompanionDesk, COMPANIONS, CompanionId } from './CompanionDesk';
import {
  DAILY_PROMPTS,
  CATEGORIES,
  PromptCategory,
  Language,
  getPromptText,
  getHintText,
  getPromptSlug,
  getPromptSeoDetails,
  formatDateKey,
  FREE_THOUGHT_PROMPT,
  FREE_THOUGHT_PROMPT_ID,
} from '../data/prompts';
import { encryptText, EncryptedPayload } from '../services/crypto';
import { usePWAInstall } from '../services/pwa';

interface LandingPageProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  onGoogleLogin: () => Promise<void>;
  onNavigate?: (path: string) => void;
  onReturnToEditor?: () => void;
  userName?: string;
  userPhotoURL?: string;
  isAuthLoading?: boolean;
  authError?: string | null;
}

const COMPANION_WHISPERS: Record<CompanionId, { pl: string; en: string; es: string; fr: string }> = {
  crocodile: {
    pl: '„Zacznij od jednego konkretnego szczegółu — faktury kubka, dźwięku za oknem albo pierwszego zdania, które usłyszałeś rano.”',
    en: '“Start with one concrete detail — the texture of your mug, a sound outside, or the first sentence you heard this morning.”',
    es: '«Empieza por un detalle concreto: la textura de tu taza, un sonido tras la ventana o la primera frase que escuchaste por la mañana.»',
    fr: '« Commencez par un détail concret : la texture de votre tasse, un bruit derrière la fenêtre ou la première phrase entendue ce matin. »',
  },
  wolf: {
    pl: '„Wieczorem myśli stają się czystsze. Zapisz to, czego w ciągu dnia nie wypowiedziałeś na głos.”',
    en: '“In the evening, thoughts grow clearer. Write down what you left unspoken during the day.”',
    es: '«Por la noche los pensamientos se vuelven más claros. Escribe aquello que dejaste sin decir durante el día.»',
    fr: '« Le soir, les pensées s’éclaircissent. Écrivez ce que vous avez gardé silencieux durant la journée. »',
  },
  axolotl: {
    pl: '„Nie musisz oceniać swoich emocji. Pozwól im przepłynąć na papier tak spokojnie, jak woda w głębinie.”',
    en: '“You don’t need to judge your emotions. Let them drift onto the paper as calmly as deep water.”',
    es: '«No necesitas juzgar tus emociones. Deja que fluyan hacia el papel tan serenamente como el agua profunda.»',
    fr: '« Nul besoin de juger vos émotions. Laissez-les glisser sur le papier aussi paisiblement qu’une eau profonde. »',
  },
  bear: {
    pl: '„Nawet trzy spokojne zdania wystarczą, by zamknąć dzień z poczuciem ciepła i wdzięczności.”',
    en: '“Even three unhurried sentences are enough to close the day with warmth and gratitude.”',
    es: '«Incluso tres frases tranquilas bastan para cerrar el día con calidez y gratitud.»',
    fr: '« Même trois phrases paisibles suffisent pour clore la journée avec chaleur et gratitude. »',
  },
  panda: {
    pl: '„Zwolnij tempo. Dobre pisanie to nie wyścig na liczbę słów, lecz uważność między kolejnymi klawiszami.”',
    en: '“Slow down. Good journaling isn’t a word-count race, it’s mindfulness between keystrokes.”',
    es: '«Baja el ritmo. Escribir un diario no es una carrera de palabras, sino atención plena entre cada tecla.»',
    fr: '« Ralentissez. Tenir un journal n’est pas une course aux mots, mais une attention douce entre chaque touche. »',
  },
  dragon: {
    pl: '„Odważ się nazwać rzecz po imieniu. Gdzie dziś pojawi się iskra ciekawości albo odwagi?”',
    en: '“Dare to name things directly. Where did a spark of curiosity or courage appear today?”',
    es: '«Atrévete a llamar a las cosas por su nombre. ¿Dónde apareció hoy una chispa de curiosidad o valentía?»',
    fr: '« Osez nommer les choses simplement. Où est apparue aujourd’hui une étincelle de curiosité ou de courage ? »',
  },
  cat: {
    pl: '„Rozgość się wygodnie. Czasami najpiękniejsze myśli rodzą się w całkowitej ciszy i bezruchu.”',
    en: '“Make yourself comfortable. Sometimes the most beautiful reflections are born in total quiet and stillness.”',
    es: '«Ponte cómodo. A veces las reflexiones más hermosas nacen en silencio absoluto y calma.»',
    fr: '« Installez-vous confortablement. Parfois, les plus belles pensées naissent dans le silence le plus doux. »',
  },
  fox: {
    pl: '„Podejdź do dzisiejszego dnia ze sprytem i czułością. Który drobiazg umknął wszystkim poza Tobą?”',
    en: '“Approach today with curiosity and warmth. What small detail went unnoticed by everyone except you?”',
    es: '«Mira el día de hoy con curiosidad y calidez. ¿Qué pequeño detalle pasó desapercibido para todos menos para ti?»',
    fr: '« Abordez la journée avec curiosité et tendresse. Quel menu détail a échappé à tous, sauf à vous ? »',
  },
  dinosaur: {
    pl: '„Z perspektywy lat liczą się drobne rytuały. Zostaw dziś ślad, do którego wrócisz za dekadę.”',
    en: '“Across the years, small rituals matter most. Leave a trace today that you will revisit in a decade.”',
    es: '«Con el paso de los años, los pequeños rituales son lo que más importa. Deja hoy una huella a la que volverás en una década.»',
    fr: '« Au fil des années, ce sont les petits rituels qui comptent. Laissez aujourd’hui une trace que vous relirez dans dix ans. »',
  },
  lizard: {
    pl: '„Złap ulotne skojarzenie zanim ucieknie — pojedyncza scena wystarczy za cały rozdział.”',
    en: '“Catch a fleeting association before it slips away — a single scene can hold a whole chapter.”',
    es: '«Atrapa una asociación fugaz antes de que se escape: una sola escena puede contener todo un capítulo.»',
    fr: '« Saisissez une impression fugace avant qu’elle ne s’échappe — une seule scène peut contenir tout un chapitre. »',
  },
  bird: {
    pl: '„Spójrz na swój dzień z lotu ptaka: co dodawało Ci dziś lekkości, a co możesz już odpuścić?”',
    en: '“Look at your day from above: what gave you lightness today, and what can you gently let go of?”',
    es: '«Mira tu día a vista de pájaro: ¿qué te dio ligereza hoy y qué puedes dejar ir con calma?»',
    fr: '« Regardez votre journée de haut : qu’est-ce qui vous a apporté de la légèreté, et que pouvez-vous laisser partir ? »',
  },
};

export const LandingPage: React.FC<LandingPageProps> = ({
  lang,
  onLanguageChange,
  onGoogleLogin,
  onNavigate,
  onReturnToEditor,
  userName,
  userPhotoURL,
  isAuthLoading = false,
  authError = null,
}) => {
  const isEn = lang === 'en';
  const isEs = lang === 'es';
  const isFr = lang === 'fr';
  const tr = (pl: string, en: string, es: string, fr?: string) =>
    isEn ? en : isEs ? es : isFr ? (fr ?? en) : pl;

  const { isInstallable, isInstalled, isIos, promptInstall } = usePWAInstall();
  const [showInstallGuideModal, setShowInstallGuideModal] = useState<boolean>(false);
  const [showLangDropdown, setShowLangDropdown] = useState<boolean>(false);
  const [showMobileLangDropdown, setShowMobileLangDropdown] = useState<boolean>(false);
  const [showMobileViewPreview, setShowMobileViewPreview] = useState<boolean>(false);

  // When visiting via a regular mobile or desktop browser, show the full main landing page.
  // In the installed standalone app (or explicit preview), show the focused login screen.
  const isStandaloneApp =
    isInstalled ||
    (typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
        (typeof document !== 'undefined' && document.referrer.includes('android-app://'))));

  const showAppLoginScreen = isStandaloneApp || showMobileViewPreview;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await promptInstall();
      if (outcome === 'unavailable') {
        setShowInstallGuideModal(true);
      }
    } else {
      setShowInstallGuideModal(true);
    }
  };

  const handleSpaLink = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (!onNavigate) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(path);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ===========================================================================
  // PLG "WRITE FIRST, SIGN UP TO SAVE" INTERACTIVE HERO STATE
  // ===========================================================================
  const todayKey = formatDateKey(new Date());
  const heroPromptsPool = [
    DAILY_PROMPTS[0], // small moment to remember in 5 years
    DAILY_PROMPTS.find(p => p.slug === 'overcoming-burnout') || DAILY_PROMPTS[11],
    DAILY_PROMPTS.find(p => p.slug === 'evening-gratitude') || DAILY_PROMPTS[1],
  ];
  const [plgPromptIdx, setPlgPromptIdx] = useState<number>(0);
  const [plgFreeThought, setPlgFreeThought] = useState<boolean>(false);
  const activeHeroPrompt = plgFreeThought
    ? FREE_THOUGHT_PROMPT
    : heroPromptsPool[plgPromptIdx] || DAILY_PROMPTS[0];
  const activeHeroSeo = getPromptSeoDetails(activeHeroPrompt, lang);

  const [plgDraft, setPlgDraft] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const todayDraftRaw = localStorage.getItem(`kronika_draft_${formatDateKey(new Date())}`);
      if (todayDraftRaw) {
        const parsed = JSON.parse(todayDraftRaw);
        if (parsed && typeof parsed.content === 'string' && parsed.content.trim().length > 0) {
          return parsed.content;
        }
      }
      const plgRaw = localStorage.getItem('kronika_plg_draft');
      if (plgRaw) {
        const parsed = JSON.parse(plgRaw);
        if (parsed && typeof parsed.content === 'string') {
          return parsed.content;
        }
      }
    } catch {
      // ignore
    }
    return '';
  });

  const [plgWritingSeconds, setPlgWritingSeconds] = useState<number>(0);
  const [isPlgUserTyping, setIsPlgUserTyping] = useState<boolean>(false);
  const [isPlgListening, setIsPlgListening] = useState<boolean>(false);
  const [showPlgConversionModal, setShowPlgConversionModal] = useState<boolean>(false);
  const heroTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const plgTypingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const plgSpeechRef = useRef<any>(null);

  const persistPlgDraft = (textVal: string, promptIdVal: string, secsVal: number) => {
    try {
      const payload = {
        content: textVal,
        isSealed: false,
        promptId: promptIdVal,
        writingTimeSeconds: secsVal,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('kronika_plg_draft', JSON.stringify(payload));
      if (textVal.trim().length > 0) {
        localStorage.setItem(`kronika_draft_${todayKey}`, JSON.stringify(payload));
        localStorage.setItem(`kronika_answered_prompt_${todayKey}`, promptIdVal);
      }
    } catch {
      // ignore storage errors
    }
  };

  const handlePlgDraftChange = (newText: string) => {
    setPlgDraft(newText);
    setIsPlgUserTyping(true);
    if (plgTypingTimerRef.current) clearTimeout(plgTypingTimerRef.current);
    plgTypingTimerRef.current = setTimeout(() => {
      setIsPlgUserTyping(false);
    }, 1200);
    persistPlgDraft(newText, activeHeroPrompt.id, plgWritingSeconds);
  };

  useEffect(() => {
    if (!isPlgUserTyping) return;
    const timer = setInterval(() => {
      setPlgWritingSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlgUserTyping]);

  const applyPlgFormatting = (wrapper: '**' | '*') => {
    const el = heroTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? plgDraft.length;
    const end = el.selectionEnd ?? plgDraft.length;
    const selected = plgDraft.slice(start, end);
    const replacement = selected
      ? `${wrapper}${selected}${wrapper}`
      : `${wrapper}${tr('tekst', 'text', 'texto', 'texte')}${wrapper}`;
    const updated = plgDraft.slice(0, start) + replacement + plgDraft.slice(end);
    handlePlgDraftChange(updated);
    setTimeout(() => {
      el.focus();
      const cursor = start + replacement.length;
      el.setSelectionRange(cursor, cursor);
    }, 15);
  };

  const insertPlgMarginHint = (questionText: string) => {
    const cleanQ = questionText.replace(/[„”"«»→]/g, '').trim();
    const formatted = `***${cleanQ}***`;
    const prefix = plgDraft.trim().length > 0 ? `${plgDraft.replace(/\s+$/, '')}\n\n` : '';
    const updated = `${prefix}${formatted}\n`;
    handlePlgDraftChange(updated);
    setTimeout(() => {
      if (heroTextareaRef.current) {
        heroTextareaRef.current.focus();
        heroTextareaRef.current.setSelectionRange(updated.length, updated.length);
      }
    }, 20);
  };

  const togglePlgDictation = () => {
    if (typeof window === 'undefined') return;
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    if (isPlgListening && plgSpeechRef.current) {
      try {
        plgSpeechRef.current.stop();
      } catch {
        // ignore
      }
      setIsPlgListening(false);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang =
        lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'fr' ? 'fr-FR' : 'pl-PL';
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        if (transcript && typeof transcript === 'string') {
          const sep = plgDraft && !/\s$/.test(plgDraft) ? ' ' : '';
          handlePlgDraftChange(`${plgDraft}${sep}${transcript.trim()}`);
        }
      };
      rec.onerror = () => setIsPlgListening(false);
      rec.onend = () => setIsPlgListening(false);
      plgSpeechRef.current = rec;
      setIsPlgListening(true);
      rec.start();
    } catch {
      setIsPlgListening(false);
    }
  };

  const handleSaveEntryTrigger = () => {
    persistPlgDraft(plgDraft, activeHeroPrompt.id, plgWritingSeconds);
    if (onReturnToEditor) {
      onReturnToEditor();
      return;
    }
    setShowPlgConversionModal(true);
  };

  const plgWordCount = plgDraft.trim() ? plgDraft.trim().split(/\s+/).length : 0;

  // Hero live typewriter demo state (used in Step 01/02 showcase below fold)
  const heroSamplePl =
    'Dzisiaj po południu zauważyłem, jak światło wpada przez kuchenne okno. Zaparzyłem herbatę i przez dziesięć minut po prostu słuchałem deszczu.';
  const heroSampleEn =
    'This afternoon I noticed how the light fell through the kitchen window. I brewed tea and spent ten quiet minutes just listening to the rain.';
  const heroSampleEs =
    'Esta tarde noté cómo entraba la luz por la ventana de la cocina. Preparé té y pasé diez minutos en silencio escuchando la lluvia.';
  const heroSampleFr =
    'Cet après-midi, j’ai remarqué comment la lumière entrait par la fenêtre de la cuisine. J’ai préparé du thé et écouté la pluie en silence.';
  const targetHeroText = tr(heroSamplePl, heroSampleEn, heroSampleEs, heroSampleFr);

  const [typedHeroText, setTypedHeroText] = useState<string>('');
  const [isHeroTyping, setIsHeroTyping] = useState<boolean>(false);

  useEffect(() => {
    let idx = 0;
    let timeoutId: NodeJS.Timeout;
    setTypedHeroText('');

    const step = () => {
      if (idx <= targetHeroText.length) {
        const currentSlice = targetHeroText.slice(0, idx);
        const lastChar = targetHeroText[idx - 1] || '';
        const isPauseChar = lastChar === '.' || lastChar === ',' || lastChar === ' ';
        setTypedHeroText(currentSlice);
        setIsHeroTyping(idx < targetHeroText.length && !isPauseChar);
        idx++;
        const charDelay =
          idx === targetHeroText.length + 1
            ? 4200
            : lastChar === '.' || lastChar === ','
            ? 380
            : lastChar === ' '
            ? 165
            : 105;
        timeoutId = setTimeout(step, charDelay);
      } else {
        setIsHeroTyping(false);
        idx = 0;
        timeoutId = setTimeout(step, 3200);
      }
    };

    timeoutId = setTimeout(step, 700);
    return () => clearTimeout(timeoutId);
  }, [targetHeroText]);

  // Step-by-step scroll flow state
  const [activeStep, setActiveStep] = useState<number>(0);
  const [marginEyeOpen, setMarginEyeOpen] = useState<boolean>(true);
  const [selectedArchiveDay, setSelectedArchiveDay] = useState<number>(19);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    stepRefs.current.forEach((el, index) => {
      if (!el) return;
      const obs = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              setActiveStep(index);
            }
          });
        },
        {
          root: null,
          rootMargin: '-28% 0px -38% 0px',
          threshold: 0.15,
        }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => {
      observers.forEach(o => o.disconnect());
    };
  }, []);

  // Interactive 9-companion carousel & dropdown state — each day & each site visit a different animal assists you
  const [showcaseCompanion, setShowcaseCompanion] = useState<CompanionId>(() => {
    const randomIdx = Math.floor(Math.random() * COMPANIONS.length);
    return COMPANIONS[randomIdx]?.id || 'crocodile';
  });
  const [showcasePose, setShowcasePose] = useState<'typing' | 'reading' | 'searching'>('typing');

  const currentCompanionIndex = COMPANIONS.findIndex(c => c.id === showcaseCompanion);
  const currentCompanionInfo = COMPANIONS[currentCompanionIndex] || COMPANIONS[0];

  const handlePrevCompanion = () => {
    const prevIdx = (currentCompanionIndex - 1 + COMPANIONS.length) % COMPANIONS.length;
    setShowcaseCompanion(COMPANIONS[prevIdx].id);
  };

  const handleNextCompanion = () => {
    const nextIdx = (currentCompanionIndex + 1) % COMPANIONS.length;
    setShowcaseCompanion(COMPANIONS[nextIdx].id);
  };

  // Smart Hints & Prompt Category explorer state
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory>('sensory');
  const [selectedSampleThoughtIdx, setSelectedSampleThoughtIdx] = useState<number>(0);

  const sampleThoughts = isEn
    ? [
        {
          thought: 'I walked home slower than usual today after the meeting.',
          followUps: [
            'What stayed in your mind after that conversation?',
            'What did the street look or sound like on your way back?',
          ],
        },
        {
          thought: 'I finally finished reading a book I started three months ago.',
          followUps: [
            'Which sentence or image from it will stay with you the longest?',
            'How do you feel now that this story is behind you?',
          ],
        },
        {
          thought: 'Morning coffee on the balcony tasted better than it had all week.',
          followUps: [
            'What made this morning feel calmer than the previous ones?',
            'Was there a scent or sound that anchored you in the moment?',
          ],
        },
      ]
    : isEs
    ? [
        {
          thought: 'Hoy volví a casa caminando más despacio de lo habitual tras la reunión.',
          followUps: [
            '¿Qué fue lo que más se quedó en tu mente después de esa conversación?',
            '¿Cómo se veía o sonaba la calle mientras caminabas sin prisa?',
          ],
        },
        {
          thought: 'Por fin terminé de leer el libro que empecé hace tres meses.',
          followUps: [
            '¿Qué frase o escena de ese libro se quedará contigo más tiempo?',
            '¿Qué sientes ahora al cerrar este capítulo?',
          ],
        },
        {
          thought: 'El café de la mañana en el balcón supo mejor que en toda la semana.',
          followUps: [
            '¿Qué hizo que esta mañana se sintiera más tranquila que las anteriores?',
            '¿Qué aroma o sonido te acompañó en ese instante?',
          ],
        },
      ]
    : isFr
    ? [
        {
          thought: 'Je suis rentré à pied plus lentement que d’habitude après la réunion.',
          followUps: [
            'Qu’est-ce qui est resté le plus présent dans votre esprit après cet échange ?',
            'À quoi ressemblait la rue pendant que vous marchiez sans hâte ?',
          ],
        },
        {
          thought: 'J’ai enfin terminé le livre que j’avais commencé il y a trois mois.',
          followUps: [
            'Quelle phrase ou quelle image de ce livre restera le plus longtemps avec vous ?',
            'Que ressentez-vous maintenant en refermant ce chapitre ?',
          ],
        },
        {
          thought: 'Le café du matin sur le balcon était meilleur que toute la semaine.',
          followUps: [
            'Qu’est-ce qui a rendu ce matin plus paisible que les précédents ?',
            'Quel parfum ou quel bruit vous a accompagné à cet instant ?',
          ],
        },
      ]
    : [
        {
          thought: 'Wracałem dziś do domu wolniej niż zwykle po długiej rozmowie.',
          followUps: [
            'Co najmocniej zostało w Twojej głowie po tym spotkaniu?',
            'Jak wyglądała ulica, gdy szedłeś bez pośpiechu?',
          ],
        },
        {
          thought: 'Skończyłem wreszcie książkę, którą zacząłem czytać trzy miesiące temu.',
          followUps: [
            'Która myśl albo scena z niej zostanie z Tobą najdłużej?',
            'Co czujesz, zamykając ten rozdział?',
          ],
        },
        {
          thought: 'Poranna kawa na balkonie smakowała dziś lepiej niż przez cały tydzień.',
          followUps: [
            'Co sprawiło, że ten poranek był spokojniejszy od poprzednich?',
            'Jaki dźwięk lub zapach towarzyszył Ci w tej chwili?',
          ],
        },
      ];

  // Live E2EE Security Inspector state
  const [demoSecretText, setDemoSecretText] = useState<string>(
    tr(
      'Moja prywatna myśl, której żaden serwer ani nikt postronny nigdy nie przeczyta.',
      'My private reflection that no server or third party can ever read.',
      'Mi reflexión privada que ningún servidor ni tercero podrá leer jamás.',
      'Ma pensée privée qu’aucun serveur ni tiers ne pourra jamais lire.'
    )
  );
  const [demoViewMode, setDemoViewMode] = useState<'decrypted' | 'encrypted'>('encrypted');
  const [hoveredLandingWordIdx, setHoveredLandingWordIdx] = useState<number | null>(null);
  const [hoveredLandingTimeIdx, setHoveredLandingTimeIdx] = useState<number | null>(null);
  const [liveEncrypted, setLiveEncrypted] = useState<EncryptedPayload>({
    encryptedContent: '9fK3xP8mQ2vL7nR4wT1yZ6bC0dF5gH8jK2mN9pQ4sV7x...',
    iv: 'a8F2k9LmP1qR4tV7',
    salt: 'x7B4n9QwE2rT5yU8iO1pA3sD',
  });

  useEffect(() => {
    setDemoSecretText(
      tr(
        'Moja prywatna myśl, której żaden serwer ani nikt postronny nigdy nie przeczyta.',
        'My private reflection that no server or third party can ever read.',
        'Mi reflexión privada que ningún servidor ni tercero podrá leer jamás.',
        'Ma pensée privée qu’aucun serveur ni tiers ne pourra jamais lire.'
      )
    );
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    const runEncryption = async () => {
      try {
        const res = await encryptText(
          demoSecretText || 'Kronika Dnia',
          'demo-user-private-key-256-aes'
        );
        if (!cancelled) {
          setLiveEncrypted(res);
        }
      } catch {
        // Fallback deterministic preview if subtle crypto is unavailable
      }
    };
    runEncryption();
    return () => {
      cancelled = true;
    };
  }, [demoSecretText]);

  const categoryPrompts = DAILY_PROMPTS.filter(p => p.category === selectedCategory).slice(0, 3);

  const archiveDemoEntries: Record<
    number,
    {
      dateLabelPl: string;
      dateLabelEn: string;
      dateLabelEs: string;
      dateLabelFr: string;
      promptPl: string;
      promptEn: string;
      promptEs: string;
      promptFr: string;
      textPl: string;
      textEn: string;
      textEs: string;
      textFr: string;
      words: number;
      seconds: number;
    }
  > = {
    14: {
      dateLabelPl: '14 PAŹDZIERNIKA 2026',
      dateLabelEn: 'OCTOBER 14, 2026',
      dateLabelEs: '14 DE OCTUBRE DE 2026',
      dateLabelFr: '14 OCTOBRE 2026',
      promptPl: 'Jaki dźwięk z dzisiejszego dnia najbardziej zapadł Ci w pamięć?',
      promptEn: 'What sound from today stuck with you the most?',
      promptEs: '¿Qué sonido de hoy se quedó más grabado en tu memoria?',
      promptFr: 'Quel bruit d’aujourd’hui vous a le plus marqué ?',
      textPl:
        'Trzask gałęzi w parku pod butami i cichy szum ekspresu do kawy o siódmej rano, zanim reszta domu się obudziła.',
      textEn:
        'The crunch of twigs under my boots in the park and the quiet hum of the espresso machine at 7 AM before the house woke up.',
      textEs:
        'El crujido de las ramas en el parque bajo mis botas y el suave murmullo de la cafetera a las siete de la mañana antes de que despertara la casa.',
      textFr:
        'Le craquement des branches dans le parc sous mes pas et le doux murmure de la cafetière à sept heures du matin avant que la maison ne s’éveille.',
      words: 21,
      seconds: 38,
    },
    17: {
      dateLabelPl: '17 PAŹDZIERNIKA 2026',
      dateLabelEn: 'OCTOBER 17, 2026',
      dateLabelEs: '17 DE OCTUBRE DE 2026',
      dateLabelFr: '17 OCTOBRE 2026',
      promptPl: 'Komu byłeś dzisiaj po cichu wdzięczny?',
      promptEn: 'Who were you silently grateful to today?',
      promptEs: '¿A quién estuviste hoy agradecido en silencio?',
      promptFr: 'Envers qui avez-vous éprouvé une gratitude silencieuse aujourd’hui ?',
      textPl:
        'Starszemu panu w księgarni, który polecił mi stary zbiór esejów i opowiedział krótką historię o swoim dziadku.',
      textEn:
        'The older gentleman at the bookshop who recommended a volume of essays and shared a short story about his grandfather.',
      textEs:
        'Al señor mayor de la librería que me recomendó una colección de ensayos y me contó una breve historia sobre su abuelo.',
      textFr:
        'Au vieux monsieur de la librairie qui m’a conseillé un recueil d’essais et m’a raconté une courte histoire sur son grand-père.',
      words: 19,
      seconds: 44,
    },
    19: {
      dateLabelPl: '19 PAŹDZIERNIKA 2026',
      dateLabelEn: 'OCTOBER 19, 2026',
      dateLabelEs: '19 DE OCTUBRE DE 2026',
      dateLabelFr: '19 OCTOBRE 2026',
      promptPl: 'Jaki drobny moment z dzisiejszego dnia chciałbyś zapamiętać za 5 lat?',
      promptEn: 'What small moment from today would you like to remember in 5 years?',
      promptEs: '¿Qué pequeño momento de hoy te gustaría recordar dentro de 5 años?',
      promptFr: 'Quel petit moment d’aujourd’hui aimeriez-vous retrouver dans 5 ans ?',
      textPl:
        'Spokojny wieczór przy lampce na biurku. Przez chwilę nic nie musiałem gonić i poczułem prawdziwą ulgę po całym tygodniu.',
      textEn:
        'A calm evening by the desk lamp. For a moment I had nothing to chase and felt genuine relief after the whole week.',
      textEs:
        'Una tarde tranquila junto a la lámpara del escritorio. Por un momento no tuve que correr tras nada y sentí un verdadero alivio.',
      textFr:
        'Une soirée paisible près de la lampe de bureau. Pendant un instant, je n’avais rien à poursuivre et j’ai ressenti un vrai soulagement.',
      words: 21,
      seconds: 52,
    },
  };

  const currentArchiveDemo = archiveDemoEntries[selectedArchiveDay] || archiveDemoEntries[19];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C1A18] flex flex-col font-serif-literary antialiased selection:bg-[#E2DDD3]">
      {/* Top Bar Contract: Zone 1 (Logo + Single Name) — Zone 2 (Single-Line Links) — Zone 3 (1 Primary Action) */}
      <header
        className={`${
          showAppLoginScreen ? 'hidden' : 'block'
        } sticky top-0 z-40 bg-[#F7F5F0]/95 backdrop-blur-[2px] border-b border-[#E5DFD3]`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 sm:gap-8">
          <a
            href="#top"
            className="inline-flex items-center gap-2.5 text-xl font-serif-literary font-semibold tracking-tight text-[#1C1A18] whitespace-nowrap shrink-0"
          >
            {/* Simple line-art cloud & sun logo mark */}
            <svg
              viewBox="0 0 36 26"
              className="w-8 h-6 shrink-0 overflow-visible"
              aria-hidden="true"
            >
              <circle
                cx="26"
                cy="9"
                r="5.5"
                fill="#EBC5CF"
                stroke="#1C1A18"
                strokeWidth="1.7"
              />
              <path
                d="M6 21 H26 C29 21 30.5 18.5 29.5 16 C28.8 14 26.8 13.5 25.5 14 C24.5 10 20.5 8 17 9.5 C14.5 7.5 10.5 8.5 9.5 12 C6.5 12.2 4 14.5 4.2 17.5 C4.3 19.5 5 21 6 21 Z"
                fill="#FAF8F5"
                stroke="#1C1A18"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{tr('Momenty', 'Moments', 'Moments', 'Moments')}</span>
          </a>

          <nav className="hidden md:flex items-center gap-3.5 lg:gap-5 text-[11px] lg:text-xs font-mono-meta text-[#524D46]">
            <button
              type="button"
              onClick={() => scrollToSection('flow-section')}
              className="hover:text-[#1C1A18] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {tr('Jak to działa', 'How it works', 'Cómo funciona', 'Comment ça marche')}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('hints-section')}
              className="hover:text-[#1C1A18] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {tr('Podpowiedzi', 'Prompts & Hints', 'Pistas', 'Questions & Marges')}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('stats-section')}
              className="hover:text-[#1C1A18] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {tr('Wykresy i statystyki', 'Charts & Stats', 'Gráficos y estadísticas', 'Graphiques & Stats')}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('mobile-section')}
              className="hover:text-[#1C1A18] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {tr('Mobile + Instalacja', 'Mobile + Install', 'Móvil + Instalación', 'Mobile + Installation')}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('security-section')}
              className="hover:text-[#1C1A18] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {tr('Bezpieczeństwo', 'Encryption', 'Seguridad', 'Chiffrement')}
            </button>
            <a
              href="/prompts"
              onClick={e => handleSpaLink(e, '/prompts')}
              className="text-[#8B2635] hover:text-[#1C1A18] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer font-medium"
            >
              {tr('Biblioteka pytań (47)', 'Prompts Library (47)', 'Preguntas (47)', 'Questions (47)')}
            </a>
          </nav>

          {/* Compact Right Header Controls: Mobile + Language Dropdown + Account (Padlock or Name & Avatar) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 1. Compact "Mobile" Install App Button */}
            <button
              type="button"
              onClick={handleInstallClick}
              title={
                isInstalled
                  ? tr(
                      'Aplikacja Momenty jest zainstalowana na tym urządzeniu',
                      'Moments app is installed on this device',
                      'La aplicación Moments está instalada en este dispositivo',
                      'L’application Moments est installée sur cet appareil'
                    )
                  : tr(
                      'Zainstaluj aplikację mobilną (Android / iOS)',
                      'Install mobile app (Android / iOS)',
                      'Instalar aplicación móvil (Android / iOS)',
                      'Installer l’application mobile (Android / iOS)'
                    )
              }
              className={`h-7 px-2.5 rounded-md border text-[11px] font-mono-meta inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                isInstalled
                  ? 'border-[#CCE2CC] bg-[#EBF2EB] text-[#2E5C33]'
                  : 'border-[#D4CEBF] bg-[#FAF8F5] hover:bg-[#EAE5DA] text-[#1C1A18]'
              }`}
            >
              {isInstalled ? (
                <Check className="w-3 h-3 text-[#2E5C33]" />
              ) : (
                <Smartphone className="w-3 h-3 text-[#8B2635]" />
              )}
              <span>Mobile</span>
            </button>

            {/* 2. Compact Language Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangDropdown(prev => !prev)}
                className="h-7 px-2 rounded-md border border-[#E2DDD3] bg-[#F2EFE8] hover:bg-[#EAE5DA] text-[11px] font-mono-meta text-[#1C1A18] inline-flex items-center gap-1 transition-colors cursor-pointer"
                title={tr('Zmień język', 'Change language', 'Cambiar idioma', 'Changer de langue')}
              >
                <Globe className="w-3 h-3 text-[#7A756D]" />
                <span className="uppercase font-medium">{lang}</span>
                <ChevronDown className="w-3 h-3 text-[#7A756D]" />
              </button>

              {showLangDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowLangDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-32 rounded-lg bg-[#FAF8F5] border border-[#DDD6C8] shadow-lg p-1 text-[11px] font-mono-meta">
                    {(
                      [
                        { code: 'pl', label: 'Polski' },
                        { code: 'en', label: 'English' },
                        { code: 'es', label: 'Español' },
                        { code: 'fr', label: 'Français' },
                      ] as const
                    ).map(item => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => {
                          onLanguageChange(item.code);
                          setShowLangDropdown(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded text-left flex items-center justify-between transition-colors cursor-pointer ${
                          lang === item.code
                            ? 'bg-[#1C1A18] text-[#FAF8F5] font-medium'
                            : 'text-[#524D46] hover:bg-[#EFECE4] hover:text-[#1C1A18]'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className="uppercase opacity-70">{item.code}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 3. Compact Account Button: Name + Avatar when signed in, or Padlock + "Account" when signed out */}
            {onReturnToEditor ? (
              <button
                type="button"
                onClick={onReturnToEditor}
                title={tr(
                  'Wróć do pisania',
                  'Back to editor',
                  'Volver al diario',
                  'Retour au journal'
                )}
                className="h-7 px-2.5 text-[11px] font-mono-meta font-medium text-[#FAF8F5] bg-[#1C1A18] hover:bg-[#33302B] rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {userPhotoURL ? (
                  <img
                    src={userPhotoURL}
                    alt={userName || 'Account'}
                    referrerPolicy="no-referrer"
                    className="w-4 h-4 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-3 h-3 text-[#EBC5CF]" />
                )}
                <span>{userName || tr('Konto', 'Account', 'Cuenta', 'Compte')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onGoogleLogin}
                disabled={isAuthLoading}
                className="h-7 px-2.5 text-[11px] font-mono-meta font-medium text-[#FAF8F5] bg-[#1C1A18] hover:bg-[#33302B] rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <Lock className="w-3 h-3 text-[#EBC5CF]" />
                <span>
                  {isAuthLoading
                    ? '...'
                    : tr('Konto', 'Account', 'Cuenta', 'Compte')}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Guided Mobile Install Modal when direct prompt is not available */}
      {showInstallGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
          onClick={() => setShowInstallGuideModal(false)}
        >
          <div
            className="w-full max-w-md bg-[#FAF8F5] border border-[#E2DDD3] rounded-2xl shadow-xl p-6 text-[#1C1A18] space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#ECE7DC]">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-[#8B2635]" />
                <h3 className="text-base font-serif-literary font-medium text-[#1C1A18]">
                  {tr(
                    'Aplikacja Momenty na telefon (Android / iOS)',
                    'Moments App for Mobile (Android / iOS)',
                    'App Moments para móvil (Android / iOS)',
                    'Application Moments sur mobile (Android / iOS)'
                  )}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallGuideModal(false)}
                className="p-1 rounded text-[#7A756D] hover:text-[#1C1A18] hover:bg-[#EFECE4] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInstalled ? (
              <div className="p-3.5 rounded-xl bg-[#EBF2EB] border border-[#CCE2CC] text-xs font-serif-literary text-[#2E5C33] leading-relaxed">
                {tr(
                  'Aplikacja Momenty jest już zainstalowana na tym urządzeniu i działa w trybie pełnoekranowym.',
                  'The Moments app is already installed on this device and running in fullscreen mode.',
                  'La aplicación Moments ya está instalada en este dispositivo.',
                  'L’application Moments est déjà installée sur cet appareil.'
                )}
              </div>
            ) : (
              <div className="space-y-3.5 text-xs sm:text-sm font-serif-literary text-[#524D46] leading-relaxed">
                <p>
                  {tr(
                    'Możesz zainstalować Momenty bezpośrednio na ekranie głównym swojego telefonu z ikoną chmurki i słońca, pracą w trybie offline oraz dyktowaniem głosowym:',
                    'You can install Moments directly on your phone’s home screen with the cloud & sun icon, offline writing, and voice dictation:',
                    'Puedes instalar Moments directamente en la pantalla de inicio de tu teléfono con modo sin conexión y dictado por voz:',
                    'Vous pouvez installer Moments directement sur l’écran d’accueil de votre téléphone avec mode hors-ligne et dictée vocale :'
                  )}
                </p>

                <div className="p-3.5 rounded-xl bg-[#F2EFE8] border border-[#DDD6C8] space-y-2">
                  <div className="font-mono-meta text-[11px] uppercase tracking-wider text-[#1C1A18] font-semibold">
                    {isIos
                      ? 'iPhone / iPad (Safari)'
                      : tr('Android (Chrome)', 'Android (Chrome)', 'Android (Chrome)', 'Android (Chrome)')}
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-[#33302B]">
                    {isIos ? (
                      <>
                        <li>
                          {tr(
                            'Otwórz adres aplikacji bezpośrednio w przeglądarce Safari.',
                            'Open the app URL directly in Safari.',
                            'Abre la dirección directamente en Safari.',
                            'Ouvrez l’adresse directement dans Safari.'
                          )}
                        </li>
                        <li>
                          {tr(
                            'Dotknij ikony Udostępnij na dolnym pasku i wybierz „Dodaj do ekranu początkowego”.',
                            'Tap the Share icon in the bottom bar and select “Add to Home Screen”.',
                            'Toca Compartir y selecciona «Añadir a pantalla de inicio».',
                            'Appuyez sur Partager puis sur « Sur l’écran d’accueil ».'
                          )}
                        </li>
                      </>
                    ) : (
                      <>
                        <li>
                          {tr(
                            'Otwórz pełny adres aplikacji w przeglądarce Chrome na telefonie z Androidem.',
                            'Open the full app URL in Chrome on your Android phone.',
                            'Abre la dirección de la app en Chrome en tu teléfono Android.',
                            'Ouvrez l’adresse de l’application dans Chrome sur votre téléphone Android.'
                          )}
                        </li>
                        <li>
                          {tr(
                            'Kliknij przycisk „Zainstaluj aplikację” w nagłówku lub otwórz menu Chrome (⋮) w prawym górnym rogu i wybierz „Zainstaluj aplikację” / „Dodaj do ekranu głównego”.',
                            'Tap “Install app” in the header or open the Chrome menu (⋮) in the top-right corner and choose “Install app” / “Add to Home screen”.',
                            'Toca «Instalar app» o abre el menú de Chrome (⋮) y elige «Instalar aplicación».',
                            'Appuyez sur « Installer l’application » ou ouvrez le menu Chrome (⋮) et choisissez « Installer l’application ».'
                          )}
                        </li>
                      </>
                    )}
                  </ol>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowInstallGuideModal(false);
                  setShowMobileViewPreview(prev => !prev);
                }}
                className="text-xs font-mono-meta text-[#6F4E37] hover:text-[#1C1A18] underline underline-offset-4 cursor-pointer"
              >
                {showMobileViewPreview
                  ? tr(
                      'Pokaż pełną stronę główną',
                      'Show full main page',
                      'Mostrar página principal',
                      'Afficher la page principale'
                    )
                  : tr(
                      'Podgląd ekranu logowania aplikacji →',
                      'Preview App login screen →',
                      'Vista previa de inicio de app →',
                      'Aperçu de l’écran application →'
                    )}
              </button>
              <button
                type="button"
                onClick={() => setShowInstallGuideModal(false)}
                className="px-4 py-2 rounded-lg bg-[#1C1A18] text-[#FAF8F5] text-xs font-mono-meta cursor-pointer hover:bg-[#33302B] transition-colors"
              >
                {tr('Rozumiem', 'Got it', 'Entendido', 'Compris')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APP STARTING PAGE: Centered minimalist login screen (shown only in standalone app or during preview) */}
      {showAppLoginScreen && (
        <div className="relative flex-1 flex flex-col items-center justify-between px-6 pt-5 pb-10 text-center select-none min-h-screen">
          {/* Top-right Language Selector Dropdown on App Login Screen */}
          <div className="w-full flex items-center justify-end z-30">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMobileLangDropdown(prev => !prev)}
                className="h-8 px-3 rounded-lg border border-[#D4CEBF] bg-[#FAF8F5] hover:bg-[#EAE5DA] text-xs font-mono-meta text-[#1C1A18] inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title={tr('Zmień język', 'Change language', 'Cambiar idioma', 'Changer de langue')}
              >
                <Globe className="w-3.5 h-3.5 text-[#7A756D]" />
                <span className="font-medium">
                  {lang === 'pl'
                    ? 'Polski'
                    : lang === 'en'
                    ? 'English'
                    : lang === 'es'
                    ? 'Español'
                    : 'Français'}
                </span>
                <span className="uppercase text-[10px] text-[#7A756D]">({lang})</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#7A756D] transition-transform duration-150 ${
                    showMobileLangDropdown ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showMobileLangDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMobileLangDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-36 rounded-lg bg-[#FAF8F5] border border-[#DDD6C8] shadow-lg p-1 text-xs font-mono-meta">
                    {(
                      [
                        { code: 'pl', label: 'Polski' },
                        { code: 'en', label: 'English' },
                        { code: 'es', label: 'Español' },
                        { code: 'fr', label: 'Français' },
                      ] as const
                    ).map(item => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => {
                          onLanguageChange(item.code);
                          setShowMobileLangDropdown(false);
                        }}
                        className={`w-full px-2.5 py-2 rounded-md text-left flex items-center justify-between transition-colors cursor-pointer ${
                          lang === item.code
                            ? 'bg-[#1C1A18] text-[#FAF8F5] font-medium'
                            : 'text-[#524D46] hover:bg-[#EFECE4] hover:text-[#1C1A18]'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className="inline-flex items-center gap-1">
                          <span className="uppercase text-[10px] opacity-75">{item.code}</span>
                          {lang === item.code && <Check className="w-3 h-3 shrink-0" />}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="max-w-xs w-full flex flex-col items-center justify-center space-y-6 my-auto">
            {/* [Logo] Momenty */}
            <div className="inline-flex items-center justify-center gap-3 py-1">
              <svg
                viewBox="0 0 36 26"
                className="w-12 h-9 shrink-0 overflow-visible"
                aria-hidden="true"
              >
                <circle
                  cx="26"
                  cy="9"
                  r="5.5"
                  fill="#EBC5CF"
                  stroke="#1C1A18"
                  strokeWidth="1.7"
                />
                <path
                  d="M6 21 H26 C29 21 30.5 18.5 29.5 16 C28.8 14 26.8 13.5 25.5 14 C24.5 10 20.5 8 17 9.5 C14.5 7.5 10.5 8.5 9.5 12 C6.5 12.2 4 14.5 4.2 17.5 C4.3 19.5 5 21 6 21 Z"
                  fill="#FAF8F5"
                  stroke="#1C1A18"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-4xl sm:text-5xl font-serif-literary font-semibold tracking-tight text-[#1C1A18]">
                {tr('Momenty', 'Moments', 'Momentos', 'Moments')}
              </span>
            </div>

            {/* Line 3: "login" button */}
            <div className="pt-1 pb-1">
              <button
                type="button"
                onClick={onReturnToEditor || onGoogleLogin}
                disabled={isAuthLoading}
                className="min-h-[42px] px-7 py-2.5 rounded-lg bg-[#1C1A18] hover:bg-[#33302B] text-[#FAF8F5] text-xs font-mono-meta uppercase tracking-widest inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-60"
              >
                {onReturnToEditor && userName ? (
                  <>
                    {userPhotoURL ? (
                      <img
                        src={userPhotoURL}
                        alt={userName}
                        referrerPolicy="no-referrer"
                        className="w-4 h-4 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-3.5 h-3.5 text-[#EBC5CF]" />
                    )}
                    <span>{userName}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-[#EBC5CF]" />
                    <span>
                      {isAuthLoading
                        ? tr('łączenie...', 'connecting...', 'conectando...', 'connexion...')
                        : tr('zaloguj się', 'login', 'iniciar sesión', 'se connecter')}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Line 4: "and tell the story." */}
            <p className="text-xl sm:text-2xl font-serif-literary italic text-[#6E6961]">
              {tr(
                'i opowiedz swoją historię.',
                'and tell the story.',
                'y cuenta la historia.',
                'et racontez l’histoire.'
              )}
            </p>

            {authError && (
              <div className="p-2.5 rounded-lg bg-[#FDF2F2] border border-[#E8C5C5] text-xs font-mono-meta text-[#8B2635] flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
          </div>

          {showMobileViewPreview && (
            <button
              type="button"
              onClick={() => setShowMobileViewPreview(false)}
              className="mt-8 text-[11px] font-mono-meta text-[#7A756D] hover:text-[#1C1A18] underline underline-offset-4 cursor-pointer"
            >
              {tr(
                '← Wróć do pełnej strony',
                '← Back to full page',
                '← Volver a la página completa',
                '← Retour à la page complète'
              )}
            </button>
          )}
        </div>
      )}

      <main
        id="top"
        className={`${
          showAppLoginScreen ? 'hidden' : 'block'
        } flex-1`}
      >
        {/* PLG Frictionless Conversion Modal ("Your moment is ready. Create an encrypted account in 1 click to save it to your timeline.") */}
        {showPlgConversionModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
            onClick={() => setShowPlgConversionModal(false)}
          >
            <div
              className="w-full max-w-md bg-[#FAF8F5] border border-[#E2DDD3] rounded-2xl shadow-xl p-6 sm:p-7 text-[#1C1A18] space-y-5 animate-in fade-in zoom-in-95 duration-150"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-xs font-mono-meta text-[#2E6F40]">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>AES-GCM 256 · END-TO-END ENCRYPTED</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPlgConversionModal(false)}
                  className="p-1 rounded text-[#7A756D] hover:text-[#1C1A18] hover:bg-[#EFECE4] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-2xl font-serif-literary font-medium text-[#1C1A18] leading-snug">
                  {tr(
                    'Twój moment jest gotowy. Stwórz szyfrowane konto jednym kliknięciem, aby zapisać go na swojej osi czasu.',
                    'Your moment is ready. Create an encrypted account in 1 click to save it to your timeline.',
                    'Tu momento está listo. Crea una cuenta cifrada en 1 clic para guardarlo en tu línea de tiempo.',
                    'Votre moment est prêt. Créez un compte chiffré en 1 clic pour l’enregistrer sur votre fil.'
                  )}
                </h3>
                <p className="text-sm font-serif-literary text-[#524D46] leading-relaxed">
                  {tr(
                    'Twój tekst jest już bezpiecznie zapisany w pamięci przeglądarki. Jedno kliknięcie zaszyfruje go kluczem AES-256 i doda bezpośrednio do Twojego dzisiejszego dnia.',
                    'Your reflection is already safely stored in your browser. One click encrypts it with your private AES-256 key and saves it directly to today’s entry.',
                    'Tu reflexión ya está guardada en tu navegador. Un clic la cifrará con tu clave privada AES-256 y la guardará en tu diario de hoy.',
                    'Votre réflexion est déjà enregistrée dans votre navigateur. Un clic la chiffrera avec votre clé privée AES-256 et l’ajoutera à votre journée.'
                  )}
                </p>
              </div>

              {plgDraft.trim().length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#F2EFE8] border border-[#DDD6C8] space-y-1 text-left">
                  <div className="text-[10px] font-mono-meta text-[#7A756D] uppercase tracking-wider">
                    {tr('Twój dzisiejszy szkic', 'Your draft ready to save', 'Tu borrador listo', 'Votre brouillon prêt')} · {plgWordCount}{' '}
                    {tr('słów', 'words', 'palabras', 'mots')}
                  </div>
                  <p className="text-xs font-serif-literary italic text-[#33302B] line-clamp-3">
                    „{plgDraft.trim()}”
                  </p>
                </div>
              )}

              {authError && (
                <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#E8C5C5] text-xs font-mono-meta text-[#8B2635] flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={onGoogleLogin}
                  disabled={isAuthLoading}
                  className="w-full py-3.5 px-5 rounded-xl bg-[#1C1A18] hover:bg-[#33302B] text-[#FAF8F5] text-xs sm:text-sm font-mono-meta font-medium flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-60"
                >
                  <Lock className="w-4 h-4 text-[#EBC5CF]" />
                  <span>
                    {isAuthLoading
                      ? tr('Szyfrowanie i łączenie...', 'Encrypting & connecting...', 'Conectando...', 'Connexion...')
                      : tr(
                          'Stwórz szyfrowane konto w 1 kliknięcie (Google)',
                          'Create encrypted account in 1 click (Google)',
                          'Crear cuenta cifrada en 1 clic (Google)',
                          'Créer un compte chiffré en 1 clic (Google)'
                        )}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowPlgConversionModal(false)}
                  className="w-full py-2 text-xs font-mono-meta text-[#7A756D] hover:text-[#1C1A18] transition-colors cursor-pointer"
                >
                  {tr(
                    'Wróć do pisania (szkic czeka w przeglądarce)',
                    'Keep writing first (your draft stays saved locally)',
                    'Seguir escribiendo primero',
                    'Continuer à écrire d’abord'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 1. HERO SECTION — Interactive "Write First, Sign Up to Save" PLG Experience */}
        <section className="max-w-6xl mx-auto px-6 pt-10 pb-18 md:pt-16 md:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            {/* Left Column: Minimalist Headline & PLG Value Proposition */}
            <div className="lg:col-span-5 space-y-6 lg:pt-4">
              <div className="space-y-4">
                <div className="text-xs font-mono-meta text-[#8B2635] tracking-wide">
                  {tr(
                    'PISZ OD RAZU · ZAPISZ JEDNYM KLIKNIĘCIEM',
                    'WRITE FIRST · SIGN UP TO SAVE',
                    'ESCRIBE PRIMERO · GUARDA EN 1 CLIC',
                    'ÉCRIVEZ D’ABORD · SAUVEGARDEZ EN 1 CLIC'
                  )}
                </div>

                <h1
                  className="text-4xl sm:text-5xl font-serif-literary font-normal tracking-tight text-[#1C1A18] leading-[1.13]"
                  style={{ textWrap: 'balance' }}
                >
                  {tr(
                    'Cicha kartka na Twoje codzienne momenty.',
                    'A quiet page for your daily moments.',
                    'Una página tranquila para tus momentos diarios.',
                    'Une page paisible pour vos moments du quotidien.'
                  )}
                </h1>

                <p className="text-base sm:text-lg text-[#524D46] font-serif-literary leading-relaxed">
                  {tr(
                    'Nie musisz zakładać konta, żeby zacząć. Odpowiedz na dzisiejsze pytanie bezpośrednio na kartce obok — Twój szkic zapisuje się lokalnie w trakcie pisania. Gdy będziesz gotowy, zachowaj go na swojej szyfrowanej osi czasu.',
                    'Never hit a login wall before your first thought. Answer today’s reflection prompt right on the page — your words save locally as you type. Click “Save Entry” whenever you’re ready to keep it.',
                    'Empieza a escribir sin muros de registro. Responde a la pregunta de hoy directamente en la página: tu texto se guarda localmente mientras escribes.',
                    'Commencez sans mur de connexion. Répondez à la question du jour directement sur la page : vos mots sont sauvegardés localement pendant que vous écrivez.'
                  )}
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {authError && (
                  <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#E8C5C5] text-xs font-mono-meta text-[#8B2635] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (plgDraft.trim().length > 0) {
                        handleSaveEntryTrigger();
                      } else if (heroTextareaRef.current) {
                        heroTextareaRef.current.focus();
                      } else {
                        onGoogleLogin();
                      }
                    }}
                    disabled={isAuthLoading}
                    className="px-6 py-3.5 text-sm font-mono-meta font-medium text-[#FAF8F5] bg-[#1C1A18] hover:bg-[#33302B] rounded-lg transition-all flex items-center gap-2.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
                  >
                    <span>
                      {isAuthLoading
                        ? tr('Łączenie...', 'Connecting...', 'Conectando...', 'Connexion...')
                        : plgDraft.trim().length > 0
                        ? tr(
                            'Zapisz wpis na osi czasu',
                            'Save Entry to Timeline',
                            'Guardar entrada',
                            'Enregistrer l’entrée'
                          )
                        : tr(
                            'Zacznij pisać teraz',
                            'Start writing now',
                            'Empieza a escribir',
                            'Commencer à écrire'
                          )}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={onReturnToEditor || onGoogleLogin}
                    disabled={isAuthLoading}
                    className="px-4 py-3.5 text-sm font-mono-meta text-[#524D46] hover:text-[#1C1A18] border border-[#DDD6C8] hover:border-[#B8B0A0] bg-[#FAF8F5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {onReturnToEditor
                      ? tr('Otwórz dziennik', 'Open journal', 'Abrir diario', 'Ouvrir le journal')
                      : tr('Zaloguj się', 'Sign in', 'Iniciar sesión', 'Se connecter')}
                  </button>
                </div>

                {/* Quick links to programmatic long-tail prompt pages */}
                <div className="pt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono-meta text-[#7A756D]">
                  <span>{tr('Popularne tematy:', 'Popular prompts:', 'Temas:', 'Sujets :')}</span>
                  <a
                    href="/prompts/overcoming-burnout"
                    onClick={e => handleSpaLink(e, '/prompts/overcoming-burnout')}
                    className="text-[#524D46] hover:text-[#8B2635] underline underline-offset-4"
                  >
                    {tr('Wypalenie i zmęczenie', 'Overcoming burnout', 'Superar el agotamiento', 'Surmonter l’épuisement')}
                  </a>
                  <span aria-hidden="true">·</span>
                  <a
                    href="/prompts/evening-gratitude"
                    onClick={e => handleSpaLink(e, '/prompts/evening-gratitude')}
                    className="text-[#524D46] hover:text-[#8B2635] underline underline-offset-4"
                  >
                    {tr('Wieczorna wdzięczność', 'Evening gratitude', 'Gratitud nocturna', 'Gratitude du soir')}
                  </a>
                  <span aria-hidden="true">·</span>
                  <a
                    href="/prompts"
                    onClick={e => handleSpaLink(e, '/prompts')}
                    className="text-[#8B2635] hover:text-[#1C1A18] underline underline-offset-4 font-medium"
                  >
                    {tr('Wszystkie (47) →', 'All prompts (47) →', 'Todas (47) →', 'Toutes (47) →')}
                  </a>
                </div>
              </div>
            </div>

            {/* Right Column: Live Interactive "Write First, Sign Up to Save" Paper Sanctuary */}
            <div className="lg:col-span-7 flex flex-col justify-between bg-[#FAF8F5] border border-[#E5DFD3] rounded-xl p-5 sm:p-8 relative overflow-hidden shadow-[0_10px_34px_-16px_rgba(28,26,24,0.08)]">
              {/* Top Interactive Writing Header: Logo + Prompt Switcher (1/3) + Free Thought */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-[#ECE7DC] text-xs font-mono-meta text-[#7A756D]">
                <div className="flex items-center gap-1.5 text-[#1C1A18] font-serif-literary text-sm">
                  <svg
                    viewBox="0 0 36 26"
                    className="w-6 h-4 shrink-0 overflow-visible mr-0.5"
                    aria-hidden="true"
                  >
                    <circle
                      cx="26"
                      cy="9"
                      r="5.5"
                      fill="#EBC5CF"
                      stroke="#1C1A18"
                      strokeWidth="1.7"
                    />
                    <path
                      d="M6 21 H26 C29 21 30.5 18.5 29.5 16 C28.8 14 26.8 13.5 25.5 14 C24.5 10 20.5 8 17 9.5 C14.5 7.5 10.5 8.5 9.5 12 C6.5 12.2 4 14.5 4.2 17.5 C4.3 19.5 5 21 6 21 Z"
                      fill="#FAF8F5"
                      stroke="#1C1A18"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>
                    {tr('Dzisiejsza kartka', 'Today’s page', 'Página de hoy', 'Page d’aujourd’hui')}
                  </span>
                  <span className="text-[#9E978C] font-mono-meta text-[11px]">
                    · {todayKey}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 tabular-nums">
                  {!plgFreeThought && (
                    <div className="inline-flex items-center gap-1 bg-[#F2EFE8] border border-[#E2DDD3] rounded-md px-1.5 py-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setPlgPromptIdx(
                            prev => (prev - 1 + heroPromptsPool.length) % heroPromptsPool.length
                          )
                        }
                        className="p-0.5 hover:text-[#1C1A18] cursor-pointer"
                        title={tr('Poprzednie pytanie', 'Previous prompt', 'Pregunta anterior', 'Question précédente')}
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <span className="text-[11px] text-[#1C1A18] font-medium px-1">
                        {plgPromptIdx + 1}/{heroPromptsPool.length}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPlgPromptIdx(prev => (prev + 1) % heroPromptsPool.length)
                        }
                        className="p-0.5 hover:text-[#1C1A18] cursor-pointer"
                        title={tr('Kolejne pytanie', 'Next prompt', 'Siguiente pregunta', 'Question suivante')}
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setPlgFreeThought(prev => !prev)}
                    className={`px-2 py-1 rounded-md border text-[11px] font-mono-meta inline-flex items-center gap-1 transition-colors cursor-pointer ${
                      plgFreeThought
                        ? 'bg-[#1C1A18] border-[#1C1A18] text-[#FAF8F5]'
                        : 'bg-[#FAF8F5] border-[#DDD6C8] hover:bg-[#EFECE4] text-[#524D46]'
                    }`}
                  >
                    <Feather className="w-3 h-3 text-[#8B2635]" />
                    <span>{tr('Wolna myśl', 'Free thought', 'Pensamiento libre', 'Pensée libre')}</span>
                  </button>
                </div>
              </div>

              {/* Daily Question + Interactive Toolbar + Live Textarea */}
              <div className="space-y-4 my-auto">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl sm:text-2xl font-serif-literary text-[#1C1A18] leading-snug">
                    {getPromptText(activeHeroPrompt, lang)}
                  </h2>
                </div>

                {/* Live Interactive Writing Toolbar: Voice Dictation + Bold/Italic + Sample */}
                <div className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-lg bg-[#F7F5F0] border border-[#E5DFD3] text-[11px] font-mono-meta text-[#524D46]">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={togglePlgDictation}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border font-medium transition-colors cursor-pointer ${
                        isPlgListening
                          ? 'bg-[#8B2635] border-[#8B2635] text-[#FAF8F5]'
                          : 'bg-[#FAF8F5] border-[#DDD6C8] hover:bg-[#EAE5DA] text-[#1C1A18]'
                      }`}
                    >
                      {isPlgListening ? (
                        <>
                          <MicOff className="w-3 h-3 animate-pulse" />
                          <span>{tr('Słucham...', 'Listening...', 'Escuchando...', 'Écoute...')}</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3 h-3 text-[#8B2635]" />
                          <span>{tr('Dyktuj', 'Dictate', 'Dictar', 'Dicter')}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPlgFormatting('**')}
                      title={tr('Pogrubienie', 'Bold', 'Negrita', 'Gras')}
                      className="px-2 py-1 rounded bg-[#FAF8F5] hover:bg-[#EAE5DA] border border-[#DDD6C8] font-serif-literary font-bold text-[#1C1A18] cursor-pointer"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPlgFormatting('*')}
                      title={tr('Kursywa', 'Italic', 'Cursiva', 'Italique')}
                      className="px-2 py-1 rounded bg-[#FAF8F5] hover:bg-[#EAE5DA] border border-[#DDD6C8] font-serif-literary italic text-[#1C1A18] cursor-pointer"
                    >
                      I
                    </button>
                    {!plgDraft.trim() && (
                      <button
                        type="button"
                        onClick={() => handlePlgDraftChange(targetHeroText)}
                        className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-[#FAF8F5] hover:bg-[#EAE5DA] border border-[#DDD6C8] text-[#524D46] cursor-pointer"
                      >
                        <span>
                          {tr('Wstaw przykład', 'Try sample thought', 'Probar ejemplo', 'Essayer un exemple')}
                        </span>
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-[#7A756D]">
                    {plgDraft.trim().length > 0
                      ? tr('Zapisano w pamięci przeglądarki', 'Saved in localStorage', 'Guardado en navegador', 'Sauvegardé localement')
                      : tr('Zacznij pisać poniżej', 'Type directly below', 'Escribe abajo', 'Écrivez ci-dessous')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-1 items-start">
                  {/* Clickable Active Margin Follow-Up Hint — ON THE LEFT */}
                  <div className="sm:col-span-4 pt-1 border-b sm:border-b-0 sm:border-r border-[#EAE5DA] pb-2.5 sm:pb-0 sm:pr-3.5 space-y-1.5 text-left">
                    <div className="flex items-center justify-between text-[10px] font-mono-meta text-[#7A756D]">
                      <span>{tr('Margines (kliknij)', 'Margin (click)', 'Margen (clic)', 'Marge (cliquer)')}</span>
                      <Eye className="w-3 h-3 text-[#7A756D]" />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        insertPlgMarginHint(
                          activeHeroSeo.followUpQuestions[0] ||
                            getHintText(activeHeroPrompt, lang)
                        )
                      }
                      className="text-left text-xs font-serif-literary italic text-[#6E675F] hover:text-[#1C1A18] leading-snug transition-colors cursor-pointer"
                    >
                      „{activeHeroSeo.followUpQuestions[0] || getHintText(activeHeroPrompt, lang)}” →
                    </button>
                  </div>

                  {/* Live Interactive Textarea on the Right of the Margin */}
                  <div className="sm:col-span-8 text-left">
                    <textarea
                      ref={heroTextareaRef}
                      value={plgDraft}
                      onChange={e => handlePlgDraftChange(e.target.value)}
                      rows={4}
                      aria-label={getPromptText(activeHeroPrompt, lang)}
                      placeholder={tr(
                        'Napisz tu pierwsze zdanie swojej dzisiejszej refleksji... (np. Dzisiaj po południu zauważyłem, jak światło wpada przez okno...)',
                        'Write the first sentence of today’s reflection right here... (e.g. This afternoon I noticed how the light fell through the window...)',
                        'Escribe aquí la primera frase de tu reflexión de hoy...',
                        'Écrivez ici la première phrase de votre réflexion du jour...'
                      )}
                      className="w-full min-h-[112px] bg-transparent text-base font-serif-literary text-[#1C1A18] placeholder:text-[#9E978C] placeholder:italic leading-relaxed resize-y focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Rotating companion + Primary "Save Entry" Conversion Bar */}
              <div className="mt-3 pt-2 border-t border-[#ECE7DC]/70">
                <CompanionDesk
                  companionId={showcaseCompanion}
                  isTyping={isPlgUserTyping || (plgDraft.length === 0 && isHeroTyping)}
                  isSealed={false}
                  isSearching={false}
                  lang={lang}
                  onSelectCompanion={handleNextCompanion}
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[#ECE7DC] text-[11px] font-mono-meta text-[#7A756D] tabular-nums">
                  <div className="flex items-center gap-2">
                    <span>
                      {plgWordCount} {tr('słów', 'words', 'palabras', 'mots')}
                    </span>
                    {plgWritingSeconds > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{plgWritingSeconds}s</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="text-[#2E6F40]">AES-256</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveEntryTrigger}
                    className="px-4 py-2 rounded-lg bg-[#1C1A18] hover:bg-[#33302B] text-[#FAF8F5] text-xs font-mono-meta font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Lock className="w-3 h-3 text-[#EBC5CF]" />
                    <span>
                      {tr(
                        'Zapisz wpis (Save Entry) →',
                        'Save Entry →',
                        'Guardar entrada →',
                        'Enregistrer l’entrée →'
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. SCROLL-DRIVEN STEP-BY-STEP FLOW — With Hanging Lightbulb Illustration */}
        <section id="flow-section" className="border-t border-[#E5DFD3] bg-[#F3EFE7]/55 py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
              <div className="max-w-xl space-y-2">
                <div className="text-xs font-mono-meta text-[#7A756D]">
                  {tr(
                    '01 · Jak to działa',
                    '01 · How it works',
                    '01 · Cómo funciona',
                    '01 · Comment ça marche'
                  )}
                </div>
                <h2
                  className="text-3xl sm:text-4xl font-serif-literary text-[#1C1A18] leading-tight"
                  style={{ textWrap: 'balance' }}
                >
                  {tr(
                    'Cztery chwile codziennego rytuału.',
                    'Four moments of the daily ritual.',
                    'Cuatro momentos del ritual diario.',
                    'Quatre moments du rituel quotidien.'
                  )}
                </h2>
              </div>

              {/* Hanging Lightbulb & Cloud Line-Art Illustration placed in this section */}
              <svg
                viewBox="0 0 120 68"
                className="w-28 h-16 shrink-0 overflow-visible"
                aria-hidden="true"
              >
                {/* Flat-bottomed cloud */}
                <path
                  d="M10 46 H58 C62 46 65 42.5 64 38 C63 35 59.5 34 57 34.5 C55.5 28 49 24.5 42.5 26.5 C39 22 31.5 23 29 28.5 C23 28 18 32 18 37.5 C13.5 38 11 41 11.5 44 C11.8 45 11 46 10 46 Z"
                  fill="#FAF8F5"
                  stroke="#1C1A18"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Hanging cord + lightbulb */}
                <line
                  x1="92"
                  y1="0"
                  x2="92"
                  y2="24"
                  stroke="#1C1A18"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <circle
                  cx="92"
                  cy="38"
                  r="14"
                  fill="#F5DCE3"
                  fillOpacity="0.65"
                />
                <rect
                  x="88"
                  y="23"
                  width="8"
                  height="5"
                  rx="1"
                  fill="#EAE4D7"
                  stroke="#1C1A18"
                  strokeWidth="1.6"
                />
                <path
                  d="M84 36 C84 31 87.5 28 92 28 C96.5 28 100 31 100 36 C100 41 96 45 92 45 C88 45 84 41 84 36 Z"
                  fill="#FAF8F5"
                  stroke="#1C1A18"
                  strokeWidth="1.7"
                />
                <path
                  d="M89.5 36 C89.5 33.5 92 33.5 92 36 C92 33.5 94.5 33.5 94.5 36"
                  fill="none"
                  stroke="#1C1A18"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <line x1="73" y1="36" x2="77" y2="36" stroke="#1C1A18" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="107" y1="36" x2="111" y2="36" stroke="#1C1A18" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="92" y1="53" x2="92" y2="57" stroke="#1C1A18" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: 4 Concise Steps */}
              <div className="lg:col-span-5 space-y-3">
                {[
                  {
                    num: '01.',
                    titlePl: 'Pytanie Dnia i cichy margines',
                    titleEn: 'Daily Question & quiet margin',
                    titleEs: 'Pregunta del Día y margen silencioso',
                    titleFr: 'Question du jour et marge discrète',
                    descPl:
                      'Na wysokości Twojego kursora pojawia się dyskretne pytanie pomocnicze, które możesz jednym kliknięciem wkleić do tekstu.',
                    descEn:
                      'A gentle follow-up question tracks your active cursor line in the margin — click once to copy it into your text.',
                    descEs:
                      'Una pregunta de seguimiento acompaña la línea activa de tu cursor; haz clic para copiarla a tu texto.',
                    descFr:
                      'Une question de relance accompagne la ligne active de votre curseur — cliquez pour l’insérer dans votre texte.',
                  },
                  {
                    num: '02.',
                    titlePl: 'Pisanie i dyktowanie głosem w rytmie maszyny',
                    titleEn: 'Writing & voice dictation to the typewriter rhythm',
                    titleEs: 'Escritura y dictado por voz al ritmo de la máquina',
                    titleFr: 'Écriture et dictée vocale au rythme de la machine',
                    descPl:
                      'Pisz na klawiaturze lub dyktuj głosem — przyklejony pasek narzędzi (Dyktuj, B, I, Popraw pisownię) jest zawsze pod ręką, a towarzysz stuka w klawisze razem z Tobą.',
                    descEn:
                      'Type or dictate by voice — the sticky toolbar (Dictate, B, I, Spellcheck) stays visible as you scroll while your companion types along.',
                    descEs:
                      'Escribe o dicta por voz: la barra fija (Dictar, B, I, Ortografía) te acompaña al bajar mientras tu compañero teclea contigo.',
                    descFr:
                      'Écrivez ou dictez à la voix — la barre fixe (Dicter, B, I, Orthographe) reste visible pendant que votre compagnon tape avec vous.',
                  },
                  {
                    num: '03.',
                    titlePl: 'Zamknięcie i swobodne odblokowanie dnia',
                    titleEn: 'Sealing & unlocking the day anytime',
                    titleEs: 'Cerrar y desbloquear el día cuando quieras',
                    titleFr: 'Clore et déverrouiller la journée à tout moment',
                    descPl:
                      'Po zamknięciu dnia atrament jaśnieje, a zwierzak czyta książkę. Jeśli przypomni Ci się kolejna myśl, jednym kliknięciem odblokujesz wpis i wrócisz na dół kartki.',
                    descEn:
                      'When sealed, the ink softens and your companion reads a book. If a new thought appears, unlock the entry with one click to resume right at the end.',
                    descEs:
                      'Al cerrar el día, la tinta se suaviza y tu compañero lee. Si recuerdas algo más, desbloquea la entrada con un clic para seguir al final.',
                    descFr:
                      'Une fois la journée close, l’encre s’adoucit. Si une pensée vous revient, déverrouillez l’entrée d’un clic pour reprendre tout en bas.',
                  },
                  {
                    num: '04.',
                    titlePl: 'Szyfrowany Dziennik',
                    titleEn: 'Encrypted Journal',
                    titleEs: 'Diario cifrado',
                    titleFr: 'Journal chiffré',
                    descPl:
                      'Kalendarz z zakreślonymi dniami wysuwa się spod biurka, a towarzysz pomaga szukać zapisków z lupą.',
                    descEn:
                      'A monthly calendar slides out from beneath the desk while your companion searches with a magnifying glass.',
                    descEs:
                      'El calendario mensual se desliza desde abajo mientras tu compañero busca con su lupa.',
                    descFr:
                      'Un calendrier mensuel glisse sous le bureau tandis que votre compagnon cherche vos notes à la loupe.',
                  },
                ].map((step, index) => {
                  const isCurrent = activeStep === index;
                  return (
                    <div
                      key={step.num}
                      ref={el => {
                        stepRefs.current[index] = el;
                      }}
                      onClick={() => setActiveStep(index)}
                      className={`p-5 rounded-lg transition-all cursor-pointer border-l-2 ${
                        isCurrent
                          ? 'bg-[#FAF8F5] border-l-[#1C1A18]'
                          : 'bg-transparent border-l-[#DED8CC] hover:bg-[#FAF8F5]/60 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono-meta text-[#7A756D] tabular-nums">
                          {step.num}
                        </span>
                        <h3 className="text-lg font-serif-literary font-medium text-[#1C1A18]">
                          {tr(step.titlePl, step.titleEn, step.titleEs, step.titleFr)}
                        </h3>
                      </div>
                      <p className="text-sm font-serif-literary text-[#524D46] leading-relaxed">
                        {tr(step.descPl, step.descEn, step.descEs, step.descFr)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Sticky Interactive Stage responding to activeStep */}
              <div className="lg:col-span-7 lg:sticky lg:top-24">
                <div className="bg-[#FAF8F5] border border-[#E5DFD3] rounded-xl overflow-hidden">
                  {/* Step Selector Tabs */}
                  <div className="flex items-center justify-between px-5 py-3 bg-[#F2EFE8] border-b border-[#E5DFD3] gap-2 overflow-x-auto">
                    <div className="flex items-center gap-1.5">
                      {[
                        {
                          idx: 0,
                          labelPl: '01. Margines',
                          labelEn: '01. Margin',
                          labelEs: '01. Margen',
                          labelFr: '01. Marge',
                        },
                        {
                          idx: 1,
                          labelPl: '02. Maszyna',
                          labelEn: '02. Typewriter',
                          labelEs: '02. Máquina',
                          labelFr: '02. Machine',
                        },
                        {
                          idx: 2,
                          labelPl: '03. Zamknięty dzień',
                          labelEn: '03. Sealed Day',
                          labelEs: '03. Día cerrado',
                          labelFr: '03. Jour clos',
                        },
                        {
                          idx: 3,
                          labelPl: '04. Dziennik',
                          labelEn: '04. Journal',
                          labelEs: '04. Diario',
                          labelFr: '04. Journal',
                        },
                      ].map(tab => (
                        <button
                          key={tab.idx}
                          type="button"
                          onClick={() => setActiveStep(tab.idx)}
                          className={`px-3 py-1.5 rounded-md text-xs font-mono-meta transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                            activeStep === tab.idx
                              ? 'bg-[#1C1A18] text-[#FAF8F5] font-medium'
                              : 'text-[#524D46] hover:text-[#1C1A18] hover:bg-[#E6E1D6]'
                          }`}
                        >
                          {tr(tab.labelPl, tab.labelEn, tab.labelEs, tab.labelFr)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stage Content */}
                  <div className="p-6 sm:p-8 min-h-[420px] flex flex-col justify-between">
                    {/* STEP 0: Question & Cursor-Aligned Margin Eye */}
                    {activeStep === 0 && (
                      <div className="flex-1 flex flex-col justify-between space-y-5 animate-in fade-in duration-150">
                        <h4 className="text-xl sm:text-2xl font-serif-literary text-[#1C1A18]">
                          {tr(
                            'Która rozmowa z ostatnich dni została w Tobie najdłużej?',
                            'What conversation from the last few days stayed with you the longest?',
                            '¿Qué conversación de los últimos días se quedó contigo más tiempo?',
                            'Quelle conversation de ces derniers jours est restée le plus longtemps en vous ?'
                          )}
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                          {/* Cursor-aligned margin ON THE LEFT with interactive Eye toggle */}
                          <div className="md:col-span-5 md:pt-4 flex flex-col items-start space-y-2 border-b md:border-b-0 md:border-r border-[#EAE5DA] pb-3 md:pb-0 md:pr-4">
                            <button
                              type="button"
                              onClick={() => setMarginEyeOpen(prev => !prev)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#DDD6C8] bg-[#F3EFE7] hover:bg-[#EAE5DA] text-xs font-mono-meta text-[#524D46] cursor-pointer transition-colors"
                            >
                              {marginEyeOpen ? (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-[#1C1A18]" />
                                  <span>
                                    {tr(
                                      'Ukryj margines',
                                      'Hide margin',
                                      'Ocultar margen',
                                      'Masquer la marge'
                                    )}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3.5 h-3.5 text-[#7A756D]" />
                                  <span>
                                    {tr(
                                      'Pokaż margines',
                                      'Show margin',
                                      'Mostrar margen',
                                      'Afficher la marge'
                                    )}
                                  </span>
                                </>
                              )}
                            </button>

                            {marginEyeOpen && (
                              <div className="pl-3 border-l border-[#D5CEC0] text-xs font-serif-literary italic text-[#6E675F] text-left">
                                {tr(
                                  '„Co sprawia, że na co dzień brakuje Wam takich rozmów?” →',
                                  '“What prevents you from having unhurried talks more often?” →',
                                  '«¿Qué os impide tener conversaciones sin prisa más a menudo?» →',
                                  '« Qu’est-ce qui vous empêche d’avoir ces échanges plus souvent ? » →'
                                )}
                              </div>
                            )}
                          </div>

                          {/* Written text on the right */}
                          <div className="md:col-span-7 space-y-2.5 text-base font-serif-literary text-[#1C1A18] leading-relaxed bg-[#F7F5F0] p-4 rounded-lg text-left">
                            <p className="italic font-bold text-[#1C1A18]">
                              {tr(
                                'Co powiedział brat, co najbardziej Cię zaskoczyło?',
                                'What did your brother say that surprised you the most?',
                                '¿Qué dijo tu hermano que más te sorprendió?',
                                'Qu’a dit votre frère qui vous a le plus surpris ?'
                              )}
                            </p>
                            <p className="text-[#1C1A18]">
                              {tr(
                                'Zadzwoniłem tylko na chwilę, a rozmawialiśmy bez pośpiechu przez godzinę.',
                                'I called just for a minute, and we ended up talking unhurriedly for an hour.',
                                'Llamé solo por un momento y terminamos hablando sin prisa durante una hora.',
                                'J’ai appelé pour une minute, et nous avons discuté sans hâte pendant une heure.'
                              )}
                              <span className="inline-block w-[2px] h-4 bg-[#8B2635] ml-1 align-middle animate-pulse" />
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#ECE7DC]">
                          <CompanionDesk
                            companionId={showcaseCompanion}
                            isTyping={isHeroTyping}
                            isSealed={false}
                            isSearching={false}
                            lang={lang}
                            onSelectCompanion={handleNextCompanion}
                          />
                        </div>
                      </div>
                    )}

                    {/* STEP 1: Typewriter Rhythm & Active Timer */}
                    {activeStep === 1 && (
                      <div className="flex-1 flex flex-col justify-between space-y-5 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between text-xs font-mono-meta text-[#7A756D] tabular-nums">
                          <span>
                            {tr(
                              'AKTYWNE PISANIE',
                              'ACTIVE WRITING',
                              'ESCRITURA ACTIVA',
                              'ÉCRITURE ACTIVE'
                            )}
                          </span>
                          <span>48s · 128 {tr('słów', 'words', 'palabras', 'mots')}</span>
                        </div>

                        <div className="bg-[#F7F5F0] p-5 rounded-lg">
                          <p className="text-base font-serif-literary text-[#1C1A18] leading-relaxed">
                            {tr(
                              'Każde uderzenie w klawisz porusza maszyną Twojego towarzysza. Gdy zatrzymujesz się, by pomyśleć, licznik cierpliwie czeka.',
                              'Every keystroke moves your companion’s typewriter. When you pause to think, the timer waits patiently.',
                              'Cada pulsación mueve la máquina de tu compañero. Cuando haces una pausa, el cronómetro espera contigo.',
                              'Chaque frappe anime la machine de votre compagnon. Lorsque vous faites une pause, le chronomètre attend patiemment.'
                            )}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <CompanionDesk
                            companionId={showcaseCompanion}
                            isTyping={isHeroTyping}
                            isSealed={false}
                            isSearching={false}
                            lang={lang}
                          />
                          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                            {COMPANIONS.slice(0, 5).map(comp => (
                              <button
                                key={comp.id}
                                type="button"
                                onClick={() => setShowcaseCompanion(comp.id)}
                                className={`px-2.5 py-1 rounded text-xs font-mono-meta transition-colors cursor-pointer whitespace-nowrap ${
                                  showcaseCompanion === comp.id
                                    ? 'bg-[#1C1A18] text-[#FAF8F5]'
                                    : 'bg-[#F2EFE8] text-[#524D46] hover:bg-[#EAE5DA]'
                                }`}
                              >
                                {comp.emoji} {tr(comp.namePl, comp.nameEn, comp.nameEs, comp.nameFr)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: Sealed Day Summary + Lighter Locked Ink + Reading Crocodile */}
                    {activeStep === 2 && (
                      <div className="flex-1 flex flex-col justify-between space-y-4 animate-in fade-in duration-150">
                        <div className="p-4 rounded-lg bg-[#EFECE4] text-[#1C1A18] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <p className="text-sm font-serif-literary text-[#1C1A18]">
                            {tr(
                              'Doskonała robota, to Twój 7. dzień z rzędu (48 s · 128 słów).',
                              'Great job, this is your 7th day in a row (48s · 128 words).',
                              'Excelente trabajo, este es tu 7.º día seguido (48s · 128 palabras).',
                              'Excellent travail, c’est votre 7e jour consécutif (48 s · 128 mots).'
                            )}
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveStep(3)}
                            className="px-3.5 py-1.5 rounded-md bg-[#1C1A18] text-[#FAF8F5] text-xs font-mono-meta whitespace-nowrap shrink-0 cursor-pointer hover:bg-[#33302B] transition-colors"
                          >
                            {tr(
                              'Otwórz Dziennik →',
                              'Open Journal →',
                              'Abrir Diario →',
                              'Ouvrir le Journal →'
                            )}
                          </button>
                        </div>

                        <div className="relative pt-2 pb-1 overflow-hidden max-h-[140px]">
                          <p className="text-base font-serif-literary text-[#A39C91] leading-relaxed">
                            {tr(
                              'Dzisiaj po południu zauważyłem, jak ciepłe światło pada na drewniany stół. Po zamknięciu dnia atrament jaśnieje i łagodnie rozpływa się nad biurkiem.',
                              'This afternoon I noticed how the warm light fell across the wooden table. Once sealed, the ink softens and gently fades above the desk.',
                              'Esta tarde noté cómo la luz cálida caía sobre la mesa. Al cerrar el día, la tinta se suaviza sobre el escritorio.',
                              'Cet après-midi, j’ai remarqué la lumière chaude sur la table en bois. Une fois la journée close, l’encre s’adoucit au-dessus du bureau.'
                            )}
                          </p>
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#FAF8F5] via-[#FAF8F5]/85 to-transparent" />
                        </div>

                        <div className="pt-1">
                          <CompanionDesk
                            companionId={showcaseCompanion}
                            isTyping={false}
                            isSealed={true}
                            isSearching={false}
                            lang={lang}
                            onSelectCompanion={handleNextCompanion}
                          />
                        </div>
                      </div>
                    )}

                    {/* STEP 3: Journal Calendar + Searching Companion with Magnifying Glass */}
                    {activeStep === 3 && (
                      <div className="flex-1 flex flex-col justify-between space-y-4 animate-in fade-in duration-150">
                        <div className="border-b border-[#ECE7DC] pb-2">
                          <CompanionDesk
                            companionId={showcaseCompanion}
                            isTyping={false}
                            isSealed={false}
                            isSearching={true}
                            lang={lang}
                            onSelectCompanion={handleNextCompanion}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start pt-1">
                          <div className="md:col-span-7 bg-[#F7F5F0] rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3 text-xs font-mono-meta text-[#1C1A18]">
                              <span className="font-semibold">
                                {tr(
                                  'PAŹDZIERNIK 2026',
                                  'OCTOBER 2026',
                                  'OCTUBRE 2026',
                                  'OCTOBRE 2026'
                                )}
                              </span>
                              <span className="text-[#7A756D] tabular-nums">
                                {tr(
                                  '14, 17, 19 paź',
                                  'Oct 14, 17, 19',
                                  '14, 17, 19 oct',
                                  '14, 17, 19 oct.'
                                )}
                              </span>
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-xs font-mono-meta tabular-nums">
                              {Array.from({ length: 21 }, (_, i) => i + 1).map(day => {
                                const hasEntry = day === 14 || day === 17 || day === 19;
                                const isSelected = selectedArchiveDay === day;
                                return (
                                  <button
                                    key={day}
                                    type="button"
                                    disabled={!hasEntry}
                                    onClick={() => hasEntry && setSelectedArchiveDay(day)}
                                    className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center transition-all ${
                                      isSelected
                                        ? 'bg-[#1C1A18] text-[#FAF8F5] font-semibold cursor-pointer'
                                        : hasEntry
                                        ? 'border border-[#1C1A18] text-[#1C1A18] font-medium hover:bg-[#EAE5DA] cursor-pointer'
                                        : 'text-[#B8B0A0] cursor-default'
                                    }`}
                                  >
                                    {day}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="md:col-span-5 bg-[#F7F5F0] rounded-lg p-4 space-y-2">
                            <div className="text-[10px] font-mono-meta text-[#7A756D] tabular-nums">
                              {tr(
                                currentArchiveDemo.dateLabelPl,
                                currentArchiveDemo.dateLabelEn,
                                currentArchiveDemo.dateLabelEs,
                                currentArchiveDemo.dateLabelFr
                              )}
                            </div>
                            <h5 className="text-sm font-serif-literary font-semibold text-[#1C1A18] leading-snug">
                              {tr(
                                currentArchiveDemo.promptPl,
                                currentArchiveDemo.promptEn,
                                currentArchiveDemo.promptEs,
                                currentArchiveDemo.promptFr
                              )}
                            </h5>
                            <p className="text-xs font-serif-literary text-[#524D46] leading-relaxed">
                              {tr(
                                currentArchiveDemo.textPl,
                                currentArchiveDemo.textEn,
                                currentArchiveDemo.textEs,
                                currentArchiveDemo.textFr
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. SMART PROMPTS & SOCRATIC MARGIN HINTS */}
        <section id="hints-section" className="border-t border-[#E5DFD3] bg-[#F3EFE7]/55 py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-xl space-y-2 mb-10">
              <div className="text-xs font-mono-meta text-[#7A756D]">
                {tr(
                  '02 · Pytania i Margines',
                  '02 · Prompts & Margin',
                  '02 · Preguntas y Margen',
                  '02 · Questions et Marge'
                )}
              </div>
              <h2
                className="text-3xl sm:text-4xl font-serif-literary text-[#1C1A18] leading-tight"
                style={{ textWrap: 'balance' }}
              >
                {tr(
                  'Pytania zamiast pustej kartki.',
                  'Questions instead of a blank page.',
                  'Preguntas en lugar de una hoja en blanco.',
                  'Des questions plutôt qu’une page blanche.'
                )}
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Left: 5 Categories Explorer */}
              <div className="lg:col-span-6 bg-[#FAF8F5] border border-[#E5DFD3] rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.filter(
                    (
                      c
                    ): c is {
                      id: PromptCategory;
                      labelPl: string;
                      labelEn: string;
                      labelEs: string;
                      labelFr: string;
                    } => c.id !== 'all'
                  ).map(cat => {
                    const active = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-md text-xs font-mono-meta transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-[#1C1A18] text-[#FAF8F5] font-medium'
                            : 'bg-[#F2EFE8] text-[#524D46] hover:text-[#1C1A18] hover:bg-[#EAE5DA]'
                        }`}
                      >
                        {tr(cat.labelPl, cat.labelEn, cat.labelEs, cat.labelFr)}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3 my-auto">
                  {categoryPrompts.slice(0, 2).map(p => {
                    const pSlug = getPromptSlug(p);
                    return (
                      <a
                        key={p.id}
                        href={`/prompts/${pSlug}`}
                        onClick={e => handleSpaLink(e, `/prompts/${pSlug}`)}
                        className="block p-4 rounded-lg bg-[#F7F5F0] hover:bg-[#EFECE4] border border-transparent hover:border-[#DDD6C8] transition-all space-y-1 group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-base font-serif-literary font-medium text-[#1C1A18] group-hover:text-[#8B2635] transition-colors">
                            {getPromptText(p, lang)}
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-[#7A756D] group-hover:text-[#1C1A18] shrink-0" />
                        </div>
                        <div className="text-xs font-serif-literary italic text-[#6E675F]">
                          {getHintText(p, lang)}
                        </div>
                      </a>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-[#ECE7DC] flex items-center justify-between text-xs font-mono-meta">
                  <span className="text-[#7A756D]">
                    {tr('47 indeksowanych pytań refleksyjnych', '47 indexable reflection prompts', '47 preguntas de reflexión', '47 questions de réflexion')}
                  </span>
                  <a
                    href="/prompts"
                    onClick={e => handleSpaLink(e, '/prompts')}
                    className="text-[#8B2635] hover:text-[#1C1A18] underline underline-offset-4 font-medium inline-flex items-center gap-1"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{tr('Otwórz bibliotekę /prompts →', 'Browse /prompts library →', 'Ver biblioteca /prompts →', 'Voir /prompts →')}</span>
                  </a>
                </div>
              </div>

              {/* Right: Interactive Socratic Margin Follow-up Demo */}
              <div className="lg:col-span-6 bg-[#FAF8F5] border border-[#E5DFD3] rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
                <div className="text-xs font-mono-meta text-[#7A756D]">
                  {tr(
                    'Kliknij zdanie, aby zobaczyć podpowiedź na marginesie:',
                    'Click a sentence to see the margin follow-up:',
                    'Haz clic en una frase para ver la pista en el margen:',
                    'Cliquez sur une phrase pour voir la piste en marge :'
                  )}
                </div>

                <div className="space-y-2">
                  {sampleThoughts.map((item, idx) => {
                    const active = selectedSampleThoughtIdx === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedSampleThoughtIdx(idx)}
                        className={`w-full text-left p-3 rounded-lg text-sm font-serif-literary transition-all cursor-pointer border-l-2 ${
                          active
                            ? 'bg-[#F7F5F0] border-l-[#1C1A18] text-[#1C1A18] font-medium'
                            : 'bg-[#F7F5F0]/50 border-l-transparent text-[#524D46] hover:bg-[#F7F5F0]'
                        }`}
                      >
                        „{item.thought}”
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 rounded-lg bg-[#F2EFE8] space-y-1.5 pl-4 border-l-2 border-l-[#EBC5CF]">
                  {sampleThoughts[selectedSampleThoughtIdx].followUps.slice(0, 2).map((q, qIdx) => (
                    <p
                      key={qIdx}
                      className="text-sm font-serif-literary italic font-bold text-[#1C1A18] leading-snug"
                    >
                      {q} →
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. WEEKLY LINE-ART CHARTS & WRITING STATISTICS SECTION */}
        <section id="stats-section" className="border-t border-[#E5DFD3] py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              {/* Left Column: Description & 4 Minimalist Metrics */}
              <div className="lg:col-span-5 space-y-6">
                <div className="space-y-3">
                  <div className="text-xs font-mono-meta text-[#7A756D]">
                    {tr(
                      '03 · Wykresy i statystyki pisania',
                      '03 · Charts & writing statistics',
                      '03 · Gráficos y estadísticas',
                      '03 · Graphiques et statistiques'
                    )}
                  </div>
                  <h2
                    className="text-3xl sm:text-4xl font-serif-literary text-[#1C1A18] leading-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    {tr(
                      'Lekkie, liniowe wykresy skupione na Twoim tygodniu.',
                      'Light, line-art charts focused on your week.',
                      'Gráficos lineales y ligeros centrados en tu semana.',
                      'Des graphiques linéaires et légers centrés sur votre semaine.'
                    )}
                  </h2>
                  <p className="text-base font-serif-literary text-[#524D46] leading-relaxed">
                    {tr(
                      'Zamiast ciężkich, blokowych tabel widzisz dwa rysunkowe wykresy w stylu naszego logo: rytm słów z ostatnich 7 dni oraz dokładną porę dnia, o której powstawały Twoje wpisy.',
                      'Instead of heavy blocky tables, see two hand-drawn line charts matching our logo aesthetic: your 7-day word rhythm and the exact time of day each entry was written.',
                      'En lugar de tablas pesadas, observa dos gráficos lineales del estilo de nuestro logo: el ritmo semanal de palabras y la hora exacta a la que escribiste cada día.',
                      'Au lieu de tableaux massifs, retrouvez deux graphiques linéaires dans le style de notre logo : le rythme hebdomadaire des mots et l’heure précise d’écriture de chaque jour.'
                    )}
                  </p>
                </div>

                {/* 4 Minimalist Metrics Preview */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#E5DFD3]">
                  <div className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E5DFD3] space-y-0.5">
                    <div className="text-[10px] font-mono-meta uppercase tracking-wider text-[#7A756D]">
                      {tr('Systematyczność', 'Consistency', 'Constancia', 'Régularité')}
                    </div>
                    <div className="text-xl font-serif-literary text-[#1C1A18] tabular-nums">
                      3{' '}
                      <span className="text-xs font-mono-meta text-[#7A756D]">
                        {tr('dni z rzędu', 'days in a row', 'días seguidos', 'jours de suite')}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono-meta text-[#7A756D]">
                      3/7 {tr('dni w tym tyg.', 'days this week', 'días esta sem.', 'jours cette sem.')}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E5DFD3] space-y-0.5">
                    <div className="text-[10px] font-mono-meta uppercase tracking-wider text-[#7A756D]">
                      {tr('Napisane słowa', 'Words written', 'Palabras escritas', 'Mots écrits')}
                    </div>
                    <div className="text-xl font-serif-literary text-[#1C1A18] tabular-nums">
                      412{' '}
                      <span className="text-xs font-mono-meta text-[#7A756D]">
                        {tr('słów', 'words', 'palabras', 'mots')}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono-meta text-[#8B2635] flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>3 {tr('zamknięte wpisy', 'sealed entries', 'entradas cerradas', 'entrées closes')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Compact 7-day Line-Art Charts (Words + Time of Day, interactive on hover) */}
              <div className="lg:col-span-7">
                <div className="bg-[#FAF8F5] border border-[#E5DFD3] rounded-2xl p-5 sm:p-7 space-y-5 max-w-xl mx-auto">
                  {/* Chart 1: 7-day Word Count Line-Art Chart */}
                  <div className="space-y-2 p-3.5 rounded-xl border border-transparent hover:border-[#E2DDD3] hover:bg-[#F7F5F0]/80 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-10px_rgba(28,26,24,0.1)]">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-mono-meta uppercase tracking-wider text-[#1C1A18] font-medium">
                          {tr(
                            'Rytm tygodnia · Liczba słów',
                            'Weekly rhythm · Word count',
                            'Ritmo semanal · Palabras',
                            'Rythme hebdomadaire · Mots'
                          )}
                        </div>
                        <div className="text-[10px] font-mono-meta text-[#7A756D] tabular-nums">
                          16.10 – 22.10 ·{' '}
                          {tr(
                            'najedź na dzień, aby podświetlić',
                            'hover a day to inspect',
                            'pasa el cursor sobre un día',
                            'survolez un jour'
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono-meta text-[#7A756D]">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#EBC5CF] border border-[#1C1A18] inline-block" />
                          <span>{tr('Zamknięty', 'Sealed', 'Cerrado', 'Clos')}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FAF8F5] border border-[#1C1A18] inline-block" />
                          <span>{tr('Szkic', 'Draft', 'Borrador', 'Brouillon')}</span>
                        </span>
                      </div>
                    </div>

                    <svg viewBox="0 0 380 145" className="w-full h-auto overflow-visible select-none">
                      <defs>
                        <linearGradient id="landingWordsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#EBC5CF" stopOpacity="0.45" />
                          <stop offset="100%" stopColor="#EBC5CF" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <line x1="28" y1="26" x2="352" y2="26" stroke="#E6E0D4" strokeWidth="1" strokeDasharray="3 4" />
                      <line x1="28" y1="64" x2="352" y2="64" stroke="#E6E0D4" strokeWidth="1" strokeDasharray="3 4" />
                      <line x1="28" y1="102" x2="352" y2="102" stroke="#1C1A18" strokeWidth="1.35" strokeLinecap="round" />

                      {/* Soft rose area under active days */}
                      <path
                        d="M 244 52 C 262 52, 280 28, 298 28 C 316 28, 334 44, 352 44 L 352 102 L 244 102 Z"
                        fill="url(#landingWordsGrad)"
                      />
                      {/* Smooth line-art curve */}
                      <path
                        d="M 28 102 L 82 102 L 136 102 L 190 102 C 208 102, 226 52, 244 52 C 262 52, 280 28, 298 28 C 316 28, 334 44, 352 44"
                        fill="none"
                        stroke="#1C1A18"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {[
                        { x: 28, y: 102, w: 0, day: tr('Pt', 'Fri', 'Vie', 'Ven'), date: '16.10' },
                        { x: 82, y: 102, w: 0, day: tr('Sob', 'Sat', 'Sáb', 'Sam'), date: '17.10' },
                        { x: 136, y: 102, w: 0, day: tr('Niedz', 'Sun', 'Dom', 'Dim'), date: '18.10' },
                        { x: 190, y: 102, w: 0, day: tr('Pon', 'Mon', 'Lun', 'Lun'), date: '19.10' },
                        { x: 244, y: 52, w: 118, day: tr('Wt', 'Tue', 'Mar', 'Mar'), date: '20.10' },
                        { x: 298, y: 28, w: 164, day: tr('Śr', 'Wed', 'Mié', 'Mer'), date: '21.10' },
                        { x: 352, y: 44, w: 130, day: tr('Czw', 'Thu', 'Jue', 'Jeu'), date: '22.10' },
                      ].map((pt, i) => {
                        const isHovered = hoveredLandingWordIdx === i;
                        const cyPos = pt.w > 0 && isHovered ? pt.y - 3 : pt.y;
                        return (
                          <g
                            key={i}
                            onMouseEnter={() => setHoveredLandingWordIdx(i)}
                            onMouseLeave={() => setHoveredLandingWordIdx(null)}
                            className="cursor-pointer"
                          >
                            <rect x={pt.x - 24} y={10} width={48} height={128} fill="transparent" />
                            {pt.w > 0 && (
                              <>
                                <line
                                  x1={pt.x}
                                  y1={cyPos}
                                  x2={pt.x}
                                  y2={102}
                                  stroke={isHovered ? '#8B2635' : '#1C1A18'}
                                  strokeWidth={isHovered ? '1.5' : '1.1'}
                                  strokeDasharray="2 2.5"
                                  opacity={isHovered ? '0.75' : '0.32'}
                                />
                                <text
                                  x={pt.x}
                                  y={cyPos - 9}
                                  textAnchor="middle"
                                  className={`text-[9.5px] font-mono-meta font-medium transition-colors duration-200 ${
                                    isHovered ? 'fill-[#8B2635] font-semibold' : 'fill-[#1C1A18]'
                                  }`}
                                >
                                  {pt.w}
                                </text>
                              </>
                            )}
                            {pt.w > 0 ? (
                              <>
                                {isHovered && (
                                  <circle
                                    cx={pt.x}
                                    cy={cyPos}
                                    r="9.5"
                                    fill="#EBC5CF"
                                    fillOpacity="0.45"
                                  />
                                )}
                                <circle
                                  cx={pt.x}
                                  cy={cyPos}
                                  r={isHovered ? '6' : '5'}
                                  fill={isHovered ? '#DF9FB0' : '#EBC5CF'}
                                  stroke={isHovered ? '#8B2635' : '#1C1A18'}
                                  strokeWidth={isHovered ? '1.8' : '1.6'}
                                  className="transition-all duration-200"
                                />
                                <circle
                                  cx={pt.x}
                                  cy={cyPos}
                                  r="1.6"
                                  fill={isHovered ? '#8B2635' : '#1C1A18'}
                                />
                              </>
                            ) : (
                              <circle
                                cx={pt.x}
                                cy={isHovered ? 100.5 : 102}
                                r={isHovered ? '3.3' : '2.5'}
                                fill={isHovered ? '#EBC5CF' : '#FAF8F5'}
                                stroke={isHovered ? '#8B2635' : '#B5B0A6'}
                                strokeWidth="1.3"
                                className="transition-all duration-200"
                              />
                            )}
                            <text
                              x={pt.x}
                              y={119}
                              textAnchor="middle"
                              className={`text-[9.5px] font-serif-literary transition-colors duration-200 ${
                                isHovered
                                  ? 'fill-[#8B2635] font-semibold'
                                  : pt.w > 0
                                  ? 'fill-[#1C1A18] font-medium'
                                  : 'fill-[#7A756D]'
                              }`}
                            >
                              {pt.day}
                            </text>
                            <text
                              x={pt.x}
                              y={132}
                              textAnchor="middle"
                              className={`text-[8.5px] font-mono-meta transition-colors duration-200 ${
                                isHovered ? 'fill-[#8B2635]' : 'fill-[#9E978C]'
                              }`}
                            >
                              {pt.date}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Chart 2: Time-of-Day Writing Schedule (06:00 at bottom, 23:00 at top) */}
                  <div className="pt-4 border-t border-[#ECE7DC] space-y-2 p-3.5 rounded-xl border border-transparent hover:border-[#E2DDD3] hover:bg-[#F7F5F0]/80 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-10px_rgba(28,26,24,0.1)]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-mono-meta uppercase tracking-wider text-[#1C1A18] font-medium">
                        {tr(
                          'Pora pisania każdego dnia',
                          'Time of writing each day',
                          'Hora de escritura cada día',
                          'Heure d’écriture chaque jour'
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-[#F2EFE8] border border-[#E2DDD3] text-[10px] font-mono-meta text-[#1C1A18] tabular-nums">
                        {tr('Śr. pora:', 'Avg time:', 'Hora media:', 'Heure moy. :')} 21:15
                      </span>
                    </div>

                    <svg viewBox="0 0 380 128" className="w-full h-auto overflow-visible select-none">
                      {/* Inverted Y-axis: 23:00 at top (y=26), 14:00 in middle (y=60), 06:00 at bottom (y=94) */}
                      <text x="0" y="29" className="fill-[#8C857B] text-[8.5px] font-mono-meta">23:00</text>
                      <text x="0" y="63" className="fill-[#8C857B] text-[8.5px] font-mono-meta">14:00</text>
                      <text x="0" y="97" className="fill-[#8C857B] text-[8.5px] font-mono-meta">06:00</text>
                      <line x1="34" y1="26" x2="352" y2="26" stroke="#E6E0D4" strokeWidth="1" strokeDasharray="3 4" />
                      <line x1="34" y1="60" x2="352" y2="60" stroke="#E6E0D4" strokeWidth="1" strokeDasharray="3 4" />
                      <line x1="34" y1="94" x2="352" y2="94" stroke="#1C1A18" strokeWidth="1.35" strokeLinecap="round" />

                      {/* Subtle vertical day tracks */}
                      {[42, 92, 142, 192, 244, 298, 352].map((xPos, idx) => (
                        <line
                          key={`track-${idx}`}
                          x1={xPos}
                          y1={26}
                          x2={xPos}
                          y2={94}
                          stroke="#ECE7DC"
                          strokeWidth="1"
                        />
                      ))}

                      {/* Smooth dashed curve connecting evening writing times near 23:00 top */}
                      <path
                        d="M 244 33 C 262 33, 280 36, 298 36 C 316 36, 334 30, 352 30"
                        fill="none"
                        stroke="#1C1A18"
                        strokeWidth="1.65"
                        strokeDasharray="4 3"
                        strokeLinecap="round"
                      />
                      {[
                        { x: 42, y: null, t: null, d: '16.10' },
                        { x: 92, y: null, t: null, d: '17.10' },
                        { x: 142, y: null, t: null, d: '18.10' },
                        { x: 192, y: null, t: null, d: '19.10' },
                        { x: 244, y: 33, t: '21:10', d: '20.10' },
                        { x: 298, y: 36, t: '20:45', d: '21.10' },
                        { x: 352, y: 30, t: '21:50', d: '22.10' },
                      ].map((pt, i) => {
                        const isHovered = hoveredLandingTimeIdx === i;
                        const cyPos = pt.y !== null ? (isHovered ? pt.y - 3 : pt.y) : null;
                        return (
                          <g
                            key={i}
                            onMouseEnter={() => setHoveredLandingTimeIdx(i)}
                            onMouseLeave={() => setHoveredLandingTimeIdx(null)}
                            className="cursor-pointer"
                          >
                            <rect x={pt.x - 24} y={8} width={48} height={112} fill="transparent" />
                            {cyPos !== null && pt.t ? (
                              <>
                                <line
                                  x1={pt.x}
                                  y1={cyPos}
                                  x2={pt.x}
                                  y2={94}
                                  stroke={isHovered ? '#8B2635' : '#1C1A18'}
                                  strokeWidth={isHovered ? '1.5' : '1.1'}
                                  strokeDasharray="2 2.5"
                                  opacity={isHovered ? '0.75' : '0.32'}
                                />
                                {isHovered && (
                                  <circle
                                    cx={pt.x}
                                    cy={cyPos}
                                    r="9.5"
                                    fill="#EBC5CF"
                                    fillOpacity="0.45"
                                  />
                                )}
                                <circle
                                  cx={pt.x}
                                  cy={cyPos}
                                  r={isHovered ? '6' : '5'}
                                  fill={isHovered ? '#DF9FB0' : '#EBC5CF'}
                                  stroke={isHovered ? '#8B2635' : '#1C1A18'}
                                  strokeWidth={isHovered ? '1.8' : '1.6'}
                                  className="transition-all duration-200"
                                />
                                <circle
                                  cx={pt.x}
                                  cy={cyPos}
                                  r="1.6"
                                  fill={isHovered ? '#8B2635' : '#1C1A18'}
                                />
                                <rect
                                  x={pt.x - 16}
                                  y={cyPos - 20}
                                  width="32"
                                  height="12.5"
                                  rx="3.5"
                                  fill={isHovered ? '#8B2635' : '#FAF8F5'}
                                  stroke={isHovered ? '#8B2635' : '#DDD6C8'}
                                  strokeWidth="1"
                                  className="transition-all duration-200"
                                />
                                <text
                                  x={pt.x}
                                  y={cyPos - 11.2}
                                  textAnchor="middle"
                                  className={`text-[8.5px] font-mono-meta font-medium transition-colors duration-200 ${
                                    isHovered ? 'fill-[#FAF8F5]' : 'fill-[#1C1A18]'
                                  }`}
                                >
                                  {pt.t}
                                </text>
                              </>
                            ) : (
                              <circle
                                cx={pt.x}
                                cy={isHovered ? 92.5 : 94}
                                r={isHovered ? '3.2' : '2.3'}
                                fill={isHovered ? '#EBC5CF' : '#FAF8F5'}
                                stroke={isHovered ? '#8B2635' : '#C8C2B4'}
                                strokeWidth="1.3"
                                className="transition-all duration-200"
                              />
                            )}
                            <text
                              x={pt.x}
                              y={112}
                              textAnchor="middle"
                              className={`text-[8.5px] font-mono-meta transition-colors duration-200 ${
                                isHovered
                                  ? 'fill-[#8B2635] font-semibold'
                                  : pt.y !== null
                                  ? 'fill-[#524D46] font-medium'
                                  : 'fill-[#9E978C]'
                              }`}
                            >
                              {pt.d}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. MOBILE + SIMPLE PWA INSTALLATION + VOICE DICTATION SECTION */}
        <section id="mobile-section" className="border-t border-[#E5DFD3] bg-[#F3EFE7]/55 py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left Column: Mobile & Simple Installation Features */}
              <div className="lg:col-span-5 space-y-6">
                <div className="space-y-3">
                  <div className="text-xs font-mono-meta text-[#8B2635] flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    <span>
                      {tr(
                        '04 · Mobile + Prosta instalacja',
                        '04 · Mobile + Simple Installation',
                        '04 · Móvil + Instalación sencilla',
                        '04 · Mobile + Installation simple'
                      )}
                    </span>
                  </div>

                  <h2
                    className="text-3xl sm:text-4xl font-serif-literary text-[#1C1A18] leading-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    {tr(
                      'Zainstaluj na telefonie jednym kliknięciem i dyktuj myśli głosem.',
                      'Install on your phone in one tap and dictate your thoughts by voice.',
                      'Instálalo en tu móvil con un toque y dicta tus pensamientos por voz.',
                      'Installez sur votre téléphone en un geste et dictez vos pensées à la voix.'
                    )}
                  </h2>

                  <p className="text-base font-serif-literary text-[#524D46] leading-relaxed">
                    {tr(
                      'Bez sklepów z aplikacjami i bez ciężkich instalacji. Dodaj Momenty do ekranu głównego (Android i iOS), aby uruchamiać czystą kartkę w pełnym ekranie — z obsługą offline i mobilnymi ułatwieniami.',
                      'No app stores or bloated downloads. Add Moments to your home screen (Android & iOS) to open a fullscreen page with offline support and mobile-first writing tools.',
                      'Sin tiendas de aplicaciones. Añade Moments a tu pantalla de inicio (Android e iOS) para abrir tu página a pantalla completa con modo sin conexión y herramientas móviles.',
                      'Sans boutique d’applications. Ajoutez Moments à votre écran d’accueil (Android et iOS) pour ouvrir votre page en plein écran avec mode hors-ligne et outils mobiles.'
                    )}
                  </p>
                </div>

                {/* 3 Mobile Feature Highlights */}
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5DFD3] flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-[#F2EFE8] border border-[#DDD6C8] flex items-center justify-center shrink-0 mt-0.5">
                      <Mic className="w-4 h-4 text-[#8B2635]" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-serif-literary font-semibold text-[#1C1A18]">
                        {tr(
                          'Mobilne dyktowanie głosem',
                          'Mobile voice dictation',
                          'Dictado por voz en el móvil',
                          'Dictée vocale sur mobile'
                        )}
                      </h3>
                      <p className="text-xs font-serif-literary text-[#524D46] leading-relaxed">
                        {tr(
                          'Pływający przycisk mikrofonu nad klawiaturą oraz przycisk „Dyktuj” w pasku pozwalają mówić swobodnie na spacerze lub przed snem — słowa od razu zamieniają się w tekst.',
                          'A floating microphone button and the sticky “Dictate” button let you speak freely on a walk or before sleep — turning your voice directly into text.',
                          'Un botón de micrófono flotante y «Dictar» en la barra te permiten hablar con naturalidad y convertir tu voz en texto al instante.',
                          'Un bouton microphone flottant et le bouton « Dicter » vous permettent de parler librement — votre voix se transforme instantanément en texte.'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5DFD3] flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-[#F2EFE8] border border-[#DDD6C8] flex items-center justify-center shrink-0 mt-0.5">
                      <Eye className="w-4 h-4 text-[#1C1A18]" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-serif-literary font-semibold text-[#1C1A18]">
                        {tr(
                          'Przyklejony pasek z pytaniem pomocniczym',
                          'Sticky bar with follow-up question',
                          'Barra fija con pregunta de seguimiento',
                          'Barre fixe avec question de relance'
                        )}
                      </h3>
                      <p className="text-xs font-serif-literary text-[#524D46] leading-relaxed">
                        {tr(
                          'Gdy przewijasz dłuższy wpis na telefonie, pasek z dyktowaniem, korektą pisowni, pogrubieniem oraz pytaniem pomocniczym pozostaje przyklejony u góry ekranu.',
                          'As you scroll through a longer entry on your phone, the toolbar with dictation, spellcheck, formatting, and the follow-up question stays pinned at the top.',
                          'Al desplazarte por tu entrada en el móvil, la barra con dictado, ortografía y la pregunta de apoyo permanece visible arriba.',
                          'Lorsque vous faites défiler votre texte sur mobile, la barre avec dictée, correction et question de relance reste épinglée en haut.'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5DFD3] flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-[#F2EFE8] border border-[#DDD6C8] flex items-center justify-center shrink-0 mt-0.5">
                      <Download className="w-4 h-4 text-[#2E5C33]" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-serif-literary font-semibold text-[#1C1A18]">
                        {tr(
                          'Prosta instalacja w 5 sekund (Android i iOS)',
                          'Simple 5-second installation (Android & iOS)',
                          'Instalación sencilla en 5 segundos (Android e iOS)',
                          'Installation simple en 5 secondes (Android et iOS)'
                        )}
                      </h3>
                      <p className="text-xs font-serif-literary text-[#524D46] leading-relaxed">
                        {tr(
                          'Kliknij przycisk poniżej, aby dodać ikonę chmurki i słońca do ekranu telefonu. Wpisy synchronizują się z komputerem zaraz po połączeniu.',
                          'Tap the button below to add the cloud & sun icon to your phone’s home screen. Entries sync seamlessly with your computer.',
                          'Toca el botón de abajo para añadir el icono a tu pantalla de inicio. Tus entradas se sincronizan automáticamente con tu ordenador.',
                          'Appuyez sur le bouton ci-dessous pour ajouter l’icône à votre écran d’accueil. Vos entrées se synchronisent avec votre ordinateur.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-1 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="px-5 py-3 rounded-lg bg-[#1C1A18] hover:bg-[#33302B] text-[#FAF8F5] text-xs font-mono-meta font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Smartphone className="w-4 h-4 text-[#EBC5CF]" />
                    <span>
                      {isInstalled
                        ? tr(
                            'Aplikacja zainstalowana na urządzeniu',
                            'App installed on this device',
                            'Aplicación instalada en el dispositivo',
                            'Application installée sur cet appareil'
                          )
                        : tr(
                            'Zainstaluj aplikację mobilną (Android / iOS)',
                            'Install mobile app (Android / iOS)',
                            'Instalar aplicación móvil (Android / iOS)',
                            'Installer l’application mobile (Android / iOS)'
                          )}
                    </span>
                  </button>
                </div>
              </div>

              {/* Right Column: Larger, Generous Mobile App Preview with Sticky Bar + Follow-up Hint + Voice Dictation + Companion */}
              <div className="lg:col-span-7 flex justify-center">
                <div className="w-full max-w-[490px] rounded-2xl bg-[#FAF8F5] border border-[#E5DFD3] p-6 sm:p-8 space-y-5 relative transition-all duration-300 hover:-translate-y-0.5 hover:border-[#DDD6C8] hover:shadow-[0_8px_24px_-12px_rgba(28,26,24,0.08)]">
                  {/* Top Phone Header */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-[#ECE7DC] text-xs font-mono-meta text-[#7A756D]">
                    <div className="flex items-center gap-2 text-[#1C1A18] font-serif-literary font-semibold text-base">
                      <svg viewBox="0 0 36 26" className="w-6 h-4.5 shrink-0 overflow-visible" aria-hidden="true">
                        <circle cx="26" cy="9" r="5.5" fill="#EBC5CF" stroke="#1C1A18" strokeWidth="1.8" />
                        <path
                          d="M6 21 H26 C29 21 30.5 18.5 29.5 16 C28.8 14 26.8 13.5 25.5 14 C24.5 10 20.5 8 17 9.5 C14.5 7.5 10.5 8.5 9.5 12 C6.5 12.2 4 14.5 4.2 17.5 C4.3 19.5 5 21 6 21 Z"
                          fill="#FAF8F5"
                          stroke="#1C1A18"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>{tr('Momenty', 'Moments', 'Moments', 'Moments')}</span>
                    </div>
                    <span className="tabular-nums">22 PAŹ · 1/3</span>
                  </div>

                  {/* Sticky Mobile Toolbar + Pinned Follow-Up Question */}
                  <div className="rounded-xl bg-[#F7F5F0] border border-[#E5DFD3] p-3.5 sm:p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs font-mono-meta">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#8B2635] text-[#FAF8F5] font-medium">
                          <span className="w-2 h-2 rounded-full bg-[#FAF8F5] animate-ping" />
                          <Mic className="w-3.5 h-3.5" />
                          <span>{tr('Słucham...', 'Listening...', 'Escuchando...', 'Écoute...')}</span>
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-[#FAF8F5] border border-[#DDD6C8] font-serif-literary font-bold text-[#1C1A18]">
                          B
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-[#FAF8F5] border border-[#DDD6C8] font-serif-literary italic text-[#1C1A18]">
                          I
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-md bg-[#FAF8F5] border border-[#DDD6C8] text-[#524D46]">
                        {tr('Popraw pisownię', 'Fix spelling', 'Ortografía', 'Orthographe')}
                      </span>
                    </div>

                    {/* Pinned Mobile Follow-up Question inside Sticky Bar */}
                    <div className="pt-2.5 border-t border-[#E6E0D4] flex items-start justify-between gap-2.5 text-left">
                      <p className="text-xs sm:text-sm font-serif-literary italic text-[#524D46] leading-snug">
                        {tr(
                          '„Co w tej chwili dało Ci najwięcej spokoju?” →',
                          '“What gave you the most peace in that moment?” →',
                          '«¿Qué te dio más paz en ese momento?» →',
                          '« Qu’est-ce qui vous a apporté le plus de calme à cet instant ? » →'
                        )}
                      </p>
                      <Eye className="w-3.5 h-3.5 text-[#7A756D] shrink-0 mt-0.5" />
                    </div>
                  </div>

                  {/* Mobile Writing Area */}
                  <div className="p-4 sm:p-5 rounded-xl bg-[#F7F5F0]/55 border border-[#ECE7DC] space-y-3 text-left min-h-[195px] relative">
                    <div className="text-base sm:text-lg font-serif-literary font-semibold text-[#1C1A18] leading-snug">
                      {tr(
                        'Jaki drobny moment z dzisiejszego dnia chciałbyś zapamiętać?',
                        'What small moment from today would you like to remember?',
                        '¿Qué pequeño momento de hoy te gustaría recordar?',
                        'Quel petit moment d’aujourd’hui aimeriez-vous retenir ?'
                      )}
                    </div>
                    <p className="text-sm sm:text-base font-serif-literary text-[#1C1A18] leading-relaxed pr-10">
                      {tr(
                        'Wracając wieczorem do domu, nagrałem tę myśl głosem. Nawet na telefonie mam pod ręką pytanie pomocnicze i odblokowanie dnia...',
                        'Walking home in the evening, I dictated this thought by voice. Even on my phone, the follow-up question stays pinned right above...',
                        'Volviendo a casa por la noche, dicté este pensamiento por voz con la pregunta de apoyo siempre visible arriba...',
                        'En rentrant ce soir, j’ai dicté cette pensée à la voix avec la question de relance toujours visible en haut...'
                      )}
                      <span className="inline-block w-[2px] h-4 bg-[#8B2635] ml-0.5 align-middle animate-pulse" />
                    </p>

                    {/* Floating Mobile Dictation Mic Button */}
                    <div className="absolute right-3.5 bottom-3.5 w-10 h-10 rounded-full bg-[#8B2635] text-[#FAF8F5] flex items-center justify-center shadow-xs border border-[#8B2635]">
                      <Mic className="w-4.5 h-4.5" />
                    </div>
                  </div>

                  {/* Companion at the Mobile Desk */}
                  <div className="pt-1">
                    <CompanionDesk
                      companionId={showcaseCompanion}
                      isTyping={isHeroTyping}
                      isSealed={false}
                      isSearching={false}
                      lang={lang}
                      onSelectCompanion={handleNextCompanion}
                    />
                  </div>

                  {/* Mobile Bottom Footer with Unlock / Seal Day */}
                  <div className="pt-3 border-t border-[#ECE7DC] flex items-center justify-between text-xs font-mono-meta text-[#7A756D]">
                    <span>{tr('Dziennik · Wykresy', 'Journal · Charts', 'Diario · Gráficos', 'Journal · Graphiques')}</span>
                    <span className="inline-flex items-center gap-1.5 text-[#1C1A18] font-medium">
                      <Unlock className="w-3.5 h-3.5 text-[#8B2635]" />
                      <span>{tr('Zamknij / Odblokuj dzień', 'Close / Unlock day', 'Cerrar / Abrir día', 'Clore / Ouvrir')}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. SECURITY & END-TO-END ENCRYPTION (E2EE) SECTION */}
        <section id="security-section" className="border-t border-[#E5DFD3] py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Left Concise Column */}
              <div className="lg:col-span-5 space-y-5">
                <div className="space-y-3">
                  <div className="text-xs font-mono-meta text-[#2E6F40] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {tr(
                        '05 · Szyfrowanie E2EE',
                        '05 · E2EE Security',
                        '05 · Cifrado E2EE',
                        '05 · Chiffrement E2EE'
                      )}
                    </span>
                  </div>

                  <h2
                    className="text-3xl sm:text-4xl font-serif-literary text-[#1C1A18] leading-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    {tr(
                      'Szyfrowane zanim opuści Twoją przeglądarkę.',
                      'Encrypted before it leaves your browser.',
                      'Cifrado antes de salir de tu navegador.',
                      'Chiffré avant même de quitter votre navigateur.'
                    )}
                  </h2>

                  <p className="text-base font-serif-literary text-[#524D46] leading-relaxed">
                    {tr(
                      'Klucze AES-GCM 256 synchronizują się automatycznie z kontem Google między telefonem a komputerem. Dla dodatkowej ochrony możesz też ustawić własny PIN.',
                      'Your AES-GCM 256 keys sync automatically with your Google account across phone and computer. You can also set an optional custom PIN.',
                      'Tus claves AES-GCM 256 se sincronizan automáticamente con tu cuenta de Google entre móvil y ordenador, con opción de PIN propio.',
                      'Vos clés AES-GCM 256 se synchronisent automatiquement avec votre compte Google entre téléphone et ordinateur, avec option de code PIN personnel.'
                    )}
                  </p>
                </div>

                <div className="space-y-2 pt-3 border-t border-[#E5DFD3] text-xs font-mono-meta text-[#524D46]">
                  <div>01. AES-GCM 256 · PBKDF2</div>
                  <div>
                    02.{' '}
                    {tr(
                      'Automatyczna synchronizacja (Telefon ↔ Komputer)',
                      'Automatic sync (Phone ↔ Computer)',
                      'Sincronización automática (Móvil ↔ Ordenador)',
                      'Synchronisation automatique (Téléphone ↔ Ordinateur)'
                    )}
                  </div>
                  <div>
                    03.{' '}
                    {tr(
                      'Opcjonalny własny PIN i nazwa urządzenia',
                      'Optional custom PIN & device recognition',
                      'PIN opcional y reconocimiento de dispositivo',
                      'Code PIN optionnel et reconnaissance d’appareil'
                    )}
                  </div>
                </div>
              </div>

              {/* Right Interactive Live Encryption Inspector */}
              <div className="lg:col-span-7 bg-[#FAF8F5] border border-[#E5DFD3] rounded-xl p-6 sm:p-8 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#ECE7DC]">
                  <span className="text-xs font-mono-meta text-[#1C1A18] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#2E6F40]" />
                    {tr(
                      'Test szyfrowania na żywo',
                      'Live encryption test',
                      'Prueba de cifrado en vivo',
                      'Test de chiffrement en direct'
                    )}
                  </span>

                  <div className="flex items-center gap-1 p-1 bg-[#EFECE4] rounded-lg">
                    <button
                      type="button"
                      onClick={() => setDemoViewMode('decrypted')}
                      className={`px-3 py-1 rounded text-xs font-mono-meta transition-colors cursor-pointer whitespace-nowrap ${
                        demoViewMode === 'decrypted'
                          ? 'bg-[#1C1A18] text-[#FAF8F5]'
                          : 'text-[#524D46] hover:text-[#1C1A18]'
                      }`}
                    >
                      {tr('Twój widok', 'Your view', 'Tu vista', 'Votre vue')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDemoViewMode('encrypted')}
                      className={`px-3 py-1 rounded text-xs font-mono-meta transition-colors cursor-pointer whitespace-nowrap ${
                        demoViewMode === 'encrypted'
                          ? 'bg-[#1C1A18] text-[#FAF8F5]'
                          : 'text-[#524D46] hover:text-[#1C1A18]'
                      }`}
                    >
                      {tr(
                        'W bazie (Szyfrogram)',
                        'In database (Ciphertext)',
                        'En base de datos',
                        'En base (Texte chiffré)'
                      )}
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={demoSecretText}
                  onChange={e => setDemoSecretText(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#F7F5F0] border border-[#DDD6C8] text-sm font-serif-literary text-[#1C1A18] focus:outline-none focus:border-[#1C1A18]"
                />

                {demoViewMode === 'encrypted' ? (
                  <div className="rounded-lg bg-[#F7F5F0] p-4 space-y-3">
                    <div className="font-mono-meta text-[11px] text-[#9E978C] break-all leading-relaxed select-none opacity-65">
                      {liveEncrypted.encryptedContent} · IV:{liveEncrypted.iv}
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E5DFD3] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-mono-meta text-[#1C1A18]">
                        <Lock className="w-3.5 h-3.5 text-[#8B2635] shrink-0" />
                        <span>
                          {tr(
                            'Urządzenie klucza: MacBook (Chrome)',
                            'Key device: MacBook (Chrome)',
                            'Dispositivo: MacBook (Chrome)',
                            'Appareil de la clé : MacBook (Chrome)'
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDemoViewMode('decrypted')}
                        className="px-3 py-1.5 rounded-md bg-[#1C1A18] text-[#FAF8F5] text-xs font-mono-meta whitespace-nowrap shrink-0 cursor-pointer hover:bg-[#33302B]"
                      >
                        {tr('Odblokuj wpis', 'Unlock entry', 'Desbloquear', 'Déverrouiller')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-[#F7F5F0] space-y-1">
                    <div className="text-[11px] font-mono-meta text-[#2E6F40] flex items-center gap-1.5">
                      <Lock className="w-3 h-3" />
                      <span>
                        {tr(
                          'Odszyfrowane w przeglądarce (Telefon ↔ Komputer)',
                          'Decrypted in browser (Phone ↔ Computer)',
                          'Descifrado en el navegador (Móvil ↔ Ordenador)',
                          'Déchiffré dans le navigateur (Téléphone ↔ Ordinateur)'
                        )}
                      </span>
                    </div>
                    <p className="text-base font-serif-literary text-[#1C1A18]">
                      {demoSecretText ||
                        tr('(Pusty wpis)', '(Empty entry)', '(Entrada vacía)', '(Entrée vide)')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 5. FINAL CONVERSION SECTION */}
        <section className="border-t border-[#E5DFD3] bg-[#F2EFE8] py-16">
          <div className="max-w-2xl mx-auto px-6 text-center space-y-5">
            <h2
              className="text-3xl sm:text-4xl font-serif-literary text-[#1C1A18] leading-tight"
              style={{ textWrap: 'balance' }}
            >
              {tr(
                'Zacznij swój pierwszy moment dzisiaj.',
                'Start your first moment today.',
                'Empieza tu primer momento hoy.',
                'Commencez votre premier moment aujourd’hui.'
              )}
            </h2>
            <div>
              <button
                type="button"
                onClick={onGoogleLogin}
                disabled={isAuthLoading}
                className="px-7 py-3.5 text-sm font-mono-meta font-medium text-[#FAF8F5] bg-[#1C1A18] hover:bg-[#33302B] rounded-lg transition-all inline-flex items-center gap-2.5 cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                <span>
                  {isAuthLoading
                    ? tr('Łączenie...', 'Connecting...', 'Conectando...', 'Connexion...')
                    : tr(
                        'Stwórz konto / Zaloguj',
                        'Create account / Sign in',
                        'Crear cuenta / Entrar',
                        'Créer un compte / Connexion'
                      )}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* QUIET FOOTER WITH CRAWLABLE PROGRAMMATIC PROMPT LINKS */}
      <footer
        className={`${
          showAppLoginScreen ? 'hidden' : 'block'
        } border-t border-[#E5DFD3] bg-[#F7F5F0] py-8`}
      >
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-mono-meta text-[#7A756D]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="inline-flex items-center gap-2 text-[#1C1A18] font-serif-literary font-semibold text-sm">
              <span>{tr('Momenty', 'Moments', 'Moments', 'Moments')}</span>
            </span>
            <span aria-hidden="true">·</span>
            <a
              href="/prompts"
              onClick={e => handleSpaLink(e, '/prompts')}
              className="hover:text-[#1C1A18] underline underline-offset-4"
            >
              {tr('Biblioteka pytań (/prompts)', 'Reflection Prompts (/prompts)', 'Preguntas (/prompts)', 'Questions (/prompts)')}
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="/prompts/overcoming-burnout"
              onClick={e => handleSpaLink(e, '/prompts/overcoming-burnout')}
              className="hover:text-[#1C1A18] underline underline-offset-4"
            >
              /prompts/overcoming-burnout
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="/prompts/evening-gratitude"
              onClick={e => handleSpaLink(e, '/prompts/evening-gratitude')}
              className="hover:text-[#1C1A18] underline underline-offset-4"
            >
              /prompts/evening-gratitude
            </a>
          </div>

          <button
            type="button"
            onClick={onReturnToEditor || onGoogleLogin}
            className="hover:text-[#1C1A18] underline underline-offset-4 transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            <Lock className="w-3 h-3" />
            <span>
              {userName || tr('Konto', 'Account', 'Cuenta', 'Compte')}
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
};
