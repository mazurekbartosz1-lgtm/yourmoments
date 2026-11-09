import React, { useRef, useEffect, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import {
  DailyPrompt,
  PromptCategory,
  CATEGORIES,
  getPromptText,
  getCategoryLabel,
  FREE_THOUGHT_PROMPT_ID,
} from '../data/prompts';
import { CompanionDesk, CompanionId } from './CompanionDesk';
import { SavedEntry } from './ChronicleArchiveModal';
import { generateJournalKey } from '../services/crypto';
import { autoFixPolishText, fixSpellingFull } from '../services/writingAssistant';
import {
  fetchDynamicQuestions,
  generateLocalDynamicQuestionsForLang,
  MIN_TEXT_LENGTH_FOR_AI_HINTS,
  MIN_CHAR_DELTA_FOR_AI_REFETCH,
} from '../services/dynamicQuestions';
import {
  Check,
  Shield,
  Lock,
  Unlock,
  Stamp,
  Sparkles,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Wand2,
  BookOpen,
  Eye,
  EyeOff,
  Key,
  Copy,
  ShieldCheck,
  Calendar,
  Award,
  ArrowLeft,
  Trash2,
  Smartphone,
  BarChart2,
  LogOut,
  Maximize2,
  Minimize2,
  Mic,
  MicOff,
  WifiOff,
  Share2,
} from 'lucide-react';
import { SparkleAppreciationCard } from './SparkleModal';

interface FocusEditorProps {
  prompt: DailyPrompt;
  promptIndex: number;
  totalPromptsInHistory: number;
  answeredPromptId?: string;
  content: string;
  isSealed: boolean;
  isLoadingEntry?: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'offline' | 'error';
  companionId: CompanionId;
  hasKey: boolean;
  encryptionKey: string;
  decryptionError?: boolean;
  rawCiphertext?: string;
  entryDeviceName?: string;
  currentDeviceName?: string;
  keySyncMode?: 'auto' | 'pin';
  syncedKeysCount?: number;
  remainingRerolls: number;
  writingTimeSeconds: number;
  streak?: number;
  lang?: 'pl' | 'en' | 'es' | 'fr';
  archiveCount: number;
  savedEntries: SavedEntry[];
  allPrompts: DailyPrompt[];
  isFreeThoughtMode?: boolean;
  onToggleFreeThought?: (enable: boolean) => void;
  onContentChange: (newText: string) => void;
  onPrevPrompt: () => void;
  onNextPrompt: () => void;
  onRerollPrompt: (category: PromptCategory | 'all') => void;
  onAssignPromptToDraft?: () => void;
  onSealDay: () => void;
  onUnsealDay?: () => void;
  onSaveKey: (newKey: string, persist: boolean, customDeviceName?: string) => void;
  onUnlockWithPin?: (pin: string) => Promise<boolean>;
  onUpdateKeySyncMode?: (mode: 'auto' | 'pin', customPin?: string) => Promise<void>;
  onResetLockedTodayEntry?: () => Promise<void>;
  onDeviceNameChange?: (newDeviceName: string) => void;
  onDeleteEntry?: (entryId: string) => void;
  onSelectCompanion: () => void;
  onTickWritingTime: () => void;
  onSignOut?: () => void;
  hasPendingSparkle?: boolean;
  sparkleTestMode?: boolean;
  sparkleCards?: SparkleAppreciationCard[];
  onTriggerSparkle?: () => void;
  onViewSparkleCard?: (card: SparkleAppreciationCard) => void;
  onOpenOneTimeShare?: (customEntry?: { content: string; promptText: string; date: string }) => void;
}

export function formatWritingTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} s`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} min ${s.toString().padStart(2, '0')} s`;
}

function getPolishSecondsLabel(seconds: number): string {
  if (seconds === 1) return 'sekundę';
  const mod10 = seconds % 10;
  const mod100 = seconds % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return 'sekundy';
  }
  return 'sekund';
}

function getPolishWordsLabel(words: number): string {
  if (words === 1) return 'słowo';
  const mod10 = words % 10;
  const mod100 = words % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return 'słowa';
  }
  return 'słów';
}

type BottomPage = 'none' | 'key' | 'archive' | 'stats' | 'closeDay';

export const FocusEditor: React.FC<FocusEditorProps> = ({
  prompt,
  promptIndex,
  totalPromptsInHistory,
  content,
  isSealed,
  isLoadingEntry = false,
  saveStatus,
  companionId,
  hasKey,
  encryptionKey,
  decryptionError = false,
  rawCiphertext = '',
  entryDeviceName = '',
  currentDeviceName = '',
  keySyncMode = 'auto',
  syncedKeysCount = 1,
  remainingRerolls,
  writingTimeSeconds,
  streak = 1,
  lang = 'pl',
  archiveCount,
  savedEntries,
  allPrompts,
  isFreeThoughtMode = false,
  onToggleFreeThought,
  onContentChange,
  onPrevPrompt,
  onNextPrompt,
  onRerollPrompt,
  onSealDay,
  onUnsealDay,
  onSaveKey,
  onUnlockWithPin,
  onUpdateKeySyncMode,
  onResetLockedTodayEntry,
  onDeviceNameChange,
  onDeleteEntry,
  onSelectCompanion,
  onTickWritingTime,
  onSignOut,
  hasPendingSparkle = false,
  sparkleTestMode = false,
  sparkleCards = [],
  onTriggerSparkle,
  onViewSparkleCard,
  onOpenOneTimeShare,
}) => {
  const isEn = lang === 'en';
  const isEs = lang === 'es';
  const isFr = lang === 'fr';
  const tr = useCallback(
    (pl: string, en: string, es: string, fr?: string) =>
      isEn ? en : isEs ? es : isFr ? fr ?? en : pl,
    [isEn, isEs, isFr]
  );

  const activePromptText = getPromptText(prompt, lang);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const caretMirrorRef = useRef<HTMLDivElement>(null);
  const caretMarkerRef = useRef<HTMLSpanElement>(null);
  const marginHintRef = useRef<HTMLDivElement>(null);
  const prevIsSealedRef = useRef<boolean>(isSealed);

  const [isTyping, setIsTyping] = useState<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeystrokeTimeRef = useRef<number>(0);

  // Active cursor character index inside textarea — used to align the margin question & closed eye to the active cursor line
  const [cursorPos, setCursorPos] = useState<number>(content.length);
  const [caretLineY, setCaretLineY] = useState<number>(0);

  // Sliding bottom page state & last viewed tab memory
  const [activeBottomPage, setActiveBottomPage] = useState<BottomPage>('none');
  const [lastBottomPage, setLastBottomPage] = useState<Exclude<BottomPage, 'none'>>(() => {
    try {
      const saved = localStorage.getItem('kronika_last_bottom_page');
      if (saved === 'archive' || saved === 'stats' || saved === 'key' || saved === 'closeDay') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'archive';
  });

  // Bi-directional pull gesture state on the companion area (pull down to write, pull up to open last tab)
  const [pullDownOffset, setPullDownOffset] = useState<number>(0);
  const [pullUpOffset, setPullUpOffset] = useState<number>(0);
  const pullStartYRef = useRef<number | null>(null);
  const didPullDragRef = useRef<boolean>(false);

  const [showCategoryMenu, setShowCategoryMenu] = useState<boolean>(false);
  const [isRerolling, setIsRerolling] = useState<boolean>(false);

  // Key page & inline unlock state
  const [keyInput, setKeyInput] = useState<string>(encryptionKey || '');
  const [inlineKeyInput, setInlineKeyInput] = useState<string>('');
  const [inlinePinInput, setInlinePinInput] = useState<string>('');
  const [inlinePinError, setInlinePinError] = useState<boolean>(false);
  const [isUnlockingPin, setIsUnlockingPin] = useState<boolean>(false);
  const [confirmResetToday, setConfirmResetToday] = useState<boolean>(false);
  const [customPinInput, setCustomPinInput] = useState<string>('');
  const [pinSavedStatus, setPinSavedStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [deviceInput, setDeviceInput] = useState<string>(currentDeviceName || '');
  const [persistKey, setPersistKey] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [showKeyText, setShowKeyText] = useState<boolean>(false);

  // Inline delete confirmation state for Journal entries
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isJournalEntryExpanded, setIsJournalEntryExpanded] = useState<boolean>(false);

  useEffect(() => {
    setKeyInput(encryptionKey || '');
  }, [encryptionKey]);

  useEffect(() => {
    if (currentDeviceName) {
      setDeviceInput(currentDeviceName);
    }
  }, [currentDeviceName]);

  // Sort saved entries from newest date to oldest date
  const sortedSavedEntries = useMemo(() => {
    return [...savedEntries].sort((a, b) => b.date.localeCompare(a.date));
  }, [savedEntries]);

  // Journal page state: default to the most recent day that has a written entry
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(
    sortedSavedEntries.length > 0 ? sortedSavedEntries[0].id : null
  );

  // Currently displayed calendar month (year, month 0-11)
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>(() => {
    const latestDateStr = sortedSavedEntries[0]?.date;
    if (latestDateStr && /^\d{4}-\d{2}-\d{2}$/.test(latestDateStr)) {
      const [y, m] = latestDateStr.split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Whenever Journal is opened, automatically select the most recent day with an entry (or Sparkle card) and jump calendar to its month
  useEffect(() => {
    if (activeBottomPage !== 'archive') {
      setIsJournalEntryExpanded(false);
    }
    if (activeBottomPage === 'archive') {
      const stillExistsInEntries = sortedSavedEntries.some(
        e => e.id === selectedEntryId || e.date === selectedEntryId
      );
      const stillExistsInSparkles = Boolean(
        selectedEntryId && sparkleCards.some(sc => sc.date === selectedEntryId)
      );

      if (stillExistsInEntries || stillExistsInSparkles) {
        const targetDate =
          sortedSavedEntries.find(e => e.id === selectedEntryId || e.date === selectedEntryId)
            ?.date || selectedEntryId;
        if (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
          const [y, m] = targetDate.split('-').map(Number);
          setCalendarMonth({ year: y, month: m - 1 });
        }
      } else if (sortedSavedEntries.length > 0) {
        const target = sortedSavedEntries[0];
        setSelectedEntryId(target.id);
        if (target.date && /^\d{4}-\d{2}-\d{2}$/.test(target.date)) {
          const [y, m] = target.date.split('-').map(Number);
          setCalendarMonth({ year: y, month: m - 1 });
        }
      } else if (sparkleCards.length > 0) {
        const targetDate = sparkleCards[0].date;
        setSelectedEntryId(targetDate);
        if (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
          const [y, m] = targetDate.split('-').map(Number);
          setCalendarMonth({ year: y, month: m - 1 });
        }
      } else {
        setSelectedEntryId(null);
      }
    }
  }, [activeBottomPage, sortedSavedEntries, sparkleCards]);

  // Whether the user has started writing — locks main question exchange & navigation
  const hasWrittenText = content.trim().length > 0 || decryptionError;

  useEffect(() => {
    if (hasWrittenText && showCategoryMenu) {
      setShowCategoryMenu(false);
    }
  }, [hasWrittenText, showCategoryMenu]);

  // Toggle visibility of the margin question with Eye icon
  const [showMarginHints, setShowMarginHints] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('kronika_show_margin_hints');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const handleToggleMarginHints = () => {
    setShowMarginHints(prev => {
      const next = !prev;
      try {
        localStorage.setItem('kronika_show_margin_hints', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Track questions copied into the text via the arrow so they render in italics (kursywa)
  const [italicQuestions, setItalicQuestions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kronika_italic_questions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Currently displayed margin question — NEVER rotates automatically while typing!
  const [currentMarginQuestion, setCurrentMarginQuestion] = useState<string>(() => {
    const initial = generateLocalDynamicQuestionsForLang(content, activePromptText, lang);
    return initial[0] || '';
  });

  // Background pool of context-aware questions (AI questions preserved + local questions)
  const aiPoolRef = useRef<string[]>([]);
  const shownQuestionsRef = useRef<Set<string>>(new Set());
  const questionPoolRef = useRef<string[]>(
    generateLocalDynamicQuestionsForLang(content, activePromptText, lang)
  );
  const poolIndexRef = useRef<number>(0);
  const lastAiTextSnapshotRef = useRef<string>('');
  const [isRotatingQuestion, setIsRotatingQuestion] = useState<boolean>(false);

  // Update local fallback pool silently on text change WITHOUT making background API calls
  useEffect(() => {
    const localPool = generateLocalDynamicQuestionsForLang(content, activePromptText, lang);
    const combined = Array.from(new Set([...aiPoolRef.current, ...localPool]));
    questionPoolRef.current = combined;
  }, [content, activePromptText, lang]);

  // Reset the displayed margin question and AI pool when the main daily prompt or language is switched
  useEffect(() => {
    aiPoolRef.current = [];
    shownQuestionsRef.current = new Set();
    lastAiTextSnapshotRef.current = '';
    const fresh = generateLocalDynamicQuestionsForLang(content, activePromptText, lang);
    questionPoolRef.current = fresh;
    poolIndexRef.current = 0;
    if (fresh[0]) {
      setCurrentMarginQuestion(fresh[0]);
      shownQuestionsRef.current.add(fresh[0].trim());
    }
  }, [prompt.id, lang]);

  // Sync active cursor position from textarea & keep active line visible between sticky dock and mobile keyboard
  const stickyDockRef = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const [isMobileKeyboardOpen, setIsMobileKeyboardOpen] = useState<boolean>(false);
  const maxViewportHeightRef = useRef<number>(
    typeof window !== 'undefined'
      ? Math.max(window.innerHeight, window.visualViewport?.height || 0)
      : 800
  );
  const vvDidShrinkRef = useRef<boolean>(false);
  const userTappedEditorRef = useRef<boolean>(false);

  const ensureMobileCursorVisible = useCallback((isFocusOrResize: boolean = false) => {
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return;
    if (!textareaRef.current || document.activeElement !== textareaRef.current) return;

    const caretRect = caretMarkerRef.current?.getBoundingClientRect();
    if (!caretRect) return;

    const vv = window.visualViewport;
    const vvHeight = vv ? vv.height : window.innerHeight;
    const dockBottom = stickyDockRef.current
      ? stickyDockRef.current.getBoundingClientRect().bottom
      : 160;

    const topBoundary = Math.max(80, dockBottom + 14);
    const bottomBoundary = vvHeight - 28;

    if (caretRect.bottom > bottomBoundary) {
      window.scrollBy({
        top: caretRect.bottom - bottomBoundary,
        behavior: 'instant' as ScrollBehavior,
      });
    } else if (caretRect.top < topBoundary && window.scrollY > 0) {
      window.scrollBy({
        top: caretRect.top - topBoundary,
        behavior: 'instant' as ScrollBehavior,
      });
    } else if (isFocusOrResize && caretRect.bottom > bottomBoundary - 12) {
      window.scrollBy({
        top: caretRect.bottom - (bottomBoundary - 12),
        behavior: 'instant' as ScrollBehavior,
      });
    }
  }, []);

  const syncCursorPos = useCallback(() => {
    if (textareaRef.current) {
      setCursorPos(textareaRef.current.selectionStart ?? content.length);
    }
  }, [content.length]);

  const handleTextareaFocus = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && userTappedEditorRef.current) {
      setIsMobileKeyboardOpen(true);
    }
    syncCursorPos();
    ensureMobileCursorVisible(true);
    const t1 = setTimeout(() => ensureMobileCursorVisible(true), 80);
    const t2 = setTimeout(() => ensureMobileCursorVisible(true), 220);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [syncCursorPos, ensureMobileCursorVisible]);

  const handleTextareaBlur = useCallback(() => {
    setTimeout(() => {
      if (typeof document !== 'undefined' && document.activeElement !== textareaRef.current) {
        userTappedEditorRef.current = false;
        vvDidShrinkRef.current = false;
        setIsMobileKeyboardOpen(false);
      }
    }, 100);
  }, []);

  // Measure the exact Y coordinate of the active writing cursor line and keep textarea taller than backdrop
  const updateCaretAlignment = useCallback(() => {
    const markerTop = caretMarkerRef.current ? Math.max(0, caretMarkerRef.current.offsetTop) : 0;
    if (caretMarkerRef.current) {
      setCaretLineY(markerTop);
    }

    if (textareaRef.current) {
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
      const hintHeight = marginHintRef.current ? marginHintRef.current.offsetHeight : 88;
      const backdropHeight = backdropRef.current ? backdropRef.current.scrollHeight : 0;
      const mirrorHeight = caretMirrorRef.current ? caretMirrorRef.current.scrollHeight : 0;
      const requiredHeight = isDesktop
        ? Math.max(
            260,
            backdropHeight + 36,
            mirrorHeight + 36,
            markerTop + Math.max(hintHeight, 76) + 36
          )
        : Math.max(150, backdropHeight + 48, mirrorHeight + 48, markerTop + 56);
      textareaRef.current.style.minHeight = `${requiredHeight}px`;
      textareaRef.current.style.height = `${Math.max(requiredHeight, textareaRef.current.scrollHeight)}px`;
      textareaRef.current.scrollTop = 0;
    }
  }, []);

  useLayoutEffect(() => {
    if (!isSealed && !isLoadingEntry && !decryptionError && activeBottomPage === 'none') {
      updateCaretAlignment();
    }
  }, [
    content,
    cursorPos,
    isSealed,
    isLoadingEntry,
    decryptionError,
    currentMarginQuestion,
    showMarginHints,
    activeBottomPage,
    updateCaretAlignment,
  ]);

  useEffect(() => {
    const onResize = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        const vv = window.visualViewport;
        const currentH = vv ? vv.height : window.innerHeight;
        if (document.activeElement !== textareaRef.current) {
          maxViewportHeightRef.current = Math.max(maxViewportHeightRef.current, currentH);
        }
        const heightDrop = maxViewportHeightRef.current - currentH;
        if (heightDrop > 110) {
          vvDidShrinkRef.current = true;
          setIsMobileKeyboardOpen(true);
        } else if (vvDidShrinkRef.current && heightDrop < 50) {
          vvDidShrinkRef.current = false;
          userTappedEditorRef.current = false;
          setIsMobileKeyboardOpen(false);
        }
      } else {
        setIsMobileKeyboardOpen(false);
      }
      updateCaretAlignment();
      ensureMobileCursorVisible(true);
    };

    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    window.addEventListener('resize', onResize);
    vv?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      vv?.removeEventListener('resize', onResize);
    };
  }, [updateCaretAlignment, ensureMobileCursorVisible]);

  // Helper: check if the user has written enough new text (>= 60 chars delta & >= 30 chars total) to warrant an on-demand AI fetch
  const shouldFetchNewAiBatch = useCallback((trimmedText: string, copiedSet: Set<string>): boolean => {
    if (trimmedText.length < MIN_TEXT_LENGTH_FOR_AI_HINTS) return false;

    const unshownAi = aiPoolRef.current.filter(
      q => !copiedSet.has(q.trim()) && !shownQuestionsRef.current.has(q.trim())
    );
    // If we still have unused AI questions from the last batch and the user hasn't written a big new chunk, use the buffer first
    const prevSnap = lastAiTextSnapshotRef.current;
    const charDelta = Math.abs(trimmedText.length - prevSnap.length);
    const hasSignificantNewText =
      prevSnap === '' ||
      charDelta >= MIN_CHAR_DELTA_FOR_AI_REFETCH ||
      (charDelta >= 35 && trimmedText.slice(-50) !== prevSnap.slice(-50));

    if (unshownAi.length > 0 && !hasSignificantNewText) {
      return false;
    }

    return hasSignificantNewText;
  }, []);

  // Manual rotation ONLY when user clicks the rotate icon (on-demand AI with buffer)
  const handleRotateQuestion = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isRotatingQuestion) return;
    setIsRotatingQuestion(true);

    try {
      const trimmed = content.trim();
      const copiedSet = new Set(italicQuestions.map(item => item.trim()));
      if (currentMarginQuestion.trim()) {
        shownQuestionsRef.current.add(currentMarginQuestion.trim());
      }

      // 1. Check if we already have unshown AI questions when no major text change happened
      const unshownAi = aiPoolRef.current.filter(
        q =>
          !copiedSet.has(q.trim()) &&
          !shownQuestionsRef.current.has(q.trim()) &&
          q.trim() !== currentMarginQuestion.trim()
      );

      if (unshownAi.length > 0 && !shouldFetchNewAiBatch(trimmed, copiedSet)) {
        const nextQ = unshownAi[0];
        shownQuestionsRef.current.add(nextQ.trim());
        setCurrentMarginQuestion(nextQ);
        return;
      }

      // 2. Fetch fresh AI batch on-demand ONLY if user wrote >= 30 chars and added >= 60 new chars
      if (shouldFetchNewAiBatch(trimmed, copiedSet)) {
        const localImmediate = generateLocalDynamicQuestionsForLang(
          content,
          activePromptText,
          lang
        ).filter(item => !copiedSet.has(item.trim()));
        const immediateCandidate =
          localImmediate.find(
            q => q !== currentMarginQuestion && !shownQuestionsRef.current.has(q.trim())
          ) ||
          localImmediate.find(q => q !== currentMarginQuestion) ||
          localImmediate[0];
        if (immediateCandidate) {
          setCurrentMarginQuestion(immediateCandidate);
        }

        const aiQuestions = (await fetchDynamicQuestions(content, activePromptText, lang)).filter(
          item => !copiedSet.has(item.trim())
        );
        if (aiQuestions.length > 0) {
          aiPoolRef.current = aiQuestions;
          const localPool = generateLocalDynamicQuestionsForLang(content, activePromptText, lang);
          questionPoolRef.current = Array.from(new Set([...aiQuestions, ...localPool]));
          lastAiTextSnapshotRef.current = trimmed;
          const bestAi =
            aiQuestions.find(
              q => q !== currentMarginQuestion && !shownQuestionsRef.current.has(q.trim())
            ) ||
            aiQuestions.find(q => q !== currentMarginQuestion) ||
            aiQuestions[0];
          shownQuestionsRef.current.add(bestAi.trim());
          poolIndexRef.current = Math.max(0, questionPoolRef.current.indexOf(bestAi));
          setCurrentMarginQuestion(bestAi);
          return;
        }
      }

      // 3. Otherwise rotate locally through the current combined pool (0 API calls)
      const pool = questionPoolRef.current.filter(item => !copiedSet.has(item.trim()));
      if (pool.length > 0) {
        let nextIdx = (poolIndexRef.current + 1) % pool.length;
        if (pool[nextIdx] === currentMarginQuestion && pool.length > 1) {
          nextIdx = (nextIdx + 1) % pool.length;
        }
        poolIndexRef.current = nextIdx;
        shownQuestionsRef.current.add(pool[nextIdx].trim());
        setCurrentMarginQuestion(pool[nextIdx]);
      }
    } finally {
      setTimeout(() => setIsRotatingQuestion(false), 200);
    }
  };

  // Clicking the arrow copies the margin question into the text in italics (kursywą)
  const handleCopyQuestionToText = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isSealed || decryptionError || !currentMarginQuestion.trim()) return;

    const q = currentMarginQuestion.trim();
    shownQuestionsRef.current.add(q);
    const updatedCopied = italicQuestions.includes(q) ? italicQuestions : [...italicQuestions, q];

    setItalicQuestions(updatedCopied);
    try {
      localStorage.setItem('kronika_italic_questions', JSON.stringify(updatedCopied));
    } catch {
      // ignore
    }

    const trimmedEnd = content.replace(/[ \t]+$/, '');
    const markedQuestion = `\u2063${q}`;
    const newContent =
      trimmedEnd.length === 0
        ? `${markedQuestion}\n`
        : trimmedEnd.endsWith('\n')
        ? `${trimmedEnd}${markedQuestion}\n`
        : `${trimmedEnd}\n\n${markedQuestion}\n`;

    onContentChange(newContent);
    setCursorPos(newContent.length);

    const copiedSet = new Set(updatedCopied.map(item => item.trim()));
    const remainingPool = questionPoolRef.current.filter(
      item => !copiedSet.has(item.trim()) && item.trim() !== q
    );

    if (remainingPool.length > 0) {
      questionPoolRef.current = remainingPool;
      poolIndexRef.current = 0;
      shownQuestionsRef.current.add(remainingPool[0].trim());
      setCurrentMarginQuestion(remainingPool[0]);
    } else {
      const localFresh = generateLocalDynamicQuestionsForLang(
        newContent,
        activePromptText,
        lang
      ).filter(item => !copiedSet.has(item.trim()) && item.trim() !== q);
      if (localFresh.length > 0) {
        questionPoolRef.current = localFresh;
        poolIndexRef.current = 0;
        setCurrentMarginQuestion(localFresh[0]);
      }
      if (shouldFetchNewAiBatch(newContent.trim(), copiedSet)) {
        fetchDynamicQuestions(newContent, activePromptText, lang)
          .then(aiQs => {
            const filteredAi = aiQs.filter(
              item => !copiedSet.has(item.trim()) && item.trim() !== q
            );
            if (filteredAi.length > 0) {
              aiPoolRef.current = filteredAi;
              questionPoolRef.current = filteredAi;
              lastAiTextSnapshotRef.current = newContent.trim();
              poolIndexRef.current = 0;
              if (localFresh.length === 0) {
                setCurrentMarginQuestion(filteredAi[0]);
              }
            }
          })
          .catch(() => {});
      }
    }

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus({ preventScroll: true });
        const len = newContent.length;
        textareaRef.current.setSelectionRange(len, len);
        setCursorPos(len);
        requestAnimationFrame(() => ensureMobileCursorVisible(true));
      }
    }, 20);
  };

  // Dynamic textarea height calculation without collapsing height to 'auto'
  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
      const hintHeight = marginHintRef.current ? marginHintRef.current.offsetHeight : 88;
      const backdropHeight = backdropRef.current ? backdropRef.current.scrollHeight : 0;
      const mirrorHeight = caretMirrorRef.current ? caretMirrorRef.current.scrollHeight : 0;
      const minForHint = isDesktop
        ? Math.max(
            260,
            caretLineY + hintHeight + 36,
            backdropHeight + 36,
            mirrorHeight + 36
          )
        : Math.max(110, caretLineY + 44, backdropHeight + 32, mirrorHeight + 32);
      const nextHeight = Math.max(minForHint, backdropHeight + (isDesktop ? 36 : 32));
      textareaRef.current.style.minHeight = `${nextHeight}px`;
      textareaRef.current.style.height = `${Math.max(nextHeight, textareaRef.current.scrollHeight)}px`;
      textareaRef.current.scrollTop = 0;
    }
  }, [caretLineY]);

  useLayoutEffect(() => {
    if (activeBottomPage === 'none' && !isSealed && !isLoadingEntry && !decryptionError) {
      adjustHeight();
    }
  }, [content, isSealed, isLoadingEntry, decryptionError, activeBottomPage, adjustHeight]);

  // Auto-focus textarea at the very bottom on desktop load or when unlocking a sealed entry
  useEffect(() => {
    const wasSealed = prevIsSealedRef.current;
    prevIsSealedRef.current = isSealed;

    if (
      !isLoadingEntry &&
      !isSealed &&
      !decryptionError &&
      activeBottomPage === 'none' &&
      textareaRef.current
    ) {
      const endPos = content.length;
      setCursorPos(endPos);
      adjustHeight();
      updateCaretAlignment();
      textareaRef.current.setSelectionRange(endPos, endPos);
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
      if (isDesktop || wasSealed) {
        textareaRef.current.focus({ preventScroll: true });
      }
      textareaRef.current.scrollTop = 0;

      if (wasSealed) {
        const timer = setTimeout(() => {
          if (textareaRef.current) {
            const len = textareaRef.current.value.length;
            adjustHeight();
            updateCaretAlignment();
            textareaRef.current.setSelectionRange(len, len);
            textareaRef.current.focus({ preventScroll: true });
            textareaRef.current.scrollTop = 0;
            setCursorPos(len);
            ensureMobileCursorVisible(true);
          }
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoadingEntry, isSealed, decryptionError, activeBottomPage]);

  // Active typing timer: ticks ONLY when user is actively writing
  useEffect(() => {
    if (isSealed || decryptionError) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastKeystrokeTimeRef.current < 2000) {
        onTickWritingTime();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isSealed, decryptionError, onTickWritingTime]);

  // Single-button spell fixer state
  const [isFixingSpelling, setIsFixingSpelling] = useState<boolean>(false);
  const [spellFixStatus, setSpellFixStatus] = useState<'idle' | 'fixed' | 'clean'>('idle');
  const [fixedCount, setFixedCount] = useState<number>(0);
  const [previousContent, setPreviousContent] = useState<string | null>(null);
  const spellStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Voice Dictation (Web Speech API) state & refs
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const [interimSpeech, setInterimSpeech] = useState<string>('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const shouldKeepDictatingRef = useRef<boolean>(false);
  const wakeLockRef = useRef<any>(null);
  const contentLatestRef = useRef<string>(content);
  const cursorPosLatestRef = useRef<number>(cursorPos);
  const sessionBaseBeforeRef = useRef<string>('');
  const sessionBaseAfterRef = useRef<string>('');

  useEffect(() => {
    contentLatestRef.current = content;
  }, [content]);

  useEffect(() => {
    cursorPosLatestRef.current = cursorPos;
  }, [cursorPos]);

  // Screen Wake Lock helper so mobile screen never dims or turns off during voice dictation
  const requestScreenWakeLock = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      if (wakeLockRef.current) return;
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      wakeLockRef.current.addEventListener?.('release', () => {
        wakeLockRef.current = null;
      });
    } catch {
      // Ignore if browser/battery saver blocks Wake Lock
    }
  }, []);

  const releaseScreenWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // ignore
      }
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        (isDictating || shouldKeepDictatingRef.current)
      ) {
        requestScreenWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isDictating, requestScreenWakeLock]);

  // Automatically convert completed markup tags (*bold*, **bold**, _italic_, __italic__, *_both_*, <b>, <i>)
  // into zero-width formatted markers so sentences immediately transform into bold/italic
  const transformAutoMarkup = useCallback((raw: string): string => {
    return raw
      // 1. Bold + Italic: *_zdanie_*, _*zdanie*_, ***zdanie***
      .replace(/\*\*\*([^*\n]+)\*\*\*/g, '\u2063$1\u2063')
      .replace(/\*_([^*\n]+)_\*/g, '\u2063$1\u2063')
      .replace(/_\*([^_\n]+)\*_/g, '\u2063$1\u2063')
      // 2. Bold: *zdanie*, **zdanie**, <b>zdanie</b>, [b]zdanie[/b], <strong>zdanie</strong>
      .replace(/\*\*([^*\n]+)\*\*/g, '\u2062$1\u2062')
      .replace(/(?<![*\\])\*([^*\n]+)\*(?!\*)/g, '\u2062$1\u2062')
      .replace(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/gi, '\u2062$1\u2062')
      .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '\u2062$1\u2062')
      // 3. Italic: _zdanie_, __zdanie__, <i>zdanie</i>, [i]zdanie[/i], <em>zdanie</em>
      .replace(/__([^_\n]+)__/g, '\u2064$1\u2064')
      .replace(
        /(?<![_a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ])_([^_\n]+)_(?![_a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ])/g,
        '\u2064$1\u2064'
      )
      .replace(/<(?:i|em)>([\s\S]*?)<\/(?:i|em)>/gi, '\u2064$1\u2064')
      .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '\u2064$1\u2064');
  }, []);

  // Spoken punctuation & markup helper for natural voice dictation in PL / EN / ES / FR
  const formatDictatedTranscript = useCallback(
    (rawChunk: string, textBefore: string): string => {
      let processed = rawChunk
        // Polish spoken punctuation
        .replace(/\s+\b(kropka)\b/gi, '.')
        .replace(/\s+\b(przecinek)\b/gi, ',')
        .replace(/\s+\b(znak zapytania|pytajnik)\b/gi, '?')
        .replace(/\s+\b(wykrzyknik|znak wykrzyknienia)\b/gi, '!')
        .replace(/\s+\b(dwukropek)\b/gi, ':')
        .replace(/\s*\b(nowa linia|nowy wiersz)\b\s*/gi, '\n')
        .replace(/\s*\b(nowy akapit)\b\s*/gi, '\n\n')
        // English spoken punctuation
        .replace(/\s+\b(period|full stop)\b/gi, '.')
        .replace(/\s+\b(comma)\b/gi, ',')
        .replace(/\s+\b(question mark)\b/gi, '?')
        .replace(/\s+\b(exclamation mark|exclamation point)\b/gi, '!')
        .replace(/\s*\b(new line)\b\s*/gi, '\n')
        .replace(/\s*\b(new paragraph)\b\s*/gi, '\n\n')
        .trim();

      processed = transformAutoMarkup(processed);

      if (!processed) return '';

      const startsWithPunctuation = /^[.,!?:;)]/.test(processed);
      const startsWithNewline = /^\n/.test(processed);
      const needsLeadingSpace =
        textBefore.length > 0 &&
        !/[\s\n(\u201E"«]$/.test(textBefore) &&
        !startsWithPunctuation &&
        !startsWithNewline;

      const shouldCapitalize =
        textBefore.trim().length === 0 || /(?:[.!?…]|\n)\s*$/.test(textBefore);

      if (shouldCapitalize && processed.length > 0) {
        processed = processed.charAt(0).toUpperCase() + processed.slice(1);
      }

      // Capitalize any letter following a period/question/exclamation or newline inside the chunk
      processed = processed.replace(/([.!?]\s+|\n+)([a-ząćęłńóśźżáéíóúñüàâçèéêëîïôùûü])/g, (_, sep, ch) => {
        return sep + ch.toUpperCase();
      });

      return (needsLeadingSpace ? ' ' : '') + processed;
    },
    [transformAutoMarkup]
  );

  const stopDictation = useCallback(() => {
    shouldKeepDictatingRef.current = false;
    releaseScreenWakeLock();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsDictating(false);
    setInterimSpeech('');
    setIsTyping(false);
  }, [releaseScreenWakeLock]);

  useEffect(() => {
    if (isSealed || decryptionError || activeBottomPage !== 'none') {
      stopDictation();
    }
  }, [isSealed, decryptionError, activeBottomPage, stopDictation]);

  useEffect(() => {
    return () => {
      stopDictation();
    };
  }, [stopDictation]);

  const handleToggleDictation = useCallback(() => {
    if (isDictating || shouldKeepDictatingRef.current) {
      stopDictation();
      return;
    }

    setSpeechError(null);
    const SpeechRecognitionAPI =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionAPI) {
      setSpeechError(
        tr(
          'Twoja przeglądarka nie obsługuje Web Speech API (użyj Chrome, Edge lub Safari).',
          'Your browser does not support the Web Speech API (use Chrome, Edge, or Safari).',
          'Tu navegador no admite Web Speech API (usa Chrome, Edge o Safari).',
          'Votre navigateur ne prend pas en charge Web Speech API (utilisez Chrome, Edge ou Safari).'
        )
      );
      return;
    }

    try {
      shouldKeepDictatingRef.current = true;
      const isMobileBrowser =
        typeof navigator !== 'undefined' &&
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      const snapshotSessionAnchor = () => {
        const currentText = contentLatestRef.current;
        const activePos =
          textareaRef.current && document.activeElement === textareaRef.current
            ? textareaRef.current.selectionStart ?? currentText.length
            : cursorPosLatestRef.current <= currentText.length
            ? cursorPosLatestRef.current
            : currentText.length;
        sessionBaseBeforeRef.current = currentText.slice(0, activePos);
        sessionBaseAfterRef.current = currentText.slice(activePos);
      };

      snapshotSessionAnchor();

      const recognition = new SpeechRecognitionAPI();
      recognition.lang =
        lang === 'en'
          ? 'en-US'
          : lang === 'es'
          ? 'es-ES'
          : lang === 'fr'
          ? 'fr-FR'
          : 'pl-PL';
      // On Android Chrome, continuous=true has a known Chromium bug where each word re-emits
      // the entire cumulative sentence as a new isFinal result. Using continuous=false on mobile
      // (with automatic restart in onend) + cumulative prefix deduplication prevents any duplication.
      recognition.continuous = !isMobileBrowser;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      const normalizeForDedup = (str: string) =>
        str
          .toLowerCase()
          .replace(/[.,!?;:…]+/g, '')
          .replace(/\s+/g, ' ')
          .trim();

      const mergeCumulativeSegments = (segments: string[]): string => {
        const merged: string[] = [];
        for (const raw of segments) {
          const trimmed = raw.trim();
          if (!trimmed) continue;
          const currNorm = normalizeForDedup(trimmed);
          if (!currNorm) continue;

          if (merged.length > 0) {
            const prev = merged[merged.length - 1];
            const prevNorm = normalizeForDedup(prev);
            if (currNorm === prevNorm || currNorm.startsWith(prevNorm)) {
              // Android Chrome cumulative update: replace the previous prefix with the fuller phrase
              merged[merged.length - 1] = trimmed;
              continue;
            }
            if (prevNorm.startsWith(currNorm)) {
              // Shorter duplicate of already-captured phrase: skip
              continue;
            }
          }
          merged.push(trimmed);
        }
        return merged.join(' ');
      };

      recognition.onstart = () => {
        snapshotSessionAnchor();
        requestScreenWakeLock();
        setIsDictating(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        const finalSegments: string[] = [];
        const interimSegments: string[] = [];

        for (let i = 0; i < event.results.length; i++) {
          const transcript = (event.results[i][0]?.transcript || '').trim();
          if (!transcript) continue;
          if (event.results[i].isFinal) {
            finalSegments.push(transcript);
          } else {
            interimSegments.push(transcript);
          }
        }

        const deduplicatedFinal = mergeCumulativeSegments(finalSegments);
        let deduplicatedInterim = mergeCumulativeSegments(interimSegments);

        // If interim transcript repeats the already-finalized prefix (common on mobile), strip the prefix
        if (deduplicatedFinal && deduplicatedInterim) {
          const finalNorm = normalizeForDedup(deduplicatedFinal);
          const interimNorm = normalizeForDedup(deduplicatedInterim);
          if (interimNorm === finalNorm) {
            deduplicatedInterim = '';
          } else if (interimNorm.startsWith(finalNorm)) {
            deduplicatedInterim = deduplicatedInterim
              .slice(deduplicatedFinal.length)
              .trim();
          }
        }

        setInterimSpeech(deduplicatedInterim);
        lastKeystrokeTimeRef.current = Date.now();
        setIsTyping(true);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 1200);

        if (deduplicatedFinal) {
          const before = sessionBaseBeforeRef.current;
          const after = sessionBaseAfterRef.current;
          const formattedInsertion = formatDictatedTranscript(deduplicatedFinal, before);

          if (formattedInsertion) {
            const needsTrailingSpace =
              after.length > 0 && !/^[\s\n.,!?:;)]/.test(after) && !/\s$/.test(formattedInsertion);
            const nextText =
              before + formattedInsertion + (needsTrailingSpace ? ' ' : '') + after;
            const newCursorPos = before.length + formattedInsertion.length;

            contentLatestRef.current = nextText;
            cursorPosLatestRef.current = newCursorPos;
            onContentChange(nextText);
            setCursorPos(newCursorPos);
            requestAnimationFrame(() => ensureMobileCursorVisible(false));
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          return;
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSpeechError(
            tr(
              'Brak dostępu do mikrofonu. Zezwól na mikrofon w ustawieniach przeglądarki.',
              'Microphone access denied. Please allow microphone permission in your browser.',
              'Acceso al micrófono denegado. Permite el micrófono en el navegador.',
              'Accès au microphone refusé. Veuillez autoriser le microphone.'
            )
          );
          stopDictation();
          return;
        }
        if (event.error === 'audio-capture') {
          setSpeechError(
            tr(
              'Nie wykryto mikrofonu na tym urządzeniu.',
              'No microphone was detected on this device.',
              'No se detectó ningún micrófono en este dispositivo.',
              'Aucun microphone détecté sur cet appareil.'
            )
          );
          stopDictation();
          return;
        }
        if (event.error !== 'aborted') {
          stopDictation();
        }
      };

      recognition.onend = () => {
        setInterimSpeech('');
        // Automatically resume if the user hasn't stopped dictation
        if (shouldKeepDictatingRef.current && recognitionRef.current) {
          try {
            snapshotSessionAnchor();
            recognitionRef.current.start();
            return;
          } catch {
            // Fall through to clean stop if restart is blocked
          }
        }
        releaseScreenWakeLock();
        setIsDictating(false);
      };

      recognitionRef.current = recognition;
      requestScreenWakeLock();
      recognition.start();
    } catch {
      stopDictation();
    }
  }, [
    isDictating,
    lang,
    formatDictatedTranscript,
    onContentChange,
    requestScreenWakeLock,
    releaseScreenWakeLock,
    stopDictation,
    tr,
  ]);

  // Quick button helper to wrap selected text in bold/italic or insert markup tags at cursor
  const handleInsertMarkup = useCallback(
    (type: 'bold' | 'italic') => {
      if (isSealed || decryptionError) return;
      const el = textareaRef.current;
      const current = contentLatestRef.current;
      const start = el ? el.selectionStart ?? cursorPosLatestRef.current : cursorPosLatestRef.current;
      const end = el ? el.selectionEnd ?? start : start;

      if (start !== end) {
        // Wrap selected text and immediately transform it into bold or italic
        const selected = current.slice(start, end);
        const marker = type === 'bold' ? '\u2062' : '\u2064';
        const wrapped = `${marker}${selected}${marker}`;
        const nextText = current.slice(0, start) + wrapped + current.slice(end);
        const newPos = start + wrapped.length;
        contentLatestRef.current = nextText;
        cursorPosLatestRef.current = newPos;
        sessionBaseBeforeRef.current = nextText.slice(0, newPos);
        sessionBaseAfterRef.current = nextText.slice(newPos);
        onContentChange(nextText);
        setCursorPos(newPos);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newPos, newPos);
          }
        });
      } else {
        const marker = type === 'bold' ? '\u2062' : '\u2064';
        if (current[start] === marker) {
          const newPos = start + 1;
          cursorPosLatestRef.current = newPos;
          setCursorPos(newPos);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              textareaRef.current.setSelectionRange(newPos, newPos);
            }
          });
          return;
        }
        // Insert markup tag pair (*tekst* for bold, _tekst_ for italic) and place cursor inside so typing transforms it
        const tag = type === 'bold' ? '*' : '_';
        const nextText = current.slice(0, start) + tag + tag + current.slice(start);
        const newPos = start + tag.length;
        contentLatestRef.current = nextText;
        cursorPosLatestRef.current = newPos;
        sessionBaseBeforeRef.current = nextText.slice(0, newPos);
        sessionBaseAfterRef.current = nextText.slice(newPos);
        onContentChange(nextText);
        setCursorPos(newPos);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newPos, newPos);
          }
        });
      }
    },
    [isSealed, decryptionError, onContentChange]
  );

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isSealed || decryptionError) return;
    const rawValue = e.target.value;
    const rawCursor = e.target.selectionStart ?? rawValue.length;

    // Automatically transform completed markup tags (**bold**, *italic*, <b>...</b>, <i>...</i>)
    const beforeCursor = rawValue.slice(0, rawCursor);
    const afterCursor = rawValue.slice(rawCursor);
    const transformedBefore = transformAutoMarkup(beforeCursor);
    const value = transformAutoMarkup(transformedBefore + afterCursor);
    const nextCursor = Math.min(value.length, transformedBefore.length);

    contentLatestRef.current = value;
    cursorPosLatestRef.current = nextCursor;
    sessionBaseBeforeRef.current = value.slice(0, nextCursor);
    sessionBaseAfterRef.current = value.slice(nextCursor);
    onContentChange(value);
    setCursorPos(nextCursor);

    if (value !== rawValue) {
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(nextCursor, nextCursor);
        }
      });
    }

    requestAnimationFrame(() => {
      ensureMobileCursorVisible(false);
    });

    if (spellStatusTimeoutRef.current) {
      clearTimeout(spellStatusTimeoutRef.current);
      spellStatusTimeoutRef.current = null;
    }
    if (spellFixStatus !== 'idle') {
      setSpellFixStatus('idle');
      setPreviousContent(null);
    }

    lastKeystrokeTimeRef.current = Date.now();
    setIsTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 600);
  };

  const handleSelectCategory = (catId: PromptCategory | 'all') => {
    if (remainingRerolls <= 0 || hasWrittenText) return;
    setIsRerolling(true);
    setShowCategoryMenu(false);
    onRerollPrompt(catId);
    setTimeout(() => setIsRerolling(false), 300);
  };

  // 1-Click Spelling & Typo Fixer (language-aware: Polish, English, Spanish, or French)
  const handleAutoFixSpelling = async () => {
    if (!content.trim() || isFixingSpelling || decryptionError) return;

    if (spellStatusTimeoutRef.current) {
      clearTimeout(spellStatusTimeoutRef.current);
      spellStatusTimeoutRef.current = null;
    }

    const originalSnapshot = content;
    setIsFixingSpelling(true);

    try {
      const local = autoFixPolishText(originalSnapshot, lang);
      if (local.correctedText !== originalSnapshot && local.changesCount > 0) {
        contentLatestRef.current = local.correctedText;
        onContentChange(local.correctedText);
      }

      const result = await fixSpellingFull(originalSnapshot, lang);

      if (result.correctedText !== originalSnapshot && result.changesCount > 0) {
        setPreviousContent(originalSnapshot);
        contentLatestRef.current = result.correctedText;
        onContentChange(result.correctedText);
        setCursorPos(result.correctedText.length);
        setFixedCount(result.changesCount);
        setSpellFixStatus('fixed');
      } else if (local.correctedText !== originalSnapshot && local.changesCount > 0) {
        setPreviousContent(originalSnapshot);
        contentLatestRef.current = local.correctedText;
        onContentChange(local.correctedText);
        setCursorPos(local.correctedText.length);
        setFixedCount(local.changesCount);
        setSpellFixStatus('fixed');
      } else {
        setSpellFixStatus('clean');
        spellStatusTimeoutRef.current = setTimeout(() => {
          setSpellFixStatus('idle');
        }, 2500);
      }
    } catch {
      const local = autoFixPolishText(originalSnapshot, lang);
      if (local.correctedText !== originalSnapshot && local.changesCount > 0) {
        setPreviousContent(originalSnapshot);
        contentLatestRef.current = local.correctedText;
        onContentChange(local.correctedText);
        setCursorPos(local.correctedText.length);
        setFixedCount(local.changesCount);
        setSpellFixStatus('fixed');
      } else {
        setSpellFixStatus('clean');
        spellStatusTimeoutRef.current = setTimeout(() => {
          setSpellFixStatus('idle');
        }, 2500);
      }
    } finally {
      setIsFixingSpelling(false);
    }
  };

  const handleUndoFix = () => {
    if (previousContent !== null) {
      contentLatestRef.current = previousContent;
      onContentChange(previousContent);
      setCursorPos(previousContent.length);
      setPreviousContent(null);
      setSpellFixStatus('idle');
    }
  };

  // Render inline bold (\u2062...\u2062), italic (\u2064...\u2064), and bold+italic (\u2063...\u2063) segments
  // Uses font-normal + text-shadow in live editor backdrop so character advance widths match <textarea> 1:1,
  // and true font-semibold in read-only views (Archive / Sealed).
  const renderInlineMarkup = (segmentText: string, muted: boolean, useRealBold: boolean = false) => {
    if (!segmentText) return null;
    const normalized = useRealBold
      ? segmentText
          .replace(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/gi, '\u2062$1\u2062')
          .replace(/<(?:i|em)>([\s\S]*?)<\/(?:i|em)>/gi, '\u2064$1\u2064')
          .replace(/\*\*\*([^*\n]+)\*\*\*/g, '\u2063$1\u2063')
          .replace(/\*_([^*\n]+)_\*/g, '\u2063$1\u2063')
          .replace(/_\*([^_\n]+)\*_/g, '\u2063$1\u2063')
          .replace(/\*\*([^*\n]+)\*\*/g, '\u2062$1\u2062')
          .replace(/(?<![*\\])\*([^*\n]+)\*(?!\*)/g, '\u2062$1\u2062')
          .replace(/__([^_\n]+)__/g, '\u2064$1\u2064')
          .replace(
            /(?<![_a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ])_([^_\n]+)_(?![_a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ])/g,
            '\u2064$1\u2064'
          )
      : segmentText;

    const parts = normalized.split(
      /(\u2063[^\u2063]*\u2063|\u2062[^\u2062]*\u2062|\u2064[^\u2064]*\u2064|\u2063[^\u2063]+$|\u2062[^\u2062]+$|\u2064[^\u2064]+$)/g
    );
    const boldStyleClass = useRealBold
      ? 'font-semibold tracking-normal'
      : 'font-normal tracking-normal [text-shadow:0.65px_0_0_currentColor,-0.3px_0_0_currentColor]';

    return parts.map((part, i) => {
      if (!part) return null;
      const displayPart = useRealBold ? part.replace(/[\u2062\u2063\u2064]/g, '') : part;
      if (part.startsWith('\u2063')) {
        return (
          <span
            key={i}
            className={`italic ${boldStyleClass} ${
              muted ? 'text-[#7E776C]' : 'text-[#1C1A18]'
            }`}
          >
            {displayPart}
          </span>
        );
      }
      if (part.startsWith('\u2062')) {
        return (
          <span
            key={i}
            className={`${boldStyleClass} ${
              muted ? 'text-[#7E776C]' : 'text-[#1C1A18]'
            }`}
          >
            {displayPart}
          </span>
        );
      }
      if (part.startsWith('\u2064')) {
        return (
          <em
            key={i}
            className={`italic font-normal tracking-normal ${muted ? 'text-[#8C857B]' : 'text-[#1C1A18]'}`}
          >
            {displayPart}
          </em>
        );
      }
      return <span key={i}>{displayPart}</span>;
    });
  };

  // Render content with copied margin questions in bold italics + inline markup (**bold**, *italic*)
  const renderFormattedText = (
    rawText: string,
    forceMuted: boolean = false,
    includeTrailingBreak: boolean = true,
    useRealBold: boolean = false
  ) => {
    if (!rawText) return ' ';
    const lines = rawText.split('\n');
    const muted = isSealed || forceMuted;
    const readOnlyBold = useRealBold || isSealed;
    const boldQuestionClass = readOnlyBold
      ? 'italic font-semibold tracking-normal'
      : 'italic font-normal tracking-normal [text-shadow:0.65px_0_0_currentColor,-0.3px_0_0_currentColor]';

    return lines.map((line, idx) => {
      const cleanTrimmed = line
        .replace(/[\u200B-\u200D\uFEFF\u2062\u2063\u2064]/g, '')
        .replace(/^\*{1,3}|\*{1,3}$/g, '')
        .trim();
      const hasInvisibleQuestionMarker =
        line.startsWith('\u2063') && !line.slice(1).includes('\u2063');
      const matchedStoredQuestion = italicQuestions.find(q => {
        const cq = q.replace(/[\u200B-\u200D\uFEFF\u2062\u2063\u2064]/g, '').trim();
        return cq.length > 0 && (cleanTrimmed === cq || cleanTrimmed.startsWith(cq));
      });
      const isStandaloneQuestionLine =
        cleanTrimmed.length >= 8 &&
        cleanTrimmed.length <= 240 &&
        /^[¿A-ZĄĆĘŁŃÓŚŹŻÁÉÍÓÚÑÜÀÂÇÈÉÊËÎÏÔÙÛÜ][^.!?\n]{6,235}\?$/.test(cleanTrimmed);

      const isCopiedQuestion =
        cleanTrimmed.length > 0 &&
        (hasInvisibleQuestionMarker || Boolean(matchedStoredQuestion) || isStandaloneQuestionLine);

      // If the user typed additional text on the same line right after a copied question ending with '?',
      // keep the question bold+italic and render the remainder normally
      let questionPart = readOnlyBold ? line.replace(/[\u2062\u2063\u2064]/g, '') : line;
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
              <span
                className={`${boldQuestionClass} ${
                  muted ? 'text-[#7E776C]' : 'text-[#1C1A18]'
                }`}
              >
                {questionPart}
              </span>
              {remainderPart && renderInlineMarkup(remainderPart, muted, readOnlyBold)}
            </>
          ) : (
            renderInlineMarkup(line, muted, readOnlyBold)
          )}
          {idx < lines.length - 1
            ? '\n'
            : includeTrailingBreak && rawText.endsWith('\n')
            ? '\n\u200b'
            : ''}
        </React.Fragment>
      );
    });
  };

  // Render encoded ciphertext message with a built-in window ("wbudowane z okienkiem") asking for the key from device XYZ
  const renderEncodedMessageWithWindow = (
    cipherSample: string,
    sourceDevice?: string,
    isTodayView: boolean = false
  ) => {
    const deviceLabel =
      sourceDevice?.trim() ||
      entryDeviceName?.trim() ||
      tr('poprzedniego urządzenia', 'previous device', 'dispositivo anterior');

    const displayCipher =
      cipherSample && cipherSample.trim().length > 0
        ? `${cipherSample} · AES-GCM-256 · ${cipherSample.slice(0, 180)} · ${cipherSample
            .split('')
            .reverse()
            .join('')
            .slice(0, 140)}`
        : 'U2FsdGVkX1+9X8kLmN3pQrStUvWxYz0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ== · AES-GCM-256 · PBKDF2-SHA256';

    return (
      <div className="relative w-full rounded-xl border border-[#DDD6C8] bg-[#F3EFE7]/75 p-5 sm:p-6 overflow-hidden select-none">
        {/* Background encoded ciphertext blocks */}
        <div className="space-y-2 opacity-55">
          <div className="flex items-center justify-between text-[10px] font-mono-meta uppercase tracking-wider text-[#8C857B]">
            <span>AES-GCM 256 · CIPHERTEXT</span>
            <span>{deviceLabel}</span>
          </div>
          <div className="font-mono-meta text-xs sm:text-[13px] text-[#8C857B] break-all leading-relaxed line-clamp-4 blur-[0.3px]">
            {displayCipher}
          </div>
        </div>

        {/* Built-in Embedded Window ("wbudowane z okienkiem") */}
        <div className="relative z-10 mt-4 p-4 sm:p-5 rounded-xl bg-[#FAF8F5] border border-[#D4CEBF] shadow-xs space-y-4 text-left select-auto">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#EFECE4] border border-[#DDD6C8] flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-4 h-4 text-[#8B2635]" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm sm:text-base font-serif-literary font-medium text-[#1C1A18]">
                  {keySyncMode === 'pin'
                    ? tr(
                        'Odblokuj wpisy własnym hasłem / PIN-em',
                        'Unlock entries with your password / PIN',
                        'Desbloquea las entradas con tu contraseña / PIN'
                      )
                    : tr(
                        `Wpis zaszyfrowany na urządzeniu: ${deviceLabel}`,
                        `Entry encrypted on device: ${deviceLabel}`,
                        `Entrada cifrada en el dispositivo: ${deviceLabel}`
                      )}
                </h4>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EFECE4] border border-[#DDD6C8] text-[10px] font-mono-meta text-[#524D46]">
                  <Smartphone className="w-3 h-3 text-[#6F4E37]" />
                  <span>{deviceLabel}</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm font-serif-literary text-[#6E6961] leading-relaxed">
                {keySyncMode === 'pin'
                  ? tr(
                      'Masz włączoną ochronę własnym hasłem/PIN-em. Wpisz swoje hasło poniżej, aby odblokować pęk kluczy z chmury.',
                      'You have custom password/PIN protection enabled. Enter your password below to unlock your cloud keyring.',
                      'Tienes activada la protección con contraseña/PIN. Introduce tu contraseña abajo para desbloquear tu llavero en la nube.'
                    )
                  : tr(
                      `Od teraz Twoje klucze synchronizują się automatycznie z kontem Google między urządzeniami. Jeśli ten wpis powstał wcześniej na urządzeniu „${deviceLabel}”, wystarczy otworzyć tam aplikację na chwilę (klucz sam doda się do chmury) lub wkleić klucz z tamtego urządzenia poniżej.`,
                      `Your keys now sync automatically with your Google account across devices. If this entry was created earlier on “${deviceLabel}”, simply open the app there once (it will auto-sync to the cloud) or paste the key from that device below.`,
                      `Tus claves ahora se sincronizan automáticamente con tu cuenta de Google entre dispositivos. Si esta entrada se creó antes en «${deviceLabel}», basta con abrir la aplicación allí un momento (se sincronizará sola) o pegar la clave abajo.`
                    )}
              </p>
            </div>
          </div>

          {/* Option A: If user enabled PIN mode, show simple PIN/password input first */}
          {keySyncMode === 'pin' && onUnlockWithPin && (
            <div className="space-y-1.5 pt-1">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <input
                  type="password"
                  value={inlinePinInput}
                  onChange={e => {
                    setInlinePinInput(e.target.value);
                    setInlinePinError(false);
                  }}
                  placeholder={tr(
                    'Wpisz swoje hasło lub PIN...',
                    'Enter your password or PIN...',
                    'Introduce tu contraseña o PIN...'
                  )}
                  className="flex-1 px-3.5 py-2 text-xs sm:text-sm font-mono-meta bg-[#F7F5F0] border border-[#D4CEBF] rounded-lg focus:outline-none focus:border-[#1C1A18] text-[#1C1A18]"
                />
                <button
                  type="button"
                  disabled={!inlinePinInput.trim() || isUnlockingPin}
                  onClick={async () => {
                    if (!inlinePinInput.trim()) return;
                    setIsUnlockingPin(true);
                    setInlinePinError(false);
                    const ok = await onUnlockWithPin(inlinePinInput.trim());
                    setIsUnlockingPin(false);
                    if (ok) {
                      setInlinePinInput('');
                    } else {
                      setInlinePinError(true);
                    }
                  }}
                  className="px-3.5 py-2 rounded border border-[#1C1A18] bg-[#1C1A18] hover:bg-[#33302B] disabled:opacity-40 text-[#FAF8F5] text-xs font-mono-meta font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>
                    {tr('Odblokuj hasłem', 'Unlock with password', 'Desbloquear con contraseña')}
                  </span>
                </button>
              </div>
              {inlinePinError && (
                <p className="text-[11px] font-mono-meta text-[#8B2635]">
                  {tr(
                    'Nieprawidłowe hasło lub PIN. Spróbuj ponownie.',
                    'Incorrect password or PIN. Please try again.',
                    'Contraseña o PIN incorrecto. Inténtalo de nuevo.'
                  )}
                </p>
              )}
            </div>
          )}

          {/* Option B: Paste raw key from the other device (merges into Cloud Keyring forever) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <input
              type="text"
              value={inlineKeyInput}
              onChange={e => setInlineKeyInput(e.target.value)}
              placeholder={tr(
                `Wklej klucz z urządzenia ${deviceLabel} (połączy się na stałe w chmurze)...`,
                `Paste key from ${deviceLabel} (will merge into cloud keyring)...`,
                `Pega la clave de ${deviceLabel} (se unirá en la nube)...`
              )}
              className="flex-1 px-3.5 py-2 text-xs sm:text-sm font-mono-meta bg-[#F7F5F0] border border-[#D4CEBF] rounded focus:outline-none focus:border-[#1C1A18] text-[#1C1A18]"
            />
            <button
              type="button"
              disabled={!inlineKeyInput.trim()}
              onClick={() => {
                if (!inlineKeyInput.trim()) return;
                onSaveKey(inlineKeyInput.trim(), true, deviceInput.trim() || undefined);
                setInlineKeyInput('');
              }}
              className="px-3.5 py-2 rounded border border-[#1C1A18] bg-[#1C1A18] hover:bg-[#33302B] disabled:opacity-40 text-[#FAF8F5] text-xs font-mono-meta font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>{tr('Połącz klucz i odblokuj', 'Merge key & unlock', 'Unir clave y desbloquear')}</span>
            </button>
          </div>

          {/* Emergency Option C (for Today's editor): Start fresh with current synced key if old device is gone */}
          {isTodayView && onResetLockedTodayEntry && (
            <div className="pt-2.5 border-t border-[#EAE5DA] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-serif-literary text-[#7A756D]">
                {tr(
                  'Nie masz pod ręką tamtego urządzenia i chcesz od razu pisać dzisiaj?',
                  'Don’t have that device nearby and want to write today right away?',
                  '¿No tienes ese dispositivo a mano y quieres escribir hoy mismo?'
                )}
              </span>
              {confirmResetToday ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await onResetLockedTodayEntry();
                      setConfirmResetToday(false);
                    }}
                    className="px-2.5 py-1 rounded border border-[#8B2635] bg-[#8B2635] hover:bg-[#6E1D29] text-[#FAF8F5] text-[11px] font-mono-meta cursor-pointer transition-colors whitespace-nowrap"
                  >
                    {tr(
                      'Tak, wyczyść dzisiejszy szkic i pisz nowym kluczem',
                      'Yes, clear today’s draft & write with current key',
                      'Sí, limpiar borrador de hoy y escribir con la clave actual'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetToday(false)}
                    className="px-2.5 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] text-[11px] font-mono-meta cursor-pointer transition-colors whitespace-nowrap"
                  >
                    {tr('Anuluj', 'Cancel', 'Cancelar')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmResetToday(true)}
                  className="px-2.5 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] text-[11px] font-mono-meta transition-colors cursor-pointer whitespace-nowrap"
                >
                  {tr(
                    'Zacznij dzisiejszy wpis od nowa →',
                    'Start today’s entry fresh →',
                    'Empezar la entrada de hoy de nuevo →'
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Compute stats
  const characterCount = content.length;
  const wordCount = content.trim().length === 0 ? 0 : content.trim().split(/\s+/).length;

  const lockedPromptTooltip = tr(
    'Można zmienić pytanie tylko gdy tekst jest pusty',
    'You can only change the question when the text is empty',
    'Solo puedes cambiar la pregunta cuando el texto está vacío',
    'Vous ne pouvez changer la question que lorsque le texte est vide'
  );

  // Map entries by YYYY-MM-DD date string for fast calendar lookup
  const entriesByDate = useMemo(() => {
    const map = new Map<string, SavedEntry>();
    for (const entry of sortedSavedEntries) {
      if (entry.date) {
        map.set(entry.date, entry);
      }
    }
    return map;
  }, [sortedSavedEntries]);

  // Calculate true consecutive-day streak from actual entry dates
  const displayStreak = useMemo(() => {
    const activeDates = new Set<string>();
    entriesByDate.forEach((entry, dateStr) => {
      if (
        (entry.wordCount && entry.wordCount > 0) ||
        (entry.characterCount && entry.characterCount > 0) ||
        entry.isSealed ||
        (entry.decryptedContent && entry.decryptedContent.trim().length > 0)
      ) {
        activeDates.add(dateStr);
      }
    });

    const formatD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const now = new Date();
    const todayStr = formatD(now);
    if (wordCount > 0 || isSealed) {
      activeDates.add(todayStr);
    }

    if (activeDates.size === 0) {
      return 1;
    }

    let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!activeDates.has(formatD(cursor))) {
      const yesterday = new Date(cursor);
      yesterday.setDate(yesterday.getDate() - 1);
      if (activeDates.has(formatD(yesterday))) {
        cursor = yesterday;
      } else {
        const sortedDates = Array.from(activeDates).sort((a, b) => b.localeCompare(a));
        const [ly, lm, ld] = sortedDates[0].split('-').map(Number);
        if (ly && lm && ld) {
          cursor = new Date(ly, lm - 1, ld);
        }
      }
    }

    let count = 0;
    while (activeDates.has(formatD(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return Math.max(1, count);
  }, [entriesByDate, wordCount, isSealed]);

  const isSelectedSparkleOnlyDate = Boolean(
    selectedEntryId &&
      !sortedSavedEntries.some(e => e.id === selectedEntryId || e.date === selectedEntryId) &&
      sparkleCards.some(sc => sc.date === selectedEntryId)
  );
  const selectedArchiveEntry = isSelectedSparkleOnlyDate
    ? undefined
    : sortedSavedEntries.find(e => e.id === selectedEntryId || e.date === selectedEntryId) ||
      sortedSavedEntries[0];
  const selectedDateKey =
    selectedArchiveEntry?.date || (isSelectedSparkleOnlyDate ? selectedEntryId : null);
  const selectedDaySparkles = useMemo(() => {
    if (!selectedDateKey) return [];
    return sparkleCards.filter(sc => sc.date === selectedDateKey).slice(0, 1);
  }, [sparkleCards, selectedDateKey]);
  const matchedArchivePrompt = selectedArchiveEntry
    ? allPrompts.find(p => p.id === selectedArchiveEntry.promptId)
    : null;
  const totalArchiveWords = savedEntries.reduce((acc, curr) => acc + (curr.wordCount || 0), 0);
  const totalArchiveSeconds = savedEntries.reduce(
    (acc, curr) => acc + (curr.writingTimeSeconds || 0),
    0
  );
  const sealedArchiveCount = savedEntries.filter(e => e.isSealed).length;
  const avgWordsPerEntry =
    savedEntries.length > 0 ? Math.round(totalArchiveWords / savedEntries.length) : 0;

  const [statsWeekOffset, setStatsWeekOffset] = useState<number>(0);
  const [hoveredWordDayKey, setHoveredWordDayKey] = useState<string | null>(null);
  const [hoveredTimeDayKey, setHoveredTimeDayKey] = useState<string | null>(null);

  const recent7Days = useMemo(() => {
    const days: Array<{
      dateKey: string;
      shortLabel: string;
      weekdayShort: string;
      wordCount: number;
      isSealed: boolean;
      hasEntry: boolean;
      timeStr: string | null;
      hourDecimal: number | null;
    }> = [];
    const weekdayNames =
      lang === 'en'
        ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        : lang === 'es'
        ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
        : lang === 'fr'
        ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        : ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'];

    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = String(now.getMonth() + 1).padStart(2, '0');
    const todayD = String(now.getDate()).padStart(2, '0');
    const todayKeyStr = `${todayY}-${todayM}-${todayD}`;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - (statsWeekOffset * 7 + i));
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${dayNum}`;
      const entry = entriesByDate.get(dateKey);
      const isToday = dateKey === todayKeyStr;
      const effectiveWords = isToday
        ? Math.max(entry?.wordCount || 0, wordCount)
        : entry?.wordCount || 0;
      const effectiveSealed = Boolean(entry?.isSealed || (isToday && isSealed));
      const hasEntry = effectiveWords > 0;

      let isoTimestamp = entry?.updatedAt;
      if (!isoTimestamp && isToday && hasEntry) {
        try {
          const rawDraft = localStorage.getItem(`kronika_draft_${dateKey}`);
          if (rawDraft) {
            const parsedDraft = JSON.parse(rawDraft);
            if (typeof parsedDraft?.updatedAt === 'string') {
              isoTimestamp = parsedDraft.updatedAt;
            }
          }
        } catch {
          // ignore
        }
        if (!isoTimestamp) {
          isoTimestamp = now.toISOString();
        }
      }

      let timeStr: string | null = null;
      let hourDecimal: number | null = null;
      if (hasEntry && isoTimestamp) {
        const dt = new Date(isoTimestamp);
        if (!isNaN(dt.getTime())) {
          const hrs = dt.getHours();
          const mins = dt.getMinutes();
          timeStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
          hourDecimal = hrs + mins / 60;
        }
      }

      days.push({
        dateKey,
        shortLabel: `${dayNum}.${m}`,
        weekdayShort: weekdayNames[(d.getDay() + 6) % 7],
        wordCount: effectiveWords,
        isSealed: effectiveSealed,
        hasEntry,
        timeStr,
        hourDecimal,
      });
    }
    return days;
  }, [entriesByDate, statsWeekOffset, wordCount, isSealed, lang]);

  const activeInLast7Days = recent7Days.filter(d => d.hasEntry).length;
  const maxRecentWords = Math.max(40, ...recent7Days.map(d => d.wordCount));

  const averageWritingTimeStr = useMemo(() => {
    const withTime = recent7Days.filter(d => d.hourDecimal !== null);
    if (withTime.length === 0) return null;
    const avgDec =
      withTime.reduce((acc, curr) => acc + (curr.hourDecimal ?? 0), 0) / withTime.length;
    const hrs = Math.floor(avgDec) % 24;
    const mins = Math.round((avgDec - Math.floor(avgDec)) * 60) % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }, [recent7Days]);

  // Map Sparkle appreciation cards by date (YYYY-MM-DD) so calendar days show a star indicator (max 1 per day)
  const sparklesByDate = useMemo(() => {
    const map = new Map<string, SparkleAppreciationCard[]>();
    for (const sc of sparkleCards) {
      if (sc.date && !map.has(sc.date)) {
        map.set(sc.date, [sc]);
      }
    }
    return map;
  }, [sparkleCards]);

  // Build calendar grid cells for `calendarMonth` (Monday = first day of week)
  const calendarCells = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

    const cells: Array<{
      day: number | null;
      dateKey: string | null;
      entry?: SavedEntry;
      sparkles?: SparkleAppreciationCard[];
    }> = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({ day: null, dateKey: null });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateKey = `${year}-${mStr}-${dStr}`;
      cells.push({
        day: d,
        dateKey,
        entry: entriesByDate.get(dateKey),
        sparkles: sparklesByDate.get(dateKey),
      });
    }

    return cells;
  }, [calendarMonth, entriesByDate, sparklesByDate]);

  const MONTH_NAMES = isEn
    ? [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ]
    : isEs
    ? [
        'Enero',
        'Febrero',
        'Marzo',
        'Abril',
        'Mayo',
        'Junio',
        'Julio',
        'Agosto',
        'Septiembre',
        'Octubre',
        'Noviembre',
        'Diciembre',
      ]
    : isFr
    ? [
        'Janvier',
        'Février',
        'Mars',
        'Avril',
        'Mai',
        'Juin',
        'Juillet',
        'Août',
        'Septembre',
        'Octobre',
        'Novembre',
        'Décembre',
      ]
    : [
        'Styczeń',
        'Luty',
        'Marzec',
        'Kwiecień',
        'Maj',
        'Czerwiec',
        'Lipiec',
        'Sierpień',
        'Wrzesień',
        'Październik',
        'Listopad',
        'Grudzień',
      ];

  const WEEKDAY_NAMES = isEn
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : isEs
    ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    : isFr
    ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    : ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'];

  const handlePrevCalendarMonth = () => {
    setCalendarMonth(prev => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const handleNextCalendarMonth = () => {
    setCalendarMonth(prev => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  // Text slice up to active cursor position for exact caret line measurement
  const textBeforeCursor = content.slice(0, Math.min(cursorPos, content.length));

  const isDrawerOpen = activeBottomPage !== 'none';

  // Remember the most recently viewed tab whenever a bottom page is opened
  useEffect(() => {
    if (activeBottomPage !== 'none') {
      setLastBottomPage(activeBottomPage);
      try {
        localStorage.setItem('kronika_last_bottom_page', activeBottomPage);
      } catch {
        // ignore
      }
    }
  }, [activeBottomPage]);

  // Resolve target tab for pull-up gesture (fallback to 'archive' if 'closeDay' was previously stored)
  const effectiveLastBottomPage: Exclude<BottomPage, 'none'> =
    lastBottomPage === 'closeDay' ? 'archive' : lastBottomPage;

  const effectiveLastTabLabel =
    effectiveLastBottomPage === 'archive'
      ? tr('Dziennik', 'Journal', 'Diario', 'Journal')
      : effectiveLastBottomPage === 'stats'
      ? tr('Statystyki', 'Stats', 'Estadísticas', 'Statistiques')
      : tr('Klucz E2EE', 'E2EE Key', 'Clave E2EE', 'Clé E2EE');

  // Hold-to-close + short time indicator state for "Zamknij dzień" above the companion's head
  const [isHoldingClose, setIsHoldingClose] = useState<boolean>(false);
  const [holdCloseProgress, setHoldCloseProgress] = useState<number>(0);
  const [closeCountdownProgress, setCloseCountdownProgress] = useState<number | null>(null);
  const holdRafRef = useRef<number | null>(null);
  const holdStartTimeRef = useRef<number | null>(null);
  const countdownRafRef = useRef<number | null>(null);
  const countdownStartTimeRef = useRef<number | null>(null);
  const onSealDayLatestRef = useRef(onSealDay);

  useEffect(() => {
    onSealDayLatestRef.current = onSealDay;
  }, [onSealDay]);

  const cancelHoldClose = useCallback(() => {
    if (holdRafRef.current !== null) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    holdStartTimeRef.current = null;
    setIsHoldingClose(false);
    setHoldCloseProgress(0);
  }, []);

  const cancelCloseCountdown = useCallback(() => {
    if (countdownRafRef.current !== null) {
      cancelAnimationFrame(countdownRafRef.current);
      countdownRafRef.current = null;
    }
    countdownStartTimeRef.current = null;
    setCloseCountdownProgress(null);
  }, []);

  const startCloseCountdown = useCallback(() => {
    cancelHoldClose();
    const COUNTDOWN_DURATION_MS = 2600;
    countdownStartTimeRef.current = performance.now();
    setCloseCountdownProgress(0);

    const stepCountdown = (now: number) => {
      if (countdownStartTimeRef.current === null) return;
      const elapsed = now - countdownStartTimeRef.current;
      const pct = Math.min(100, (elapsed / COUNTDOWN_DURATION_MS) * 100);
      setCloseCountdownProgress(pct);

      if (pct < 100) {
        countdownRafRef.current = requestAnimationFrame(stepCountdown);
      } else {
        countdownRafRef.current = null;
        countdownStartTimeRef.current = null;
        setCloseCountdownProgress(null);
        onSealDayLatestRef.current();
      }
    };

    countdownRafRef.current = requestAnimationFrame(stepCountdown);
  }, [cancelHoldClose]);

  const startHoldClose = useCallback(() => {
    if (characterCount <= 0 || isSealed || decryptionError || closeCountdownProgress !== null) {
      return;
    }
    cancelHoldClose();
    const HOLD_DURATION_MS = 1050;
    holdStartTimeRef.current = performance.now();
    setIsHoldingClose(true);
    setHoldCloseProgress(0);

    const stepHold = (now: number) => {
      if (holdStartTimeRef.current === null) return;
      const elapsed = now - holdStartTimeRef.current;
      const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      setHoldCloseProgress(pct);

      if (pct < 100) {
        holdRafRef.current = requestAnimationFrame(stepHold);
      } else {
        startCloseCountdown();
      }
    };

    holdRafRef.current = requestAnimationFrame(stepHold);
  }, [characterCount, isSealed, decryptionError, closeCountdownProgress, cancelHoldClose, startCloseCountdown]);

  useEffect(() => {
    if (isDrawerOpen || isSealed || decryptionError) {
      cancelHoldClose();
      cancelCloseCountdown();
    }
  }, [isDrawerOpen, isSealed, decryptionError, cancelHoldClose, cancelCloseCountdown]);

  // Hold-to-unseal + countdown state for "Odblokuj wpis" when day is sealed
  const [isHoldingUnseal, setIsHoldingUnseal] = useState<boolean>(false);
  const [holdUnsealProgress, setHoldUnsealProgress] = useState<number>(0);
  const [unsealCountdownProgress, setUnsealCountdownProgress] = useState<number | null>(null);
  const holdUnsealRafRef = useRef<number | null>(null);
  const holdUnsealStartTimeRef = useRef<number | null>(null);
  const unsealCountdownRafRef = useRef<number | null>(null);
  const unsealCountdownStartTimeRef = useRef<number | null>(null);
  const onUnsealDayLatestRef = useRef(onUnsealDay);

  useEffect(() => {
    onUnsealDayLatestRef.current = onUnsealDay;
  }, [onUnsealDay]);

  const cancelHoldUnseal = useCallback(() => {
    if (holdUnsealRafRef.current !== null) {
      cancelAnimationFrame(holdUnsealRafRef.current);
      holdUnsealRafRef.current = null;
    }
    holdUnsealStartTimeRef.current = null;
    setIsHoldingUnseal(false);
    setHoldUnsealProgress(0);
  }, []);

  const cancelUnsealCountdown = useCallback(() => {
    if (unsealCountdownRafRef.current !== null) {
      cancelAnimationFrame(unsealCountdownRafRef.current);
      unsealCountdownRafRef.current = null;
    }
    unsealCountdownStartTimeRef.current = null;
    setUnsealCountdownProgress(null);
  }, []);

  const startUnsealCountdown = useCallback(() => {
    cancelHoldUnseal();
    const COUNTDOWN_DURATION_MS = 2600;
    unsealCountdownStartTimeRef.current = performance.now();
    setUnsealCountdownProgress(0);

    const stepCountdown = (now: number) => {
      if (unsealCountdownStartTimeRef.current === null) return;
      const elapsed = now - unsealCountdownStartTimeRef.current;
      const pct = Math.min(100, (elapsed / COUNTDOWN_DURATION_MS) * 100);
      setUnsealCountdownProgress(pct);

      if (pct < 100) {
        unsealCountdownRafRef.current = requestAnimationFrame(stepCountdown);
      } else {
        unsealCountdownRafRef.current = null;
        unsealCountdownStartTimeRef.current = null;
        setUnsealCountdownProgress(null);
        if (onUnsealDayLatestRef.current) {
          onUnsealDayLatestRef.current();
        }
      }
    };

    unsealCountdownRafRef.current = requestAnimationFrame(stepCountdown);
  }, [cancelHoldUnseal]);

  const startHoldUnseal = useCallback(() => {
    if (!isSealed || decryptionError || unsealCountdownProgress !== null) {
      return;
    }
    cancelHoldUnseal();
    const HOLD_DURATION_MS = 1050;
    holdUnsealStartTimeRef.current = performance.now();
    setIsHoldingUnseal(true);
    setHoldUnsealProgress(0);

    const stepHold = (now: number) => {
      if (holdUnsealStartTimeRef.current === null) return;
      const elapsed = now - holdUnsealStartTimeRef.current;
      const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      setHoldUnsealProgress(pct);

      if (pct < 100) {
        holdUnsealRafRef.current = requestAnimationFrame(stepHold);
      } else {
        startUnsealCountdown();
      }
    };

    holdUnsealRafRef.current = requestAnimationFrame(stepHold);
  }, [isSealed, decryptionError, unsealCountdownProgress, cancelHoldUnseal, startUnsealCountdown]);

  useEffect(() => {
    if (isDrawerOpen || !isSealed || decryptionError) {
      cancelHoldUnseal();
      cancelUnsealCountdown();
    }
  }, [isDrawerOpen, isSealed, decryptionError, cancelHoldUnseal, cancelUnsealCountdown]);

  useEffect(() => {
    return () => {
      if (holdRafRef.current !== null) cancelAnimationFrame(holdRafRef.current);
      if (countdownRafRef.current !== null) cancelAnimationFrame(countdownRafRef.current);
      if (holdUnsealRafRef.current !== null) cancelAnimationFrame(holdUnsealRafRef.current);
      if (unsealCountdownRafRef.current !== null) cancelAnimationFrame(unsealCountdownRafRef.current);
    };
  }, []);

  useEffect(() => {
    setPullDownOffset(0);
    setPullUpOffset(0);
    pullStartYRef.current = null;
    didPullDragRef.current = false;
    if (isDrawerOpen && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isDrawerOpen]);

  const handleCompanionPullStart = (clientY: number) => {
    pullStartYRef.current = clientY;
    didPullDragRef.current = false;
  };

  const handleCompanionPullMove = (clientY: number) => {
    if (pullStartYRef.current === null) return;
    const rawDelta = clientY - pullStartYRef.current;

    if (isDrawerOpen) {
      // Pull DOWN to return to writing
      if (rawDelta > 6) {
        didPullDragRef.current = true;
        setPullDownOffset(Math.min(84, Math.round(rawDelta * 0.65)));
        setPullUpOffset(0);
      } else {
        setPullDownOffset(0);
      }
    } else {
      // Pull UP to open the last viewed tab
      const upDelta = -rawDelta;
      if (upDelta > 6) {
        didPullDragRef.current = true;
        setPullUpOffset(Math.min(84, Math.round(upDelta * 0.65)));
        setPullDownOffset(0);
      } else {
        setPullUpOffset(0);
      }
    }
  };

  const handleCompanionPullEnd = () => {
    if (pullStartYRef.current === null) return;

    if (isDrawerOpen) {
      const shouldReturnToWriting = pullDownOffset >= 24;
      pullStartYRef.current = null;
      setPullDownOffset(0);
      setPullUpOffset(0);
      if (shouldReturnToWriting) {
        setActiveBottomPage('none');
      }
    } else {
      const shouldOpenLastTab = pullUpOffset >= 24;
      pullStartYRef.current = null;
      setPullUpOffset(0);
      setPullDownOffset(0);
      if (shouldOpenLastTab) {
        setActiveBottomPage(effectiveLastBottomPage);
      }
    }

    setTimeout(() => {
      didPullDragRef.current = false;
    }, 60);
  };

  return (
    <div
      className={`flex-1 flex flex-col w-full text-left relative ${
        isDrawerOpen
          ? 'overflow-x-hidden pt-1 pb-12 justify-start'
          : isSealed && !isLoadingEntry
          ? 'overflow-x-hidden h-[calc(100vh-57px)] max-h-[calc(100vh-57px)] overflow-hidden pt-0 pb-4 justify-between'
          : 'pt-0 pb-6 sm:pb-12 justify-between'
      }`}
    >
      {/* PINNED TOP DOCK FOR ACTIVE WRITING: Main Question / Free Thought + Toolbar (Mic, B/I, Spellcheck, Prompt Switcher, Wolna myśl) + Live Dictated Text + Mobile Follow-up Question */}
      {!isDrawerOpen && !isSealed && !decryptionError && (
        <div
          ref={stickyDockRef}
          style={{
            top: 'var(--header-h, 45px)',
            transform: 'translate3d(0, var(--vv-offset-top, 0px), 0)',
          }}
          className="sticky z-30 w-full bg-[#F7F5F0]/95 backdrop-blur-[2px] border-b border-[#EAE5DA]/85 select-none will-change-transform"
        >
          <div className="max-w-2xl mx-auto w-full px-3 sm:px-8 pt-2.5 sm:pt-5 pb-2.5 space-y-2 sm:space-y-3">
            {/* Main Question OR Free Thought Header */}
            <div className="w-full select-none shrink-0">
              {isFreeThoughtMode ? (
                <div className="flex flex-wrap items-center justify-between gap-2 py-0.5">
                  <div className="inline-flex items-center gap-2 text-base sm:text-xl font-serif-literary italic text-[#6E6961]">
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
                <h2 className="w-full text-[17px] sm:text-2xl md:text-[26px] font-serif-literary font-normal leading-snug text-left text-[#6E6961] transition-colors">
                  {activePromptText}
                </h2>
              )}
            </div>

            {/* Combined Action Row + Live Dictation Preview + Mobile Follow-up Question */}
            {!isLoadingEntry && (
              <div className="w-full space-y-2 select-none">
                <div className="w-full flex flex-nowrap items-center justify-between gap-2 min-w-0">
                  {/* Left side of toolbar: Voice Dictation (Mobile + Desktop), B/I markup, + Spellcheck button */}
                  <div className="flex flex-nowrap items-center gap-1.5 text-[11px] sm:text-xs font-mono-meta shrink-0">
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={handleToggleDictation}
                      className={`flex transition-colors items-center justify-center gap-1.5 px-2 sm:px-2.5 h-7 sm:min-h-[30px] rounded text-[11px] sm:text-xs font-mono-meta border cursor-pointer whitespace-nowrap shrink-0 ${
                        isDictating
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
                      {isDictating ? (
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
                          <span className="hidden sm:inline">
                            {tr('Dyktuj', 'Dictate', 'Dictar', 'Dicter')}
                          </span>
                        </>
                      )}
                    </button>

                    {/* Quick Bold (*tekst*) & Italic (_tekst_) markup buttons */}
                    <div className="flex items-center rounded border border-[#DDD6C8] bg-[#F5F2EB] divide-x divide-[#DDD6C8] overflow-hidden shrink-0 h-7 sm:min-h-[30px]">
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleInsertMarkup('bold')}
                        title={tr(
                          'Pogrubienie — wpisz *tekst* lub zaznacz słowa i kliknij B',
                          'Bold — type *text* or select words and click B',
                          'Negrita — escribe *texto* o selecciona palabras y pulsa B',
                          'Gras — tapez *texte* ou sélectionnez des mots et cliquez sur B'
                        )}
                        className="px-2 h-full font-serif-literary font-bold text-[11px] sm:text-xs text-[#524D46] hover:bg-[#EAE5DA] hover:text-[#1C1A18] transition-colors cursor-pointer"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleInsertMarkup('italic')}
                        title={tr(
                          'Kursywa — wpisz _tekst_ lub zaznacz słowa i kliknij I',
                          'Italic — type _text_ or select words and click I',
                          'Cursiva — escribe _texto_ o selecciona palabras y pulsa I',
                          'Italique — tapez _texte_ ou sélectionnez des mots et cliquez sur I'
                        )}
                        className="px-2 h-full font-serif-literary italic text-[11px] sm:text-xs text-[#524D46] hover:bg-[#EAE5DA] hover:text-[#1C1A18] transition-colors cursor-pointer"
                      >
                        I
                      </button>
                    </div>

                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={handleAutoFixSpelling}
                      disabled={isFixingSpelling || content.trim().length <= 2}
                      className={`transition-colors flex items-center justify-center gap-1.5 px-2 sm:px-2.5 h-7 sm:min-h-[30px] rounded text-[11px] sm:text-xs font-mono-meta border whitespace-nowrap shrink-0 ${
                        content.trim().length <= 2
                          ? 'bg-[#F5F2EB]/60 border-[#EAE5DA] text-[#ABA497] cursor-not-allowed opacity-65'
                          : spellFixStatus === 'fixed'
                          ? 'bg-[#EBF2EB] border-[#CCE2CC] text-[#2E5C33] cursor-pointer'
                          : spellFixStatus === 'clean'
                          ? 'bg-[#EFECE4] border-[#DDD6C8] text-[#524D46] cursor-pointer'
                          : 'bg-[#F5F2EB] hover:bg-[#EAE5DA] border-[#DDD6C8] text-[#524D46] hover:text-[#1C1A18] cursor-pointer'
                      }`}
                      title={tr(
                        'Automatycznie poprawia literówki i polskie znaki bez zmiany znaczenia zdań',
                        'Automatically fixes typos and spelling without changing sentence meaning',
                        'Corrige automáticamente errores ortográficos y tildes sin cambiar el significado',
                        'Corrige automatiquement les fautes d’orthographe et les accents sans changer le sens'
                      )}
                    >
                      {isFixingSpelling ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#3E7B44] shrink-0" />
                          <span className="hidden sm:inline">
                            {tr(
                              'Sprawdzanie...',
                              'Checking...',
                              'Revisando...',
                              'Vérification...'
                            )}
                          </span>
                        </>
                      ) : spellFixStatus === 'fixed' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#2E5C33] shrink-0" />
                          <span className="sm:hidden tabular-nums">{fixedCount}</span>
                          <span className="hidden sm:inline">
                            {tr(`Poprawiono (${fixedCount})`, `Fixed (${fixedCount})`, `Corregido (${fixedCount})`, `Corrigé (${fixedCount})`)}
                          </span>
                          {previousContent && (
                            <span
                              onMouseDown={e => e.preventDefault()}
                              onClick={e => {
                                e.stopPropagation();
                                handleUndoFix();
                              }}
                              className="ml-0.5 sm:ml-1 underline font-semibold hover:text-[#142A17] cursor-pointer"
                              title={tr('Cofnij poprawki', 'Undo fixes', 'Deshacer cambios', 'Annuler')}
                            >
                              <span className="sm:hidden">↶</span>
                              <span className="hidden sm:inline">
                                {tr('(Cofnij)', '(Undo)', '(Deshacer)', '(Annuler)')}
                              </span>
                            </span>
                          )}
                        </>
                      ) : spellFixStatus === 'clean' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#2E5C33] shrink-0" />
                          <span className="sm:hidden">OK</span>
                          <span className="hidden sm:inline">
                            {tr(
                              'Brak literówek',
                              'No typos',
                              'Sin errores',
                              'Aucune faute'
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3.5 h-3.5 text-[#3E7B44] shrink-0" />
                          <span className="hidden sm:inline">
                            {tr('Popraw pisownię', 'Fix spelling', 'Corregir', 'Corriger')}
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Right side of toolbar: Unified Prompt navigation ([< | Wymień | >]) + Free Thought toggle */}
                  <div className="relative flex flex-nowrap items-center gap-1.5 shrink-0">
                    {!isFreeThoughtMode && (
                      <div
                        className="relative group flex flex-nowrap items-center rounded border border-[#DDD6C8] bg-[#F5F2EB] divide-x divide-[#DDD6C8] h-7 sm:min-h-[30px] shrink-0"
                        title={hasWrittenText ? lockedPromptTooltip : undefined}
                      >
                        {hasWrittenText && (
                          <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute right-0 bottom-full mb-1.5 z-40 whitespace-nowrap px-2.5 py-1 rounded bg-[#1C1A18] text-[#FAF8F5] text-[11px] font-mono-meta shadow-md">
                            {lockedPromptTooltip}
                          </div>
                        )}

                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            if (!hasWrittenText) onPrevPrompt();
                          }}
                          disabled={hasWrittenText || promptIndex <= 0}
                          title={
                            hasWrittenText
                              ? lockedPromptTooltip
                              : tr('Poprzednie pytanie', 'Previous question', 'Pregunta anterior', 'Question précédente')
                          }
                          className="px-1.5 sm:px-2 h-full flex items-center justify-center rounded-l text-[#524D46] hover:bg-[#EAE5DA] hover:text-[#1C1A18] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>

                        <div className="relative h-full flex items-center">
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              if (!hasWrittenText && remainingRerolls > 0) {
                                setShowCategoryMenu(!showCategoryMenu);
                              }
                            }}
                            disabled={hasWrittenText || remainingRerolls <= 0}
                            title={
                              hasWrittenText
                                ? lockedPromptTooltip
                                : remainingRerolls > 0
                                ? tr(
                                    `Wymień pytanie (pozostało ${remainingRerolls} z 3 prób)`,
                                    `Change question (${remainingRerolls} of 3 left today)`,
                                    `Cambiar pregunta (quedan ${remainingRerolls} de 3 hoy)`,
                                    `Changer de question (${remainingRerolls} sur 3 restantes)`
                                  )
                                : tr(
                                    'Wykorzystano wszystkie 3 wymiany na dzisiaj',
                                    'All 3 question changes used for today',
                                    'Se usaron los 3 cambios de pregunta de hoy',
                                    'Les 3 changements de question ont été utilisés aujourd’hui'
                                  )
                            }
                            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 h-full text-[11px] sm:text-xs font-mono-meta transition-colors whitespace-nowrap shrink-0 ${
                              !hasWrittenText && remainingRerolls > 0
                                ? 'text-[#524D46] hover:text-[#1C1A18] hover:bg-[#EAE5DA] cursor-pointer'
                                : 'text-[#ABA497] cursor-not-allowed opacity-50'
                            }`}
                          >
                            <RefreshCw className={`w-3 h-3 shrink-0 ${isRerolling ? 'animate-spin' : ''}`} />
                            <span className="sm:hidden tabular-nums">
                              {remainingRerolls > 0 ? `${remainingRerolls}/3` : '0/3'}
                            </span>
                            <span className="hidden sm:inline tabular-nums">
                              {remainingRerolls > 0
                                ? tr(
                                    `Wymień (${remainingRerolls}/3)`,
                                    `Change (${remainingRerolls}/3)`,
                                    `Cambiar (${remainingRerolls}/3)`,
                                    `Changer (${remainingRerolls}/3)`
                                  )
                                : '0/3'}
                            </span>
                            <ChevronDown className="hidden sm:inline w-3 h-3 opacity-60 shrink-0" />
                          </button>

                          {!hasWrittenText && showCategoryMenu && remainingRerolls > 0 && (
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
                                    onClick={() => handleSelectCategory(cat.id)}
                                    className="w-full text-left px-2.5 py-1.5 rounded text-xs font-serif-literary text-[#33302B] hover:bg-[#EFECE4] hover:text-[#1C1A18] transition-colors flex items-center justify-between cursor-pointer"
                                  >
                                    <span>{getCategoryLabel(cat.id, lang)}</span>
                                    {cat.id === prompt.category && (
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
                            if (!hasWrittenText) onNextPrompt();
                          }}
                          disabled={hasWrittenText || promptIndex >= totalPromptsInHistory - 1}
                          title={
                            hasWrittenText
                              ? lockedPromptTooltip
                              : tr('Następne pytanie', 'Next question', 'Siguiente pregunta', 'Question suivante')
                          }
                          className="px-1.5 sm:px-2 h-full flex items-center justify-center rounded-r text-[#524D46] hover:bg-[#EAE5DA] hover:text-[#1C1A18] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Toggle between Daily Question and Free Thought ("Wolna myśl") */}
                    {onToggleFreeThought && (
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setShowCategoryMenu(false);
                          onToggleFreeThought(!isFreeThoughtMode);
                        }}
                        title={
                          isFreeThoughtMode
                            ? tr(
                                'Wróć do codziennego pytania dnia',
                                'Return to today’s daily question',
                                'Volver a la pregunta del día',
                                'Revenir à la question du jour'
                              )
                            : tr(
                                'Zrezygnuj z codziennego pytania i zapisz wolną myśl',
                                'Skip the daily question and write a free thought',
                                'Omitir la pregunta diaria y escribir un pensamiento libre',
                                'Ignorer la question du jour et écrire une pensée libre'
                              )
                        }
                        className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 h-7 sm:min-h-[30px] rounded text-[11px] sm:text-xs font-mono-meta border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          isFreeThoughtMode
                            ? 'border-[#1C1A18] bg-[#EAE5DA] text-[#1C1A18] font-medium'
                            : 'border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18]'
                        }`}
                      >
                        <svg
                          viewBox="0 0 18 18"
                          className="w-3.5 h-3.5 shrink-0 text-[#8B2635]"
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
                          {isFreeThoughtMode
                            ? tr('Pytanie', 'Prompt', 'Pregunta', 'Question')
                            : tr('Wolna myśl', 'Free', 'Libre', 'Libre')}
                        </span>
                        <span className="hidden sm:inline">
                          {isFreeThoughtMode
                            ? tr('Pytanie dnia', 'Daily question', 'Pregunta del día', 'Question du jour')
                            : tr('Wolna myśl', 'Free thought', 'Pensamiento libre', 'Pensée libre')}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Dictation Interim Preview or Speech Error inside pinned toolbar */}
                {(isDictating || speechError) && (
                  <div className="w-full flex items-center justify-between gap-2 px-2.5 py-1 rounded bg-[#EFECE4]/95 border border-[#DDD6C8] text-xs font-serif-literary text-[#524D46]">
                    {speechError ? (
                      <span className="text-[#8B2635]">{speechError}</span>
                    ) : (
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Mic className="w-3.5 h-3.5 text-[#8B2635] shrink-0" />
                        <span className="italic truncate">
                          {interimSpeech
                            ? `„${interimSpeech}...”`
                            : tr(
                                'Słucham — mów spokojnie, tekst pojawi się poniżej...',
                                'Listening — speak naturally, your words will appear below...',
                                'Escuchando — habla con calma, el texto aparecerá abajo...',
                                'Écoute en cours — parlez calmement, vos mots apparaîtront ci-dessous...'
                              )}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Mobile & Tablet Follow-up Question (pytanie pomocnicze) inside pinned top bar */}
                <div className="lg:hidden pt-0.5">
                  {showMarginHints ? (
                    <div className="border border-[#E2DDD3] bg-[#EFECE4]/75 rounded px-2.5 py-1 flex items-center justify-between gap-2">
                      <span className="text-[13.5px] sm:text-[15px] font-serif-literary italic text-[#3D3831] leading-snug flex-1 text-left">
                        {currentMarginQuestion}
                      </span>

                      <div className="inline-flex items-center rounded border border-[#DDD6C8] bg-[#F5F2EB] divide-x divide-[#DDD6C8] overflow-hidden shrink-0 h-6">
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={handleCopyQuestionToText}
                          title={tr(
                            'Skopiuj pytanie do tekstu (pogrubioną kursywą)',
                            'Copy question into text (in bold italics)',
                            'Copiar pregunta al texto (en cursiva y negrita)',
                            'Copier la question dans le texte (en gras italique)'
                          )}
                          className="px-1.5 h-full flex items-center justify-center text-[#524D46] hover:text-[#1C1A18] hover:bg-[#EAE5DA] transition-colors font-mono-meta text-xs cursor-pointer"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={handleRotateQuestion}
                          title={tr(
                            'Zmień pytanie pomocnicze',
                            'Change follow-up question',
                            'Cambiar pregunta de seguimiento',
                            'Changer la question de suivi'
                          )}
                          className="px-1.5 h-full flex items-center justify-center text-[#524D46] hover:text-[#1C1A18] hover:bg-[#EAE5DA] transition-colors cursor-pointer"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${isRotatingQuestion ? 'animate-spin' : ''}`}
                          />
                        </button>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={handleToggleMarginHints}
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
                        onClick={handleToggleMarginHints}
                        title={tr(
                          'Pokaż pytanie pomocnicze',
                          'Show follow-up question',
                          'Mostrar pregunta de seguimiento',
                          'Afficher la question de suivi'
                        )}
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
            )}
          </div>
        </div>
      )}

      {/* 1. WRITING MODE SECTION */}
      <div
        className={`w-full ${
          isDrawerOpen
            ? 'hidden'
            : isSealed
            ? 'flex-1 min-h-0 flex flex-col'
            : 'flex-1 flex flex-col'
        }`}
      >
        <div
          ref={editorScrollRef}
          className={`min-h-0 w-full ${
            isSealed ? 'h-full flex flex-col overflow-hidden' : ''
          }`}
        >
          <div
            className={`max-w-2xl mx-auto w-full px-4 sm:px-8 pb-4 ${
              isSealed && !isDrawerOpen ? 'flex-1 min-h-0 flex flex-col' : 'pt-3 sm:pt-4 space-y-3.5'
            }`}
          >
            {/* Top Banner when Day is Sealed — symmetrical vertical padding from header and to main question */}
            {!isLoadingEntry && isSealed && (
              <div className="shrink-0 py-5 sm:py-6 mb-5 sm:mb-6 border-b border-[#EAE5DA]/80 flex items-start sm:items-center gap-3.5 select-none animate-in fade-in duration-300">
                {/* Cozy line-art warm cup & bookmark/star icon (distinct from the cloud+sun logo) */}
                <svg
                  viewBox="0 0 32 30"
                  className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 mt-0.5 sm:mt-0 overflow-visible"
                  aria-hidden="true"
                >
                  {/* Pastel pink saucer/coaster accent */}
                  <ellipse
                    cx="14"
                    cy="25.5"
                    rx="10.5"
                    ry="2.5"
                    fill="#EBC5CF"
                    stroke="#1C1A18"
                    strokeWidth="1.6"
                  />
                  {/* Cup handle */}
                  <path
                    d="M21 13.5 H23.5 C25.5 13.5 26.8 15 26.8 17 C26.8 19 25.5 20.5 23.5 20.5 H20.5"
                    fill="none"
                    stroke="#1C1A18"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  {/* Cup body */}
                  <path
                    d="M6.5 11.5 H21.5 V18.5 C21.5 22.2 18.5 24.5 14 24.5 C9.5 24.5 6.5 22.2 6.5 18.5 Z"
                    fill="#FAF8F5"
                    stroke="#1C1A18"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  {/* Tea tag with pastel pink accent */}
                  <line
                    x1="11"
                    y1="11.5"
                    x2="11"
                    y2="16"
                    stroke="#1C1A18"
                    strokeWidth="1.3"
                  />
                  <rect
                    x="9.3"
                    y="16"
                    width="3.4"
                    height="4"
                    rx="0.6"
                    fill="#EBC5CF"
                    stroke="#1C1A18"
                    strokeWidth="1.3"
                  />
                  {/* Gentle steam lines */}
                  <path
                    d="M11 8.5 C10.3 6.8 11.8 5.5 11 3.8"
                    fill="none"
                    stroke="#1C1A18"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M16.5 8.5 C15.8 6.8 17.3 5.5 16.5 3.8"
                    fill="none"
                    stroke="#1C1A18"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>

                <div className="flex-1 space-y-2.5">
                  {isEn ? (
                    <p className="text-sm sm:text-base font-serif-literary text-[#524D46] leading-relaxed">
                      Great job, this is your{' '}
                      <span className="font-semibold text-[#1C1A18]">{displayStreak}</span>{' '}
                      {displayStreak === 1 ? 'day' : 'days'} in a row. It took you{' '}
                      <span className="font-semibold text-[#1C1A18]">
                        {writingTimeSeconds} {writingTimeSeconds === 1 ? 'second' : 'seconds'}
                      </span>{' '}
                      today and you wrote{' '}
                      <span className="font-semibold text-[#1C1A18]">
                        {wordCount} {wordCount === 1 ? 'word' : 'words'}
                      </span>
                      . That’s all for today, you can{' '}
                      <span className="inline-flex items-center gap-1.5 align-baseline">
                        {(hasPendingSparkle || sparkleTestMode) && onTriggerSparkle && (
                          <button
                            type="button"
                            onClick={onTriggerSparkle}
                            title="A Sparkle summary of your recent days awaits you!"
                            aria-label="Sparkle"
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#EBC5CF]/85 hover:bg-[#EBC5CF] border border-[#1C1A18] text-[#1C1A18] shadow-2xs animate-pulse cursor-pointer align-middle"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#8B2635]" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveBottomPage('archive')}
                          className="underline underline-offset-4 text-[#1C1A18] font-medium hover:text-[#8B2635] transition-colors cursor-pointer"
                        >
                          open your journal
                        </button>
                      </span>
                      {onSignOut && (
                        <>
                          {' '}
                          or{' '}
                          <button
                            type="button"
                            onClick={onSignOut}
                            className="underline underline-offset-4 text-[#1C1A18] font-medium hover:text-[#8B2635] transition-colors cursor-pointer"
                          >
                            log out
                          </button>
                        </>
                      )}{' '}
                      and get back to your day.
                    </p>
                  ) : isEs ? (
                    <p className="text-sm sm:text-base font-serif-literary text-[#524D46] leading-relaxed">
                      Excelente trabajo, este es tu{' '}
                      <span className="font-semibold text-[#1C1A18]">{displayStreak}.º</span> día
                      seguido. Hoy te tomó{' '}
                      <span className="font-semibold text-[#1C1A18]">
                        {writingTimeSeconds} {writingTimeSeconds === 1 ? 'segundo' : 'segundos'}
                      </span>{' '}
                      y escribiste{' '}
                      <span className="font-semibold text-[#1C1A18]">
                        {wordCount} {wordCount === 1 ? 'palabra' : 'palabras'}
                      </span>
                      . Eso es todo por hoy, puedes{' '}
                      <span className="inline-flex items-center gap-1.5 align-baseline">
                        {(hasPendingSparkle || sparkleTestMode) && onTriggerSparkle && (
                          <button
                            type="button"
                            onClick={onTriggerSparkle}
                            title="¡Un resumen Sparkle de tus últimos días te espera!"
                            aria-label="Sparkle"
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#EBC5CF]/85 hover:bg-[#EBC5CF] border border-[#1C1A18] text-[#1C1A18] shadow-2xs animate-pulse cursor-pointer align-middle"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#8B2635]" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveBottomPage('archive')}
                          className="underline underline-offset-4 text-[#1C1A18] font-medium hover:text-[#8B2635] transition-colors cursor-pointer"
                        >
                          ir al diario
                        </button>
                      </span>
                      {onSignOut && (
                        <>
                          {' '}
                          o{' '}
                          <button
                            type="button"
                            onClick={onSignOut}
                            className="underline underline-offset-4 text-[#1C1A18] font-medium hover:text-[#8B2635] transition-colors cursor-pointer"
                          >
                            cerrar sesión
                          </button>
                        </>
                      )}{' '}
                      y volver a tus actividades.
                    </p>
                  ) : isFr ? (
                    <p className="text-sm sm:text-base font-serif-literary text-[#524D46] leading-relaxed">
                      Excellent travail, c’est votre{' '}
                      <span className="font-semibold text-[#1C1A18]">{displayStreak}e</span> jour
                      consécutif. Cela vous a pris{' '}
                      <span className="font-semibold text-[#1C1A18]">
                        {writingTimeSeconds} {writingTimeSeconds === 1 ? 'seconde' : 'secondes'}
                      </span>{' '}
                      aujourd’hui et vous avez écrit{' '}
                      <span className="font-semibold text-[#1C1A18]">
                        {wordCount} {wordCount === 1 ? 'mot' : 'mots'}
                      </span>
                      . C’est tout pour aujourd’hui, vous pouvez{' '}
                      <span className="inline-flex items-center gap-1.5 align-baseline">
                        {(hasPendingSparkle || sparkleTestMode) && onTriggerSparkle && (
                          <button
                            type="button"
                            onClick={onTriggerSparkle}
                            title="Un résumé Sparkle de vos derniers jours vous attend !"
                            aria-label="Sparkle"
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#EBC5CF]/85 hover:bg-[#EBC5CF] border border-[#1C1A18] text-[#1C1A18] shadow-2xs animate-pulse cursor-pointer align-middle"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#8B2635]" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveBottomPage('archive')}
                          className="underline underline-offset-4 text-[#1C1A18] font-medium hover:text-[#8B2635] transition-colors cursor-pointer"
                        >
                          aller au journal
                        </button>
                      </span>
                      {onSignOut && (
                        <>
                          {' '}
                          ou{' '}
                          <button
                            type="button"
                            onClick={onSignOut}
                            className="underline underline-offset-4 text-[#1C1A18] font-medium hover:text-[#8B2635] transition-colors cursor-pointer"
                          >
                            vous déconnecter
                          </button>
                        </>
                      )}{' '}
                      et reprendre vos activités.
                    </p>
                  ) : (
                    <p className="text-sm sm:text-base font-serif-literary text-[#524D46] leading-relaxed">
                      Doskonała robota, to Twój{' '}
                      <span className="font-semibold text-[#1C1A18]">{displayStreak}</span> dzień z
                      rzędu. Zajęło Ci to dziś{' '}
                      <span className="font-semibold text-[#1C1A18]">
                        {writingTimeSeconds} {getPolishSecondsLabel(writingTimeSeconds)}
                      </span>{' '}
                      i napisałeś{' '}
                      <span className="font-semibold text-[#1C1A18]">
                        {wordCount} {getPolishWordsLabel(wordCount)}
                      </span>
                      . To koniec na dziś, możesz{' '}
                      <span className="inline-flex items-center gap-1.5 align-baseline">
                        {(hasPendingSparkle || sparkleTestMode) && onTriggerSparkle && (
                          <button
                            type="button"
                            onClick={onTriggerSparkle}
                            title="Kliknij gwiazdki — czeka na Ciebie kumplowskie podsumowanie ostatnich dni!"
                            aria-label="Sparkle"
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#EBC5CF]/85 hover:bg-[#EBC5CF] border border-[#1C1A18] text-[#1C1A18] shadow-2xs animate-pulse cursor-pointer align-middle"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#8B2635]" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveBottomPage('archive')}
                          className="underline underline-offset-4 text-[#1C1A18] font-medium hover:text-[#8B2635] transition-colors cursor-pointer"
                        >
                          przejść do dziennika
                        </button>
                      </span>
                      {onSignOut && (
                        <>
                          {' '}
                          albo{' '}
                          <button
                            type="button"
                            onClick={onSignOut}
                            className="underline underline-offset-4 text-[#1C1A18] font-medium hover:text-[#8B2635] transition-colors cursor-pointer"
                          >
                            wylogować się
                          </button>
                        </>
                      )}{' '}
                      i wrócić do swoich zajęć.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Main Question when Day is Sealed or Locked (in active writing mode, it lives in the Sticky Top Dock above) */}
            {(isSealed || decryptionError) && (
              <div className={`w-full select-none shrink-0 ${isSealed && !isDrawerOpen ? 'mb-4 sm:mb-5' : 'pt-4 mb-3'}`}>
                <h2
                  className={`w-full text-xl sm:text-2xl md:text-[26px] font-serif-literary font-normal leading-snug text-left transition-colors ${
                    isSealed ? 'text-[#9E978C]' : 'text-[#6E6961]'
                  }`}
                >
                  {activePromptText}
                </h2>
              </div>
            )}

            {/* Centered Writing Area + Desktop Left Margin Question aligned to ACTIVE WRITING CURSOR */}
            <div
              className={`relative w-full pt-1 ${
                isSealed && !isDrawerOpen ? 'flex-1 min-h-0 overflow-hidden' : ''
              }`}
            >
              {/* Desktop Left Hint: tracks the active writing cursor line (caretLineY) */}
              {!isLoadingEntry && !isSealed && !decryptionError && (
                <aside className="hidden lg:block lg:absolute lg:right-full lg:top-1 lg:mr-7 xl:mr-10 lg:w-60 xl:w-64 select-none z-10">
                  <div
                    ref={marginHintRef}
                    style={{
                      transform: `translateY(${caretLineY}px)`,
                    }}
                    className="transition-transform duration-150 ease-out"
                  >
                    {showMarginHints ? (
                      <div className="border-r border-[#DDD6C8] pr-3.5 py-1 flex items-start justify-between gap-2.5">
                        <div className="flex-1 flex items-start justify-between gap-2 text-[14.5px] font-serif-literary text-[#524D46] leading-snug">
                          <span className="italic flex-1 text-left">
                            {currentMarginQuestion}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyQuestionToText}
                            title={tr(
                              'Skopiuj pytanie do tekstu (pogrubioną kursywą)',
                              'Copy question into text (in bold italics)',
                              'Copiar pregunta al texto (en cursiva y negrita)',
                              'Copier la question dans le texte (en gras italique)'
                            )}
                            className="text-[#6E685F] hover:text-[#1C1A18] hover:bg-[#EAE5DA] px-1.5 py-0.5 rounded transition-colors font-mono font-normal shrink-0 text-sm mt-0.5 cursor-pointer"
                          >
                            →
                          </button>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          <button
                            type="button"
                            onClick={handleRotateQuestion}
                            title={tr(
                              'Zmień pytanie pomocnicze',
                              'Change follow-up question',
                              'Cambiar pregunta de seguimiento',
                              'Changer la question de suivi'
                            )}
                            className="p-1 rounded text-[#6E685F] hover:text-[#1C1A18] hover:bg-[#EAE5DA]/80 transition-colors cursor-pointer"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${isRotatingQuestion ? 'animate-spin' : ''}`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={handleToggleMarginHints}
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
                          onClick={handleToggleMarginHints}
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
                  </div>
                </aside>
              )}

              {isLoadingEntry ? (
                /* Smooth Decryption Loader directly below the title — prevents jumping from empty page to sealed/open entry */
                <div
                  className="w-full min-h-[260px] pt-3 flex flex-col justify-start gap-5 select-none animate-in fade-in duration-200"
                  aria-live="polite"
                >
                  <div className="inline-flex items-center gap-2.5 text-xs sm:text-sm font-mono-meta text-[#7A756D]">
                    <Lock className="w-3.5 h-3.5 text-[#8B2635]/80 animate-pulse" />
                    <span className="animate-pulse">
                      {tr(
                        'Rozszyfrowywanie wpisu...',
                        'Decrypting entry...',
                        'Descifrando entrada...',
                        'Déchiffrement de l’entrée...'
                      )}
                    </span>
                  </div>
                  <div className="space-y-3 pt-1 max-w-xl">
                    <div className="h-3.5 w-11/12 rounded bg-[#EAE5DA]/75 animate-pulse" />
                    <div className="h-3.5 w-4/5 rounded bg-[#EAE5DA]/60 animate-pulse" />
                    <div className="h-3.5 w-3/5 rounded bg-[#EAE5DA]/45 animate-pulse" />
                  </div>
                </div>
              ) : decryptionError ? (
                /* When key is missing or mismatched for today's entry: show encoded message + built-in window */
                renderEncodedMessageWithWindow(rawCiphertext, entryDeviceName, true)
              ) : isSealed ? (
                /* Sealed Day Text: visibly lighter locked tone (#968F84) + smooth transparent gradient fade */
                <div className="relative w-full h-full overflow-hidden select-none">
                  <div
                    style={{
                      WebkitMaskImage:
                        'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.5) 38%, rgba(0,0,0,0.18) 74%, rgba(0,0,0,0) 98%)',
                      maskImage:
                        'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.5) 38%, rgba(0,0,0,0.18) 74%, rgba(0,0,0,0) 98%)',
                    }}
                    className="w-full h-full font-serif-literary font-light text-lg sm:text-xl leading-relaxed whitespace-pre-wrap break-words p-0 text-[#968F84]"
                  >
                    {renderFormattedText(content, true)}
                  </div>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#F7F5F0] via-[#F7F5F0]/85 to-transparent flex items-end justify-center pb-2"
                  >
                    <span className="text-[11px] font-mono-meta text-[#8C857B] bg-[#FAF8F5]/90 px-3 py-1 rounded-full border border-[#E2DDD3] shadow-2xs">
                      {tr(
                        'Dzień jest zamknięty · Odblokuj przyciskiem poniżej',
                        'Day is sealed · Unlock using the button below',
                        'El día está cerrado · Desbloquea con el botón abajo',
                        'La journée est clôturée · Déverrouillez avec le bouton ci-dessous'
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="relative w-full pb-6 sm:pb-2">
                  {/* Hidden Caret Mirror */}
                  <div
                    ref={caretMirrorRef}
                    aria-hidden="true"
                    className="editor-sync-layer invisible pointer-events-none absolute top-0 left-0 w-full text-lg sm:text-xl leading-relaxed overflow-hidden p-0 m-0 border-0"
                  >
                    {textBeforeCursor ? renderFormattedText(textBeforeCursor, false, false) : null}
                    <span ref={caretMarkerRef}>&#8203;</span>
                  </div>

                  {/* Visible formatted backdrop layer */}
                  <div
                    ref={backdropRef}
                    aria-hidden="true"
                    className={`editor-sync-layer pointer-events-none absolute top-0 left-0 w-full text-lg sm:text-xl leading-relaxed overflow-hidden p-0 m-0 border-0 text-[#1C1A18] opacity-100 ${
                      content ? 'visible' : 'invisible'
                    }`}
                  >
                    {renderFormattedText(content)}
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={handleInput}
                    onSelect={syncCursorPos}
                    onPointerDown={() => {
                      userTappedEditorRef.current = true;
                    }}
                    onTouchStart={() => {
                      userTappedEditorRef.current = true;
                    }}
                    onClick={() => {
                      userTappedEditorRef.current = true;
                      syncCursorPos();
                      requestAnimationFrame(() => ensureMobileCursorVisible(false));
                    }}
                    onKeyUp={() => {
                      syncCursorPos();
                      requestAnimationFrame(() => ensureMobileCursorVisible(false));
                    }}
                    onKeyDown={() => requestAnimationFrame(syncCursorPos)}
                    onFocus={handleTextareaFocus}
                    onBlur={handleTextareaBlur}
                    onScroll={e => {
                      if (e.currentTarget.scrollTop !== 0) {
                        e.currentTarget.scrollTop = 0;
                      }
                    }}
                    placeholder={
                      isDictating
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
                    className={`editor-sync-layer relative z-10 w-full min-h-[150px] lg:min-h-[260px] bg-transparent border-0 outline-none resize-none overflow-hidden text-lg sm:text-xl leading-relaxed placeholder-[#B5B0A6] focus:ring-0 p-0 m-0 text-left selection:bg-[#E2DDD3]/50 ${
                      content
                        ? 'text-transparent caret-[#1C1A18]'
                        : 'text-[#1C1A18]'
                    }`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. CROCODILE & FULL-SCREEN SLIDING BOTTOM PAGES SECTION */}
      <div
        className={`w-full overflow-x-hidden flex flex-col items-center shrink-0 transition-all duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isDrawerOpen
            ? 'mt-0 pt-0'
            : isSealed
            ? 'mt-2 pt-1'
            : 'mt-4 lg:mt-6 pt-2 lg:pt-3'
        }`}
      >
        {/* "Zamknij dzień" placed ABOVE the horizontal line with small bottom padding */}
        {!isDrawerOpen && !isSealed && !decryptionError && (
          <div className="max-w-2xl mx-auto w-full px-2.5 sm:px-8 flex flex-col items-center pb-2.5 select-none">
            {closeCountdownProgress !== null ? (
              /* Short time indicator before closing so sealing is not immediate */
              <div className="relative overflow-hidden flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded border border-[#1C1A18] bg-[#FAF8F5] text-[11px] sm:text-xs font-mono-meta text-[#1C1A18] animate-in fade-in duration-150">
                <div
                  style={{ width: `${closeCountdownProgress}%` }}
                  className="pointer-events-none absolute inset-y-0 left-0 bg-[#EBC5CF]/55 transition-none"
                />
                <svg
                  viewBox="0 0 18 18"
                  className="relative z-10 w-3.5 h-3.5 shrink-0 text-[#8B2635]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="3.5" width="14" height="11" rx="1.8" />
                  <path d="M2.5 4.5 L9 9.5 L15.5 4.5" />
                </svg>
                <span className="relative z-10 tabular-nums">
                  {tr(
                    `Zamykanie dnia za ${Math.max(1, Math.ceil(((100 - closeCountdownProgress) / 100) * 3))}s...`,
                    `Closing day in ${Math.max(1, Math.ceil(((100 - closeCountdownProgress) / 100) * 3))}s...`,
                    `Cerrando en ${Math.max(1, Math.ceil(((100 - closeCountdownProgress) / 100) * 3))}s...`,
                    `Clôture dans ${Math.max(1, Math.ceil(((100 - closeCountdownProgress) / 100) * 3))}s...`
                  )}
                </span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    cancelCloseCountdown();
                  }}
                  className="relative z-10 ml-1 px-1.5 py-0.5 rounded bg-[#1C1A18] text-[#FAF8F5] hover:bg-[#8B2635] text-[10px] font-mono-meta transition-colors cursor-pointer"
                >
                  {tr('Anuluj', 'Cancel', 'Cancelar', 'Annuler')}
                </button>
              </div>
            ) : (
              /* Press-and-hold "Zamknij dzień" button in the unified light minimalist style */
              <button
                type="button"
                disabled={characterCount <= 0}
                onMouseDown={e => {
                  e.stopPropagation();
                  if (e.button === 0) startHoldClose();
                }}
                onMouseUp={e => {
                  e.stopPropagation();
                  cancelHoldClose();
                }}
                onMouseLeave={() => {
                  if (isHoldingClose) cancelHoldClose();
                }}
                onTouchStart={e => {
                  e.stopPropagation();
                  startHoldClose();
                }}
                onTouchEnd={e => {
                  e.stopPropagation();
                  cancelHoldClose();
                }}
                onTouchCancel={e => {
                  e.stopPropagation();
                  cancelHoldClose();
                }}
                onContextMenu={e => e.preventDefault()}
                title={
                  characterCount > 0
                    ? tr(
                        'Przytrzymaj chwilę, aby zamknąć dzisiejszy dzień',
                        'Press and hold briefly to close today’s entry',
                        'Mantén pulsado un momento para cerrar el día de hoy',
                        'Maintenez appuyé un instant pour clôturer la journée'
                      )
                    : tr(
                        'Napisz kilka słów, aby móc zamknąć dzisiejszy dzień',
                        'Write a few words first to close today’s entry',
                        'Escribe unas palabras primero para cerrar el día',
                        'Écrivez quelques mots d’abord pour clôturer la journée'
                      )
                }
                className={`group/seal relative overflow-hidden flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded border text-[11px] sm:text-xs font-mono-meta transition-colors select-none ${
                  characterCount <= 0
                    ? 'border-[#EAE5DA] bg-[#F5F2EB]/60 text-[#ABA497] opacity-60 cursor-not-allowed'
                    : isHoldingClose
                    ? 'border-[#1C1A18] bg-[#EAE5DA] text-[#1C1A18] cursor-pointer'
                    : 'border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] cursor-pointer'
                }`}
              >
                {holdCloseProgress > 0 && (
                  <div
                    style={{ width: `${holdCloseProgress}%` }}
                    className="pointer-events-none absolute inset-y-0 left-0 bg-[#EBC5CF]/65 transition-none"
                  />
                )}

                <svg
                  viewBox="0 0 18 18"
                  className="relative z-10 w-3.5 h-3.5 shrink-0 text-[#7A756D] group-hover/seal:text-[#8B2635] transition-colors"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="3.5" width="14" height="11" rx="1.8" />
                  <path d="M2.5 4.5 L9 9.5 L15.5 4.5" />
                  <circle cx="9" cy="10" r="1.6" fill="#EBC5CF" stroke="currentColor" strokeWidth="1.2" />
                </svg>

                <span className="relative z-10">
                  {isHoldingClose
                    ? tr('Przytrzymaj...', 'Keep holding...', 'Mantén...', 'Maintenez...')
                    : tr('Zamknij dzień', 'Close day', 'Cerrar día', 'Clôturer le jour')}
                </span>
              </button>
            )}
          </div>
        )}

        {/* "Odblokuj wpis" and "Podziel się myślą" placed side-by-side ABOVE the horizontal line when the day is sealed */}
        {!isDrawerOpen && isSealed && !decryptionError && (
          <div className="max-w-2xl mx-auto w-full px-2.5 sm:px-8 flex flex-nowrap items-center justify-center gap-1.5 sm:gap-2.5 pb-2.5 select-none animate-in fade-in duration-200">
            {unsealCountdownProgress !== null ? (
              /* Short time indicator before unsealing so opening is not accidental and can be cancelled */
              <div className="relative overflow-hidden flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded border border-[#1C1A18] bg-[#FAF8F5] text-[11px] sm:text-xs font-mono-meta text-[#1C1A18] animate-in fade-in duration-150">
                <div
                  style={{ width: `${unsealCountdownProgress}%` }}
                  className="pointer-events-none absolute inset-y-0 left-0 bg-[#D4E2D4]/70 transition-none"
                />
                <svg
                  viewBox="0 0 18 18"
                  className="relative z-10 w-3.5 h-3.5 shrink-0 text-[#3E7B44]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3.5" y="8" width="11" height="7.5" rx="1.8" />
                  <path d="M6 8 V5.5 C6 3.8 7.3 2.5 9 2.5 C10.4 2.5 11.5 3.3 11.9 4.5" />
                </svg>
                <span className="relative z-10 tabular-nums">
                  {tr(
                    `Odblokowywanie za ${Math.max(1, Math.ceil(((100 - unsealCountdownProgress) / 100) * 3))}s...`,
                    `Unlocking in ${Math.max(1, Math.ceil(((100 - unsealCountdownProgress) / 100) * 3))}s...`,
                    `Desbloqueando en ${Math.max(1, Math.ceil(((100 - unsealCountdownProgress) / 100) * 3))}s...`,
                    `Déverrouillage dans ${Math.max(1, Math.ceil(((100 - unsealCountdownProgress) / 100) * 3))}s...`
                  )}
                </span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    cancelUnsealCountdown();
                  }}
                  className="relative z-10 ml-1 px-1.5 py-0.5 rounded bg-[#1C1A18] text-[#FAF8F5] hover:bg-[#8B2635] text-[10px] font-mono-meta transition-colors cursor-pointer"
                >
                  {tr('Anuluj', 'Cancel', 'Cancelar', 'Annuler')}
                </button>
              </div>
            ) : (
              /* Press-and-hold "Odblokuj wpis" button in the unified light minimalist style */
              <button
                type="button"
                onMouseDown={e => {
                  e.stopPropagation();
                  if (e.button === 0) startHoldUnseal();
                }}
                onMouseUp={e => {
                  e.stopPropagation();
                  cancelHoldUnseal();
                }}
                onMouseLeave={() => {
                  if (isHoldingUnseal) cancelHoldUnseal();
                }}
                onTouchStart={e => {
                  e.stopPropagation();
                  startHoldUnseal();
                }}
                onTouchEnd={e => {
                  e.stopPropagation();
                  cancelHoldUnseal();
                }}
                onTouchCancel={e => {
                  e.stopPropagation();
                  cancelHoldUnseal();
                }}
                onContextMenu={e => e.preventDefault()}
                title={tr(
                  'Przytrzymaj chwilę, aby odblokować dzisiejszy wpis i móc dalej pisać',
                  'Press and hold briefly to unlock today’s entry and resume writing',
                  'Mantén pulsado un momento para desbloquear la entrada de hoy y seguir escribiendo',
                  'Maintenez appuyé un instant pour déverrouiller l’entrée du jour et continuer à écrire'
                )}
                className={`group/unseal relative overflow-hidden flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded border text-[11px] sm:text-xs font-mono-meta transition-colors select-none ${
                  isHoldingUnseal
                    ? 'border-[#1C1A18] bg-[#EAE5DA] text-[#1C1A18] cursor-pointer'
                    : 'border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] cursor-pointer'
                }`}
              >
                {holdUnsealProgress > 0 && (
                  <div
                    style={{ width: `${holdUnsealProgress}%` }}
                    className="pointer-events-none absolute inset-y-0 left-0 bg-[#D4E2D4]/70 transition-none"
                  />
                )}

                <svg
                  viewBox="0 0 18 18"
                  className="relative z-10 w-3.5 h-3.5 shrink-0 text-[#7A756D] group-hover/unseal:text-[#3E7B44] transition-colors"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3.5" y="8" width="11" height="7.5" rx="1.8" />
                  <path d="M6 8 V5.5 C6 3.8 7.3 2.5 9 2.5 C10.4 2.5 11.5 3.3 11.9 4.5" />
                </svg>

                <span className="relative z-10">
                  {isHoldingUnseal
                    ? tr('Przytrzymaj...', 'Keep holding...', 'Mantén...', 'Maintenez...')
                    : tr('Odblokuj wpis', 'Unlock entry', 'Desbloquear entrada', 'Déverrouiller l’entrée')}
                </span>
              </button>
            )}

            {/* "Podziel się myślą" button — unified light minimalist style right next to "Odblokuj wpis" */}
            {onOpenOneTimeShare && (
              <button
                type="button"
                onClick={() => onOpenOneTimeShare()}
                title={tr(
                  'Wyślij dzisiejszą myśl jednorazowym linkiem z kodem PIN i wyborem języka',
                  'Share today’s thought via a one-time PIN-protected link in your chosen language',
                  'Comparte el pensamiento de hoy mediante un enlace único con PIN e idioma a elegir',
                  'Partagez la pensée du jour via un lien unique protégé par PIN dans la langue choisie'
                )}
                className="group/share flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] text-[11px] sm:text-xs font-mono-meta transition-colors cursor-pointer whitespace-nowrap"
              >
                <svg
                  viewBox="0 0 18 18"
                  className="w-3.5 h-3.5 shrink-0 text-[#7A756D] group-hover/share:text-[#8B2635] transition-colors"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15.5 2.5 L8.2 9.8" />
                  <path d="M15.5 2.5 L10.8 15.5 L8.2 9.8 L2.5 7.2 Z" />
                </svg>
                <span>
                  {tr(
                    'Podziel się myślą',
                    'Share a thought',
                    'Compartir pensamiento',
                    'Partager une pensée'
                  )}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Centered Companion Desk + 2-line footer */}
        <div
          className={`max-w-2xl mx-auto w-full px-2.5 sm:px-8 flex flex-col items-center select-none ${
            !isDrawerOpen ? 'border-t border-[#EAE5DA]/70 pt-3' : 'pt-0'
          }`}
        >
          <div
            onTouchStart={e => {
              if (e.touches.length === 1) {
                handleCompanionPullStart(e.touches[0].clientY);
              }
            }}
            onTouchMove={e => {
              if (e.touches.length === 1) {
                handleCompanionPullMove(e.touches[0].clientY);
              }
            }}
            onTouchEnd={handleCompanionPullEnd}
            onTouchCancel={handleCompanionPullEnd}
            style={{
              transform:
                pullDownOffset > 0
                  ? `translateY(${pullDownOffset}px)`
                  : pullUpOffset > 0
                  ? `translateY(-${pullUpOffset}px)`
                  : undefined,
            }}
            className={`w-full flex flex-col items-center mb-1.5 touch-none sm:touch-auto ${
              pullDownOffset === 0 && pullUpOffset === 0
                ? 'transition-transform duration-300 ease-out'
                : ''
            }`}
          >
            {isDrawerOpen ? (
              <button
                type="button"
                onClick={() => {
                  if (!didPullDragRef.current) {
                    setActiveBottomPage('none');
                  }
                }}
                title={tr(
                  'Przeciągnij w dół lub dotknij, aby wrócić do pisania',
                  'Pull down or tap to return to writing',
                  'Arrastra hacia abajo o toca para volver a escribir',
                  'Tirez vers le bas ou touchez pour revenir à l’écriture'
                )}
                className="group/pull flex sm:hidden flex-col items-center gap-0.5 pt-1 pb-0.5 cursor-pointer select-none focus:outline-none"
              >
                <span
                  className={`w-8 h-1 rounded-full transition-colors duration-200 ${
                    pullDownOffset >= 24
                      ? 'bg-[#8B2635]'
                      : 'bg-[#D4CEBF] group-hover/pull:bg-[#9E978C]'
                  }`}
                />
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-mono-meta tracking-wide transition-colors duration-200 ${
                    pullDownOffset >= 24
                      ? 'text-[#8B2635] font-medium'
                      : 'text-[#9E978C] group-hover/pull:text-[#524D46]'
                  }`}
                >
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${
                      pullDownOffset >= 24 ? 'translate-y-0.5 text-[#8B2635]' : 'opacity-80'
                    }`}
                  />
                  <span>
                    {pullDownOffset >= 24
                      ? tr(
                          'Puść, aby pisać',
                          'Release to write',
                          'Suelta para escribir',
                          'Relâchez pour écrire'
                        )
                      : tr(
                          'Przeciągnij w dół do pisania',
                          'Pull down to write',
                          'Arrastra abajo para escribir',
                          'Tirez vers le bas pour écrire'
                        )}
                  </span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!didPullDragRef.current) {
                    setActiveBottomPage(effectiveLastBottomPage);
                  }
                }}
                title={tr(
                  `Przeciągnij w górę lub dotknij, aby otworzyć: ${effectiveLastTabLabel}`,
                  `Pull up or tap to open: ${effectiveLastTabLabel}`,
                  `Arrastra hacia arriba o toca para abrir: ${effectiveLastTabLabel}`,
                  `Tirez vers le haut ou touchez pour ouvrir : ${effectiveLastTabLabel}`
                )}
                className="group/pull flex sm:hidden flex-col items-center gap-0.5 pt-0.5 pb-0.5 cursor-pointer select-none focus:outline-none"
              >
                <span
                  className={`w-8 h-1 rounded-full transition-colors duration-200 ${
                    pullUpOffset >= 24
                      ? 'bg-[#8B2635]'
                      : 'bg-[#D4CEBF]/80 group-hover/pull:bg-[#9E978C]'
                  }`}
                />
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-mono-meta tracking-wide transition-colors duration-200 ${
                    pullUpOffset >= 24
                      ? 'text-[#8B2635] font-medium'
                      : 'text-[#9E978C]/90 group-hover/pull:text-[#524D46]'
                  }`}
                >
                  <ChevronUp
                    className={`w-3 h-3 transition-transform duration-200 ${
                      pullUpOffset >= 24 ? '-translate-y-0.5 text-[#8B2635]' : 'opacity-80'
                    }`}
                  />
                  <span>
                    {pullUpOffset >= 24
                      ? `${tr(
                          'Puść, aby otworzyć',
                          'Release to open',
                          'Suelta para abrir',
                          'Relâchez pour ouvrir'
                        )}: ${effectiveLastTabLabel}`
                      : `${tr(
                          'Przeciągnij w górę',
                          'Pull up',
                          'Arrastra arriba',
                          'Tirez vers le haut'
                        )} · ${effectiveLastTabLabel}`}
                  </span>
                </span>
              </button>
            )}
            <CompanionDesk
              companionId={companionId}
              isTyping={isTyping && !isDrawerOpen}
              isSealed={isSealed}
              isSearching={isDrawerOpen}
              lang={lang}
              onSelectCompanion={() => {
                if (!didPullDragRef.current) {
                  onSelectCompanion();
                }
              }}
            />
            {isDrawerOpen && (
              <div className="text-[11px] font-mono-meta text-[#7A756D] italic -mt-1 mb-1 transition-opacity duration-700">
                {activeBottomPage === 'archive' &&
                  tr(
                    'Przeglądanie dziennika...',
                    'Browsing your journal...',
                    'Explorando tu diario...',
                    'Exploration de votre journal...'
                  )}
                {activeBottomPage === 'stats' &&
                  tr(
                    'Sprawdzanie statystyk pisania...',
                    'Checking your writing stats...',
                    'Revisando estadísticas de escritura...',
                    'Consultation des statistiques d’écriture...'
                  )}
                {activeBottomPage === 'key' &&
                  tr(
                    'Sprawdzanie szyfrowania i klucza dziennika...',
                    'Inspecting encryption and journal key...',
                    'Revisando el cifrado y la clave del diario...',
                    'Vérification du chiffrement et de la clé du journal...'
                  )}
                {activeBottomPage === 'closeDay' &&
                  tr(
                    'Przygotowywanie zamknięcia dzisiejszego dnia...',
                    'Preparing to close today...',
                    'Preparando el cierre del día de hoy...',
                    'Préparation de la clôture de la journée...'
                  )}
              </div>
            )}
          </div>

          {/* Two-line footer & navigation bar directly below the crocodile */}
          <div className="w-full flex flex-col items-center gap-2.5 text-xs font-mono-meta text-[#7A756D] py-1">
            {/* Line 1: Statistics */}
            <div className="tabular-nums flex flex-wrap items-center justify-center gap-2 text-[11px] sm:text-xs">
              <span
                className={`flex items-center gap-1 ${
                  isTyping ? 'text-[#1C1A18] font-medium' : 'text-[#7A756D]'
                }`}
                title={tr(
                  'Czas pisania (liczy się wyłącznie podczas pisania)',
                  'Writing time (counts only while actively typing)',
                  'Tiempo de escritura (solo cuenta mientras escribes)',
                  'Temps d’écriture (ne compte que pendant la frappe)'
                )}
              >
                <Clock className={`w-3 h-3 ${isTyping ? 'text-[#3E7B44]' : 'text-[#9E978C]'}`} />
                <span>{formatWritingTime(writingTimeSeconds)}</span>
              </span>
              <span className="text-[#C8C2B4]">·</span>
              <span>
                {wordCount}{' '}
                {isEn
                  ? wordCount === 1
                    ? 'word'
                    : 'words'
                  : isEs
                  ? wordCount === 1
                    ? 'palabra'
                    : 'palabras'
                  : isFr
                  ? wordCount === 1
                    ? 'mot'
                    : 'mots'
                  : 'słów'}
              </span>
              <span className="text-[#C8C2B4]">·</span>
              <span>
                {characterCount}{' '}
                {isEn
                  ? characterCount === 1
                    ? 'char'
                    : 'chars'
                  : isEs
                  ? characterCount === 1
                    ? 'carácter'
                    : 'caracteres'
                  : isFr
                  ? characterCount === 1
                    ? 'caractère'
                    : 'caractères'
                  : 'znaków'}
              </span>

              {saveStatus === 'saving' && (
                <>
                  <span className="text-[#C8C2B4]">·</span>
                  <span className="animate-pulse text-[#7A756D]">
                    {tr('Zapisywanie...', 'Saving...', 'Guardando...', 'Enregistrement...')}
                  </span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <span className="text-[#C8C2B4]">·</span>
                  <span className="flex items-center gap-1 text-[#5E5A54]">
                    <Check className="w-3 h-3 text-[#3E7B44]" />
                    <span>{tr('Zapisano', 'Saved', 'Guardado', 'Enregistré')}</span>
                  </span>
                </>
              )}
              {saveStatus === 'offline' && (
                <>
                  <span className="text-[#C8C2B4]">·</span>
                  <span className="flex items-center gap-1 text-[#6F4E37]">
                    <WifiOff className="w-3 h-3 text-[#6F4E37]" />
                    <span>
                      {tr(
                        'Zapisano lokalnie (offline)',
                        'Saved locally (offline)',
                        'Guardado localmente (sin conexión)',
                        'Enregistré localement (hors ligne)'
                      )}
                    </span>
                  </span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <span className="text-[#C8C2B4]">·</span>
                  <span className="text-[#9E2A2B]">
                    {tr('Błąd zapisu', 'Save error', 'Error al guardar', 'Erreur de sauvegarde')}
                  </span>
                </>
              )}
            </div>

            {/* Line 2: 1. Dziennik, 2. Statystyki, 3. Klucz, 4. Wyloguj (always 1 line on mobile) + desktop Zamknij dzień */}
            <div className="w-full flex flex-nowrap sm:flex-wrap items-center justify-center gap-1.5 sm:gap-2.5 text-[11px] sm:text-xs">
              {/* 1. Sparkle ("Gwiazdki") przed Dziennikiem (tylko ikona gwiazdek) + Dziennik */}
              <div className="inline-flex items-center gap-1 shrink-0">
                {((isSealed && hasPendingSparkle) || sparkleTestMode) && onTriggerSparkle && (
                  <button
                    type="button"
                    onClick={onTriggerSparkle}
                    aria-label={tr('Karta docenienia', 'Appreciation card', 'Tarjeta de aprecio', 'Carte d’appréciation')}
                    title={tr(
                      'Kliknij, aby zobaczyć ciepłe docenienie Twoich ostatnich dni',
                      'Click to see a warm appreciation of your recent days',
                      'Haz clic para ver un resumen cálido de tus últimos días',
                      'Cliquez pour voir un résumé chaleureux de vos derniers jours'
                    )}
                    className="relative flex items-center justify-center px-2 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#8B2635] cursor-pointer transition-colors animate-pulse shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#8B2635] shrink-0" />
                  </button>
                )}

                <button
                  onClick={() =>
                    setActiveBottomPage(activeBottomPage === 'archive' ? 'none' : 'archive')
                  }
                  className={`flex items-center gap-1 sm:gap-1.5 transition-colors px-2 sm:px-2.5 py-1 rounded border cursor-pointer whitespace-nowrap shrink-0 ${
                    activeBottomPage === 'archive'
                      ? 'border-[#1C1A18] bg-[#EAE5DA] text-[#1C1A18] font-medium'
                      : 'border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] hover:text-[#1C1A18]'
                  }`}
                  title={tr(
                    'Przeglądaj zapisane wpisy w dzienniku',
                    'Browse saved entries in your journal',
                    'Explora las entradas guardadas en tu diario',
                    'Parcourir les entrées enregistrées dans votre journal'
                  )}
                >
                  <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#7A756D] shrink-0" />
                  <span>{tr('Dziennik', 'Journal', 'Diario', 'Journal')}</span>
                  <span className="text-[#9E978C]">({archiveCount})</span>
                </button>
              </div>

              {/* 2. Statystyki */}
              <button
                onClick={() =>
                  setActiveBottomPage(activeBottomPage === 'stats' ? 'none' : 'stats')
                }
                className={`flex items-center gap-1 sm:gap-1.5 transition-colors px-2 sm:px-2.5 py-1 rounded border cursor-pointer whitespace-nowrap shrink-0 ${
                  activeBottomPage === 'stats'
                    ? 'border-[#1C1A18] bg-[#EAE5DA] text-[#1C1A18] font-medium'
                    : 'border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] hover:text-[#1C1A18]'
                }`}
                title={tr(
                  'Zobacz systematyczność i liczbę napisanych słów',
                  'View consistency and word statistics',
                  'Ver constancia y estadísticas de palabras',
                  'Voir la régularité et les statistiques de mots'
                )}
              >
                <BarChart2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#7A756D] shrink-0" />
                <span>
                  {tr('Statystyki', 'Stats', 'Estadísticas', 'Statistiques')}
                </span>
              </button>

              {/* 3. Klucz */}
              <button
                onClick={() => setActiveBottomPage(activeBottomPage === 'key' ? 'none' : 'key')}
                title={
                  hasKey && !decryptionError
                    ? tr(
                        'Szyfrowanie E2EE włączone',
                        'E2EE encryption active',
                        'Cifrado E2EE activo',
                        'Chiffrement E2EE actif'
                      )
                    : tr(
                        'Ustaw klucz szyfrowania',
                        'Set encryption key',
                        'Configurar clave de cifrado',
                        'Configurer la clé de chiffrement'
                      )
                }
                className={`flex items-center gap-1 sm:gap-1.5 transition-colors px-2 sm:px-2.5 py-1 rounded border cursor-pointer whitespace-nowrap shrink-0 ${
                  activeBottomPage === 'key'
                    ? 'border-[#1C1A18] bg-[#EAE5DA] text-[#1C1A18] font-medium'
                    : decryptionError
                    ? 'border-[#8B2635]/50 bg-[#FDF2F2] text-[#8B2635]'
                    : 'border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] hover:text-[#1C1A18]'
                }`}
              >
                {hasKey && !decryptionError ? (
                  <>
                    <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#3E7B44] shrink-0" />
                    <span className="sm:hidden">{tr('Klucz', 'Key', 'Clave', 'Clé')}</span>
                    <span className="hidden sm:inline">{tr('Klucz E2EE', 'E2EE Key', 'Clave E2EE', 'Clé E2EE')}</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#8B2635] shrink-0" />
                    <span className="text-[#8B2635] sm:hidden">
                      {tr('Klucz', 'Key', 'Clave', 'Clé')}
                    </span>
                    <span className="text-[#8B2635] hidden sm:inline">
                      {tr('Dodaj klucz', 'Add key', 'Añadir clave', 'Ajouter une clé')}
                    </span>
                  </>
                )}
              </button>

              {/* 4. Wyloguj */}
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  title={tr('Wyloguj się z konta', 'Log out of your account', 'Cerrar sesión', 'Se déconnecter')}
                  className="flex items-center gap-1 sm:gap-1.5 transition-colors px-2 sm:px-2.5 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#FDF2F2] hover:text-[#9E2A2B] hover:border-[#9E2A2B]/30 cursor-pointer text-[#7A756D] whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span>{tr('Wyloguj', 'Log out', 'Salir', 'Déconnexion')}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. FULL-SCREEN DATA PAGES DIRECTLY UNDER THE CROCODILE */}
        <div
          className={`w-full grid transition-all duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isDrawerOpen
              ? 'grid-rows-[1fr] opacity-100 translate-y-0 mt-2 sm:mt-4'
              : 'grid-rows-[0fr] opacity-0 translate-y-10 pointer-events-none mt-0'
          }`}
        >
          <div className="min-h-0 overflow-hidden w-full">
            <div className="w-full px-5 sm:px-10 lg:px-16 xl:px-24 pt-4 sm:pt-6 pb-16 border-t border-[#E2DDD3]">
              {/* PAGE A: KLUCZ E2EE */}
              {activeBottomPage === 'key' && (
                <div className="w-full space-y-6 sm:space-y-8 text-left">
                  <div className="hidden md:flex flex-wrap items-center justify-between gap-4 border-b border-[#E2DDD3] pb-5">
                    <button
                      onClick={() => setActiveBottomPage('none')}
                      className="px-3.5 py-1.5 rounded text-xs font-mono-meta border border-[#DDD6C8] bg-[#F5F2EB] text-[#524D46] hover:bg-[#EAE5DA] hover:text-[#1C1A18] flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 whitespace-nowrap"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>
                        {tr(
                          'Powrót do pisania',
                          'Back to writing',
                          'Volver a escribir',
                          'Retour à l’écriture'
                        )}
                      </span>
                    </button>

                    <div className="ml-auto text-right">
                      <div className="text-xs font-mono-meta uppercase tracking-widest text-[#7A756D] mb-1">
                        {tr(
                          'Bezpieczeństwo i prywatność',
                          'Security & Privacy',
                          'Seguridad y Privacidad',
                          'Sécurité et confidentialité'
                        )}
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-serif-literary font-normal text-[#1C1A18]">
                        {tr(
                          'Klucz szyfrowania Dziennika (End-to-End Encryption)',
                          'Journal Encryption Key (End-to-End Encryption)',
                          'Clave de cifrado del Diario (End-to-End Encryption)',
                          'Clé de chiffrement du Journal (End-to-End Encryption)'
                        )}
                      </h2>
                    </div>
                  </div>

                  {/* Full-screen 12-column grid with vertical hairline divider */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start text-left">
                    {/* Left column: Zero-knowledge explanation & device recognition */}
                    <div className="lg:col-span-5 lg:border-r lg:border-[#E2DDD3] lg:pr-10 space-y-6">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="w-6 h-6 text-[#3E7B44] shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <h3 className="text-lg font-serif-literary font-medium text-[#1C1A18]">
                            {tr(
                              'Architektura Zero-Knowledge i rozpoznawanie urządzeń',
                              'Zero-Knowledge Architecture & Device Recognition',
                              'Arquitectura Zero-Knowledge y reconocimiento de dispositivos',
                              'Architecture Zero-Knowledge et reconnaissance des appareils'
                            )}
                          </h3>
                          <p className="text-sm sm:text-base font-serif-literary text-[#524D46] leading-relaxed">
                            {tr(
                              'Twoje wpisy są szyfrowane bezpośrednio w przeglądarce za pomocą algorytmu AES-GCM 256-bit (PBKDF2 100 000 iteracji). Zapisujemy również nazwę urządzenia, na którym utworzono klucz — dzięki temu na innym telefonie lub komputerze od razu wiesz, skąd skopiować klucz.',
                              'Your entries are encrypted directly in your browser using AES-GCM 256-bit (PBKDF2 100,000 iterations). We also save the name of the device where your key was created so you can easily recognize and copy it when switching devices.',
                              'Tus entradas se cifran directamente en el navegador mediante AES-GCM de 256 bits (PBKDF2 100.000 iteraciones). Además guardamos el nombre del dispositivo donde se creó la clave para que puedas reconocerlo y copiarla fácilmente.',
                              'Vos entrées sont chiffrées directement dans le navigateur avec AES-GCM 256 bits (PBKDF2 100 000 iterations). Nous enregistrons aussi le nom de l’appareil où la clé a été créée pour la retrouver facilement.'
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 pt-5 border-t border-[#E2DDD3]">
                        <div>
                          <div className="text-[11px] font-mono-meta uppercase text-[#7A756D]">
                            {tr('Status klucza', 'Key status', 'Estado de la clave', 'Statut de la clé')}
                          </div>
                          <div className="text-base font-serif-literary font-medium text-[#1C1A18] mt-1 flex items-center gap-1.5">
                            {hasKey && !decryptionError ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-[#3E7B44]" />
                                <span>
                                  {tr(
                                    'Aktywny (AES-256)',
                                    'Active (AES-256)',
                                    'Activa (AES-256)',
                                    'Active (AES-256)'
                                  )}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="w-2 h-2 rounded-full bg-[#8B2635]" />
                                <span>
                                  {tr(
                                    'Wymaga klucza z urządzenia',
                                    'Requires device key',
                                    'Requiere clave del dispositivo',
                                    'Clé de l’appareil requise'
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-mono-meta uppercase text-[#7A756D]">
                            {tr(
                              'Synchronizacja w chmurze',
                              'Cloud sync',
                              'Sincronización en la nube',
                              'Synchronisation cloud'
                            )}
                          </div>
                          <div className="text-base font-serif-literary font-medium text-[#1C1A18] mt-1 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#3E7B44]" />
                            <span>
                              {keySyncMode === 'pin'
                                ? tr(
                                    `Chronione własnym hasłem (${syncedKeysCount} kluczy)`,
                                    `Protected by custom password (${syncedKeysCount} keys)`,
                                    `Protegido con contraseña (${syncedKeysCount} claves)`,
                                    `Protégé par mot de passe (${syncedKeysCount} clés)`
                                  )
                                : tr(
                                    `Automatyczna z Google (${syncedKeysCount} ${
                                      syncedKeysCount === 1 ? 'klucz' : 'klucze'
                                    })`,
                                    `Auto with Google (${syncedKeysCount} ${
                                      syncedKeysCount === 1 ? 'key' : 'keys'
                                    })`,
                                    `Automática con Google (${syncedKeysCount} ${
                                      syncedKeysCount === 1 ? 'clave' : 'claves'
                                    })`,
                                    `Auto avec Google (${syncedKeysCount} ${
                                      syncedKeysCount === 1 ? 'clé' : 'clés'
                                    })`
                                  )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right column: Key configuration + Cloud Sync Mode + Device Name (borderless with hairline dividers) */}
                    <div className="lg:col-span-7 space-y-6 text-left">
                      {/* Cross-device Cloud Sync Section */}
                      <div className="pb-6 border-b border-[#E2DDD3] space-y-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-[#3E7B44]" />
                            <span className="text-xs sm:text-sm font-mono-meta font-medium text-[#1C1A18]">
                              {tr(
                                'Synchronizacja między telefonem a komputerem',
                                'Phone ↔ Computer Key Synchronization',
                                'Sincronización entre teléfono y ordenador',
                                'Synchronisation téléphone ↔ ordinateur'
                              )}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono-meta text-[#2E5C33] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3E7B44]" />
                            {keySyncMode === 'pin'
                              ? tr(
                                  'Tryb: Własne hasło / PIN',
                                  'Mode: Custom PIN',
                                  'Modo: PIN propio',
                                  'Mode : Code PIN personnel'
                                )
                              : tr(
                                  'Tryb: Automatyczny po zalogowaniu Google',
                                  'Mode: Automatic with Google login',
                                  'Modo: Automático con Google',
                                  'Mode : Automatique avec Google'
                                )}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm font-serif-literary text-[#524D46] leading-relaxed">
                          {tr(
                            'Domyślnie Twój pęk kluczy szyfrujących jest automatycznie zaszyfrowany i powiązany z Twoim logowaniem Google — dzięki temu na każdym nowym urządzeniu wpisy odblokowują się od razu bez psucia onboardingu. Jeśli chcesz, możesz dodatkowo ustawić własne proste hasło lub PIN.',
                            'By default, your encryption keyring is automatically encrypted and linked to your Google login — unlocking your entries immediately on any device with zero onboarding friction. Optionally, you can set a custom simple password or PIN.',
                            'Por defecto, tu llavero de cifrado se vincula automáticamente con tu inicio de sesión de Google para desbloquear tus entradas al instante en cualquier dispositivo. Opcionalmente puedes configurar una contraseña o PIN sencillo.',
                            'Par défaut, votre trousseau de clés est automatiquement chiffré et lié à votre compte Google pour déverrouiller vos entrées instantanément sur tout appareil. Vous pouvez aussi définir un mot de passe ou code PIN.'
                          )}
                        </p>

                        {onUpdateKeySyncMode && (
                          <div className="pt-1 space-y-2.5">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                              <input
                                type="password"
                                value={customPinInput}
                                onChange={e => {
                                  setCustomPinInput(e.target.value);
                                  setPinSavedStatus('idle');
                                }}
                                placeholder={tr(
                                  'Opcjonalnie: ustaw własne proste hasło lub PIN (min. 4 znaki)...',
                                  'Optional: set a simple custom password or PIN (min. 4 chars)...',
                                  'Opcional: configura una contraseña sencilla o PIN (mín. 4 caracteres)...',
                                  'Optionnel : définir un mot de passe ou PIN simple (min. 4 caractères)...'
                                )}
                                className="flex-1 px-3.5 py-2 text-xs sm:text-sm font-mono-meta bg-[#FAF8F5] border border-[#D4CEBF] rounded-lg focus:outline-none focus:border-[#1C1A18] text-[#1C1A18]"
                              />
                              <button
                                type="button"
                                disabled={customPinInput.trim().length < 4 || pinSavedStatus === 'saving'}
                                onClick={async () => {
                                  if (customPinInput.trim().length < 4) return;
                                  setPinSavedStatus('saving');
                                  await onUpdateKeySyncMode('pin', customPinInput.trim());
                                  setCustomPinInput('');
                                  setPinSavedStatus('saved');
                                  setTimeout(() => setPinSavedStatus('idle'), 3000);
                                }}
                                className="px-3.5 py-2 rounded border border-[#1C1A18] bg-[#1C1A18] hover:bg-[#33302B] disabled:opacity-40 text-[#FAF8F5] text-xs font-mono-meta cursor-pointer transition-colors whitespace-nowrap shrink-0"
                              >
                                {tr('Ustaw hasło / PIN', 'Set password / PIN', 'Guardar PIN', 'Définir le PIN')}
                              </button>
                              {keySyncMode === 'pin' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setPinSavedStatus('saving');
                                    await onUpdateKeySyncMode('auto');
                                    setPinSavedStatus('saved');
                                    setTimeout(() => setPinSavedStatus('idle'), 3000);
                                  }}
                                  className="px-3 py-2 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] text-xs font-mono-meta cursor-pointer transition-colors whitespace-nowrap shrink-0"
                                >
                                  {tr(
                                    'Wróć do trybu automatycznego',
                                    'Switch back to automatic mode',
                                    'Volver al modo automático',
                                    'Revenir au mode automatique'
                                  )}
                                </button>
                              )}
                            </div>
                            {pinSavedStatus === 'saved' && (
                              <div className="text-xs font-mono-meta text-[#2E5C33] flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5" />
                                <span>
                                  {tr(
                                    'Zapisano ustawienia synchronizacji klucza w chmurze!',
                                    'Cloud key sync settings saved!',
                                    '¡Ajustes de sincronización guardados en la nube!',
                                    'Paramètres de synchronisation enregistrés !'
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Device Name input separated by clean hairline */}
                      <div className="pb-6 border-b border-[#E2DDD3] space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="text-xs font-mono-meta text-[#524D46] flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5 text-[#6F4E37]" />
                            <span>
                              {tr(
                                'Nazwa tego urządzenia (widoczna, gdy brakuje klucza na innym urządzeniu):',
                                'This device name (shown when your key is needed on another device):',
                                'Nombre de este dispositivo (visible cuando falte la clave en otro dispositivo):',
                                'Nom de cet appareil (affiché si votre clé manque sur un autre appareil) :'
                              )}
                            </span>
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={deviceInput}
                            onChange={e => {
                              setDeviceInput(e.target.value);
                              if (onDeviceNameChange) {
                                onDeviceNameChange(e.target.value);
                              }
                            }}
                            placeholder={tr(
                              'np. MacBook Bartka, Telefon Android...',
                              'e.g. Bartek MacBook, Android Phone...',
                              'ej. MacBook de Bartek, Teléfono Android...',
                              'ex. MacBook de Bartek, Téléphone Android...'
                            )}
                            className="flex-1 px-3.5 py-2 text-sm font-mono-meta bg-[#FAF8F5] border border-[#D4CEBF] rounded focus:outline-none focus:border-[#1C1A18] text-[#1C1A18]"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <label className="text-sm font-mono-meta text-[#524D46] flex items-center gap-2">
                            <Key className="w-4 h-4 text-[#6F4E37]" />
                            <span>
                              {tr(
                                'Twój sekretny klucz do Dziennika:',
                                'Your secret Journal key:',
                                'Tu clave secreta del Diario:',
                                'Votre clé secrète du Journal :'
                              )}
                            </span>
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (!keyInput) return;
                                navigator.clipboard.writeText(keyInput);
                                setCopiedKey(true);
                                setTimeout(() => setCopiedKey(false), 2000);
                              }}
                              className="text-xs font-mono-meta text-[#524D46] hover:text-[#1C1A18] bg-[#F5F2EB] hover:bg-[#EAE5DA] border border-[#DDD6C8] px-2.5 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                            >
                              {copiedKey ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-[#3E7B44]" />
                                  <span>
                                    {tr('Skopiowano klucz!', 'Key copied!', '¡Clave copiada!', 'Clé copiée !')}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>
                                    {tr(
                                      `Skopiuj klucz (${deviceInput || currentDeviceName || 'Urządzenie'})`,
                                      `Copy key (${deviceInput || currentDeviceName || 'Device'})`,
                                      `Copiar clave (${deviceInput || currentDeviceName || 'Dispositivo'})`,
                                      `Copier la clé (${deviceInput || currentDeviceName || 'Appareil'})`
                                    )}
                                  </span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setKeyInput(generateJournalKey())}
                              className="text-xs font-mono-meta text-[#524D46] hover:text-[#1C1A18] bg-[#F5F2EB] hover:bg-[#EAE5DA] border border-[#DDD6C8] px-2.5 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>
                                {tr(
                                  'Wygeneruj nowy losowy klucz',
                                  'Generate new random key',
                                  'Generar nueva clave aleatoria',
                                  'Générer une nouvelle clé aléatoire'
                                )}
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="relative flex items-center">
                          <input
                            type={showKeyText ? 'text' : 'password'}
                            value={keyInput}
                            onChange={e => setKeyInput(e.target.value)}
                            placeholder={tr(
                              'Wprowadź lub wklej klucz z innego urządzenia...',
                              'Enter or paste your key from another device...',
                              'Introduce o pega la clave desde otro dispositivo...',
                              'Entrez ou collez la clé d’un autre appareil...'
                            )}
                            className="w-full px-4 py-3 text-base font-mono-meta bg-[#FAF8F5] border border-[#D4CEBF] rounded-lg focus:outline-none focus:border-[#1C1A18] text-[#1C1A18] pr-24"
                          />
                          <div className="absolute right-3 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setShowKeyText(!showKeyText)}
                              className="p-1.5 text-[#7A756D] hover:text-[#1C1A18] transition-colors cursor-pointer"
                              title={
                                showKeyText
                                  ? tr('Ukryj klucz', 'Hide key', 'Ocultar clave', 'Masquer la clé')
                                  : tr('Pokaż klucz', 'Show key', 'Mostrar clave', 'Afficher la clé')
                              }
                            >
                              {showKeyText ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!keyInput) return;
                                navigator.clipboard.writeText(keyInput);
                                setCopiedKey(true);
                                setTimeout(() => setCopiedKey(false), 2000);
                              }}
                              className="p-1.5 text-[#7A756D] hover:text-[#1C1A18] transition-colors cursor-pointer"
                              title={tr(
                                'Skopiuj klucz do schowka',
                                'Copy key to clipboard',
                                'Copiar clave al portapapeles',
                                'Copier la clé dans le presse-papiers'
                              )}
                            >
                              {copiedKey ? (
                                <Check className="w-4 h-4 text-[#3E7B44]" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer select-none text-sm font-serif-literary text-[#524D46] py-1">
                        <input
                          type="checkbox"
                          checked={persistKey}
                          onChange={e => setPersistKey(e.target.checked)}
                          className="w-4 h-4 rounded border-[#C8C2B4] text-[#1C1A18] focus:ring-0"
                        />
                        <span>
                          {tr(
                            'Zapamiętaj ten klucz w tej przeglądarce (automatyczne odkodowywanie wpisów przy kolejnych wizytach)',
                            'Remember this key in this browser (automatically decrypts entries on future visits)',
                            'Recordar esta clave en este navegador (descifra automáticamente las entradas en futuras visitas)',
                            'Mémoriser cette clé dans ce navigateur (déchiffre automatiquement les entrées lors des prochaines visites)'
                          )}
                        </span>
                      </label>

                      <div className="pt-4 border-t border-[#E2DDD3] flex flex-wrap items-center justify-end gap-4">
                        <button
                          onClick={() => {
                            if (!keyInput.trim()) return;
                            onSaveKey(
                              keyInput.trim(),
                              persistKey,
                              deviceInput.trim() || currentDeviceName || undefined
                            );
                            setActiveBottomPage('none');
                          }}
                          disabled={!keyInput.trim()}
                          className="px-5 py-2 text-xs font-mono-meta text-[#FAF8F5] bg-[#1C1A18] border border-[#1C1A18] rounded hover:bg-[#33302B] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {tr(
                            'Zastosuj klucz i zapisz urządzenie',
                            'Apply key & save device',
                            'Aplicar clave y guardar dispositivo',
                            'Appliquer la clé et enregistrer l’appareil'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PAGE B: DZIENNIK (JOURNAL) */}
              {activeBottomPage === 'archive' && (
                <div className="w-full space-y-6 sm:space-y-8 text-left">
                  <div className="hidden md:flex flex-wrap items-center justify-between gap-6 border-b border-[#E2DDD3] pb-5">
                    <button
                      onClick={() => setActiveBottomPage('none')}
                      className="px-3.5 py-1.5 rounded text-xs font-mono-meta border border-[#DDD6C8] bg-[#F5F2EB] text-[#524D46] hover:bg-[#EAE5DA] hover:text-[#1C1A18] flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 whitespace-nowrap"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>
                        {tr('Powrót do pisania', 'Back to writing', 'Volver a escribir', 'Retour à l’écriture')}
                      </span>
                    </button>

                    <div className="ml-auto text-right">
                      <div className="text-xs font-mono-meta uppercase tracking-widest text-[#7A756D] mb-1">
                        {tr(
                          'Zbiór zapisanych dni',
                          'Collection of written days',
                          'Colección de días escritos',
                          'Recueil des jours écrits'
                        )}
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-serif-literary font-normal text-[#1C1A18]">
                        {tr('Dziennik', 'Journal', 'Diario', 'Journal')}
                      </h2>
                      <div className="flex flex-wrap items-center justify-end gap-3 text-xs font-mono-meta text-[#7A756D] mt-1.5">
                        <span>
                          {savedEntries.length}{' '}
                          {isEn
                            ? savedEntries.length === 1
                              ? 'entry'
                              : 'entries'
                            : isEs
                            ? savedEntries.length === 1
                              ? 'entrada'
                              : 'entradas'
                            : isFr
                            ? savedEntries.length === 1
                              ? 'entrée'
                              : 'entrées'
                            : savedEntries.length === 1
                            ? 'wpis'
                            : 'wpisów'}
                        </span>
                        <span>·</span>
                        <span>
                          {totalArchiveWords} {tr('słów', 'words', 'palabras', 'mots')}
                        </span>
                        <span>·</span>
                        <span>
                          {formatWritingTime(totalArchiveSeconds)}{' '}
                          {tr('łącznie', 'total', 'en total', 'au total')}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-[#8B2635]">
                          <Lock className="w-3.5 h-3.5" />
                          {sealedArchiveCount}{' '}
                          {isEn
                            ? sealedArchiveCount === 1
                                ? 'closed day'
                                : 'closed days'
                            : isEs
                            ? sealedArchiveCount === 1
                              ? 'día cerrado'
                              : 'días cerrados'
                            : isFr
                            ? sealedArchiveCount === 1
                              ? 'jour clôturé'
                              : 'jours clôturés'
                            : 'zamkniętych dni'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Left column = Monthly Calendar (or centered collapsed burgundy date circle when entry is expanded); Right column = Selected Entry Text */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start text-left transition-all duration-500">
                    {/* LEFT COLUMN: Full Monthly Calendar OR Centered Collapsed Burgundy Date Circle + Month Label + Restore Button */}
                    {isJournalEntryExpanded && selectedArchiveEntry ? (
                      <div className="lg:col-span-3 xl:col-span-2 lg:border-r lg:border-[#E2DDD3] lg:pr-6 flex flex-col items-center justify-center text-center gap-3 py-4 animate-in fade-in duration-300">
                        <div
                          title={selectedArchiveEntry.date}
                          className="relative w-12 h-12 rounded-full bg-[#8B2635] text-[#FAF8F5] border-2 border-[#8B2635] ring-2 ring-[#8B2635]/30 ring-offset-2 ring-offset-[#F7F5F0] font-serif-literary text-base sm:text-lg font-medium flex flex-col items-center justify-center shadow-xs shrink-0 mx-auto"
                        >
                          <span className="leading-none">
                            {selectedArchiveEntry.date.split('-')[2]
                              ? parseInt(selectedArchiveEntry.date.split('-')[2], 10)
                              : selectedArchiveEntry.date}
                          </span>
                          {(sparklesByDate.get(selectedArchiveEntry.date)?.length || 0) > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FAF8F5] border border-[#8B2635] flex items-center justify-center shadow-2xs">
                              <Sparkles className="w-2.5 h-2.5 text-[#8B2635]" />
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-mono-meta text-[#524D46]">
                          {(() => {
                            const [yStr, mStr] = selectedArchiveEntry.date.split('-');
                            const mIdx = mStr ? parseInt(mStr, 10) - 1 : -1;
                            const mName =
                              mIdx >= 0 && mIdx < MONTH_NAMES.length
                                ? MONTH_NAMES[mIdx].toLowerCase()
                                : '';
                            const shortYr = yStr ? yStr.slice(-2) : '';
                            return shortYr && mName
                              ? `${shortYr} ${mName}`
                              : selectedArchiveEntry.date;
                          })()}
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsJournalEntryExpanded(false)}
                          title={tr(
                            'Przywróć normalny widok z kalendarzem',
                            'Restore normal calendar view',
                            'Restaurar vista normal con calendario',
                            'Rétablir la vue normale avec calendrier'
                          )}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] text-xs font-mono-meta transition-colors cursor-pointer mx-auto whitespace-nowrap"
                        >
                          <Calendar className="w-3.5 h-3.5 text-[#8B2635]" />
                          <span>
                            {tr('Pokaż kalendarz', 'Show calendar', 'Mostrar calendario', 'Afficher le calendrier')}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="lg:col-span-7 xl:col-span-8 lg:border-r lg:border-[#E2DDD3] lg:pr-10 space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between border-b border-[#E2DDD3] pb-4">
                          <div>
                            <div className="text-[11px] font-mono-meta uppercase tracking-wider text-[#7A756D]">
                              {tr('Kalendarz wpisów', 'Entries calendar', 'Calendario de entradas', 'Calendrier des entrées')}
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-serif-literary font-normal text-[#1C1A18] mt-0.5">
                              {MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}
                            </h3>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handlePrevCalendarMonth}
                              title={tr('Poprzedni miesiąc', 'Previous month', 'Mes anterior', 'Mois précédent')}
                              className="w-8 h-8 flex items-center justify-center rounded border border-[#DDD6C8] bg-[#F5F2EB] text-[#524D46] hover:bg-[#EAE5DA] hover:text-[#1C1A18] transition-colors cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={handleNextCalendarMonth}
                              title={tr('Następny miesiąc', 'Next month', 'Mes siguiente', 'Mois suivant')}
                              className="w-8 h-8 flex items-center justify-center rounded border border-[#DDD6C8] bg-[#F5F2EB] text-[#524D46] hover:bg-[#EAE5DA] hover:text-[#1C1A18] transition-colors cursor-pointer"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Weekday Labels */}
                        <div className="grid grid-cols-7 gap-2 text-center">
                          {WEEKDAY_NAMES.map(dayName => (
                            <div
                              key={dayName}
                              className="text-[11px] font-mono-meta uppercase tracking-wider text-[#9E978C] py-1"
                            >
                              {dayName}
                            </div>
                          ))}
                        </div>

                        {/* Calendar Days Grid */}
                        <div className="grid grid-cols-7 gap-2 sm:gap-3">
                          {calendarCells.map((cell, idx) => {
                            if (!cell.day || !cell.dateKey) {
                              return <div key={`empty-${idx}`} className="h-14 sm:h-16" />;
                            }

                            const hasEntry = Boolean(cell.entry);
                            const daySparkles = cell.sparkles || [];
                            const hasSparkle = daySparkles.length > 0;
                            const isInteractive = hasEntry || hasSparkle;
                            const isSelected = Boolean(
                              cell.dateKey &&
                                (cell.dateKey === selectedDateKey ||
                                  (hasEntry && selectedArchiveEntry?.id === cell.entry?.id))
                            );
                            const isSealedDay = Boolean(cell.entry?.isSealed);

                            return (
                              <div
                                key={cell.dateKey}
                                className="h-14 sm:h-16 flex flex-col items-center justify-center"
                              >
                                <button
                                  type="button"
                                  disabled={!isInteractive}
                                  onClick={() => {
                                    if (cell.entry) {
                                      setSelectedEntryId(cell.entry.id);
                                      setConfirmDeleteId(null);
                                    } else if (cell.dateKey) {
                                      setSelectedEntryId(cell.dateKey);
                                      setConfirmDeleteId(null);
                                    }
                                  }}
                                  title={
                                    hasEntry && hasSparkle
                                      ? `${cell.dateKey} — ${cell.entry?.wordCount || 0} ${tr(
                                          'słów · Gwiazdka Sparkle',
                                          'words · Sparkle card',
                                          'palabras · Sparkle',
                                          'mots · Sparkle'
                                        )}`
                                      : hasEntry
                                      ? `${cell.dateKey} — ${cell.entry?.wordCount || 0} ${tr(
                                          'słów',
                                          'words',
                                          'palabras',
                                          'mots'
                                        )}`
                                      : hasSparkle
                                      ? `${cell.dateKey} — Sparkle`
                                      : cell.dateKey
                                  }
                                  className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex flex-col items-center justify-center transition-all ${
                                    isSelected
                                      ? isSealedDay
                                        ? 'bg-[#8B2635] text-[#FAF8F5] border-2 border-[#8B2635] ring-2 ring-[#8B2635]/30 ring-offset-2 ring-offset-[#F7F5F0] font-medium cursor-pointer shadow-xs'
                                        : 'bg-[#1C1A18] text-[#FAF8F5] border-2 border-[#1C1A18] ring-2 ring-[#1C1A18]/25 ring-offset-2 ring-offset-[#F7F5F0] font-medium cursor-pointer shadow-xs'
                                      : hasEntry
                                      ? isSealedDay
                                        ? 'border-2 border-[#8B2635] text-[#8B2635] bg-[#FAF8F5] hover:bg-[#8B2635]/10 font-medium cursor-pointer'
                                        : 'border-2 border-[#1C1A18] text-[#1C1A18] bg-[#FAF8F5] hover:bg-[#EAE5DA] font-medium cursor-pointer'
                                      : hasSparkle
                                      ? 'border-2 border-dashed border-[#8B2635] text-[#8B2635] bg-[#FAF8F5] hover:bg-[#EBC5CF]/30 font-medium cursor-pointer'
                                      : 'text-[#B5AEA2] cursor-default'
                                  }`}
                                >
                                  <span className="text-sm sm:text-base font-serif-literary leading-none">
                                    {cell.day}
                                  </span>

                                  {hasSparkle && (
                                    <span
                                      className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border shadow-2xs ${
                                        isSelected
                                          ? 'bg-[#FAF8F5] border-[#8B2635] text-[#8B2635]'
                                          : 'bg-[#EBC5CF] border-[#1C1A18] text-[#1C1A18]'
                                      }`}
                                    >
                                      <Sparkles className="w-2.5 h-2.5" />
                                    </span>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Subtle Calendar Legend */}
                        <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-[#E2DDD3] text-xs font-mono-meta text-[#7A756D]">
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border-2 border-[#1C1A18] bg-[#FAF8F5] inline-block" />
                            <span>
                              {tr('Dzień z wpisem', 'Day with entry', 'Día con entrada', 'Jour avec entrée')}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border-2 border-[#8B2635] bg-[#FAF8F5] inline-block" />
                            <span>{tr('Dzień zamknięty', 'Closed day', 'Día cerrado', 'Jour clôturé')}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-[#1C1A18] inline-block" />
                            <span>{tr('Wybrany dzień', 'Selected day', 'Día seleccionado', 'Jour sélectionné')}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border border-[#1C1A18] bg-[#EBC5CF] inline-flex items-center justify-center">
                              <Sparkles className="w-2.5 h-2.5 text-[#1C1A18]" />
                            </span>
                            <span>{tr('Karta docenienia', 'Appreciation card', 'Tarjeta de aprecio', 'Carte d’appréciation')}</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* RIGHT COLUMN: Selected Entry Content + Expand/Delete Actions */}
                    <div
                      className={`${
                        isJournalEntryExpanded && selectedArchiveEntry
                          ? 'lg:col-span-9 xl:col-span-10'
                          : 'lg:col-span-5 xl:col-span-4'
                      } min-h-[320px] text-left transition-all duration-500`}
                    >
                      {selectedArchiveEntry ? (
                        <div className="space-y-5">
                          <div className="border-b border-[#E2DDD3] pb-4 space-y-2.5">
                            {/* Line 1: Date · Word count · Writing time · Device name */}
                            <div className="flex flex-wrap items-center gap-2 text-xs font-mono-meta text-[#7A756D]">
                              <span className="flex items-center gap-1.5 text-sm text-[#1C1A18] font-medium">
                                <Calendar className="w-4 h-4 text-[#7A756D]" />
                                {selectedArchiveEntry.date}
                              </span>
                              <span>·</span>
                              <span>
                                {selectedArchiveEntry.wordCount || 0}{' '}
                                {tr('słów', 'words', 'palabras', 'mots')}
                              </span>
                              <span>·</span>
                              <span>
                                {formatWritingTime(selectedArchiveEntry.writingTimeSeconds || 0)}
                              </span>
                              {(selectedArchiveEntry.deviceName || currentDeviceName) && (
                                <>
                                  <span>·</span>
                                  <span className="inline-flex items-center gap-1 text-[#524D46]">
                                    <Smartphone className="w-3 h-3" />
                                    {selectedArchiveEntry.deviceName || currentDeviceName}
                                  </span>
                                </>
                              )}
                              <span>·</span>
                              <span className="inline-flex items-center gap-1 text-xs font-mono-meta text-[#8B2635] font-medium">
                                <Lock className="w-3 h-3" />
                                <span>{tr('Zamknięty', 'Closed', 'Cerrado', 'Clôturé')}</span>
                              </span>
                            </div>

                            {/* Line 2: Action buttons in a single line (Usuń wpis + Rozwiń wpis + Podziel się myślą) */}
                            <div className="flex flex-nowrap items-center justify-start gap-1.5 pt-0.5 overflow-x-auto no-scrollbar">
                              {onDeleteEntry && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {confirmDeleteId === selectedArchiveEntry.id ? (
                                    <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#9E2A2B]/35 px-2 py-1 rounded text-[11px] font-mono-meta whitespace-nowrap">
                                      <span className="text-[#9E2A2B]">
                                        {tr('Usunąć?', 'Delete?', '¿Eliminar?', 'Supprimer ?')}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const idToDelete = selectedArchiveEntry.id;
                                          setConfirmDeleteId(null);
                                          onDeleteEntry(idToDelete);
                                        }}
                                        className="px-2 py-0.5 rounded bg-[#9E2A2B] text-white hover:bg-[#7D2021] transition-colors cursor-pointer font-medium"
                                      >
                                        {tr('Tak', 'Yes', 'Sí', 'Oui')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(null)}
                                        className="px-1.5 py-0.5 rounded text-[#524D46] hover:bg-[#EAE5DA] transition-colors cursor-pointer"
                                      >
                                        {tr('Nie', 'No', 'No', 'Non')}
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(selectedArchiveEntry.id)}
                                      title={tr(
                                        'Usuń ten wpis',
                                        'Delete this entry',
                                        'Eliminar esta entrada',
                                        'Supprimer cette entrée'
                                      )}
                                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[11px] font-mono-meta text-[#524D46] hover:text-[#9E2A2B] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-[#7A756D] shrink-0" />
                                      <span>
                                        {tr('Usuń wpis', 'Delete entry', 'Eliminar entrada', 'Supprimer')}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Expand / Collapse entry button */}
                              <button
                                type="button"
                                onClick={() => setIsJournalEntryExpanded(!isJournalEntryExpanded)}
                                title={
                                  isJournalEntryExpanded
                                    ? tr(
                                        'Zwiń wpis i przywróć kalendarz',
                                        'Collapse entry and show calendar',
                                        'Contraer entrada y mostrar calendario',
                                        'Réduire l’entrée et afficher le calendrier'
                                      )
                                    : tr(
                                        'Rozwiń wpis na pełną szerokość',
                                        'Expand entry to full width',
                                        'Expandir entrada a pantalla completa',
                                        'Agrandir l’entrée sur toute la largeur'
                                      )
                                }
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[11px] font-mono-meta text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                              >
                                {isJournalEntryExpanded ? (
                                  <>
                                    <Minimize2 className="w-3.5 h-3.5 text-[#7A756D] shrink-0" />
                                    <span>
                                      {tr('Zwiń wpis', 'Collapse entry', 'Contraer', 'Réduire')}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Maximize2 className="w-3.5 h-3.5 text-[#7A756D] shrink-0" />
                                    <span>
                                      {tr('Rozwiń wpis', 'Expand entry', 'Expandir', 'Agrandir')}
                                    </span>
                                  </>
                                )}
                              </button>

                              {/* "Podziel się myślą" button for any saved/closed entry in the Journal */}
                              {selectedArchiveEntry.decryptedContent &&
                                !selectedArchiveEntry.decryptionError &&
                                onOpenOneTimeShare && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenOneTimeShare({
                                        content: selectedArchiveEntry.decryptedContent || '',
                                        promptText: matchedArchivePrompt
                                          ? getPromptText(matchedArchivePrompt, lang)
                                          : '',
                                        date: selectedArchiveEntry.date,
                                      })
                                    }
                                    title={tr(
                                      'Wyślij tę myśl z dziennika jednorazowym linkiem z kodem PIN i wyborem języka',
                                      'Share this thought via a one-time PIN-protected link in your chosen language',
                                      'Comparte este pensamiento del diario mediante un enlace único con PIN',
                                      'Partagez cette pensée du journal via un lien unique protégé par PIN'
                                    )}
                                    className="group/share inline-flex items-center gap-1.5 px-2 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[11px] font-mono-meta text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                                  >
                                    <svg
                                      viewBox="0 0 18 18"
                                      className="w-3.5 h-3.5 shrink-0 text-[#7A756D] group-hover/share:text-[#8B2635] transition-colors"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-hidden="true"
                                    >
                                      <path d="M15.5 2.5 L8.2 9.8" />
                                      <path d="M15.5 2.5 L10.8 15.5 L8.2 9.8 L2.5 7.2 Z" />
                                    </svg>
                                    <span>
                                      {tr(
                                        'Podziel się myślą',
                                        'Share a thought',
                                        'Compartir pensamiento',
                                        'Partager une pensée'
                                      )}
                                    </span>
                                  </button>
                                )}
                            </div>

                            {matchedArchivePrompt && (
                              <h3 className="text-lg sm:text-xl font-serif-literary italic text-[#6E6961] leading-snug pt-1">
                                {matchedArchivePrompt.id === FREE_THOUGHT_PROMPT_ID
                                  ? getPromptText(matchedArchivePrompt, lang)
                                  : `„${getPromptText(matchedArchivePrompt, lang)}”`}
                              </h3>
                            )}
                          </div>

                          {selectedArchiveEntry.decryptedContent &&
                          !selectedArchiveEntry.decryptionError ? (
                            isJournalEntryExpanded ? (
                              <div className="text-base sm:text-lg font-serif-literary text-[#1C1A18] leading-relaxed whitespace-pre-wrap break-words">
                                {renderFormattedText(selectedArchiveEntry.decryptedContent, false, true, true)}
                              </div>
                            ) : (
                              <div className="relative max-h-[320px] sm:max-h-[360px] overflow-hidden">
                                <div
                                  style={{
                                    WebkitMaskImage:
                                      'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.25) 85%, rgba(0,0,0,0) 100%)',
                                    maskImage:
                                      'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.25) 85%, rgba(0,0,0,0) 100%)',
                                  }}
                                  className="text-base sm:text-lg font-serif-literary text-[#1C1A18] leading-relaxed whitespace-pre-wrap break-words"
                                >
                                  {renderFormattedText(selectedArchiveEntry.decryptedContent, false, true, true)}
                                </div>
                                <div
                                  aria-hidden="true"
                                  className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#F7F5F0] via-[#F7F5F0]/85 to-transparent"
                                />
                              </div>
                            )
                          ) : (
                            /* When archived entry cannot be decrypted: show encoded message + built-in window asking for key from device XYZ */
                            renderEncodedMessageWithWindow(
                              selectedArchiveEntry.encryptedContent,
                              selectedArchiveEntry.deviceName || entryDeviceName
                            )
                          )}

                          {/* Sparkle appreciation cards created on this selected day */}
                          {selectedDaySparkles.length > 0 && (
                            <div className="pt-4 border-t border-[#E2DDD3] space-y-3">
                              {selectedDaySparkles.map(sc => (
                                <div
                                  key={sc.id}
                                  className="p-4 sm:p-5 rounded-xl bg-[#FAF8F5] border border-[#8B2635]/30 space-y-2.5 shadow-2xs"
                                >
                                  <div className="flex items-center justify-between text-[11px] font-mono-meta text-[#8B2635]">
                                    <span className="inline-flex items-center gap-1.5 font-medium">
                                      <Sparkles className="w-3.5 h-3.5" />
                                      <span>
                                        {tr(
                                          'Karta docenienia',
                                          'Appreciation Card',
                                          'Tarjeta de aprecio',
                                          'Carte d’appréciation'
                                        )}
                                      </span>
                                    </span>
                                    <span>{sc.periodLabel || sc.date}</span>
                                  </div>
                                  <div className="text-base font-serif-literary font-medium text-[#1C1A18]">
                                    {sc.greeting}
                                  </div>
                                  <div className="text-sm sm:text-base font-serif-literary text-[#3D3934] leading-relaxed whitespace-pre-wrap">
                                    {sc.content}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : selectedDateKey && selectedDaySparkles.length > 0 ? (
                        <div className="space-y-5">
                          <div className="border-b border-[#E2DDD3] pb-4 space-y-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-mono-meta text-[#7A756D]">
                              <span className="flex items-center gap-1.5 text-sm text-[#1C1A18] font-medium">
                                <Calendar className="w-4 h-4 text-[#7A756D]" />
                                {selectedDateKey}
                              </span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1 text-[#8B2635] font-medium">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>
                                  {tr(
                                    'Karta docenienia',
                                    'Appreciation Card',
                                    'Tarjeta de aprecio',
                                    'Carte d’appréciation'
                                  )}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="space-y-4">
                            {selectedDaySparkles.map(sc => (
                              <div
                                key={sc.id}
                                className="p-4 sm:p-5 rounded-xl bg-[#FAF8F5] border border-[#8B2635]/30 space-y-3 shadow-2xs"
                              >
                                <div className="flex items-center justify-between text-[11px] font-mono-meta text-[#8B2635]">
                                  <span className="inline-flex items-center gap-1 font-medium">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>{sc.periodLabel || sc.date}</span>
                                  </span>
                                  <span className="text-[#7A756D]">{sc.date}</span>
                                </div>
                                <div className="text-base sm:text-lg font-serif-literary font-medium text-[#1C1A18]">
                                  {sc.greeting}
                                </div>
                                <div className="text-sm sm:text-base font-serif-literary text-[#3D3934] leading-relaxed whitespace-pre-wrap">
                                  {sc.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 text-base font-serif-literary text-[#7A756D] italic">
                          {tr(
                            'Brak zapisanych wpisów w dzienniku. Twój dzisiejszy wpis pojawi się w kalendarzu po rozpoczęciu pisania.',
                            'No entries saved in your journal yet. Today’s entry will appear on the calendar once you start writing.',
                            'Aún no hay entradas guardadas en tu diario. Tu entrada de hoy aparecerá en el calendario en cuanto empieces a escribir.',
                            'Aucune entrée enregistrée dans votre journal pour l’instant. Votre entrée d’aujourd’hui apparaîtra sur le calendrier dès que vous commencerez à écrire.'
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* PAGE C: STATYSTYKI PISANIA (BORDERLESS WITH HAIRLINE DIVIDERS) */}
              {activeBottomPage === 'stats' && (
                <div className="w-full space-y-6 sm:space-y-8 text-left">
                  <div className="hidden md:flex flex-wrap items-center justify-between gap-6 border-b border-[#E2DDD3] pb-5">
                    <button
                      onClick={() => setActiveBottomPage('none')}
                      className="px-3.5 py-1.5 rounded text-xs font-mono-meta border border-[#DDD6C8] bg-[#F5F2EB] text-[#524D46] hover:bg-[#EAE5DA] hover:text-[#1C1A18] flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 whitespace-nowrap"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>
                        {tr('Powrót do pisania', 'Back to writing', 'Volver a escribir', 'Retour à l’écriture')}
                      </span>
                    </button>

                    <div className="ml-auto text-right">
                      <div className="text-xs font-mono-meta uppercase tracking-widest text-[#7A756D] mb-1">
                        {tr('Twój rytm i słowa', 'Your rhythm & words', 'Tu ritmo y palabras', 'Votre rythme et vos mots')}
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-serif-literary font-normal text-[#1C1A18]">
                        {tr('Statystyki pisania', 'Writing Statistics', 'Estadísticas de escritura', 'Statistiques d’écriture')}
                      </h2>
                    </div>
                  </div>

                  {/* 4 Key Minimalist Metrics — separated by clean hairline lines instead of boxes */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-6 sm:gap-x-8 pb-8 border-b border-[#E2DDD3]">
                    <div className="space-y-1 pr-4 border-r border-[#E2DDD3]">
                      <div className="text-[11px] font-mono-meta uppercase tracking-wider text-[#7A756D]">
                        {tr('Systematyczność', 'Consistency', 'Constancia', 'Régularité')}
                      </div>
                      <div className="text-2xl sm:text-3xl font-serif-literary text-[#1C1A18] tabular-nums">
                        {displayStreak}{' '}
                        <span className="text-sm font-mono-meta text-[#7A756D]">
                          {isEn
                            ? displayStreak === 1
                              ? 'day'
                              : 'days'
                            : isEs
                            ? displayStreak === 1
                              ? 'día'
                              : 'días'
                            : isFr
                            ? displayStreak === 1
                              ? 'jour'
                              : 'jours'
                            : displayStreak === 1
                            ? 'dzień z rzędu'
                            : 'dni z rzędu'}
                        </span>
                      </div>
                      <div className="text-xs font-mono-meta text-[#7A756D] pt-1">
                        {activeInLast7Days}/7 {tr('dni w tym tyg.', 'days this week', 'días esta sem.', 'jours cette sem.')}
                      </div>
                    </div>

                    <div className="space-y-1 lg:pr-4 lg:border-r lg:border-[#E2DDD3]">
                      <div className="text-[11px] font-mono-meta uppercase tracking-wider text-[#7A756D]">
                        {tr('Napisane słowa', 'Words written', 'Palabras escritas', 'Mots écrits')}
                      </div>
                      <div className="text-2xl sm:text-3xl font-serif-literary text-[#1C1A18] tabular-nums">
                        {totalArchiveWords}{' '}
                        <span className="text-sm font-mono-meta text-[#7A756D]">
                          {tr('słów', 'words', 'palabras', 'mots')}
                        </span>
                      </div>
                      <div className="text-xs font-mono-meta text-[#7A756D] pt-1">
                        ~{avgWordsPerEntry} {tr('słów / wpis', 'words / entry', 'palabras / entrada', 'mots / entrée')}
                      </div>
                    </div>

                    <div className="space-y-1 pr-4 border-r border-[#E2DDD3]">
                      <div className="text-[11px] font-mono-meta uppercase tracking-wider text-[#7A756D]">
                        {tr('Zapisane dni', 'Saved days', 'Días guardados', 'Jours enregistrés')}
                      </div>
                      <div className="text-2xl sm:text-3xl font-serif-literary text-[#1C1A18] tabular-nums">
                        {savedEntries.length}{' '}
                        <span className="text-sm font-mono-meta text-[#7A756D]">
                          {isEn
                            ? savedEntries.length === 1
                              ? 'entry'
                              : 'entries'
                            : isEs
                            ? savedEntries.length === 1
                              ? 'entrada'
                              : 'entradas'
                            : isFr
                            ? savedEntries.length === 1
                              ? 'entrée'
                              : 'entrées'
                            : savedEntries.length === 1
                            ? 'wpis'
                            : 'wpisów'}
                        </span>
                      </div>
                      <div className="text-xs font-mono-meta text-[#8B2635] pt-1 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>
                          {sealedArchiveCount} {tr('zamkniętych', 'closed', 'cerrados', 'clôturés')}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-mono-meta uppercase tracking-wider text-[#7A756D]">
                        {tr('Czas pisania', 'Writing time', 'Tiempo de escritura', 'Temps d’écriture')}
                      </div>
                      <div className="text-2xl sm:text-3xl font-serif-literary text-[#1C1A18] tabular-nums">
                        {formatWritingTime(totalArchiveSeconds)}
                      </div>
                      <div className="text-xs font-mono-meta text-[#7A756D] pt-1">
                        {tr('aktywnego pisania', 'active writing', 'escritura activa', 'd’écriture active')}
                      </div>
                    </div>
                  </div>

                  {/* Compact 7-Day Line-Art Charts (Logo & Companion Style) */}
                  <div className="max-w-lg mx-auto w-full pt-2 space-y-6">
                    {/* CHART 1: 7-Day Word Rhythm (Linear, delicate line-art style) */}
                    <div className="space-y-3 p-4 sm:p-5 rounded-2xl border border-transparent hover:border-[#E2DDD3] hover:bg-[#FAF8F5]/85 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(28,26,24,0.1)] group">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <svg
                              viewBox="0 0 24 20"
                              className="w-5 h-4 shrink-0 overflow-visible"
                              aria-hidden="true"
                            >
                              <circle
                                cx="17"
                                cy="6.5"
                                r="4"
                                fill="#EBC5CF"
                                stroke="#1C1A18"
                                strokeWidth="1.6"
                              />
                              <path
                                d="M2 16 C6 16 8 9 12 10 C15 11 17 5 22 5"
                                fill="none"
                                stroke="#1C1A18"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                              />
                            </svg>
                            <h3 className="text-base font-serif-literary font-medium text-[#1C1A18]">
                              {tr(
                                'Rytm tygodnia · Liczba słów',
                                'Weekly rhythm · Word count',
                                'Ritmo semanal · Palabras',
                                'Rythme hebdomadaire · Mots'
                              )}
                            </h3>
                          </div>
                          <p className="text-[11px] font-mono-meta text-[#7A756D] mt-0.5">
                            {recent7Days[0]?.shortLabel} – {recent7Days[6]?.shortLabel} ·{' '}
                            {tr(
                              'różowe kółko oznacza zamknięty dzień',
                              'pink circle marks a sealed day',
                              'el círculo rosa indica día cerrado',
                              'le cercle rose indique un jour clôturé'
                            )}
                          </p>
                        </div>

                        {/* Week switcher (< / >) */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setStatsWeekOffset(prev => prev + 1)}
                            title={tr('Poprzedni tydzień', 'Previous week', 'Semana anterior', 'Semaine précédente')}
                            className="w-7 h-7 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          {statsWeekOffset > 0 && (
                            <button
                              type="button"
                              onClick={() => setStatsWeekOffset(0)}
                              className="px-2 h-7 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[10px] font-mono-meta text-[#524D46] hover:text-[#1C1A18] cursor-pointer whitespace-nowrap"
                            >
                              {tr('Dziś', 'Today', 'Hoy', 'Auj.')}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={statsWeekOffset <= 0}
                            onClick={() => setStatsWeekOffset(prev => Math.max(0, prev - 1))}
                            title={tr('Następny tydzień', 'Next week', 'Semana siguiente', 'Semaine suivante')}
                            className="w-7 h-7 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] disabled:opacity-35 disabled:cursor-not-allowed text-[#524D46] hover:text-[#1C1A18] flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const svgW = 420;
                        const svgH = 168;
                        const padLeft = 28;
                        const padRight = 28;
                        const topY = 30;
                        const baseY = 122;
                        const chartH = baseY - topY;
                        const stepX = (svgW - padLeft - padRight) / 6;

                        const pts = recent7Days.map((day, idx) => {
                          const x = padLeft + idx * stepX;
                          const ratio = day.hasEntry
                            ? Math.min(1, Math.max(0.12, day.wordCount / maxRecentWords))
                            : 0;
                          const y = baseY - ratio * chartH;
                          return { x, y, day };
                        });

                        // Build smooth Catmull-Rom / cubic curve through the 7 points
                        let linePath = '';
                        pts.forEach((p, i) => {
                          if (i === 0) {
                            linePath += `M ${p.x} ${p.y}`;
                          } else {
                            const prev = pts[i - 1];
                            const cx1 = prev.x + (p.x - prev.x) * 0.45;
                            const cy1 = prev.y;
                            const cx2 = prev.x + (p.x - prev.x) * 0.55;
                            const cy2 = p.y;
                            linePath += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.y}`;
                          }
                        });

                        const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`;

                        return (
                          <div className="w-full pt-1 select-none">
                            <svg
                              viewBox={`0 0 ${svgW} ${svgH}`}
                              className="w-full h-auto overflow-visible"
                            >
                              <defs>
                                <linearGradient id="weeklyRoseWash" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#EBC5CF" stopOpacity="0.38" />
                                  <stop offset="100%" stopColor="#FAF8F5" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>

                              {/* Subtle horizontal reference lines */}
                              <line
                                x1={padLeft - 10}
                                y1={topY}
                                x2={svgW - padRight + 10}
                                y2={topY}
                                stroke="#E5DFD3"
                                strokeWidth="1"
                                strokeDasharray="3 4"
                              />
                              <line
                                x1={padLeft - 10}
                                y1={topY + chartH * 0.5}
                                x2={svgW - padRight + 10}
                                y2={topY + chartH * 0.5}
                                stroke="#E5DFD3"
                                strokeWidth="1"
                                strokeDasharray="3 4"
                              />
                              {/* Desk-like ink baseline */}
                              <line
                                x1={padLeft - 12}
                                y1={baseY}
                                x2={svgW - padRight + 12}
                                y2={baseY}
                                stroke="#1C1A18"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />

                              {/* Soft pastel wash under curve */}
                              <path d={areaPath} fill="url(#weeklyRoseWash)" />

                              {/* Slender vertical stems for written days */}
                              {pts.map(({ x, y, day }) => {
                                const isHovered = hoveredWordDayKey === day.dateKey;
                                return day.hasEntry ? (
                                  <line
                                    key={`stem-${day.dateKey}`}
                                    x1={x}
                                    y1={baseY}
                                    x2={x}
                                    y2={isHovered ? y - 3 : y}
                                    stroke={isHovered ? '#8B2635' : '#1C1A18'}
                                    strokeWidth={isHovered ? '1.6' : '1.3'}
                                    strokeDasharray="2 2.5"
                                    className="transition-all duration-200"
                                  />
                                ) : null;
                              })}

                              {/* Main hand-drawn style ink curve */}
                              <path
                                d={linePath}
                                fill="none"
                                stroke="#1C1A18"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />

                              {/* Nodes & labels with gentle hover interactivity */}
                              {pts.map(({ x, y, day }) => {
                                const isHovered = hoveredWordDayKey === day.dateKey;
                                const nodeY = isHovered && day.hasEntry ? y - 3 : y;
                                return (
                                  <g
                                    key={day.dateKey}
                                    onMouseEnter={() => setHoveredWordDayKey(day.dateKey)}
                                    onMouseLeave={() => setHoveredWordDayKey(null)}
                                    className="cursor-pointer"
                                  >
                                    {/* Invisible column hit area for smooth hover */}
                                    <rect
                                      x={x - stepX * 0.45}
                                      y={topY - 18}
                                      width={stepX * 0.9}
                                      height={svgH - topY + 14}
                                      fill="transparent"
                                    />
                                    {day.hasEntry ? (
                                      <>
                                        {isHovered && (
                                          <circle
                                            cx={x}
                                            cy={nodeY}
                                            r="10.5"
                                            fill="#EBC5CF"
                                            fillOpacity="0.45"
                                          />
                                        )}
                                        <circle
                                          cx={x}
                                          cy={nodeY}
                                          r={isHovered ? '7' : '6'}
                                          fill={
                                            isHovered
                                              ? '#DF9FB0'
                                              : day.isSealed
                                              ? '#EBC5CF'
                                              : '#FAF8F5'
                                          }
                                          stroke={isHovered ? '#8B2635' : '#1C1A18'}
                                          strokeWidth={isHovered ? '1.9' : '1.7'}
                                          className="transition-all duration-200"
                                        />
                                        <circle
                                          cx={x}
                                          cy={nodeY}
                                          r="1.8"
                                          fill={isHovered ? '#8B2635' : '#1C1A18'}
                                        />
                                        <text
                                          x={x}
                                          y={nodeY - 11}
                                          textAnchor="middle"
                                          className={`text-[10px] font-mono-meta font-medium transition-colors duration-200 ${
                                            isHovered ? 'fill-[#8B2635] font-semibold' : 'fill-[#1C1A18]'
                                          }`}
                                        >
                                          {day.wordCount}
                                        </text>
                                      </>
                                    ) : (
                                      <circle
                                        cx={x}
                                        cy={isHovered ? baseY - 1.5 : baseY}
                                        r={isHovered ? '3.8' : '3'}
                                        fill={isHovered ? '#EBC5CF' : '#FAF8F5'}
                                        stroke={isHovered ? '#8B2635' : '#B5B0A6'}
                                        strokeWidth="1.4"
                                        className="transition-all duration-200"
                                      />
                                    )}

                                    {/* Weekday name */}
                                    <text
                                      x={x}
                                      y={baseY + 19}
                                      textAnchor="middle"
                                      className={`text-[11px] font-serif-literary transition-colors duration-200 ${
                                        isHovered
                                          ? 'fill-[#8B2635] font-semibold'
                                          : day.hasEntry
                                          ? 'fill-[#1C1A18] font-medium'
                                          : 'fill-[#8C857B]'
                                      }`}
                                    >
                                      {day.weekdayShort}
                                    </text>
                                    {/* Short date DD.MM */}
                                    <text
                                      x={x}
                                      y={baseY + 33}
                                      textAnchor="middle"
                                      className={`text-[9.5px] font-mono-meta transition-colors duration-200 ${
                                        isHovered ? 'fill-[#8B2635]' : 'fill-[#9E978C]'
                                      }`}
                                    >
                                      {day.shortLabel}
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                        );
                      })()}
                    </div>

                    {/* CHART 2: Time of Day Entries Were Written Each Day (Pora pisania każdego dnia) */}
                    <div className="pt-6 border-t border-[#E2DDD3] space-y-3 p-4 sm:p-5 rounded-2xl border border-transparent hover:border-[#E2DDD3] hover:bg-[#FAF8F5]/85 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(28,26,24,0.1)] group">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <svg
                              viewBox="0 0 24 20"
                              className="w-5 h-4 shrink-0 overflow-visible"
                              aria-hidden="true"
                            >
                              <circle
                                cx="12"
                                cy="10"
                                r="7"
                                fill="#FAF8F5"
                                stroke="#1C1A18"
                                strokeWidth="1.6"
                              />
                              <circle cx="12" cy="10" r="3" fill="#EBC5CF" />
                              <path
                                d="M12 6.5 V10 L14.5 11.5"
                                fill="none"
                                stroke="#1C1A18"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <h3 className="text-base font-serif-literary font-medium text-[#1C1A18]">
                              {tr(
                                'Pora pisania każdego dnia',
                                'Time of day written each day',
                                'Hora de escritura de cada día',
                                'Heure d’écriture de chaque jour'
                              )}
                            </h3>
                          </div>
                          <p className="text-[11px] font-mono-meta text-[#7A756D] mt-0.5">
                            {tr(
                              'Godzina ostatniego zapisu lub zamknięcia wpisu w danym dniu',
                              'Hour when each daily entry was written or sealed',
                              'Hora en que se escribió o cerró la entrada de cada día',
                              'Heure à laquelle chaque entrée a été écrite ou clôturée'
                            )}
                          </p>
                        </div>
                      </div>

                      {(() => {
                        const svgW = 420;
                        const svgH = 178;
                        const padLeft = 46;
                        const padRight = 24;
                        const topY = 26;
                        const botY = 128;
                        const chartH = botY - topY;
                        const stepX = (svgW - padLeft - padRight) / 6;

                        // Map hour (0..24) to Y coordinate (botY = 06:00 morning at bottom, topY = 23:00 evening at top)
                        const hourToY = (hDec: number) => {
                          const normalized = hDec < 5 ? hDec + 24 : hDec;
                          const clamped = Math.max(5.5, Math.min(24.2, normalized));
                          const ratio = (clamped - 6) / (23 - 6); // 6:00 -> 0 (bottom), 23:00 -> 1 (top)
                          const clampedRatio = Math.max(0, Math.min(1.05, ratio));
                          return botY - clampedRatio * chartH;
                        };

                        const timeGuides = [
                          { label: '23:00', hour: 23 },
                          { label: '18:00', hour: 18 },
                          { label: '12:00', hour: 12 },
                          { label: '06:00', hour: 6 },
                        ];

                        const dayNodes = recent7Days.map((day, idx) => {
                          const x = padLeft + idx * stepX;
                          const y =
                            day.hourDecimal !== null ? hourToY(day.hourDecimal) : null;
                          return { x, y, day };
                        });

                        const activeNodes = dayNodes.filter(
                          (n): n is { x: number; y: number; day: typeof recent7Days[0] } =>
                            n.y !== null
                        );

                        let timeConnectPath = '';
                        activeNodes.forEach((n, idx) => {
                          if (idx === 0) {
                            timeConnectPath += `M ${n.x} ${n.y}`;
                          } else {
                            const prev = activeNodes[idx - 1];
                            const cx1 = prev.x + (n.x - prev.x) * 0.45;
                            const cy1 = prev.y;
                            const cx2 = prev.x + (n.x - prev.x) * 0.55;
                            const cy2 = n.y;
                            timeConnectPath += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${n.x} ${n.y}`;
                          }
                        });

                        return (
                          <div className="w-full pt-1 select-none">
                            <svg
                              viewBox={`0 0 ${svgW} ${svgH}`}
                              className="w-full h-auto overflow-visible"
                            >
                              {/* Horizontal time-of-day guides (23:00 at top, 06:00 at bottom) */}
                              {timeGuides.map(g => {
                                const gy = hourToY(g.hour);
                                return (
                                  <g key={g.label}>
                                    <text
                                      x={0}
                                      y={gy + 3.5}
                                      className="text-[9.5px] font-mono-meta fill-[#8C857B]"
                                    >
                                      {g.label}
                                    </text>
                                    <line
                                      x1={padLeft - 8}
                                      y1={gy}
                                      x2={svgW - padRight + 8}
                                      y2={gy}
                                      stroke="#E5DFD3"
                                      strokeWidth="1"
                                      strokeDasharray="3 4"
                                    />
                                  </g>
                                );
                              })}

                              {/* Vertical subtle day stems */}
                              {dayNodes.map(({ x, y, day }) => {
                                const isHovered = hoveredTimeDayKey === day.dateKey;
                                return (
                                  <g key={`t-track-${day.dateKey}`}>
                                    <line
                                      x1={x}
                                      y1={topY}
                                      x2={x}
                                      y2={botY}
                                      stroke="#ECE7DC"
                                      strokeWidth="1"
                                    />
                                    {y !== null && (
                                      <line
                                        x1={x}
                                        y1={botY}
                                        x2={x}
                                        y2={isHovered ? y - 3 : y}
                                        stroke={isHovered ? '#8B2635' : '#1C1A18'}
                                        strokeWidth={isHovered ? '1.5' : '1.15'}
                                        strokeDasharray="2 2.5"
                                        opacity={isHovered ? '0.75' : '0.32'}
                                      />
                                    )}
                                  </g>
                                );
                              })}

                              {/* Bottom baseline (06:00 morning) */}
                              <line
                                x1={padLeft - 8}
                                y1={botY}
                                x2={svgW - padRight + 8}
                                y2={botY}
                                stroke="#1C1A18"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />

                              {/* Smooth dashed ink path connecting written days' times */}
                              {activeNodes.length > 1 && (
                                <path
                                  d={timeConnectPath}
                                  fill="none"
                                  stroke="#1C1A18"
                                  strokeWidth="1.6"
                                  strokeDasharray="4 3"
                                  strokeLinecap="round"
                                />
                              )}

                              {/* Time nodes and labels with gentle hover interactivity */}
                              {dayNodes.map(({ x, y, day }) => {
                                const isHovered = hoveredTimeDayKey === day.dateKey;
                                const nodeY = y !== null ? (isHovered ? y - 3 : y) : null;
                                return (
                                  <g
                                    key={`time-${day.dateKey}`}
                                    onMouseEnter={() => setHoveredTimeDayKey(day.dateKey)}
                                    onMouseLeave={() => setHoveredTimeDayKey(null)}
                                    className="cursor-pointer"
                                  >
                                    {/* Invisible column hit area */}
                                    <rect
                                      x={x - stepX * 0.45}
                                      y={topY - 22}
                                      width={stepX * 0.9}
                                      height={svgH - topY + 18}
                                      fill="transparent"
                                    />
                                    {nodeY !== null && day.timeStr ? (
                                      <>
                                        {isHovered && (
                                          <circle
                                            cx={x}
                                            cy={nodeY}
                                            r="10.5"
                                            fill="#EBC5CF"
                                            fillOpacity="0.45"
                                          />
                                        )}
                                        {/* Logo-style sun/moon time dot */}
                                        <circle
                                          cx={x}
                                          cy={nodeY}
                                          r={isHovered ? '7' : '6'}
                                          fill={isHovered ? '#DF9FB0' : '#EBC5CF'}
                                          stroke={isHovered ? '#8B2635' : '#1C1A18'}
                                          strokeWidth={isHovered ? '1.9' : '1.7'}
                                          className="transition-all duration-200"
                                        />
                                        <circle
                                          cx={x}
                                          cy={nodeY}
                                          r="1.8"
                                          fill={isHovered ? '#8B2635' : '#1C1A18'}
                                        />
                                        {/* Pill background for HH:MM label so it's always crisp */}
                                        <rect
                                          x={x - 18}
                                          y={nodeY - 22}
                                          width="36"
                                          height="14"
                                          rx="4"
                                          fill={isHovered ? '#8B2635' : '#FAF8F5'}
                                          stroke={isHovered ? '#8B2635' : '#DDD6C8'}
                                          strokeWidth="1"
                                          className="transition-all duration-200"
                                        />
                                        <text
                                          x={x}
                                          y={nodeY - 12.5}
                                          textAnchor="middle"
                                          className={`text-[9.5px] font-mono-meta font-medium transition-colors duration-200 ${
                                            isHovered ? 'fill-[#FAF8F5]' : 'fill-[#1C1A18]'
                                          }`}
                                        >
                                          {day.timeStr}
                                        </text>
                                      </>
                                    ) : (
                                      <circle
                                        cx={x}
                                        cy={isHovered ? botY - 1.5 : botY}
                                        r={isHovered ? '3.4' : '2.5'}
                                        fill={isHovered ? '#EBC5CF' : '#FAF8F5'}
                                        stroke={isHovered ? '#8B2635' : '#C8C2B4'}
                                        strokeWidth="1.3"
                                        className="transition-all duration-200"
                                      />
                                    )}

                                    {/* Weekday name */}
                                    <text
                                      x={x}
                                      y={botY + 19}
                                      textAnchor="middle"
                                      className={`text-[11px] font-serif-literary transition-colors duration-200 ${
                                        isHovered
                                          ? 'fill-[#8B2635] font-semibold'
                                          : y !== null
                                          ? 'fill-[#1C1A18] font-medium'
                                          : 'fill-[#8C857B]'
                                      }`}
                                    >
                                      {day.weekdayShort}
                                    </text>
                                    {/* Short date DD.MM */}
                                    <text
                                      x={x}
                                      y={botY + 33}
                                      textAnchor="middle"
                                      className={`text-[9.5px] font-mono-meta transition-colors duration-200 ${
                                        isHovered ? 'fill-[#8B2635]' : 'fill-[#9E978C]'
                                      }`}
                                    >
                                      {day.shortLabel}
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* PAGE D: ZAMKNIJ DZIEŃ */}
              {activeBottomPage === 'closeDay' && (
                <div className="w-full text-left">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
                    <div className="lg:col-span-5 space-y-6 lg:border-r lg:border-[#E2DDD3] lg:pr-12">
                      <div>
                        <div className="text-xs font-mono-meta uppercase tracking-widest text-[#8B2635] mb-1">
                          {tr('Podsumowanie dnia', 'Day summary', 'Resumen del día', 'Résumé du jour')}
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-serif-literary font-normal text-[#1C1A18]">
                          {tr(
                            'Zamknij dzisiejszy dzień',
                            'Close today’s entry',
                            'Cerrar el día de hoy',
                            'Clôturer la journée d’aujourd’hui'
                          )}
                        </h2>
                      </div>

                      <p className="text-base font-serif-literary text-[#524D46] leading-relaxed">
                        {tr(
                          'Zamknięcie dnia kończy dzisiejszy rytuał pisarski. Twój tekst zostanie zapisany w Dzienniku jako ukończony rozdział, którego nie można już przypadkowo nadpisać.',
                          'Closing the day completes today’s writing ritual. Your text will be saved in your Journal as a finished chapter that cannot be accidentally overwritten.',
                          'Cerrar el día completa el ritual de escritura de hoy. Tu texto se guardará en el Diario como un capítulo terminado que no podrá sobrescribirse por accidente.',
                          'Clôturer la journée termine le rituel d’écriture d’aujourd’hui. Votre texte sera enregistré dans le Journal comme un chapitre achevé.'
                        )}
                      </p>

                      <div className="grid grid-cols-3 gap-4 py-4 border-y border-[#E2DDD3]">
                        <div>
                          <div className="text-[10px] font-mono-meta uppercase text-[#7A756D]">
                            {tr('Czas pisania', 'Writing time', 'Tiempo de escritura', 'Temps d’écriture')}
                          </div>
                          <div className="text-lg font-serif-literary font-medium text-[#1C1A18] mt-0.5">
                            {formatWritingTime(writingTimeSeconds)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono-meta uppercase text-[#7A756D]">
                            {tr('Liczba słów', 'Word count', 'Palabras', 'Mots')}
                          </div>
                          <div className="text-lg font-serif-literary font-medium text-[#1C1A18] mt-0.5">
                            {wordCount}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono-meta uppercase text-[#7A756D]">
                            {tr('Liczba znaków', 'Characters', 'Caracteres', 'Caractères')}
                          </div>
                          <div className="text-lg font-serif-literary font-medium text-[#1C1A18] mt-0.5">
                            {characterCount}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row lg:flex-col gap-3 pt-2">
                        <button
                          onClick={() => {
                            onSealDay();
                            setActiveBottomPage('none');
                          }}
                          className="w-full py-2.5 px-4 text-xs font-mono-meta text-[#FAF8F5] bg-[#1C1A18] border border-[#1C1A18] rounded hover:bg-[#33302B] transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#EBC5CF]" />
                          <span>
                            {tr(
                              'Potwierdź i zamknij dzisiejszy dzień',
                              'Confirm & close today’s entry',
                              'Confirmar y cerrar el día de hoy',
                              'Confirmer et clôturer la journée'
                            )}
                          </span>
                        </button>
                        <button
                          onClick={() => setActiveBottomPage('none')}
                          className="w-full py-2 px-4 text-xs font-mono-meta text-[#524D46] hover:text-[#1C1A18] border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>
                            {tr('Powrót do pisania', 'Back to writing', 'Volver a escribir', 'Retour à l’écriture')}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="lg:col-span-7 space-y-5">
                      <h3 className="text-xl sm:text-2xl font-serif-literary italic text-[#6E6961] leading-snug border-b border-[#E2DDD3] pb-4">
                        „{activePromptText}”
                      </h3>
                      <div className="text-lg sm:text-xl font-serif-literary text-[#1C1A18] leading-relaxed whitespace-pre-wrap max-w-4xl">
                        {renderFormattedText(content)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

