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
  Sparkles,
  Share2,
  Wand2,
  Clock,
  Calendar,
  Copy,
  ShieldAlert,
} from 'lucide-react';
import { CompanionDesk, COMPANIONS, CompanionId } from './CompanionDesk';
import {
  DAILY_PROMPTS,
  CATEGORIES,
  PromptCategory,
  Language,
  getPromptText,
  getHintText,
  getCategoryLabel,
  getPromptSlug,
  getPromptSeoDetails,
  formatDateKey,
  FREE_THOUGHT_PROMPT,
  FREE_THOUGHT_PROMPT_ID,
} from '../data/prompts';
import { encryptText, EncryptedPayload } from '../services/crypto';
import { autoFixPolishText } from '../services/writingAssistant';
import { generateLocalDynamicQuestionsForLang } from '../services/dynamicQuestions';
import { usePWAInstall } from '../services/pwa';
import { SparkleModal, SparkleAppreciationCard } from './SparkleModal';

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
  // LOGGED-IN STYLE GUEST SANCTUARY STATE (ABOVE THE FOLD)
  // ===========================================================================
  const todayKey = formatDateKey(new Date());
  const [heroPromptsPool, setHeroPromptsPool] = useState(() => [
    DAILY_PROMPTS[0],
    DAILY_PROMPTS.find(p => p.slug === 'overcoming-burnout') || DAILY_PROMPTS[11],
    DAILY_PROMPTS.find(p => p.slug === 'daily-nature-respite') || DAILY_PROMPTS[2],
  ]);
  const [plgPromptIdx, setPlgPromptIdx] = useState<number>(0);
  const [plgRemainingRerolls, setPlgRemainingRerolls] = useState<number>(3);
  const [plgShowCategoryMenu, setPlgShowCategoryMenu] = useState<boolean>(false);
  const [plgFreeThought, setPlgFreeThought] = useState<boolean>(false);
  const activeHeroPrompt = plgFreeThought
    ? FREE_THOUGHT_PROMPT
    : heroPromptsPool[plgPromptIdx] || DAILY_PROMPTS[0];
  const activeHeroSeo = getPromptSeoDetails(activeHeroPrompt, lang);

  const [plgShowMarginHints, setPlgShowMarginHints] = useState<boolean>(true);
  const [plgMarginIdx, setPlgMarginIdx] = useState<number>(0);
  const [plgIsRotatingMargin, setPlgIsRotatingMargin] = useState<boolean>(false);

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

  useEffect(() => {
    setPlgMarginIdx(0);
  }, [activeHeroPrompt.id, plgFreeThought]);

  const dynamicMarginPool = generateLocalDynamicQuestionsForLang(
    plgDraft,
    getPromptText(activeHeroPrompt, lang),
    lang
  );
  const marginFollowUpPool =
    dynamicMarginPool && dynamicMarginPool.length > 0
      ? dynamicMarginPool
      : activeHeroSeo.followUpQuestions && activeHeroSeo.followUpQuestions.length > 0
      ? activeHeroSeo.followUpQuestions
      : [getHintText(activeHeroPrompt, lang)];
  const currentPlgMarginQuestion =
    marginFollowUpPool[plgMarginIdx % marginFollowUpPool.length] ||
    getHintText(activeHeroPrompt, lang);

  const [plgWritingSeconds, setPlgWritingSeconds] = useState<number>(0);
  const [isPlgUserTyping, setIsPlgUserTyping] = useState<boolean>(false);
  const [isPlgListening, setIsPlgListening] = useState<boolean>(false);
  const [plgSpeechError, setPlgSpeechError] = useState<string | null>(null);
  const [plgSpellStatus, setPlgSpellStatus] = useState<'idle' | 'fixed' | 'clean'>('idle');
  const [plgFixedCount, setPlgFixedCount] = useState<number>(0);
  const [plgPreviousContent, setPlgPreviousContent] = useState<string | null>(null);
  const [showPlgConversionModal, setShowPlgConversionModal] = useState<boolean>(false);
  const heroTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const plgTypingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const plgSpeechRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (plgSpeechRef.current) {
        try {
          plgSpeechRef.current.onend = null;
          plgSpeechRef.current.stop();
        } catch {
          // ignore
        }
        plgSpeechRef.current = null;
      }
    };
  }, []);

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

  const transformPlgAutoMarkup = (raw: string): string => {
    return raw
      .replace(/\*\*\*([^*\n]+)\*\*\*/g, '\u2063$1\u2063')
      .replace(/\*_([^*\n]+)_\*/g, '\u2063$1\u2063')
      .replace(/_\*([^_\n]+)\*_/g, '\u2063$1\u2063')
      .replace(/\*\*([^*\n]+)\*\*/g, '\u2062$1\u2062')
      .replace(/(?<![*\\])\*([^*\n]+)\*(?!\*)/g, '\u2062$1\u2062')
      .replace(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/gi, '\u2062$1\u2062')
      .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '\u2062$1\u2062')
      .replace(/__([^_\n]+)__/g, '\u2064$1\u2064')
      .replace(
        /(?<![_a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ])_([^_\n]+)_(?![_a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ])/g,
        '\u2064$1\u2064'
      )
      .replace(/<(?:i|em)>([\s\S]*?)<\/(?:i|em)>/gi, '\u2064$1\u2064')
      .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '\u2064$1\u2064');
  };

  const renderPlgInlineMarkup = (segmentText: string) => {
    if (!segmentText) return null;
    const parts = segmentText.split(
      /(\u2063[^\u2063]*\u2063|\u2062[^\u2062]*\u2062|\u2064[^\u2064]*\u2064|\u2063[^\u2063]+$|\u2062[^\u2062]+$|\u2064[^\u2064]+$)/g
    );
    const boldStyleClass =
      'font-normal tracking-normal [text-shadow:0.65px_0_0_currentColor,-0.3px_0_0_currentColor]';

    return parts.map((part, i) => {
      if (!part) return null;
      if (part.startsWith('\u2063')) {
        return (
          <span key={i} className={`italic ${boldStyleClass} text-[#1C1A18]`}>
            {part}
          </span>
        );
      }
      if (part.startsWith('\u2062')) {
        return (
          <span key={i} className={`${boldStyleClass} text-[#1C1A18]`}>
            {part}
          </span>
        );
      }
      if (part.startsWith('\u2064')) {
        return (
          <em key={i} className="italic font-normal tracking-normal text-[#1C1A18]">
            {part}
          </em>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderPlgFormattedText = (rawText: string) => {
    if (!rawText) return ' ';
    const lines = rawText.split('\n');
    const boldQuestionClass =
      'italic font-normal tracking-normal [text-shadow:0.65px_0_0_currentColor,-0.3px_0_0_currentColor]';

    return lines.map((line, idx) => {
      const cleanTrimmed = line
        .replace(/[\u200B-\u200D\uFEFF\u2062\u2063\u2064]/g, '')
        .replace(/^\*{1,3}|\*{1,3}$/g, '')
        .trim();
      const hasInvisibleQuestionMarker =
        line.startsWith('\u2063') && !line.slice(1).includes('\u2063');
      const isStandaloneQuestionLine =
        cleanTrimmed.length >= 8 &&
        cleanTrimmed.length <= 240 &&
        /^[¿A-ZĄĆĘŁŃÓŚŹŻÁÉÍÓÚÑÜÀÂÇÈÉÊËÎÏÔÙÛÜ][^.!?\n]{6,235}\?$/.test(cleanTrimmed);

      const isCopiedQuestion =
        cleanTrimmed.length > 0 && (hasInvisibleQuestionMarker || isStandaloneQuestionLine);

      let questionPart = line;
      let remainderPart = '';
      if (isCopiedQuestion && !isStandaloneQuestionLine) {
        const qIdx = questionPart.indexOf('?');
        if (qIdx !== -1 && qIdx < questionPart.length - 1) {
          remainderPart = questionPart.slice(qIdx + 1);
          questionPart = questionPart.slice(0, qIdx + 1);
        }
      }

      return (
        <React.Fragment key={idx}>
          {isCopiedQuestion ? (
            <>
              <span className={`${boldQuestionClass} text-[#1C1A18]`}>{questionPart}</span>
              {remainderPart && renderPlgInlineMarkup(remainderPart)}
            </>
          ) : (
            renderPlgInlineMarkup(line)
          )}
          {idx < lines.length - 1 ? '\n' : rawText.endsWith('\n') ? '\n\u200b' : ''}
        </React.Fragment>
      );
    });
  };

  const handlePlgDraftChange = (newText: string, cursorOverride?: number) => {
    const el = heroTextareaRef.current;
    const rawCursor = cursorOverride ?? (el ? el.selectionStart ?? newText.length : newText.length);
    const beforeCursor = newText.slice(0, rawCursor);
    const afterCursor = newText.slice(rawCursor);
    const transformedBefore = transformPlgAutoMarkup(beforeCursor);
    const finalValue = transformPlgAutoMarkup(transformedBefore + afterCursor);
    const nextCursor = Math.min(finalValue.length, transformedBefore.length);

    setPlgDraft(finalValue);
    setPlgSpellStatus('idle');
    setIsPlgUserTyping(true);
    if (plgTypingTimerRef.current) clearTimeout(plgTypingTimerRef.current);
    plgTypingTimerRef.current = setTimeout(() => {
      setIsPlgUserTyping(false);
    }, 1200);
    persistPlgDraft(finalValue, activeHeroPrompt.id, plgWritingSeconds);

    if (finalValue !== newText && el) {
      requestAnimationFrame(() => {
        if (heroTextareaRef.current) {
          heroTextareaRef.current.setSelectionRange(nextCursor, nextCursor);
        }
      });
    }
  };

  useEffect(() => {
    if (!isPlgUserTyping) return;
    const timer = setInterval(() => {
      setPlgWritingSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlgUserTyping]);

  const applyPlgFormatting = (type: 'bold' | 'italic') => {
    const el = heroTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? plgDraft.length;
    const end = el.selectionEnd ?? start;
    const marker = type === 'bold' ? '\u2062' : '\u2064';

    if (start !== end) {
      const selected = plgDraft.slice(start, end);
      const wrapped = `${marker}${selected}${marker}`;
      const updated = plgDraft.slice(0, start) + wrapped + plgDraft.slice(end);
      const newPos = start + wrapped.length;
      setPlgDraft(updated);
      persistPlgDraft(updated, activeHeroPrompt.id, plgWritingSeconds);
      requestAnimationFrame(() => {
        if (heroTextareaRef.current) {
          heroTextareaRef.current.focus();
          heroTextareaRef.current.setSelectionRange(newPos, newPos);
        }
      });
    } else {
      if (plgDraft[start] === marker) {
        const newPos = start + 1;
        requestAnimationFrame(() => {
          if (heroTextareaRef.current) {
            heroTextareaRef.current.focus();
            heroTextareaRef.current.setSelectionRange(newPos, newPos);
          }
        });
        return;
      }
      const tag = type === 'bold' ? '*' : '_';
      const updated = plgDraft.slice(0, start) + tag + tag + plgDraft.slice(start);
      const newPos = start + tag.length;
      setPlgDraft(updated);
      persistPlgDraft(updated, activeHeroPrompt.id, plgWritingSeconds);
      requestAnimationFrame(() => {
        if (heroTextareaRef.current) {
          heroTextareaRef.current.focus();
          heroTextareaRef.current.setSelectionRange(newPos, newPos);
        }
      });
    }
  };

  const handlePlgAutoFixSpelling = () => {
    if (plgDraft.trim().length <= 2) return;
    const { correctedText, changesCount } = autoFixPolishText(plgDraft);
    if (changesCount > 0 && correctedText !== plgDraft) {
      setPlgPreviousContent(plgDraft);
      setPlgDraft(correctedText);
      persistPlgDraft(correctedText, activeHeroPrompt.id, plgWritingSeconds);
      setPlgFixedCount(changesCount);
      setPlgSpellStatus('fixed');
    } else {
      setPlgSpellStatus('clean');
      setTimeout(() => setPlgSpellStatus('idle'), 2400);
    }
  };

  const handlePlgUndoFix = () => {
    if (plgPreviousContent !== null) {
      setPlgDraft(plgPreviousContent);
      persistPlgDraft(plgPreviousContent, activeHeroPrompt.id, plgWritingSeconds);
      setPlgPreviousContent(null);
      setPlgSpellStatus('idle');
    }
  };

  const handlePlgSelectCategory = (catId: PromptCategory | 'all') => {
    setPlgShowCategoryMenu(false);
    if (plgRemainingRerolls <= 0) return;
    const matching = DAILY_PROMPTS.filter(
      p => (catId === 'all' || p.category === catId) && p.id !== activeHeroPrompt.id
    );
    const picked =
      matching[Math.floor(Math.random() * matching.length)] || DAILY_PROMPTS[0];
    setHeroPromptsPool(prev => {
      const next = [...prev];
      next[plgPromptIdx] = picked;
      return next;
    });
    setPlgRemainingRerolls(prev => Math.max(0, prev - 1));
    setPlgMarginIdx(0);
  };

  const handleRotatePlgMarginQuestion = () => {
    setPlgIsRotatingMargin(true);
    setPlgMarginIdx(prev => prev + 1);
    setTimeout(() => setPlgIsRotatingMargin(false), 260);
  };

  const insertPlgMarginHint = (questionText: string) => {
    const cleanQ = questionText.replace(/[„”"«»→]/g, '').trim();
    const formatted = `\u2063${cleanQ}\u2063`;
    const prefix = plgDraft.trim().length > 0 ? `${plgDraft.replace(/\s+$/, '')}\n\n` : '';
    const updated = `${prefix}${formatted}\n`;
    setPlgDraft(updated);
    persistPlgDraft(updated, activeHeroPrompt.id, plgWritingSeconds);
    setTimeout(() => {
      if (heroTextareaRef.current) {
        heroTextareaRef.current.focus();
        heroTextareaRef.current.setSelectionRange(updated.length, updated.length);
      }
    }, 20);
  };

  const plgDraftLatestRef = useRef<string>(plgDraft);
  useEffect(() => {
    plgDraftLatestRef.current = plgDraft;
  }, [plgDraft]);

  const togglePlgDictation = () => {
    if (typeof window === 'undefined') return;

    if (isPlgListening && plgSpeechRef.current) {
      try {
        plgSpeechRef.current.onend = null;
        plgSpeechRef.current.stop();
      } catch {
        // ignore
      }
      plgSpeechRef.current = null;
      setIsPlgListening(false);
      return;
    }

    setPlgSpeechError(null);
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setPlgSpeechError(
        tr(
          'Twoja przeglądarka nie obsługuje dyktowania głosem (użyj Chrome, Edge lub Safari).',
          'Your browser does not support voice dictation (use Chrome, Edge, or Safari).',
          'Tu navegador no admite dictado por voz (usa Chrome, Edge o Safari).',
          'Votre navigateur ne prend pas en charge la dictée vocale (utilisez Chrome, Edge ou Safari).'
        )
      );
      return;
    }

    try {
      const isMobileBrowser =
        typeof navigator !== 'undefined' &&
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      const rec = new SpeechRec();
      rec.lang =
        lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'fr' ? 'fr-FR' : 'pl-PL';
      rec.interimResults = false;
      rec.continuous = !isMobileBrowser;
      rec.onstart = () => {
        setIsPlgListening(true);
        setPlgSpeechError(null);
      };
      rec.onresult = (event: any) => {
        let newlyFinalized = '';
        const startIdx = typeof event?.resultIndex === 'number' ? event.resultIndex : 0;
        for (let i = startIdx; i < (event?.results?.length || 0); i++) {
          if (event.results[i]?.isFinal) {
            const chunk = event.results[i]?.[0]?.transcript;
            if (chunk && typeof chunk === 'string') {
              newlyFinalized += (newlyFinalized ? ' ' : '') + chunk.trim();
            }
          }
        }
        if (newlyFinalized) {
          const current = plgDraftLatestRef.current;
          const sep = current && !/\s$/.test(current) ? ' ' : '';
          const updated = `${current}${sep}${newlyFinalized}`;
          plgDraftLatestRef.current = updated;
          handlePlgDraftChange(updated);
        }
      };
      rec.onerror = (event: any) => {
        if (event?.error === 'no-speech') {
          return;
        }
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          setPlgSpeechError(
            tr(
              'Brak dostępu do mikrofonu. Zezwól na mikrofon w przeglądarce po kliknięciu „Dyktuj”.',
              'Microphone access denied. Allow microphone access in your browser when clicking “Dictate”.',
              'Acceso al micrófono denegado. Permite el micrófono en el navegador.',
              'Accès au microphone refusé. Autorisez le microphone dans le navigateur.'
            )
          );
        }
        setIsPlgListening(false);
      };
      rec.onend = () => {
        plgSpeechRef.current = null;
        setIsPlgListening(false);
      };
      plgSpeechRef.current = rec;
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
  const plgCharCount = plgDraft.length;

  const formatPlgWritingTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  // ===========================================================================
  // NEW FEATURES INTERACTIVE DEMO STATE (SPARKLE + ONE-TIME SHARE)
  // ===========================================================================
  const [demoSparkleIdx, setDemoSparkleIdx] = useState<number>(0);
  const [showDemoSparkleModal, setShowDemoSparkleModal] = useState<boolean>(false);

  const demoSparkleCards: SparkleAppreciationCard[] = [
    {
      id: 'demo_sparkle_1',
      date: '2026-10-20',
      periodLabel: tr(
        'Ostatnie 3 dni · 18–20 października',
        'Last 3 days · October 18–20',
        'Últimos 3 días · 18–20 de octubre',
        '3 derniers jours · 18–20 octobre'
      ),
      greeting: tr(
        'Hej Bartek, kawał dobrej uważności w te ostatnie dni!',
        'Hey Bartek, great mindfulness over these past few days!',
        '¡Hola Bartek, qué buena atención plena en estos últimos días!',
        'Salut Bartek, quelle belle attention au cours de ces derniers jours !'
      ),
      content: tr(
        'Zauważyłem, że mimo gęstego tygodnia potrafiłeś zwolnić w dwóch ważnych momentach: w niedzielę odłożyłeś telefon na długi spacer bez słuchawek, a wczoraj wieczorem zamiast brać pracę do łóżka, zrobiłeś herbatę i zamknąłeś dzień o przyzwoitej porze. Dobrze zrobiłeś — odzyskiwanie spokoju zaczyna się właśnie od takich małych granic.',
        'I noticed that despite a busy week you slowed down at two key moments: on Sunday you left your headphones behind for a quiet walk, and yesterday evening instead of bringing work to bed, you brewed tea and closed the day on time. You did really well — reclaiming calm starts with small boundaries like these.',
        'Noté que a pesar de una semana intensa supiste bajar el ritmo en dos momentos clave: el domingo saliste a caminar sin auriculares y ayer por la noche cerraste el día con calma. Hiciste muy bien.',
        'J’ai remarqué que malgré une semaine dense, vous avez su ralentir à deux moments clés : dimanche lors d’une marche sans écouteurs, et hier soir en clôturant la journée paisiblement. Vous avez très bien fait.'
      ),
      highlights: [
        tr(
          'Odważyłeś się wyjść na spacer w zupełnej ciszy, dzięki czemu głowa naprawdę odpoczęła.',
          'You chose a quiet walk without distractions, letting your mind genuinely rest.',
          'Elegiste caminar en silencio sin distracciones para descansar la mente.',
          'Vous avez choisi de marcher en silence, permettant à votre esprit de vraiment se reposer.'
        ),
        tr(
          'Zauważyłeś drobną wdzięczność w rozmowie w księgarni zamiast biec dalej.',
          'You noticed a small moment of gratitude at the bookshop instead of rushing past.',
          'Notaste un pequeño gesto de gratitud en la librería en lugar de seguir corriendo.',
          'Vous avez noté un moment de gratitude à la librairie au lieu de courir.'
        ),
        tr(
          'Trzy zamknięte dni z rzędu budują Twój własny, spokojny rytm.',
          'Three sealed days in a row are building your own steady rhythm.',
          'Tres días cerrados seguidos construyen tu propio ritmo sereno.',
          'Trois jours clôturés de suite construisent votre propre rythme apaisé.'
        ),
      ],
      createdAt: '2026-10-20T20:15:00.000Z',
    },
    {
      id: 'demo_sparkle_2',
      date: '2026-10-16',
      periodLabel: tr(
        'Ostatnie 2 dni · 15–16 października',
        'Last 2 days · October 15–16',
        'Últimos 2 días · 15–16 de octubre',
        '2 derniers jours · 15–16 octobre'
      ),
      greeting: tr(
        'Cześć! Dobrze widzieć, jak szczerze nazywasz swoje emocje.',
        'Hey there! It’s great to see how honestly you name your emotions.',
        '¡Hola! Qué bueno ver con qué honestidad nombras tus emociones.',
        'Salut ! C’est beau de voir avec quelle sincérité vous nommez vos émotions.'
      ),
      content: tr(
        'W czwartek napisałeś wprost o zmęczeniu po trudnej rozmowie, zamiast udawać, że wszystko gra. To duża dojrzałość. A już kolejnego ranka potrafiłeś docenić spokojną kawę na balkonie i pierwszy chłodniejszy powiew jesieni.',
        'On Thursday you wrote honestly about feeling drained after a difficult conversation instead of pretending everything was fine. And the very next morning you appreciated a quiet coffee on the balcony.',
        'El jueves escribiste con sinceridad sobre el cansancio tras una conversación difícil, y a la mañana siguiente supiste disfrutar de un café tranquilo en el balcón.',
        'Jeudi, vous avez écrit franchement sur votre fatigue après un échange difficile, et dès le lendemain matin vous avez su apprécier un café paisible sur le balcon.'
      ),
      highlights: [
        tr(
          'Nazwanie zmęczenia na kartce zdjęło z Ciebie połowę napięcia.',
          'Naming your fatigue on paper lifted half the tension off your shoulders.',
          'Poner en palabras el cansancio alivió la mitad de la tensión.',
          'Nommer votre fatigue sur le papier a dissipé la moitié de la tension.'
        ),
        tr(
          'Dałeś sobie prawo do wolniejszego powrotu do domu.',
          'You gave yourself permission to walk home at a slower pace.',
          'Te diste permiso para volver a casa sin prisa.',
          'Vous vous êtes accordé le droit de rentrer plus lentement.'
        ),
      ],
      createdAt: '2026-10-16T21:00:00.000Z',
    },
  ];

  const activeDemoSparkle = demoSparkleCards[demoSparkleIdx] || demoSparkleCards[0];

  const [demoShareStep, setDemoShareStep] = useState<'create' | 'recipient_pin' | 'unlocked' | 'burned'>('create');
  const [demoShareLang, setDemoShareLang] = useState<'pl' | 'en' | 'es' | 'fr'>('en');
  const [demoSharePinInput, setDemoSharePinInput] = useState<string>('4829');
  const [demoShareCopied, setDemoShareCopied] = useState<boolean>(false);

  const demoSharedTranslations: Record<'pl' | 'en' | 'es' | 'fr', { prompt: string; body: string }> = {
    pl: {
      prompt: 'Komu byłeś dzisiaj po cichu wdzięczny?',
      body: 'Dziękuję Ci za naszą dzisiejszą rozmowę w kuchni przy herbacie. Nawet nie wiesz, jak bardzo potrzebowałem dziś kogoś, kto po prostu spokojnie wysłucha.',
    },
    en: {
      prompt: 'Who were you silently grateful to today?',
      body: 'Thank you for our conversation over tea in the kitchen today. You have no idea how much I needed someone who would simply listen in peace.',
    },
    es: {
      prompt: '¿A quién estuviste hoy agradecido en silencio?',
      body: 'Gracias por nuestra conversación de hoy tomando té en la cocina. No sabes cuánto necesitaba hoy a alguien que simplemente escuchara con calma.',
    },
    fr: {
      prompt: 'Envers qui avez-vous éprouvé une gratitude silencieuse aujourd’hui ?',
      body: 'Merci pour notre conversation autour d’un thé dans la cuisine aujourd’hui. Tu n’imagines pas à quel point j’avais besoin d’une écoute paisible.',
    },
  };

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

  // Always start with the Fox companion ('fox'); only update everything when the user changes companion
  const [showcaseCompanion, setShowcaseCompanion] = useState<CompanionId>('fox');
  const [showcasePose, setShowcasePose] = useState<'typing' | 'reading' | 'searching'>('typing');

  const currentCompanionIndex = COMPANIONS.findIndex(c => c.id === showcaseCompanion);

  const getCompanionCtaStyle = (
    id: CompanionId
  ): {
    buttonClass: string;
    activePillClass: string;
    activeBorderLClass: string;
    iconClass: string;
    sealFill: string;
  } => {
    switch (id) {
      case 'crocodile':
        return {
          buttonClass: 'bg-[#789A82] hover:bg-[#698B73] text-[#1C1A18] border-[#1C1A18]',
          activePillClass: 'bg-[#789A82] hover:bg-[#698B73] text-[#1C1A18]',
          activeBorderLClass: 'border-l-[#789A82]',
          iconClass: 'text-[#1C1A18]',
          sealFill: '#EBC5CF',
        };
      case 'wolf':
        return {
          buttonClass: 'bg-[#8D959E] hover:bg-[#7D858E] text-[#1C1A18] border-[#1C1A18]',
          activePillClass: 'bg-[#8D959E] hover:bg-[#7D858E] text-[#1C1A18]',
          activeBorderLClass: 'border-l-[#8D959E]',
          iconClass: 'text-[#1C1A18]',
          sealFill: '#EBC5CF',
        };
      case 'axolotl':
        return {
          buttonClass: 'bg-[#EBC5CF] hover:bg-[#DFB4C0] text-[#1C1A18] border-[#1C1A18]',
          activePillClass: 'bg-[#EBC5CF] hover:bg-[#DFB4C0] text-[#1C1A18]',
          activeBorderLClass: 'border-l-[#EBC5CF]',
          iconClass: 'text-[#8B2635]',
          sealFill: '#FAF8F5',
        };
      case 'bear':
        return {
          buttonClass: 'bg-[#A6836C] hover:bg-[#95725B] text-[#FAF8F5] border-[#1C1A18]',
          activePillClass: 'bg-[#A6836C] hover:bg-[#95725B] text-[#FAF8F5]',
          activeBorderLClass: 'border-l-[#A6836C]',
          iconClass: 'text-[#FAF8F5]',
          sealFill: '#EBC5CF',
        };
      case 'panda':
        return {
          buttonClass: 'bg-[#FAF8F5] hover:bg-[#EAE5DA] text-[#1C1A18] border-[#1C1A18]',
          activePillClass: 'bg-[#524D46] hover:bg-[#3D3831] text-[#FAF8F5]',
          activeBorderLClass: 'border-l-[#524D46]',
          iconClass: 'text-[#8B2635]',
          sealFill: '#EBC5CF',
        };
      case 'dragon':
        return {
          buttonClass: 'bg-[#6C9A96] hover:bg-[#5B8985] text-[#1C1A18] border-[#1C1A18]',
          activePillClass: 'bg-[#6C9A96] hover:bg-[#5B8985] text-[#1C1A18]',
          activeBorderLClass: 'border-l-[#6C9A96]',
          iconClass: 'text-[#1C1A18]',
          sealFill: '#EBC5CF',
        };
      case 'cat':
      case 'dinosaur':
        return {
          buttonClass: 'bg-[#C8B89E] hover:bg-[#B8A78C] text-[#1C1A18] border-[#1C1A18]',
          activePillClass: 'bg-[#C8B89E] hover:bg-[#B8A78C] text-[#1C1A18]',
          activeBorderLClass: 'border-l-[#C8B89E]',
          iconClass: 'text-[#1C1A18]',
          sealFill: '#EBC5CF',
        };
      case 'fox':
      case 'lizard':
        return {
          buttonClass: 'bg-[#C96839] hover:bg-[#B5592C] text-[#FAF8F5] border-[#1C1A18]',
          activePillClass: 'bg-[#C96839] hover:bg-[#B5592C] text-[#FAF8F5]',
          activeBorderLClass: 'border-l-[#C96839]',
          iconClass: 'text-[#FAF8F5]',
          sealFill: '#EBC5CF',
        };
      case 'bird':
        return {
          buttonClass: 'bg-[#1C1A18] hover:bg-[#33302B] text-[#FAF8F5] border-[#1C1A18]',
          activePillClass: 'bg-[#1C1A18] hover:bg-[#33302B] text-[#FAF8F5]',
          activeBorderLClass: 'border-l-[#1C1A18]',
          iconClass: 'text-[#EBC5CF]',
          sealFill: '#EBC5CF',
        };
    }
  };

  const companionCta = getCompanionCtaStyle(showcaseCompanion);
  const currentCompanionInfo = COMPANIONS[currentCompanionIndex] || COMPANIONS[0];

  const handleSelectShowcaseCompanion = (nextId: CompanionId) => {
    setShowcaseCompanion(nextId);
    try {
      localStorage.setItem('kronika_companion', nextId);
    } catch {
      // ignore
    }
  };

  const handlePrevCompanion = () => {
    const prevIdx = (currentCompanionIndex - 1 + COMPANIONS.length) % COMPANIONS.length;
    handleSelectShowcaseCompanion(COMPANIONS[prevIdx].id);
  };

  const handleNextCompanion = () => {
    const nextIdx = (currentCompanionIndex + 1) % COMPANIONS.length;
    handleSelectShowcaseCompanion(COMPANIONS[nextIdx].id);
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
      {/* Sparkle Demo Modal */}
      <SparkleModal
        isOpen={showDemoSparkleModal}
        isLoading={false}
        card={activeDemoSparkle}
        lang={lang}
        onClose={() => setShowDemoSparkleModal(false)}
      />

      {/* Minimalist Top Header matching the logged-in interface (max-w-2xl mx-auto) */}
      <header
        className={`${
          showAppLoginScreen ? 'hidden' : 'block'
        } w-full border-b border-[#EAE5DA]/80 select-none bg-[#F7F5F0]/95 sticky top-0 z-40 backdrop-blur-[2px]`}
      >
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
          <a
            href="#top"
            className="flex items-center gap-2 text-base sm:text-lg font-serif-literary font-normal text-[#1C1A18] tracking-wide shrink-0"
          >
            <svg
              viewBox="0 0 36 26"
              className="w-7 h-5 shrink-0 overflow-visible"
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
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span>{tr('Momenty', 'Moments', 'Momentos', 'Moments')}</span>
            </span>
          </a>

          {/* Compact Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

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
              className={`h-7 px-2 rounded-md border text-[11px] font-mono-meta inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
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
              <span className="hidden xs:inline">Mobile</span>
            </button>

            {/* Language Switcher Dropdown */}
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
                            ? `${companionCta.activePillClass} font-medium`
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

            {onReturnToEditor ? (
              <button
                type="button"
                onClick={onReturnToEditor}
                className={`h-7 px-2.5 text-[11px] font-mono-meta font-medium ${companionCta.activePillClass} rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer`}
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
                <span>{userName || tr('Dziennik', 'Journal', 'Diario', 'Journal')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onGoogleLogin}
                disabled={isAuthLoading}
                className="h-7 px-2.5 text-[11px] font-mono-meta font-medium text-[#524D46] hover:text-[#1C1A18] bg-[#F5F2EB] hover:bg-[#EAE5DA] border border-[#DDD6C8] rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <User className="w-3 h-3 text-[#7A756D]" />
                <span>
                  {isAuthLoading
                    ? '...'
                    : tr('Zaloguj', 'Sign in', 'Entrar', 'Connexion')}
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
                className={`px-4 py-2 rounded-lg ${companionCta.activePillClass} text-xs font-mono-meta cursor-pointer transition-colors`}
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
                            ? `${companionCta.activePillClass} font-medium`
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

            <div className="pt-1 pb-1">
              <button
                type="button"
                onClick={onReturnToEditor || onGoogleLogin}
                disabled={isAuthLoading}
                className={`min-h-[42px] px-7 py-2.5 rounded-lg ${companionCta.activePillClass} text-xs font-mono-meta uppercase tracking-widest inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-60`}
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
        {/* PLG Frictionless Conversion Modal ("Zamknij dzień i załóż konto") */}
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
                    'Zamknij dzisiejszy dzień i zachowaj go na swoim koncie.',
                    'Close today’s entry and save it to your encrypted account.',
                    'Cierra el día de hoy y guárdalo en tu cuenta cifrada.',
                    'Clôturez votre journée et enregistrez-la sur votre compte chiffré.'
                  )}
                </h3>
                <p className="text-sm font-serif-literary text-[#524D46] leading-relaxed">
                  {tr(
                    'Twój wpis jest już bezpiecznie przygotowany w pamięci przeglądarki. Jedno kliknięcie zaszyfruje go kluczem AES-256 i zapisze w Twoim prywatnym Dzienniku.',
                    'Your reflection is already safely stored in your browser. One click encrypts it with your private AES-256 key and saves it directly to your Journal.',
                    'Tu reflexión ya está guardada en tu navegador. Un clic la cifrará con tu clave privada AES-256 y la guardará en tu Diario.',
                    'Votre réflexion est déjà enregistrée dans votre navigateur. Un clic la chiffrera avec votre clé privée AES-256 et l’ajoutera à votre Journal.'
                  )}
                </p>
              </div>

              {plgDraft.trim().length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#F2EFE8] border border-[#DDD6C8] space-y-1 text-left">
                  <div className="text-[10px] font-mono-meta text-[#7A756D] uppercase tracking-wider">
                    {tr('Twój dzisiejszy wpis', 'Your entry ready to seal', 'Tu entrada lista', 'Votre entrée prête')} · {plgWordCount}{' '}
                    {tr('słów', 'words', 'palabras', 'mots')}
                  </div>
                  <p className="text-xs font-serif-literary italic text-[#33302B] line-clamp-3">
                    „{plgDraft.replace(/[\u2062\u2063\u2064]/g, '').trim()}”
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
                  className={`w-full py-3.5 px-5 rounded-xl ${companionCta.activePillClass} text-xs sm:text-sm font-mono-meta font-medium flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-60`}
                >
                  <Lock className="w-4 h-4 text-[#EBC5CF]" />
                  <span>
                    {isAuthLoading
                      ? tr('Szyfrowanie i łączenie...', 'Encrypting & connecting...', 'Conectando...', 'Connexion...')
                      : tr(
                          'Załóż konto i zamknij dzień (Google)',
                          'Create account & close day (Google)',
                          'Crear cuenta y cerrar día (Google)',
                          'Créer un compte et clôturer le jour (Google)'
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
                    'Wróć do pisania (szkic czeka na kartce)',
                    'Keep writing first (your draft stays on the page)',
                    'Seguir escribiendo primero',
                    'Continuer à écrire d’abord'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            1. FIRST SCREEN: ~3/4 SCREEN LOGGED-IN STYLE WRITING AREA (WITH FULL HEADER OF SECTION 01 VISIBLE BELOW)
           ===================================================================== */}
        <section className="min-h-[68vh] sm:min-h-[70vh] flex flex-col justify-between w-full text-left relative pt-0 pb-4 sm:pb-5">
          {/* Pinned Top Dock: Daily Question + Action Toolbar + Mobile Follow-up Question */}
          <div className="w-full bg-[#F7F5F0]/95 border-b border-[#EAE5DA]/85 select-none">
            <div className="max-w-2xl mx-auto w-full px-4 sm:px-8 pt-5 md:pt-6 pb-4 space-y-3.5">
              {/* Main Question OR Free Thought Header */}
              <div className="w-full select-none shrink-0 py-0.5">
                {plgFreeThought ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 py-1">
                    <div className="inline-flex items-center gap-2.5 text-[18px] sm:text-xl font-serif-literary italic text-[#524D46]">
                      <svg
                        viewBox="0 0 18 18"
                        className="w-4 h-4 shrink-0 text-[#8B2635]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M14.5 3.5 C11 3.5 7.5 6 5.5 10 L3.5 14.5 L8 12.5 C12 10.5 14.5 7 14.5 3.5 Z" />
                        <path d="M3.5 14.5 L9.5 8.5" />
                      </svg>
                      <span>
                        {tr(
                          'Wolna myśl — bez codziennego pytania',
                          'Free thought — without a daily prompt',
                          'Pensamiento libre — sin pregunta diaria',
                          'Pensée libre — sans question du jour'
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <h1
                    className="w-full text-[19.5px] sm:text-[22px] md:text-[24px] font-serif-literary font-normal leading-[1.4] sm:leading-snug text-left text-[#524D46] transition-colors"
                    style={{ textWrap: 'balance' }}
                  >
                    {getPromptText(activeHeroPrompt, lang)}
                  </h1>
                )}
              </div>

              {/* Action Row: Dyktuj + [< | Wymień (3/3) | >] + Wolna myśl */}
              <div className="w-full space-y-3 select-none">
                <div className="w-full flex flex-nowrap items-center justify-between gap-2 min-w-0">
                  {/* Left side: Dyktuj */}
                  <div className="flex flex-nowrap items-center gap-1.5 text-[11px] sm:text-xs font-mono-meta shrink-0">
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={togglePlgDictation}
                      className={`flex transition-colors items-center justify-center gap-1.5 px-2.5 sm:px-3 h-7 sm:min-h-[30px] rounded text-[11px] sm:text-xs font-mono-meta border cursor-pointer whitespace-nowrap shrink-0 ${
                        isPlgListening
                          ? 'bg-[#8B2635] border-[#8B2635] text-[#FAF8F5]'
                          : 'bg-[#F5F2EB] hover:bg-[#EAE5DA] border-[#DDD6C8] text-[#524D46] hover:text-[#1C1A18]'
                      }`}
                      title={tr(
                        'Dyktuj wpis głosem (rozpoznawanie mowy)',
                        'Dictate entry by voice (speech-to-text)',
                        'Dictar entrada por voz',
                        'Dicter votre entrée à la voix'
                      )}
                    >
                      {isPlgListening ? (
                        <>
                          <MicOff className="w-3.5 h-3.5 text-[#FAF8F5] shrink-0" />
                          <span className="sm:hidden">Stop</span>
                          <span className="hidden sm:inline">
                            {tr('Nagrywanie · Stop', 'Recording · Stop', 'Grabando · Parar', 'Enregistrement · Stop')}
                          </span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-[#8B2635] shrink-0" />
                          <span>
                            {tr('Dyktuj', 'Dictate', 'Dictar', 'Dicter')}
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Right side: [< | Wymień (3/3) | >] + Wolna myśl */}
                  <div className="relative flex flex-nowrap items-center gap-1.5 shrink-0">
                    {!plgFreeThought && (
                      <div className="relative flex flex-nowrap items-center rounded border border-[#DDD6C8] bg-[#F5F2EB] divide-x divide-[#DDD6C8] h-7 sm:min-h-[30px] shrink-0">
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            setPlgPromptIdx(
                              prev => (prev - 1 + heroPromptsPool.length) % heroPromptsPool.length
                            );
                            setPlgMarginIdx(0);
                          }}
                          title={tr('Poprzednie pytanie', 'Previous question', 'Pregunta anterior', 'Question précédente')}
                          className="px-1.5 sm:px-2 h-full flex items-center justify-center rounded-l text-[#524D46] hover:bg-[#EAE5DA] hover:text-[#1C1A18] transition-colors cursor-pointer shrink-0"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>

                        <div className="relative h-full flex items-center">
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              if (plgRemainingRerolls > 0) {
                                setPlgShowCategoryMenu(prev => !prev);
                              }
                            }}
                            disabled={plgRemainingRerolls <= 0}
                            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 h-full text-[11px] sm:text-xs font-mono-meta transition-colors whitespace-nowrap shrink-0 ${
                              plgRemainingRerolls > 0
                                ? 'text-[#524D46] hover:text-[#1C1A18] hover:bg-[#EAE5DA] cursor-pointer'
                                : 'text-[#ABA497] cursor-not-allowed opacity-50'
                            }`}
                          >
                            <RefreshCw className="w-3 h-3 shrink-0" />
                            <span className="sm:hidden tabular-nums">
                              {plgRemainingRerolls}/3
                            </span>
                            <span className="hidden sm:inline tabular-nums">
                              {tr(
                                `Wymień (${plgRemainingRerolls}/3)`,
                                `Change (${plgRemainingRerolls}/3)`,
                                `Cambiar (${plgRemainingRerolls}/3)`,
                                `Changer (${plgRemainingRerolls}/3)`
                              )}
                            </span>
                            <ChevronDown className="hidden sm:inline w-3 h-3 opacity-60 shrink-0" />
                          </button>

                          {plgShowCategoryMenu && plgRemainingRerolls > 0 && (
                            <div className="absolute right-0 top-full mt-1.5 z-50 w-56 p-2 rounded-lg bg-[#FAF8F5] border border-[#DDD6C8] shadow-lg text-left animate-in fade-in zoom-in-95 duration-100">
                              <div className="text-[10px] font-mono-meta uppercase tracking-wider text-[#938C80] px-2 py-1 mb-1 border-b border-[#ECE7DC]">
                                {tr(
                                  'Z jakiej kategorii wylosować?',
                                  'Choose a category:',
                                  'Elige una categoría:',
                                  'Choisissez une catégorie :'
                                )}
                              </div>
                              <div className="space-y-0.5">
                                {CATEGORIES.map(cat => (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => handlePlgSelectCategory(cat.id)}
                                    className="w-full text-left px-2.5 py-1.5 rounded text-xs font-serif-literary text-[#33302B] hover:bg-[#EFECE4] hover:text-[#1C1A18] transition-colors flex items-center justify-between cursor-pointer"
                                  >
                                    <span>{getCategoryLabel(cat.id, lang)}</span>
                                    {cat.id === activeHeroPrompt.category && (
                                      <span className="text-[10px] font-mono-meta text-[#7A756D]">
                                        {tr('obecna', 'current', 'actual', 'actuelle')}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            setPlgPromptIdx(prev => (prev + 1) % heroPromptsPool.length);
                            setPlgMarginIdx(0);
                          }}
                          title={tr('Następne pytanie', 'Next question', 'Siguiente pregunta', 'Question suivante')}
                          className="px-1.5 sm:px-2 h-full flex items-center justify-center rounded-r text-[#524D46] hover:bg-[#EAE5DA] hover:text-[#1C1A18] transition-colors cursor-pointer shrink-0"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Wolna myśl */}
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        setPlgShowCategoryMenu(false);
                        setPlgFreeThought(prev => !prev);
                      }}
                      className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 h-7 sm:min-h-[30px] rounded text-[11px] sm:text-xs font-mono-meta border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        plgFreeThought
                          ? `${companionCta.activePillClass} border-transparent font-medium`
                          : 'border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18]'
                      }`}
                    >
                      <svg
                        viewBox="0 0 18 18"
                        className={`w-3.5 h-3.5 shrink-0 ${plgFreeThought ? 'text-current' : 'text-[#8B2635]'}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M14.5 3.5 C11 3.5 7.5 6 5.5 10 L3.5 14.5 L8 12.5 C12 10.5 14.5 7 14.5 3.5 Z" />
                        <path d="M3.5 14.5 L9.5 8.5" />
                      </svg>
                      <span className="sm:hidden">
                        {plgFreeThought
                          ? tr('Pytanie', 'Prompt', 'Pregunta', 'Question')
                          : tr('Wolna myśl', 'Free', 'Libre', 'Libre')}
                      </span>
                      <span className="hidden sm:inline">
                        {plgFreeThought
                          ? tr('Pytanie dnia', 'Daily question', 'Pregunta del día', 'Question du jour')
                          : tr('Wolna myśl', 'Free thought', 'Pensamiento libre', 'Pensée libre')}
                      </span>
                    </button>
                  </div>
                </div>

                {plgSpeechError && (
                  <div className="text-[11px] font-mono-meta text-[#8B2635] pt-0.5">
                    {plgSpeechError}
                  </div>
                )}

                {/* Mobile & Tablet Follow-up Question (pytanie pomocnicze) inside top dock */}
                <div className="lg:hidden pt-1">
                  {plgShowMarginHints ? (
                    <div className="border border-[#E2DDD3] bg-[#EFECE4]/75 rounded px-3 py-1.5 flex items-center justify-between gap-2.5">
                      <span className="text-[13.5px] sm:text-[15px] font-serif-literary italic text-[#3D3831] leading-snug flex-1 text-left">
                        {currentPlgMarginQuestion}
                      </span>

                      <div className="inline-flex items-center rounded border border-[#DDD6C8] bg-[#F5F2EB] divide-x divide-[#DDD6C8] overflow-hidden shrink-0 h-6">
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => insertPlgMarginHint(currentPlgMarginQuestion)}
                          title={tr(
                            'Skopiuj pytanie do tekstu (pogrubioną kursywą)',
                            'Copy question into text (in bold italics)',
                            'Copiar pregunta al texto',
                            'Copier la question dans le texte'
                          )}
                          className="px-1.5 h-full flex items-center justify-center text-[#524D46] hover:text-[#1C1A18] hover:bg-[#EAE5DA] transition-colors font-mono-meta text-xs cursor-pointer"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={handleRotatePlgMarginQuestion}
                          title={tr(
                            'Zmień pytanie pomocnicze',
                            'Change follow-up question',
                            'Cambiar pregunta de seguimiento',
                            'Changer la question de suivi'
                          )}
                          className="px-1.5 h-full flex items-center justify-center text-[#524D46] hover:text-[#1C1A18] hover:bg-[#EAE5DA] transition-colors cursor-pointer"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${plgIsRotatingMargin ? 'animate-spin' : ''}`}
                          />
                        </button>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => setPlgShowMarginHints(false)}
                          title={tr(
                            'Ukryj pytanie pomocnicze',
                            'Hide follow-up question',
                            'Ocultar pregunta de seguimiento',
                            'Masquer la question de suivi'
                          )}
                          className="px-1.5 h-full flex items-center justify-center text-[#524D46] hover:text-[#1C1A18] hover:bg-[#EAE5DA] transition-colors cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-start py-0.5">
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => setPlgShowMarginHints(true)}
                        className="px-2 py-0.5 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] font-mono-meta whitespace-nowrap"
                      >
                        <EyeOff className="w-3 h-3" />
                        <span>
                          {tr('Pokaż podpowiedź', 'Show hint', 'Mostrar pista', 'Afficher l’indice')}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Centered Writing Area + Desktop Left Margin Question */}
          <div className="flex-1 flex flex-col w-full">
            <div className="max-w-2xl mx-auto w-full px-4 sm:px-8 pt-4 sm:pt-5 pb-2 space-y-3.5 flex-1 flex flex-col">
              {authError && (
                <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#E8C5C5] text-xs font-mono-meta text-[#8B2635] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="relative w-full pt-1 flex-1 flex flex-col">
                {/* Desktop Left Margin Question matching FocusEditor.tsx */}
                <aside className="hidden lg:block lg:absolute lg:right-full lg:top-1 lg:mr-7 xl:mr-10 lg:w-60 xl:w-64 select-none z-10">
                  {plgShowMarginHints ? (
                    <div className="border-r border-[#DDD6C8] pr-3.5 py-1 flex items-start justify-between gap-2.5">
                      <div className="flex-1 flex items-start justify-between gap-2 text-[14.5px] font-serif-literary text-[#524D46] leading-snug">
                        <span className="italic flex-1 text-left">
                          {currentPlgMarginQuestion}
                        </span>
                        <button
                          type="button"
                          onClick={() => insertPlgMarginHint(currentPlgMarginQuestion)}
                          title={tr(
                            'Skopiuj pytanie do tekstu (pogrubioną kursywą)',
                            'Copy question into text (in bold italics)',
                            'Copiar pregunta al texto',
                            'Copier la question dans le texte'
                          )}
                          className="text-[#6E685F] hover:text-[#1C1A18] hover:bg-[#EAE5DA] px-1.5 py-0.5 rounded transition-colors font-mono font-normal shrink-0 text-sm mt-0.5 cursor-pointer"
                        >
                          →
                        </button>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={handleRotatePlgMarginQuestion}
                          title={tr(
                            'Zmień pytanie pomocnicze',
                            'Change follow-up question',
                            'Cambiar pregunta de seguimiento',
                            'Changer la question de suivi'
                          )}
                          className="p-1 rounded text-[#6E685F] hover:text-[#1C1A18] hover:bg-[#EAE5DA]/80 transition-colors cursor-pointer"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${plgIsRotatingMargin ? 'animate-spin' : ''}`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlgShowMarginHints(false)}
                          title={tr(
                            'Ukryj pytanie pomocnicze',
                            'Hide follow-up question',
                            'Ocultar pregunta de seguimiento',
                            'Masquer la question de suivi'
                          )}
                          className="p-1 rounded text-[#6E685F] hover:text-[#1C1A18] hover:bg-[#EAE5DA]/80 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end pr-3.5 py-0.5">
                      <button
                        type="button"
                        onClick={() => setPlgShowMarginHints(true)}
                        title={tr(
                          'Pokaż pytanie pomocnicze',
                          'Show follow-up question',
                          'Mostrar pregunta de seguimiento',
                          'Afficher la question de suivi'
                        )}
                        className="px-2 py-1 rounded text-[#6E685F] hover:text-[#1C1A18] hover:bg-[#EFECE4]/80 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono-meta"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </aside>

                {/* Main Paper Textarea with Live Rich Formatting Backdrop (matching FocusEditor) */}
                <div className="relative w-full pb-1">
                  {/* Visible formatted backdrop layer */}
                  <div
                    aria-hidden="true"
                    className={`editor-sync-layer pointer-events-none absolute top-0 left-0 w-full text-lg sm:text-xl leading-relaxed overflow-hidden p-0 m-0 border-0 text-[#1C1A18] opacity-100 ${
                      plgDraft ? 'visible' : 'invisible'
                    }`}
                  >
                    {renderPlgFormattedText(plgDraft)}
                  </div>

                  <textarea
                    ref={heroTextareaRef}
                    value={plgDraft}
                    onChange={e =>
                      handlePlgDraftChange(
                        e.target.value,
                        e.target.selectionStart ?? e.target.value.length
                      )
                    }
                    aria-label={getPromptText(activeHeroPrompt, lang)}
                    placeholder={
                      isPlgListening
                        ? tr(
                            'Słucham — mów teraz, Twoje słowa pojawią się bezpośrednio tutaj...',
                            'Listening — speak now, your words will appear directly here...',
                            'Escuchando — habla ahora, tus palabras aparecerán directamente aquí...',
                            'Écoute en cours — parlez maintenant, vos mots apparaîtront directement ici...'
                          )
                        : tr(
                            'Powiedz co ci siedzi w głowie...',
                            'Tell what’s on your mind...',
                            'Cuéntame qué tienes en mente...',
                            'Dites ce que vous avez en tête...'
                          )
                    }
                    className={`editor-sync-layer relative z-10 w-full min-h-[155px] sm:min-h-[185px] lg:min-h-[205px] bg-transparent border-0 outline-none resize-none text-lg sm:text-xl leading-relaxed placeholder-[#B5B0A6] focus:ring-0 p-0 m-0 text-left selection:bg-[#E2DDD3]/50 ${
                      plgDraft ? 'text-transparent caret-[#1C1A18]' : 'text-[#1C1A18]'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Gentle PLG Save Banner + Prominent Primary CTA + CompanionDesk + Clean Footer */}
          <div className="w-full overflow-x-hidden flex flex-col items-center shrink-0 mt-1 pt-0.5">
            {/* Single Primary CTA Button with Animated Closing Padlock */}
            <div className="max-w-2xl mx-auto w-full px-2.5 sm:px-8 flex flex-col items-center pb-2.5 select-none">
              {(() => {
                const hasTypedText = plgDraft.trim().length > 0;
                return (
                  <button
                    type="button"
                    onClick={handleSaveEntryTrigger}
                    className={`group/seal relative overflow-hidden flex items-center justify-center gap-2.5 px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl border text-xs sm:text-sm font-mono-meta font-medium transition-all duration-300 cursor-pointer select-none shadow-sm ${companionCta.buttonClass}`}
                  >
                    {/* Animated Padlock SVG: open when empty, smoothly locks shut & pulses when user writes */}
                    <svg
                      viewBox="0 0 18 18"
                      className={`relative z-10 w-4 h-4 shrink-0 overflow-visible transition-transform duration-300 ${
                        isPlgUserTyping ? 'scale-110' : 'scale-100'
                      } ${companionCta.iconClass}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {/* Shackle (pałąk kłódki) — lifted/open before typing, clicks shut when text is written */}
                      <path
                        d={
                          hasTypedText
                            ? 'M5.5 8.2 V5.4 C5.5 3.5 7.0 2.1 9 2.1 C11.0 2.1 12.5 3.5 12.5 5.4 V8.2'
                            : 'M5.5 8.2 V4.6 C5.5 2.7 7.0 1.3 9 1.3 C10.8 1.3 12.2 2.4 12.5 4.0'
                        }
                        className="transition-all duration-500 ease-out"
                        style={{
                          transform: hasTypedText
                            ? isPlgUserTyping
                              ? 'translateY(-0.8px)'
                              : 'translateY(0px)'
                            : 'translateY(-1.6px) rotate(-8deg)',
                          transformOrigin: '5.5px 8.2px',
                        }}
                      />
                      {/* Padlock Body */}
                      <rect
                        x="3.2"
                        y="8.2"
                        width="11.6"
                        height="8"
                        rx="2"
                        fill={hasTypedText ? companionCta.sealFill : 'none'}
                        className="transition-colors duration-300"
                      />
                      {/* Keyhole */}
                      <circle cx="9" cy="11.6" r="1" fill="currentColor" stroke="none" />
                      <path d="M9 12.4 V14.1" strokeWidth="1.4" />
                    </svg>

                    <span className="relative z-10">
                      {onReturnToEditor
                        ? tr('Wróć do swojego dziennika', 'Return to your journal', 'Volver a tu diario', 'Retourner au journal')
                        : tr(
                            'Zamknij dzień i załóż konto',
                            'Close day & create account',
                            'Cerrar día y crear cuenta',
                            'Clôturer le jour et créer un compte'
                          )}
                    </span>

                    <ArrowRight className={`w-4 h-4 shrink-0 transition-transform group-hover/seal:translate-x-0.5 ${companionCta.iconClass}`} />
                  </button>
                );
              })()}
            </div>

            {/* CompanionDesk + 2-line footer */}
            <div className="max-w-2xl mx-auto w-full px-2.5 sm:px-8 flex flex-col items-center select-none border-t border-[#EAE5DA]/70 pt-2">
              <div className="w-full flex flex-col items-center mb-1">
                <CompanionDesk
                  companionId={showcaseCompanion}
                  isTyping={isPlgUserTyping || (plgDraft.length === 0 && isHeroTyping)}
                  isSealed={false}
                  isSearching={false}
                  lang={lang}
                  onSelectCompanion={handleNextCompanion}
                />
              </div>

              {/* Two-line footer & navigation bar directly below the animal companion */}
              <div className="w-full flex flex-col items-center gap-1.5 text-xs font-mono-meta text-[#7A756D] py-0.5">
                {/* Line 1: Live Writing Statistics */}
                <div className="tabular-nums flex flex-wrap items-center justify-center gap-2 text-[11px] sm:text-xs">
                  <span
                    className={`flex items-center gap-1 ${
                      isPlgUserTyping ? 'text-[#1C1A18] font-medium' : 'text-[#7A756D]'
                    }`}
                  >
                    <Clock className={`w-3 h-3 ${isPlgUserTyping ? 'text-[#3E7B44]' : 'text-[#9E978C]'}`} />
                    <span>{formatPlgWritingTime(plgWritingSeconds)}</span>
                  </span>
                  <span className="text-[#C8C2B4]">·</span>
                  <span>
                    {plgWordCount}{' '}
                    {tr('słów', 'words', 'palabras', 'mots')}
                  </span>
                  <span className="text-[#C8C2B4]">·</span>
                  <span>
                    {plgCharCount}{' '}
                    {tr('znaków', 'chars', 'caracteres', 'caractères')}
                  </span>
                  {plgDraft.trim().length > 0 && (
                    <>
                      <span className="text-[#C8C2B4]">·</span>
                      <span className="flex items-center gap-1 text-[#5E5A54]">
                        <Check className="w-3 h-3 text-[#3E7B44]" />
                        <span>{tr('Zapisano lokalnie', 'Saved locally', 'Guardado localmente', 'Enregistré localement')}</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Line 2: Clean 3-Section Quick Links */}
                <div className="w-full flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
                  <button
                    type="button"
                    onClick={() => scrollToSection('flow-section')}
                    className="px-2.5 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                  >
                    <svg
                      viewBox="0 0 24 20"
                      className="w-3.5 h-3 shrink-0 overflow-visible"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 4 C9 2.5 5 2.5 2 4 L2 16 C5 14.5 9 14.5 12 16 C15 14.5 19 14.5 22 16 L22 4 C19 2.5 15 2.5 12 4 Z"
                        fill="#FAF8F5"
                        stroke="#1C1A18"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 4 L12 16"
                        stroke="#1C1A18"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                      <circle cx="17.5" cy="8.5" r="2.2" fill="#EBC5CF" stroke="#8B2635" strokeWidth="1.2" />
                    </svg>
                    <span>{tr('01 · Rytuał', '01 · Ritual', '01 · Ritual', '01 · Rituel')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollToSection('mobile-section')}
                    className="px-2.5 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3 h-3 text-[#8B2635] shrink-0" />
                    <span>{tr('02 · Telefon i Gwiazdki', '02 · Mobile & Stars', '02 · Móvil y Estrellas', '02 · Mobile et Étoiles')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollToSection('security-section')}
                    className="px-2.5 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#2E6F40] shrink-0" />
                    <span>{tr('03 · Prywatność E2EE', '03 · E2EE Privacy', '03 · Privacidad E2EE', '03 · Confidentialité E2EE')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. SCROLL-DRIVEN STEP-BY-STEP FLOW — With Hanging Lightbulb Illustration */}
        <section id="flow-section" className="border-t border-[#E5DFD3] bg-[#F3EFE7]/55 pt-7 pb-16 md:pt-8 md:pb-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-xs font-mono-meta text-[#7A756D]">
                  {/* Hand-drawn Open Journal / Ritual Icon */}
                  <svg
                    viewBox="0 0 24 20"
                    className="w-5 h-4 shrink-0 overflow-visible"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 4 C9 2.5 5 2.5 2 4 L2 16 C5 14.5 9 14.5 12 16 C15 14.5 19 14.5 22 16 L22 4 C19 2.5 15 2.5 12 4 Z"
                      fill="#FAF8F5"
                      stroke="#1C1A18"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 4 L12 16"
                      stroke="#1C1A18"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                    <circle cx="17.5" cy="8.5" r="2.2" fill="#EBC5CF" stroke="#8B2635" strokeWidth="1.2" />
                  </svg>
                  <span>
                    {tr(
                      '01 · Jak to działa',
                      '01 · How it works',
                      '01 · Cómo funciona',
                      '01 · Comment ça marche'
                    )}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-serif-literary text-[#1C1A18] leading-tight sm:whitespace-nowrap">
                  {tr(
                    'Cztery chwile codziennego rytuału.',
                    'Four moments of the daily ritual.',
                    'Cuatro momentos del ritual diario.',
                    'Quatre moments du rituel quotidien.'
                  )}
                </h2>
              </div>

              {/* Hanging Lightbulb Line-Art Illustration (without cloud) */}
              <svg
                viewBox="68 0 48 64"
                className="w-12 h-16 shrink-0 overflow-visible"
                aria-hidden="true"
              >
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Left Column: 4 Concise Steps */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-3">
                {[
                  {
                    num: '01.',
                    titlePl: 'Pytanie Dnia i cichy margines',
                    titleEn: 'Daily Question & quiet margin',
                    titleEs: 'Pregunta del Día y margen silencioso',
                    titleFr: 'Question du jour et marge discrète',
                    descPl:
                      'Obok Twojego tekstu pojawia się subtelne pytanie pomocnicze, które wkleisz jednym kliknięciem.',
                    descEn:
                      'A quiet follow-up question appears beside your text — click once to weave it in.',
                    descEs:
                      'Una pregunta de seguimiento aparece junto a tu texto; haz clic para añadirla.',
                    descFr:
                      'Une question de relance apparaît à côté de votre texte — cliquez pour l’insérer.',
                  },
                  {
                    num: '02.',
                    titlePl: 'Pisanie lub dyktowanie głosem',
                    titleEn: 'Writing or voice dictation',
                    titleEs: 'Escritura o dictado por voz',
                    titleFr: 'Écriture ou dictée vocale',
                    descPl:
                      'Pisz na klawiaturze albo mów swobodnie do mikrofonu, a Twój towarzysz stuka w maszynę razem z Tobą.',
                    descEn:
                      'Type on your keyboard or speak freely while your companion types along at the desk.',
                    descEs:
                      'Escribe en el teclado o habla libremente mientras tu compañero teclea contigo.',
                    descFr:
                      'Écrivez au clavier ou parlez librement pendant que votre compagnon tape avec vous.',
                  },
                  {
                    num: '03.',
                    titlePl: 'Zamknięcie i odblokowanie dnia',
                    titleEn: 'Sealing & unlocking the day',
                    titleEs: 'Cerrar y desbloquear el día',
                    titleFr: 'Clore et déverrouiller la journée',
                    descPl:
                      'Po zamknięciu dnia atrament jaśnieje, a w razie nowej myśli odblokujesz wpis jednym kliknięciem.',
                    descEn:
                      'When sealed, the ink softens — and if a new thought appears, unlock it with a single click.',
                    descEs:
                      'Al cerrar el día, la tinta se suaviza y puedes desbloquearla con un solo clic.',
                    descFr:
                      'Une fois la journée close, l’encre s’adoucit et reste déverrouillable en un clic.',
                  },
                  {
                    num: '04.',
                    titlePl: 'Szyfrowany Dziennik',
                    titleEn: 'Encrypted Journal',
                    titleEs: 'Diario cifrado',
                    titleFr: 'Journal chiffré',
                    descPl:
                      'Kalendarz z zakreślonymi dniami wysuwa się spod biurka, byś mógł spokojnie wracać do wspomnień.',
                    descEn:
                      'A monthly calendar slides out from beneath the desk so you can revisit every saved memory.',
                    descEs:
                      'El calendario mensual se desliza bajo el escritorio para volver a tus recuerdos.',
                    descFr:
                      'Un calendrier mensuel glisse sous le bureau pour retrouver chacun de vos souvenirs.',
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
                          ? `bg-[#FAF8F5] ${companionCta.activeBorderLClass}`
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

              {/* Right Column: Interactive Stage matching the full height of the 4 steps on the left */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="bg-[#FAF8F5] border border-[#E5DFD3] rounded-xl overflow-hidden flex-1 flex flex-col h-full">
                  {/* Step Selector Tabs */}
                  <div className="flex items-center justify-between px-5 py-3 bg-[#F2EFE8] border-b border-[#E5DFD3] gap-2 overflow-x-auto shrink-0">
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
                              ? `${companionCta.activePillClass} font-medium`
                              : 'text-[#524D46] hover:text-[#1C1A18] hover:bg-[#E6E1D6]'
                          }`}
                        >
                          {tr(tab.labelPl, tab.labelEn, tab.labelEs, tab.labelFr)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stage Content */}
                  <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
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
                                onClick={() => handleSelectShowcaseCompanion(comp.id)}
                                className={`px-2.5 py-1 rounded text-xs font-mono-meta transition-colors cursor-pointer whitespace-nowrap ${
                                  showcaseCompanion === comp.id
                                    ? companionCta.activePillClass
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
                            className={`px-3.5 py-1.5 rounded-md ${companionCta.activePillClass} text-xs font-mono-meta whitespace-nowrap shrink-0 cursor-pointer transition-colors`}
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
                                        ? `${companionCta.activePillClass} font-semibold cursor-pointer`
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

        {/* =====================================================================
            02 · MOBILE, STARS & SHARING — 3 CLEAN STATIC CARDS
           ===================================================================== */}
        <section id="mobile-section" className="border-t border-[#E5DFD3] bg-[#FAF8F5] py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-6 space-y-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-mono-meta text-[#8B2635]">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>
                  {tr(
                    '02 · W kieszeni i na co dzień',
                    '02 · In your pocket & every day',
                    '02 · En tu bolsillo y cada día',
                    '02 · Dans votre poche et au quotidien'
                  )}
                </span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-serif-literary text-[#1C1A18] leading-tight sm:whitespace-nowrap">
                {tr(
                  'Spokojny rytuał, który dopasowuje się do Twojego wieczoru.',
                  'A calm ritual that fits naturally into your evening.',
                  'Un ritual sereno que se adapta de forma natural a tu noche.',
                  'Un rituel apaisé qui s’adapte naturellement à votre soirée.'
                )}
              </h2>
            </div>

            {/* 3 Clean Visual Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {/* Card 1: Mobile App & Voice Dictation */}
              <div className="bg-[#F7F5F0] border border-[#E5DFD3] rounded-2xl p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-[#FAF8F5] border border-[#DDD6C8] flex items-center justify-center text-[#8B2635]">
                      <Smartphone className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] font-mono-meta text-[#7A756D]">
                      iOS · Android · Web
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-xl font-serif-literary font-medium text-[#1C1A18]">
                      {tr(
                        'Telefon i dyktowanie głosem',
                        'Mobile app & voice dictation',
                        'App móvil y dictado por voz',
                        'Application mobile et dictée vocale'
                      )}
                    </h3>
                    <p className="text-sm font-serif-literary text-[#524D46] leading-relaxed">
                      {tr(
                        'Dodaj Momenty do ekranu głównego w 5 sekund. Pisz na klawiaturze lub nagraj myśl głosem podczas wieczornego spaceru.',
                        'Add Moments to your home screen in 5 seconds. Type or dictate your thoughts by voice during an evening walk.',
                        'Añade Moments a tu pantalla de inicio en 5 segundos. Escribe o dicta tus pensamientos por voz.',
                        'Ajoutez Moments à votre écran d’accueil en 5 secondes. Écrivez ou dictez vos pensées à la voix.'
                      )}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#ECE7DC] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="text-xs font-mono-meta text-[#1C1A18] hover:text-[#8B2635] underline underline-offset-4 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#8B2635]" />
                    <span>
                      {isInstalled
                        ? tr('Aplikacja zainstalowana', 'App installed', 'App instalada', 'Application installée')
                        : tr('Zainstaluj na telefonie →', 'Install on phone →', 'Instalar en el móvil →', 'Installer sur mobile →')}
                    </span>
                  </button>
                </div>
              </div>

              {/* Card 2: Stars & Warm Reflection */}
              <div id="appreciation-section" className="bg-[#F7F5F0] border border-[#E5DFD3] rounded-2xl p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-[#EBC5CF]/55 border border-[#DDD6C8] flex items-center justify-center text-[#8B2635]">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] font-mono-meta text-[#7A756D]">
                      {tr('Co kilka zamkniętych dni', 'Every few sealed days', 'Cada pocos días', 'Tous les quelques jours')}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-xl font-serif-literary font-medium text-[#1C1A18]">
                      {tr(
                        'Gwiazdki i ciepłe podsumowania',
                        'Stars & warm reflections',
                        'Estrellas y resúmenes cálidos',
                        'Étoiles et résumés chaleureux'
                      )}
                    </h3>
                    <p className="text-sm font-serif-literary text-[#524D46] leading-relaxed">
                      {tr(
                        'Po kilku wpisach w kalendarzu zapalają się gwiazdki — życzliwe spojrzenie na to, gdzie zwolniłeś tempo i o co zadbałeś.',
                        'After a few entries, stars light up in your calendar — a kind reflection on where you slowed down and protected your calm.',
                        'Tras varias entradas, se iluminan estrellas en tu calendario con una mirada cálida a tus últimos días.',
                        'Après quelques entrées, des étoiles s’allument dans votre calendrier avec un regard bienveillant sur vos derniers jours.'
                      )}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#ECE7DC] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowDemoSparkleModal(true)}
                    className="text-xs font-mono-meta text-[#1C1A18] hover:text-[#8B2635] underline underline-offset-4 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#8B2635]" />
                    <span>
                      {tr('Zobacz przykładową kartę →', 'See sample card →', 'Ver tarjeta de ejemplo →', 'Voir un exemple de carte →')}
                    </span>
                  </button>
                </div>
              </div>

              {/* Card 3: One-Time PIN Letter & Weekly Rhythm */}
              <div id="share-section" className="bg-[#F7F5F0] border border-[#E5DFD3] rounded-2xl p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-[#EBF2EB] border border-[#CCE2CC] flex items-center justify-center text-[#2E5C33]">
                      <Share2 className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] font-mono-meta text-[#7A756D]">
                      {tr('List z PIN-em · Wykresy', 'PIN letter · Charts', 'Carta con PIN · Gráficos', 'Lettre PIN · Graphiques')}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-xl font-serif-literary font-medium text-[#1C1A18]">
                      {tr(
                        'Dzielenie się i rytm tygodnia',
                        'One-time sharing & weekly rhythm',
                        'Compartir y ritmo semanal',
                        'Partage unique et rythme hebdomadaire'
                      )}
                    </h3>
                    <p className="text-sm font-serif-literary text-[#524D46] leading-relaxed">
                      {tr(
                        'Wyślij wybrane wspomnienie bliskiej osobie jako jednorazowy list z kodem PIN i obserwuj swój spokojny rytm pisania na wykresie.',
                        'Send a chosen memory to someone close via a single-use PIN link, and follow your steady writing rhythm on a clean line chart.',
                        'Envía un recuerdo a alguien cercano mediante un enlace único con PIN y sigue tu ritmo de escritura.',
                        'Envoyez un souvenir à un proche via un lien unique protégé par PIN et suivez votre rythme d’écriture.'
                      )}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#ECE7DC] flex items-center justify-between text-xs font-mono-meta text-[#7A756D]">
                  <span>
                    {tr('Dostępne od razu po założeniu konta', 'Available right after creating an account', 'Disponible al crear tu cuenta', 'Disponible dès la création du compte')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            03 · CLEAN STATIC PRIVACY E2EE SECTION
           ===================================================================== */}
        <section id="security-section" className="border-t border-[#E5DFD3] bg-[#F3EFE7]/55 py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left Column: Short, Clear Explanation */}
              <div className="lg:col-span-5 space-y-5">
                <div className="inline-flex items-center gap-2 text-xs font-mono-meta text-[#2E6F40]">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    {tr(
                      '03 · Prywatność E2EE',
                      '03 · E2EE Privacy',
                      '03 · Privacidad E2EE',
                      '03 · Confidentialité E2EE'
                    )}
                  </span>
                </div>

                <h2
                  className="text-3xl sm:text-4xl font-serif-literary text-[#1C1A18] leading-tight"
                  style={{ textWrap: 'balance' }}
                >
                  {tr(
                    'Twoje myśli należą wyłącznie do Ciebie.',
                    'Your thoughts belong solely to you.',
                    'Tus pensamientos te pertenecen solo a ti.',
                    'Vos pensées n’appartiennent qu’à vous.'
                  )}
                </h2>

                <p className="text-base font-serif-literary text-[#524D46] leading-relaxed">
                  {tr(
                    'Każdy wpis jest szyfrowany kluczem AES-256 bezpośrednio w Twojej przeglądarce, zanim trafi do chmury. Nawet my nie możemy przeczytać ani jednego Twojego słowa.',
                    'Every entry is encrypted with an AES-256 key directly in your browser before reaching the cloud. Not even we can read a single word you write.',
                    'Cada entrada se cifra con una clave AES-256 directamente en tu navegador antes de llegar a la nube. Ni siquiera nosotros podemos leer una sola palabra.',
                    'Chaque entrée est chiffrée avec une clé AES-256 directement dans votre navigateur avant d’atteindre le nuage. Même nous ne pouvons lire un seul mot.'
                  )}
                </p>

                <div className="pt-2 space-y-2 border-t border-[#EAE5DA] text-xs font-mono-meta text-[#524D46]">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E6F40] shrink-0" />
                    <span>
                      {tr(
                        'Szyfrowanie w przeglądarce (AES-GCM 256)',
                        'Browser-side encryption (AES-GCM 256)',
                        'Cifrado en el navegador (AES-GCM 256)',
                        'Chiffrement dans le navigateur (AES-GCM 256)'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2E6F40] shrink-0" />
                    <span>
                      {tr(
                        'Automatyczna synchronizacja Telefon ↔ Komputer',
                        'Automatic sync Phone ↔ Computer',
                        'Sincronización automática Móvil ↔ Ordenador',
                        'Synchronisation automatique Téléphone ↔ Ordinateur'
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Clean Static Side-by-Side Comparison Card */}
              <div className="lg:col-span-7">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Card A: On Your Device */}
                  <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD3] flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono-meta text-[#2E6F40]">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Unlock className="w-3.5 h-3.5" />
                        <span>
                          {tr(
                            'Na Twoim urządzeniu',
                            'On your device',
                            'En tu dispositivo',
                            'Sur votre appareil'
                          )}
                        </span>
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-[#7A756D]">
                        {tr('Czytelny wpis', 'Readable', 'Legible', 'Lisible')}
                      </span>
                    </div>

                    <p className="text-base font-serif-literary italic text-[#1C1A18] leading-relaxed">
                      „{demoSecretText}”
                    </p>

                    <div className="pt-3 border-t border-[#E6E0D4] text-[11px] font-mono-meta text-[#7A756D]">
                      {tr(
                        'Widoczne tylko po zalogowaniu na Twoim telefonie lub komputerze.',
                        'Visible only when signed in on your phone or computer.',
                        'Visible solo al iniciar sesión en tu móvil u ordenador.',
                        'Visible uniquement connecté sur votre téléphone ou ordinateur.'
                      )}
                    </div>
                  </div>

                  {/* Card B: In Cloud Database */}
                  <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[#E2DDD3] flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono-meta text-[#8B2635]">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Lock className="w-3.5 h-3.5" />
                        <span>
                          {tr(
                            'W bazie danych',
                            'In the database',
                            'En la base de datos',
                            'Dans la base de données'
                          )}
                        </span>
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-[#7A756D]">
                        AES-256
                      </span>
                    </div>

                    <div className="font-mono-meta text-xs text-[#7A756D] break-all leading-relaxed select-none bg-[#F7F5F0] p-3.5 rounded-xl border border-[#E5DFD3]">
                      {liveEncrypted.encryptedContent.slice(0, 76)}...
                    </div>

                    <div className="pt-3 border-t border-[#E2DDD3] text-[11px] font-mono-meta text-[#7A756D]">
                      {tr(
                        'Serwer przechowuje wyłącznie zaszyfrowany szyfrogram bez dostępu do klucza.',
                        'The server stores only unreadable ciphertext with zero key access.',
                        'El servidor guarda solo texto cifrado ilegible sin acceso a la clave.',
                        'Le serveur ne stocke que du texte chiffré illisible sans accès à la clé.'
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            FINAL PLG CONVERSION SECTION (KARROT-INSPIRED CLEAN CLOSING)
           ===================================================================== */}
        <section className="border-t border-[#E5DFD3] bg-[#F2EFE8] py-16 md:py-24">
          <div className="max-w-xl mx-auto px-6 text-center space-y-6">
            <div className="flex justify-center">
              <CompanionDesk
                companionId={showcaseCompanion}
                isTyping={isHeroTyping}
                isSealed={false}
                isSearching={false}
                lang={lang}
                onSelectCompanion={handleNextCompanion}
              />
            </div>

            <div className="space-y-2.5">
              <h2
                className="text-3xl sm:text-4xl font-serif-literary text-[#1C1A18] leading-tight"
                style={{ textWrap: 'balance' }}
              >
                {tr(
                  'Gotowy na pierwszy spokojny wieczór z dziennikiem?',
                  'Ready for your first unhurried evening with a journal?',
                  '¿Listo para tu primera noche tranquila con tu diario?',
                  'Prêt pour votre première soirée paisible avec votre journal ?'
                )}
              </h2>
              <p className="text-sm sm:text-base font-serif-literary text-[#524D46]">
                {tr(
                  'Załóż darmowe, szyfrowane konto w kilka sekund i zachowaj swój dzisiejszy wpis.',
                  'Create your free encrypted account in seconds and keep today’s reflection.',
                  'Crea tu cuenta cifrada gratuita en segundos y guarda tu entrada de hoy.',
                  'Créez votre compte chiffré gratuit en quelques secondes et gardez votre pensée du jour.'
                )}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  persistPlgDraft(plgDraft, activeHeroPrompt.id, plgWritingSeconds);
                  onGoogleLogin();
                }}
                disabled={isAuthLoading}
                className={`px-7 py-3.5 text-sm font-mono-meta font-medium ${companionCta.activePillClass} rounded-xl transition-all inline-flex items-center gap-2.5 cursor-pointer whitespace-nowrap shadow-xs disabled:opacity-60`}
              >
                <Lock className="w-4 h-4" />
                <span>
                  {isAuthLoading
                    ? tr('Łączenie...', 'Connecting...', 'Conectando...', 'Connexion...')
                    : tr(
                        'Załóż darmowe konto (Google)',
                        'Create free account (Google)',
                        'Crear cuenta gratis (Google)',
                        'Créer un compte gratuit (Google)'
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
