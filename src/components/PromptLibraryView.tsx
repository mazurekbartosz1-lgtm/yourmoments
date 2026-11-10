import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Lock,
  ArrowLeft,
  ArrowRight,
  Globe,
  ChevronDown,
  Search,
  Mic,
  MicOff,
  Check,
  ShieldCheck,
  Sparkles,
  BookOpen,
  User,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  DAILY_PROMPTS,
  CATEGORIES,
  PromptCategory,
  Language,
  DailyPrompt,
  getPromptSlug,
  getPromptBySlug,
  getPromptSeoDetails,
  formatDateKey,
} from '../data/prompts';
import { CompanionDesk, COMPANIONS, CompanionId } from './CompanionDesk';

interface PromptLibraryViewProps {
  slug: string | null;
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  onNavigate: (path: string) => void;
  onGoogleLogin: () => Promise<void>;
  onOpenInEditorWithPrompt?: (prompt: DailyPrompt, draftText: string) => void;
  isSignedIn?: boolean;
  userName?: string;
  userPhotoURL?: string;
  isAuthLoading?: boolean;
  authError?: string | null;
}

export const PromptLibraryView: React.FC<PromptLibraryViewProps> = ({
  slug,
  lang,
  onLanguageChange,
  onNavigate,
  onGoogleLogin,
  onOpenInEditorWithPrompt,
  isSignedIn = false,
  userName,
  userPhotoURL,
  isAuthLoading = false,
  authError = null,
}) => {
  const isEn = lang === 'en';
  const isEs = lang === 'es';
  const isFr = lang === 'fr';
  const tr = (pl: string, en: string, es?: string, fr?: string) =>
    isEn ? en : isEs ? (es ?? en) : isFr ? (fr ?? en) : pl;

  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const activePrompt = useMemo(() => {
    if (!slug) return null;
    return getPromptBySlug(slug) || null;
  }, [slug]);

  const todayKey = useMemo(() => formatDateKey(new Date()), []);

  // Interactive "Write First, Sign Up to Save" editor state for individual prompt pages
  const [draftText, setDraftText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [writingSeconds, setWritingSeconds] = useState<number>(0);
  const [showSaveConversionModal, setShowSaveConversionModal] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [companionId, setCompanionId] = useState<CompanionId>(() => {
    const idx = Math.floor(Math.random() * COMPANIONS.length);
    return COMPANIONS[idx]?.id || 'crocodile';
  });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  // Load any saved draft for this prompt or today's PLG draft
  useEffect(() => {
    if (!activePrompt) return;
    try {
      const promptSpecificDraft = localStorage.getItem(`kronika_prompt_draft_${activePrompt.id}`);
      if (promptSpecificDraft !== null && promptSpecificDraft.trim().length > 0) {
        setDraftText(promptSpecificDraft);
        return;
      }
      const plgRaw = localStorage.getItem('kronika_plg_draft');
      if (plgRaw) {
        const parsed = JSON.parse(plgRaw);
        if (parsed && parsed.promptId === activePrompt.id && typeof parsed.content === 'string') {
          setDraftText(parsed.content);
          if (typeof parsed.writingTimeSeconds === 'number') {
            setWritingSeconds(parsed.writingTimeSeconds);
          }
          return;
        }
      }
      setDraftText('');
      setWritingSeconds(0);
    } catch {
      setDraftText('');
    }
  }, [activePrompt]);

  // Persist draft to localStorage as the user types so it survives OAuth / page reload
  const persistDraftToLocal = (newText: string, promptObj: DailyPrompt, secs: number) => {
    try {
      localStorage.setItem(`kronika_prompt_draft_${promptObj.id}`, newText);
      const payload = {
        content: newText,
        isSealed: false,
        promptId: promptObj.id,
        writingTimeSeconds: secs,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('kronika_plg_draft', JSON.stringify(payload));
      if (newText.trim().length > 0) {
        localStorage.setItem(`kronika_draft_${todayKey}`, JSON.stringify(payload));
        localStorage.setItem(`kronika_answered_prompt_${todayKey}`, promptObj.id);
      }
    } catch {
      // ignore storage quota errors
    }
  };

  // Increment writing timer while actively typing
  useEffect(() => {
    if (!isTyping) return;
    const interval = setInterval(() => {
      setWritingSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTyping]);

  // Update document head SEO tags & Schema.org JSON-LD dynamically
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const origin = 'https://www.dailymoments.app';

    if (activePrompt) {
      const seo = getPromptSeoDetails(activePrompt, lang);
      document.title = seo.title;

      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', seo.metaDescription);

      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', seo.title);

      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', seo.metaDescription);

      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = `${origin}${seo.urlPath}`;

      // Inject dynamic Schema.org QAPage / Article JSON-LD for long-tail prompt indexing
      let ldScript = document.getElementById('dynamic-prompt-jsonld') as HTMLScriptElement | null;
      if (!ldScript) {
        ldScript = document.createElement('script');
        ldScript.id = 'dynamic-prompt-jsonld';
        ldScript.type = 'application/ld+json';
        document.head.appendChild(ldScript);
      }
      ldScript.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: seo.title,
        description: seo.metaDescription,
        url: `${origin}${seo.urlPath}`,
        mainEntity: {
          '@type': 'Question',
          name: seo.promptText,
          text: seo.hintText,
          suggestedAnswer: {
            '@type': 'Answer',
            text: `${seo.reflectionGuide} ${seo.followUpQuestions.join(' ')}`,
          },
        },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Momenty / Moments',
              item: `${origin}/`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: tr('Biblioteka pytań', 'Reflection Prompts', 'Preguntas de reflexión', 'Questions de réflexion'),
              item: `${origin}/prompts`,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: seo.promptText,
              item: `${origin}${seo.urlPath}`,
            },
          ],
        },
      });
    } else {
      const libTitle = tr(
        'Biblioteka pytań do dziennika i codziennej refleksji | Momenty',
        'Daily Reflection Prompts & Mindful Journaling Questions | Moments',
        'Biblioteca de preguntas de reflexión diaria | Moments',
        'Bibliothèque de questions de réflexion quotidienne | Moments'
      );
      const libDesc = tr(
        'Odkryj 47 pytań do codziennej refleksji, wdzięczności, uważności i radzenia sobie z wypaleniem. Zacznij pisać od razu w przeglądarce bez logowania.',
        'Explore 47 curated daily reflection prompts for overcoming burnout, evening gratitude, sensory mindfulness, and self-discovery. Write your reflection directly on the page.',
        'Explora 47 preguntas de reflexión diaria para superar el agotamiento, gratitud nocturna y atención plena. Escribe directamente en la página.',
        'Explorez 47 questions de réflexion quotidienne pour surmonter l’épuisement, la gratitude du soir et la pleine conscience.'
      );
      document.title = libTitle;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', libDesc);

      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = `${origin}/prompts`;
    }
  }, [activePrompt, lang]);

  const handleDraftChange = (val: string) => {
    setDraftText(val);
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1200);

    if (activePrompt) {
      persistDraftToLocal(val, activePrompt, writingSeconds);
    }
  };

  const applyInlineFormatting = (wrapper: '**' | '*') => {
    const el = textareaRef.current;
    if (!el || !activePrompt) return;
    const start = el.selectionStart ?? draftText.length;
    const end = el.selectionEnd ?? draftText.length;
    const selected = draftText.slice(start, end);
    const replacement = selected
      ? `${wrapper}${selected}${wrapper}`
      : `${wrapper}${tr('tekst', 'text', 'texto', 'texte')}${wrapper}`;
    const updated = draftText.slice(0, start) + replacement + draftText.slice(end);
    handleDraftChange(updated);
    setTimeout(() => {
      el.focus();
      const cursor = start + replacement.length;
      el.setSelectionRange(cursor, cursor);
    }, 10);
  };

  const insertFollowUpQuestion = (questionText: string) => {
    if (!activePrompt) return;
    const formattedQ = `***${questionText.trim()}***`;
    const prefix = draftText.trim().length > 0 ? `${draftText.replace(/\s+$/, '')}\n\n` : '';
    const updated = `${prefix}${formattedQ}\n`;
    handleDraftChange(updated);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(updated.length, updated.length);
      }
    }, 20);
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const toggleVoiceDictation = () => {
    if (typeof window === 'undefined') return;
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      return;
    }

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang =
        lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'fr' ? 'fr-FR' : 'pl-PL';
      rec.interimResults = false;
      rec.continuous = false;

      rec.onstart = () => {
        setIsListening(true);
      };
      rec.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        if (transcript && typeof transcript === 'string') {
          const separator = draftText && !/\s$/.test(draftText) ? ' ' : '';
          handleDraftChange(`${draftText}${separator}${transcript.trim()}`);
        }
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => {
        recognitionRef.current = null;
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleSaveEntryClick = () => {
    if (!activePrompt) return;
    persistDraftToLocal(draftText, activePrompt, writingSeconds);

    if (isSignedIn && onOpenInEditorWithPrompt) {
      onOpenInEditorWithPrompt(activePrompt, draftText);
      return;
    }
    setShowSaveConversionModal(true);
  };

  const wordCount = draftText.trim() ? draftText.trim().split(/\s+/).length : 0;

  const filteredPrompts = useMemo(() => {
    return DAILY_PROMPTS.filter(p => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const seo = getPromptSeoDetails(p, lang);
      return (
        seo.promptText.toLowerCase().includes(q) ||
        seo.hintText.toLowerCase().includes(q) ||
        seo.slug.toLowerCase().includes(q) ||
        seo.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [selectedCategory, searchQuery, lang]);

  // Featured high-intent SEO prompts highlighted at the top of the directory
  const featuredSlugs = [
    'overcoming-burnout',
    'evening-gratitude',
    'quiet-morning-before-screens',
    'calming-sentence-to-past-self',
    'sensory-memory-of-taste',
    'daily-nature-respite',
  ];

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(path);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C1A18] flex flex-col font-serif-literary antialiased selection:bg-[#E2DDD3]">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-[#F7F5F0]/95 backdrop-blur-[2px] border-b border-[#E5DFD3]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a
              href="/"
              onClick={e => handleLinkClick(e, '/')}
              className="inline-flex items-center gap-2.5 text-xl font-serif-literary font-semibold tracking-tight text-[#1C1A18] whitespace-nowrap shrink-0"
            >
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

            <span className="text-[#C8C0B0] hidden sm:inline" aria-hidden="true">
              /
            </span>

            <a
              href="/prompts"
              onClick={e => handleLinkClick(e, '/prompts')}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono-meta text-[#524D46] hover:text-[#1C1A18] transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#8B2635]" />
              <span>
                {tr(
                  'Biblioteka pytań',
                  'Prompt Library',
                  'Biblioteca de preguntas',
                  'Bibliothèque de questions'
                )}
              </span>
            </a>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Language Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangDropdown(prev => !prev)}
                className="h-7 px-2 rounded-md border border-[#E2DDD3] bg-[#F2EFE8] hover:bg-[#EAE5DA] text-[11px] font-mono-meta text-[#1C1A18] inline-flex items-center gap-1 transition-colors cursor-pointer"
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

            {isSignedIn ? (
              <button
                type="button"
                onClick={() => onNavigate('/')}
                className="h-7 px-2.5 text-[11px] font-mono-meta font-medium text-[#FAF8F5] bg-[#1C1A18] hover:bg-[#33302B] rounded-md transition-colors inline-flex items-center gap-1.5 cursor-pointer"
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
                <span>{userName || tr('Twój dziennik', 'Your journal', 'Tu diario', 'Votre journal')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onGoogleLogin}
                disabled={isAuthLoading}
                className="h-7 px-2.5 text-[11px] font-mono-meta font-medium text-[#FAF8F5] bg-[#1C1A18] hover:bg-[#33302B] rounded-md transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Lock className="w-3 h-3 text-[#EBC5CF]" />
                <span>
                  {isAuthLoading ? '...' : tr('Konto', 'Account', 'Cuenta', 'Compte')}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Conversion Modal ("Your moment is ready. Create an encrypted account in 1 click to save it to your timeline") */}
      {showSaveConversionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
          onClick={() => setShowSaveConversionModal(false)}
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
                onClick={() => setShowSaveConversionModal(false)}
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
                  'Twój wpis został bezpiecznie przechowany w pamięci podręcznej przeglądarki. Po zalogowaniu zostanie automatycznie zaszyfrowany Twoim prywatnym kluczem i przypisany do dzisiejszego dnia.',
                  'Your reflection is safely held in your browser. As soon as you sign in, it will be encrypted on your device and saved directly to your personal timeline.',
                  'Tu reflexión está guardada en tu navegador. Al iniciar sesión, se cifrará en tu dispositivo y se añadirá a tu diario.',
                  'Votre réflexion est conservée dans votre navigateur. Dès la connexion, elle sera chiffrée sur votre appareil et ajoutée à votre journal.'
                )}
              </p>
            </div>

            {draftText.trim().length > 0 && (
              <div className="p-3.5 rounded-xl bg-[#F2EFE8] border border-[#DDD6C8] space-y-1">
                <div className="text-[10px] font-mono-meta text-[#7A756D] uppercase tracking-wider">
                  {tr('Podgląd Twojego wpisu', 'Your reflection preview', 'Vista previa de tu entrada', 'Aperçu de votre texte')} · {wordCount}{' '}
                  {tr('słów', 'words', 'palabras', 'mots')}
                </div>
                <p className="text-xs font-serif-literary italic text-[#33302B] line-clamp-3">
                  „{draftText.trim()}”
                </p>
              </div>
            )}

            {authError && (
              <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#E8C5C5] text-xs font-mono-meta text-[#8B2635] flex items-center gap-2">
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
                        'Kontynuuj z Google i zapisz wpis (1 kliknięcie)',
                        'Continue with Google & Save Entry (1 click)',
                        'Continuar con Google y guardar entrada (1 clic)',
                        'Continuer avec Google et enregistrer (1 clic)'
                      )}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowSaveConversionModal(false)}
                className="w-full py-2 text-xs font-mono-meta text-[#7A756D] hover:text-[#1C1A18] transition-colors cursor-pointer"
              >
                {tr(
                  'Wróć do pisania (szkic pozostanie w przeglądarce)',
                  'Keep writing first (draft stays in your browser)',
                  'Seguir escribiendo (el borrador se conserva)',
                  'Continuer à écrire (le brouillon reste sauvegardé)'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {activePrompt ? (
          /* =====================================================================
             SINGLE PROGRAMMATIC PROMPT PAGE (/prompts/:slug)
             ===================================================================== */
          (() => {
            const seo = getPromptSeoDetails(activePrompt, lang);
            const relatedPrompts = DAILY_PROMPTS.filter(
              p => p.id !== activePrompt.id && p.category === activePrompt.category
            ).slice(0, 4);

            return (
              <article className="space-y-10">
                {/* Breadcrumb & Back link */}
                <nav
                  aria-label="Breadcrumb"
                  className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono-meta text-[#7A756D]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href="/"
                      onClick={e => handleLinkClick(e, '/')}
                      className="hover:text-[#1C1A18] underline underline-offset-4"
                    >
                      {tr('Momenty', 'Moments', 'Moments', 'Moments')}
                    </a>
                    <span aria-hidden="true">·</span>
                    <a
                      href="/prompts"
                      onClick={e => handleLinkClick(e, '/prompts')}
                      className="hover:text-[#1C1A18] underline underline-offset-4"
                    >
                      {tr('Pytania', 'Prompts', 'Preguntas', 'Questions')}
                    </a>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#8B2635] font-medium">{seo.categoryLabel}</span>
                  </div>

                  <a
                    href="/prompts"
                    onClick={e => handleLinkClick(e, '/prompts')}
                    className="inline-flex items-center gap-1.5 text-[#524D46] hover:text-[#1C1A18] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>
                      {tr(
                        'Wszystkie pytania (47)',
                        'All reflection prompts (47)',
                        'Todas las preguntas (47)',
                        'Toutes les questions (47)'
                      )}
                    </span>
                  </a>
                </nav>

                {/* Prompt Header & Editorial Context */}
                <header className="space-y-4 max-w-3xl">
                  <div className="text-xs font-mono-meta text-[#8B2635] uppercase tracking-wider">
                    {seo.categoryLabel} · /prompts/{seo.slug}
                  </div>
                  <h1
                    className="text-3xl sm:text-4xl md:text-5xl font-serif-literary font-normal text-[#1C1A18] leading-[1.16]"
                    style={{ textWrap: 'balance' }}
                  >
                    {seo.promptText}
                  </h1>
                  <p className="text-base sm:text-lg font-serif-literary italic text-[#524D46] leading-relaxed">
                    {seo.hintText}
                  </p>
                </header>

                {/* LIVE INTERACTIVE "WRITE FIRST, SIGN UP TO SAVE" WORKSPACE */}
                <section
                  aria-label={tr('Twoja odpowiedź', 'Your reflection', 'Tu reflexión', 'Votre réflexion')}
                  className="bg-[#FAF8F5] border border-[#E5DFD3] rounded-2xl p-5 sm:p-8 space-y-5 shadow-[0_8px_30px_-14px_rgba(28,26,24,0.07)]"
                >
                  {/* Top Editor Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-[#ECE7DC]">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={toggleVoiceDictation}
                        className={`h-8 px-3 rounded-md border text-xs font-mono-meta inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isListening
                            ? 'bg-[#8B2635] border-[#8B2635] text-[#FAF8F5]'
                            : 'bg-[#F7F5F0] border-[#DDD6C8] hover:bg-[#EAE5DA] text-[#1C1A18]'
                        }`}
                      >
                        {isListening ? (
                          <>
                            <MicOff className="w-3.5 h-3.5 animate-pulse" />
                            <span>{tr('Słucham...', 'Listening...', 'Escuchando...', 'Écoute...')}</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5 text-[#8B2635]" />
                            <span>{tr('Dyktuj', 'Dictate', 'Dictar', 'Dicter')}</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => applyInlineFormatting('**')}
                        title={tr('Pogrubienie', 'Bold', 'Negrita', 'Gras')}
                        className="h-8 w-8 rounded-md border border-[#DDD6C8] bg-[#F7F5F0] hover:bg-[#EAE5DA] font-serif-literary font-bold text-xs text-[#1C1A18] cursor-pointer"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => applyInlineFormatting('*')}
                        title={tr('Kursywa', 'Italic', 'Cursiva', 'Italique')}
                        className="h-8 w-8 rounded-md border border-[#DDD6C8] bg-[#F7F5F0] hover:bg-[#EAE5DA] font-serif-literary italic text-xs text-[#1C1A18] cursor-pointer"
                      >
                        I
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono-meta text-[#7A756D] tabular-nums">
                      <span>
                        {draftText.trim().length > 0
                          ? tr('Zapisano szkic lokalnie', 'Draft saved locally', 'Borrador guardado', 'Brouillon local')
                          : tr('Pisz od razu — bez logowania', 'Write immediately — no login wall', 'Escribe sin iniciar sesión', 'Écrivez sans connexion')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {wordCount} {tr('słów', 'words', 'palabras', 'mots')}
                      </span>
                    </div>
                  </div>

                  {/* Two-column Margin + Live Textarea */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    {/* Left Margin with Clickable Socratic Follow-up Questions */}
                    <div className="md:col-span-4 space-y-3 border-b md:border-b-0 md:border-r border-[#EAE5DA] pb-4 md:pb-0 md:pr-5">
                      <div className="text-[11px] font-mono-meta uppercase tracking-wider text-[#7A756D]">
                        {tr(
                          'Pytania pomocnicze na marginesie (kliknij, aby wstawić):',
                          'Margin follow-ups (click to insert):',
                          'Preguntas en el margen (haz clic para insertar):',
                          'Questions en marge (cliquez pour insérer) :'
                        )}
                      </div>
                      <div className="space-y-2">
                        {seo.followUpQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => insertFollowUpQuestion(q)}
                            className="w-full text-left p-2.5 rounded-lg bg-[#F7F5F0] hover:bg-[#EFECE4] border border-transparent hover:border-[#DDD6C8] text-xs font-serif-literary italic text-[#524D46] hover:text-[#1C1A18] leading-snug transition-all cursor-pointer"
                          >
                            „{q}” →
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Right Live Reflection Textarea */}
                    <div className="md:col-span-8 flex flex-col space-y-4">
                      <textarea
                        ref={textareaRef}
                        value={draftText}
                        onChange={e => handleDraftChange(e.target.value)}
                        rows={7}
                        placeholder={tr(
                          'Zacznij pisać swoją odpowiedź tutaj... Twoje słowa zapisują się od razu na Twoim urządzeniu.',
                          'Start writing your reflection right here... Your words are saved locally as you type.',
                          'Empieza a escribir tu reflexión aquí... Tus palabras se guardan localmente mientras escribes.',
                          'Commencez à écrire votre réflexion ici... Vos mots sont enregistrés localement.'
                        )}
                        className="w-full min-h-[180px] bg-transparent text-base sm:text-lg font-serif-literary text-[#1C1A18] placeholder:text-[#9E978C] placeholder:italic leading-relaxed resize-y focus:outline-none"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#ECE7DC]">
                        <div className="text-xs font-mono-meta text-[#7A756D] tabular-nums">
                          {writingSeconds > 0 && (
                            <span>
                              {writingSeconds}s · {wordCount}{' '}
                              {tr('słów', 'words', 'palabras', 'mots')}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveEntryClick}
                          className="px-5 py-2.5 rounded-lg bg-[#1C1A18] hover:bg-[#33302B] text-[#FAF8F5] text-xs sm:text-sm font-mono-meta font-medium inline-flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                        >
                          <Lock className="w-3.5 h-3.5 text-[#EBC5CF]" />
                          <span>
                            {isSignedIn
                              ? tr(
                                  'Zapisz wpis na osi czasu →',
                                  'Save Entry to Timeline →',
                                  'Guardar entrada en tu diario →',
                                  'Enregistrer dans le journal →'
                                )
                              : tr(
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

                  {/* Desk Companion */}
                  <div className="pt-2 border-t border-[#ECE7DC]/70">
                    <CompanionDesk
                      companionId={companionId}
                      isTyping={isTyping}
                      isSealed={false}
                      isSearching={false}
                      lang={lang}
                      onSelectCompanion={() => {
                        const idx = COMPANIONS.findIndex(c => c.id === companionId);
                        const next = COMPANIONS[(idx + 1) % COMPANIONS.length];
                        if (next) setCompanionId(next.id);
                      }}
                    />
                  </div>
                </section>

                {/* SEO Editorial Guide: Why this prompt matters & how to approach it */}
                <section className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-4 border-t border-[#E5DFD3]">
                  <div className="md:col-span-7 space-y-3">
                    <h2 className="text-xl font-serif-literary font-medium text-[#1C1A18]">
                      {tr(
                        'Jak podejść do tego pytania w dzienniku?',
                        'How to approach this reflection prompt',
                        'Cómo abordar esta pregunta en tu diario',
                        'Comment aborder cette question de réflexion'
                      )}
                    </h2>
                    <p className="text-sm sm:text-base font-serif-literary text-[#524D46] leading-relaxed">
                      {seo.reflectionGuide}
                    </p>
                  </div>

                  <div className="md:col-span-5 bg-[#F2EFE8] border border-[#E2DDD3] rounded-xl p-5 space-y-2.5">
                    <div className="text-xs font-mono-meta text-[#2E6F40] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {tr(
                          'Prywatność End-to-End (AES-256)',
                          'End-to-End Privacy (AES-256)',
                          'Privacidad de extremo a extremo',
                          'Confidentialité de bout en bout'
                        )}
                      </span>
                    </div>
                    <p className="text-xs font-serif-literary text-[#524D46] leading-relaxed">
                      {tr(
                        'W aplikacji Momenty możesz najpierw swobodnie przelać myśli na kartkę. Gdy klikniesz „Zapisz wpis”, Twój tekst zostanie zaszyfrowany w przeglądarce zanim trafi do chmury.',
                        'In Moments, you always write first without friction. When you click “Save Entry”, your reflection is encrypted directly inside your browser before syncing to your timeline.',
                        'En Moments siempre escribes primero sin barreras. Al pulsar «Guardar entrada», tu texto se cifra en el navegador.',
                        'Dans Moments, vous écrivez d’abord librement. En cliquant sur « Enregistrer », votre texte est chiffré dans votre navigateur.'
                      )}
                    </p>
                  </div>
                </section>

                {/* Related Indexable Prompts */}
                <section className="pt-6 border-t border-[#E5DFD3] space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-serif-literary font-medium text-[#1C1A18]">
                      {tr(
                        'Kolejne pytania z tej kategorii',
                        'More prompts in this category',
                        'Más preguntas de esta categoría',
                        'Autres questions de cette catégorie'
                      )}
                    </h2>
                    <a
                      href="/prompts"
                      onClick={e => handleLinkClick(e, '/prompts')}
                      className="text-xs font-mono-meta text-[#8B2635] hover:underline underline-offset-4"
                    >
                      {tr('Zobacz całą bibliotekę →', 'View all prompts →', 'Ver todas →', 'Voir tout →')}
                    </a>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {relatedPrompts.map(rp => {
                      const rSeo = getPromptSeoDetails(rp, lang);
                      return (
                        <a
                          key={rp.id}
                          href={rSeo.urlPath}
                          onClick={e => handleLinkClick(e, rSeo.urlPath)}
                          className="group p-5 rounded-xl bg-[#FAF8F5] border border-[#E5DFD3] hover:border-[#1C1A18] transition-all flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-mono-meta text-[#7A756D] uppercase tracking-wider">
                              {rSeo.categoryLabel}
                            </div>
                            <h3 className="text-base font-serif-literary font-medium text-[#1C1A18] group-hover:text-[#8B2635] transition-colors leading-snug">
                              {rSeo.promptText}
                            </h3>
                            <p className="text-xs font-serif-literary italic text-[#6E675F] line-clamp-2">
                              {rSeo.hintText}
                            </p>
                          </div>
                          <div className="text-[11px] font-mono-meta text-[#1C1A18] inline-flex items-center gap-1">
                            <span>
                              {tr(
                                'Odpowiedz na to pytanie',
                                'Answer this prompt',
                                'Responder a esta pregunta',
                                'Répondre à cette question'
                              )}
                            </span>
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </section>
              </article>
            );
          })()
        ) : (
          /* =====================================================================
             PROGRAMMATIC PROMPT DIRECTORY (/prompts)
             ===================================================================== */
          <div className="space-y-10">
            <header className="space-y-4 max-w-3xl">
              <div className="text-xs font-mono-meta text-[#8B2635] uppercase tracking-wider">
                {tr(
                  'Biblioteka pytań · Programmatic Journaling Prompts',
                  'Reflection Library · 47 Curated Journaling Prompts',
                  'Biblioteca de reflexión · 47 preguntas de diario',
                  'Bibliothèque de réflexion · 47 questions de journal'
                )}
              </div>
              <h1
                className="text-3xl sm:text-5xl font-serif-literary font-normal text-[#1C1A18] leading-[1.14]"
                style={{ textWrap: 'balance' }}
              >
                {tr(
                  'Wybierz pytanie i zacznij pisać od razu na stronie.',
                  'Choose a reflection prompt and start writing right on the page.',
                  'Elige una pregunta de reflexión y empieza a escribir directamente.',
                  'Choisissez une question de réflexion et écrivez directement sur la page.'
                )}
              </h1>
              <p className="text-base sm:text-lg font-serif-literary text-[#524D46] leading-relaxed">
                {tr(
                  'Każde pytanie otwiera osobną kartkę z podpowiedziami na marginesie i dyktowaniem głosowym. Nie musisz zakładać konta, aby zacząć pisać — zapisz swój moment dopiero wtedy, gdy będziesz gotowy.',
                  'Every prompt opens a dedicated writing sanctuary with Socratic margin hints and voice dictation. No login wall — write your reflection first, then save it to your encrypted timeline in one click.',
                  'Cada pregunta abre una página de escritura con pistas en el margen y dictado por voz. Escribe primero sin registro y guárdalo cuando estés listo.',
                  'Chaque question ouvre une page d’écriture avec pistes en marge et dictée vocale. Écrivez d’abord sans inscription, puis sauvegardez en un clic.'
                )}
              </p>
            </header>

            {/* Featured Long-Tail Prompts (Overcoming Burnout, Evening Gratitude, etc.) */}
            <section className="space-y-3">
              <div className="text-xs font-mono-meta text-[#7A756D]">
                {tr(
                  'Najczęściej wybierane tematy refleksji:',
                  'Featured reflection topics:',
                  'Temas de reflexión destacados:',
                  'Sujets de réflexion populaires :'
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {featuredSlugs
                  .map(s => getPromptBySlug(s))
                  .filter((p): p is DailyPrompt => Boolean(p))
                  .map(p => {
                    const seo = getPromptSeoDetails(p, lang);
                    return (
                      <a
                        key={p.id}
                        href={seo.urlPath}
                        onClick={e => handleLinkClick(e, seo.urlPath)}
                        className="group p-4 rounded-xl bg-[#FAF8F5] border border-[#DDD6C8] hover:border-[#1C1A18] transition-all flex flex-col justify-between space-y-2.5"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono-meta text-[#8B2635]">
                            <span>/prompts/{seo.slug}</span>
                            <span>{seo.categoryLabel}</span>
                          </div>
                          <h2 className="text-sm sm:text-base font-serif-literary font-medium text-[#1C1A18] group-hover:text-[#8B2635] transition-colors leading-snug">
                            {seo.promptText}
                          </h2>
                        </div>
                        <div className="text-[11px] font-mono-meta text-[#524D46] group-hover:text-[#1C1A18] inline-flex items-center gap-1">
                          <span>{tr('Otwórz kartkę i pisz', 'Write reflection', 'Escribir reflexión', 'Écrire')}</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </a>
                    );
                  })}
              </div>
            </section>

            {/* Category Filter + Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[#E5DFD3]">
              <div className="flex flex-wrap items-center gap-1.5">
                {CATEGORIES.map(cat => {
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-mono-meta transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#1C1A18] text-[#FAF8F5] font-medium'
                          : 'bg-[#EFECE4] text-[#524D46] hover:text-[#1C1A18] hover:bg-[#E5DFD3]'
                      }`}
                    >
                      {tr(cat.labelPl, cat.labelEn, cat.labelEs, cat.labelFr)}
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#7A756D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={tr(
                    'Szukaj pytania lub tematu...',
                    'Search prompts (e.g. burnout)...',
                    'Buscar pregunta...',
                    'Rechercher une question...'
                  )}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#DDD6C8] text-xs font-mono-meta text-[#1C1A18] placeholder:text-[#9E978C] focus:outline-none focus:border-[#1C1A18]"
                />
              </div>
            </div>

            {/* Full Indexable Grid of All Prompts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPrompts.map(promptItem => {
                const seo = getPromptSeoDetails(promptItem, lang);
                const slugStr = getPromptSlug(promptItem);
                return (
                  <a
                    key={promptItem.id}
                    href={`/prompts/${slugStr}`}
                    onClick={e => handleLinkClick(e, `/prompts/${slugStr}`)}
                    className="group p-5 rounded-xl bg-[#FAF8F5] border border-[#E5DFD3] hover:border-[#1C1A18] transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-mono-meta text-[#7A756D]">
                        <span className="uppercase tracking-wider text-[#8B2635]">
                          {seo.categoryLabel}
                        </span>
                        <span>/prompts/{slugStr}</span>
                      </div>
                      <h2 className="text-lg font-serif-literary font-medium text-[#1C1A18] group-hover:text-[#8B2635] transition-colors leading-snug">
                        {seo.promptText}
                      </h2>
                      <p className="text-xs font-serif-literary italic text-[#6E675F] leading-relaxed">
                        {seo.hintText}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#ECE7DC] flex items-center justify-between text-[11px] font-mono-meta text-[#524D46] group-hover:text-[#1C1A18]">
                      <span>
                        {tr(
                          'Odpowiedz bez logowania',
                          'Write without signing in',
                          'Responder sin iniciar sesión',
                          'Répondre sans connexion'
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-[#1C1A18]">
                        <span>{tr('Otwórz kartkę', 'Answer prompt', 'Escribir', 'Écrire')}</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5DFD3] bg-[#F7F5F0] py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-xs font-mono-meta text-[#7A756D]">
          <div className="flex items-center gap-3">
            <a
              href="/"
              onClick={e => handleLinkClick(e, '/')}
              className="text-[#1C1A18] font-serif-literary font-semibold text-sm hover:underline underline-offset-4"
            >
              {tr('Momenty', 'Moments', 'Moments', 'Moments')}
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="/prompts/overcoming-burnout"
              onClick={e => handleLinkClick(e, '/prompts/overcoming-burnout')}
              className="hover:text-[#1C1A18] underline underline-offset-4"
            >
              /prompts/overcoming-burnout
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="/prompts/evening-gratitude"
              onClick={e => handleLinkClick(e, '/prompts/evening-gratitude')}
              className="hover:text-[#1C1A18] underline underline-offset-4"
            >
              /prompts/evening-gratitude
            </a>
          </div>

          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#1C1A18] underline underline-offset-4"
          >
            Sitemap.xml
          </a>
        </div>
      </footer>
    </div>
  );
};
