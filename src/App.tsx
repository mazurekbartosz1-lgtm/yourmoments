/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signOut,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
  formatFirebaseAuthError,
  hasValidFirebaseApiKey,
  subscribeToAuthChanges,
} from './services/firebase';
import {
  encryptText,
  decryptTextWithKeyring,
  generateJournalKey,
  getStoredJournalKey,
  saveJournalKey,
  getStoredDeviceName,
  saveDeviceName,
  KeySyncMode,
  getAutoWrappingPassphrase,
  wrapSingleKey,
  unwrapSingleKey,
  getStoredKeyring,
  saveStoredKeyring,
  getStoredPinPassphrase,
  saveStoredPinPassphrase,
} from './services/crypto';
import {
  getPromptForDate,
  formatDateKey,
  DailyPrompt,
  DAILY_PROMPTS,
  PromptCategory,
  getRecentPromptIdsLast30Days,
  recordMonthlyPromptUsage,
  getPromptText,
  FREE_THOUGHT_PROMPT_ID,
  FREE_THOUGHT_PROMPT,
} from './data/prompts';
import { CompanionId, COMPANIONS } from './components/CompanionDesk';
import { FocusEditor } from './components/FocusEditor';
import { CompanionPickerModal } from './components/CompanionPickerModal';
import { SavedEntry } from './components/ChronicleArchiveModal';
import { AuthModal } from './components/AuthModal';
import { AdminPanelModal, isAuthorizedAdmin } from './components/AdminPanelModal';
import { LandingPage } from './components/LandingPage';
import { PromptLibraryView } from './components/PromptLibraryView';
import { SparkleModal, SparkleAppreciationCard } from './components/SparkleModal';
import { OneTimeShareModal } from './components/OneTimeShareModal';
import { SharedEntryView } from './components/SharedEntryView';
import { AdminCampaignView } from './components/AdminCampaignView';
import { User } from 'lucide-react';
import { useNetworkStatus, checkAndTriggerScheduledReminder } from './services/pwa';

interface SparkleCounterState {
  sealedDaysSinceLast: number;
  targetDays: number; // random integer in 1..4
  hasPendingSparkle: boolean;
  lastCountedDate: string;
  lastClaimedDate: string;
}

function getSparkleCounterState(uid: string): SparkleCounterState {
  try {
    const raw = localStorage.getItem(`kronika_sparkle_state_${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        sealedDaysSinceLast:
          typeof parsed.sealedDaysSinceLast === 'number' ? parsed.sealedDaysSinceLast : 0,
        targetDays:
          typeof parsed.targetDays === 'number' && parsed.targetDays >= 1 && parsed.targetDays <= 4
            ? parsed.targetDays
            : Math.floor(Math.random() * 4) + 1,
        hasPendingSparkle: Boolean(parsed.hasPendingSparkle),
        lastCountedDate: typeof parsed.lastCountedDate === 'string' ? parsed.lastCountedDate : '',
        lastClaimedDate: typeof parsed.lastClaimedDate === 'string' ? parsed.lastClaimedDate : '',
      };
    }
  } catch {
    // ignore
  }
  return {
    sealedDaysSinceLast: 0,
    targetDays: 1, // First sealed day triggers Sparkle, then random 1..4 days
    hasPendingSparkle: false,
    lastCountedDate: '',
    lastClaimedDate: '',
  };
}

function saveSparkleCounterState(uid: string, state: SparkleCounterState): void {
  try {
    localStorage.setItem(`kronika_sparkle_state_${uid}`, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// Generates or ensures 3 distinct questions for today's pool, excluding prompts from the past 30 days
function getInitialThreePrompts(
  todayKey: string,
  extraEntries?: { date: string; promptId?: string }[],
  lockedPromptId?: string
): DailyPrompt[] {
  const recent30DaysIds = getRecentPromptIdsLast30Days(todayKey, extraEntries);
  const cached = localStorage.getItem(`kronika_prompt_history_${todayKey}`);
  let list: DailyPrompt[] = [];

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = parsed
          .map(p => DAILY_PROMPTS.find(dp => dp.id === p?.id) || p)
          .filter(
            (p): p is DailyPrompt =>
              Boolean(p && p.id && p.promptPl) &&
              (p.id === lockedPromptId || !recent30DaysIds.has(p.id))
          );
      }
    } catch {
      list = [];
    }
  }

  // Ensure locked/answered prompt is kept if present
  if (lockedPromptId && !list.some(p => p.id === lockedPromptId)) {
    const lockedObj = DAILY_PROMPTS.find(p => p.id === lockedPromptId);
    if (lockedObj) {
      list.unshift(lockedObj);
    }
  }

  // Always start with DAILY_PROMPTS[0] ("Jaka jedna spokojna chwila, rozmowa lub drobiazg sprawiły, że warto było przejść przez ten dzień?") unless another prompt was explicitly locked
  const now = new Date();
  const primaryPrompt = DAILY_PROMPTS[0];
  if (!lockedPromptId || lockedPromptId === primaryPrompt.id) {
    list = [primaryPrompt, ...list.filter(p => p.id !== primaryPrompt.id)];
  } else if (list.length === 0) {
    list.push(primaryPrompt);
  }

  // Deterministically pick remaining slots for today using day-of-year offset, avoiding 30-day repeats
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.max(
    1,
    Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24))
  );
  const startOffset = (dayOfYear * 3) % DAILY_PROMPTS.length;

  for (let i = 0; i < DAILY_PROMPTS.length && list.length < 3; i++) {
    const candidate = DAILY_PROMPTS[(startOffset + i * 7) % DAILY_PROMPTS.length];
    if (
      !list.some(p => p.id === candidate.id) &&
      !recent30DaysIds.has(candidate.id)
    ) {
      list.push(candidate);
    }
  }

  // Fallback if all prompts were somehow exhausted
  let pIdx = 0;
  while (list.length < 3 && pIdx < DAILY_PROMPTS.length) {
    const candidate = DAILY_PROMPTS[(startOffset + pIdx) % DAILY_PROMPTS.length];
    if (!list.some(p => p.id === candidate.id)) {
      list.push(candidate);
    }
    pIdx++;
  }

  const finalThree = list.slice(0, 3);
  localStorage.setItem(`kronika_prompt_history_${todayKey}`, JSON.stringify(finalThree));
  if (finalThree[0]?.id) {
    recordMonthlyPromptUsage(todayKey, finalThree[0].id);
  }
  return finalThree;
}

function detectBrowserAndSystemLanguage(): 'pl' | 'en' | 'es' | 'fr' {
  if (typeof window === 'undefined') return 'pl';

  try {
    const params = new URLSearchParams(window.location.search);
    const urlLang = (params.get('lang') || params.get('hl') || '').trim().toLowerCase();
    if (urlLang.startsWith('pl')) return 'pl';
    if (urlLang.startsWith('en')) return 'en';
    if (urlLang.startsWith('es')) return 'es';
    if (urlLang.startsWith('fr')) return 'fr';
  } catch {
    // ignore URL parse errors
  }

  try {
    const manualLang = localStorage.getItem('kronika_lang_manual');
    if (manualLang === 'pl' || manualLang === 'en' || manualLang === 'es' || manualLang === 'fr') {
      return manualLang;
    }
  } catch {
    // ignore storage errors
  }

  const candidates: string[] = [];
  if (typeof navigator !== 'undefined') {
    if (Array.isArray(navigator.languages)) {
      candidates.push(...navigator.languages);
    }
    if (navigator.language) {
      candidates.push(navigator.language);
    }
  }
  try {
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intlLocale) candidates.push(intlLocale);
  } catch {
    // ignore
  }

  for (const raw of candidates) {
    if (!raw) continue;
    const code = raw.toLowerCase().trim();
    if (code.startsWith('pl')) return 'pl';
    if (code.startsWith('es')) return 'es';
    if (code.startsWith('fr')) return 'fr';
    if (code.startsWith('en')) return 'en';
  }

  try {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    if (tz.includes('warsaw')) return 'pl';
    if (
      tz.includes('madrid') ||
      tz.includes('mexico') ||
      tz.includes('buenos_aires') ||
      tz.includes('bogota') ||
      tz.includes('santiago') ||
      tz.includes('lima')
    ) {
      return 'es';
    }
    if (tz.includes('paris')) return 'fr';
  } catch {
    // ignore
  }

  return 'en';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isInitialDataLoading, setIsInitialDataLoading] = useState<boolean>(true);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const loadedUidRef = useRef<string | null>(null);

  // Language state ('pl' | 'en' | 'es' | 'fr') detected from browser & OS or user's manual choice
  const [lang, setLang] = useState<'pl' | 'en' | 'es' | 'fr'>(() => {
    const detected = detectBrowserAndSystemLanguage();
    try {
      localStorage.setItem('kronika_lang', detected);
    } catch {
      // ignore
    }
    return detected;
  });

  const handleChangeLang = (newLang: 'pl' | 'en' | 'es' | 'fr') => {
    setLang(newLang);
    try {
      localStorage.setItem('kronika_lang', newLang);
      localStorage.setItem('kronika_lang_manual', newLang);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSystemLanguageChange = () => {
      try {
        if (!localStorage.getItem('kronika_lang_manual')) {
          const next = detectBrowserAndSystemLanguage();
          setLang(next);
          localStorage.setItem('kronika_lang', next);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('languagechange', handleSystemLanguageChange);
    return () => window.removeEventListener('languagechange', handleSystemLanguageChange);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/prompts')) {
      document.title =
        lang === 'en'
          ? 'Moments — A quiet page for your daily moments'
          : lang === 'es'
          ? 'Momentos — Una página tranquila para tus momentos diarios'
          : lang === 'fr'
          ? 'Moments — Une page calme pour vos moments quotidiens'
          : 'Momenty — Cicha kartka na Twoje codzienne momenty';
    }
  }, [lang]);

  const [currentPathname, setCurrentPathname] = useState<string>(() => {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname || '/';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      setCurrentPathname(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = useCallback((path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPathname(path);
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    if (!hasValidFirebaseApiKey) {
      // In AI Studio preview (where VITE_FIREBASE_API_KEY is not injected), open a local preview session
      const previewUser = {
        uid: 'aistudio_preview_user',
        displayName: 'Bartek',
        email: 'mazurekbartosz1@gmail.com',
        photoURL: null,
      } as unknown as FirebaseUser;
      setCurrentUser(previewUser);
      setIsInitialDataLoading(false);
      setShowLandingPreview(false);
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/prompts')) {
        window.history.pushState({}, '', '/');
        setCurrentPathname('/');
      }
      setIsAuthLoading(false);
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/prompts')) {
        window.history.pushState({}, '', '/');
        setCurrentPathname('/');
      }
    } catch (err: unknown) {
      console.error('Google Sign-In error:', err);
      const formatted = formatFirebaseAuthError(err, lang);
      setAuthError(
        formatted ||
          (lang === 'en'
            ? 'Could not sign in with Google. Please try again.'
            : lang === 'es'
            ? 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.'
            : lang === 'fr'
            ? 'Impossible de se connecter avec Google. Veuillez réessayer.'
            : 'Nie udało się zalogować przez Google. Spróbuj ponownie.')
      );
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!hasValidFirebaseApiKey) {
      setCurrentUser(null);
      setShowLandingPreview(false);
      return;
    }
    try {
      await signOut(auth);
      setShowLandingPreview(false);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const todayKey = formatDateKey(new Date());

  // Pool of 3 questions for today (1/3, 2/3, 3/3)
  const [promptHistory, setPromptHistory] = useState<DailyPrompt[]>(() => {
    return getInitialThreePrompts(todayKey);
  });

  const [promptIndex, setPromptIndex] = useState<number>(() => {
    const cachedIndex = localStorage.getItem(`kronika_prompt_index_${todayKey}`);
    if (cachedIndex !== null) {
      const parsed = parseInt(cachedIndex, 10);
      return isNaN(parsed) ? 0 : Math.min(Math.max(0, parsed), 2);
    }
    return 0;
  });

  // Track which prompt ID the user's text actually answers
  const [answeredPromptId, setAnsweredPromptId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const mode = new URLSearchParams(window.location.search).get('mode');
      if (mode === 'free') return FREE_THOUGHT_PROMPT_ID;
    }
    return localStorage.getItem(`kronika_answered_prompt_${todayKey}`) || '';
  });

  const [isFreeThoughtMode, setIsFreeThoughtMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const mode = new URLSearchParams(window.location.search).get('mode');
      if (mode === 'free') return true;
      if (mode === 'daily') return false;
    }
    return localStorage.getItem(`kronika_answered_prompt_${todayKey}`) === FREE_THOUGHT_PROMPT_ID;
  });

  const baseDailyPrompt = promptHistory[promptIndex] || promptHistory[0] || DAILY_PROMPTS[0];
  const currentPrompt = isFreeThoughtMode ? FREE_THOUGHT_PROMPT : baseDailyPrompt;

  // Remaining rerolls for today (max 3)
  const [remainingRerolls, setRemainingRerolls] = useState<number>(() => {
    const saved = localStorage.getItem(`kronika_rerolls_${todayKey}`);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      return isNaN(parsed) ? 3 : parsed;
    }
    return 3;
  });

  // Editor states
  const [content, setContent] = useState<string>('');
  const [isSealed, setIsSealed] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'offline' | 'error'>('idle');

  // Active writing duration in seconds (ticks only while typing)
  const [writingTimeSeconds, setWritingTimeSeconds] = useState<number>(() => {
    const localDraft = localStorage.getItem(`kronika_draft_${todayKey}`);
    if (localDraft) {
      try {
        const parsed = JSON.parse(localDraft);
        return typeof parsed.writingTimeSeconds === 'number' ? parsed.writingTimeSeconds : 0;
      } catch {
        return 0;
      }
    }
    return 0;
  });

  // User settings, Cloud Keyring Sync & E2EE Device recognition
  // Always start with the Fox companion ('fox') unless the user explicitly chose another companion
  const [companionId, setCompanionId] = useState<CompanionId>(() => {
    try {
      const saved = localStorage.getItem('kronika_companion') as CompanionId | null;
      if (saved && COMPANIONS.some(c => c.id === saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'fox';
  });
  const [encryptionKey, setEncryptionKey] = useState<string>('');
  const [keyring, setKeyring] = useState<string[]>([]);
  const [keySyncMode, setKeySyncMode] = useState<KeySyncMode>('auto');
  const [currentDeviceName, setCurrentDeviceName] = useState<string>(() => getStoredDeviceName());
  const [entryDeviceName, setEntryDeviceName] = useState<string>('');
  const [decryptionError, setDecryptionError] = useState<boolean>(false);
  const [rawCiphertext, setRawCiphertext] = useState<string>('');
  const [streak, setStreak] = useState<number>(1);

  // Journal entries
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>([]);

  // Sparkle ("Gwiazdki") Appreciation Cards & non-deterministic 1..4 day trigger
  const [sparkleCards, setSparkleCards] = useState<SparkleAppreciationCard[]>([]);
  const [hasPendingSparkle, setHasPendingSparkle] = useState<boolean>(false);
  const [sparkleTestMode, setSparkleTestMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kronika_sparkle_test_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [isGeneratingSparkle, setIsGeneratingSparkle] = useState<boolean>(false);
  const [activeSparkleCard, setActiveSparkleCard] = useState<SparkleAppreciationCard | null>(null);
  const [showSparkleModal, setShowSparkleModal] = useState<boolean>(false);

  // One-Time Encrypted Entry Sharing with PIN (supports today's entry or any archived entry from Journal)
  const [showOneTimeShareModal, setShowOneTimeShareModal] = useState<boolean>(false);
  const [shareModalTarget, setShareModalTarget] = useState<{
    content: string;
    promptText: string;
    date: string;
  } | null>(null);
  const [activeShareId, setActiveShareId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('share');
    return id && id.trim() ? id.trim() : null;
  });

  // Modals
  const [showCompanionModal, setShowCompanionModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);

  const lastSavedContentRef = useRef<string>('');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    testFirestoreConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async user => {
      if (user) {
        if (loadedUidRef.current !== user.uid) {
          setIsInitialDataLoading(true);
        }
      } else {
        loadedUidRef.current = null;
        setIsInitialDataLoading(false);
      }
      setCurrentUser(user);
      setAuthReady(true);

      const userId = user ? user.uid : 'local_guest';
      const storedKey = getStoredJournalKey(userId);
      const storedRing = getStoredKeyring(userId);

      setKeyring(storedRing);
      if (storedKey) {
        setEncryptionKey(storedKey);
      } else if (storedRing.length > 0) {
        setEncryptionKey(storedRing[0]);
      } else {
        setEncryptionKey('');
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * Helper to wrap and push the user's merged keyring to Firestore users/{uid}
   */
  const syncKeyringToCloud = useCallback(
    async (
      uid: string,
      primaryKey: string,
      allKeys: string[],
      mode: KeySyncMode,
      customPin?: string,
      deviceLabel?: string
    ) => {
      if (!hasValidFirebaseApiKey) return;
      const wrapSecret =
        mode === 'pin'
          ? customPin || getStoredPinPassphrase(uid) || ''
          : getAutoWrappingPassphrase(uid);
      if (!wrapSecret || !primaryKey) return;

      const uniqueKeys: string[] = [primaryKey.trim()];
      for (const k of allKeys) {
        const clean = k?.trim();
        if (clean && !uniqueKeys.includes(clean)) {
          uniqueKeys.push(clean);
        }
      }
      const boundedKeys = uniqueKeys.slice(0, 10);

      const wrappedPrimary = await wrapSingleKey(boundedKeys[0], wrapSecret);
      const wrappedHistory = await Promise.all(
        boundedKeys.map(k => wrapSingleKey(k, wrapSecret))
      );

      const userRef = doc(db, 'users', uid);
      const updatePayload: Record<string, unknown> = {
        encryptedVaultKey: wrappedPrimary,
        encryptedKeyHistory: wrappedHistory,
        keySyncMode: mode,
        updatedAt: serverTimestamp(),
      };
      if (deviceLabel) {
        updatePayload.deviceName = deviceLabel.slice(0, 120);
      }
      await updateDoc(userRef, updatePayload).catch(() => {});
    },
    []
  );

  const loadUserData = useCallback(async () => {
    if (!currentUser) {
      setIsInitialDataLoading(false);
      return;
    }

    if (!hasValidFirebaseApiKey) {
      const localDraft =
        localStorage.getItem(`kronika_draft_${todayKey}`) ||
        localStorage.getItem('kronika_plg_draft');
      if (localDraft) {
        try {
          const parsed = JSON.parse(localDraft);
          setContent(parsed.content || '');
          setIsSealed(Boolean(parsed.isSealed));
          if (typeof parsed.writingTimeSeconds === 'number') {
            setWritingTimeSeconds(parsed.writingTimeSeconds);
          }
          if (parsed.promptId) {
            setAnsweredPromptId(parsed.promptId);
            setIsFreeThoughtMode(parsed.promptId === FREE_THOUGHT_PROMPT_ID);
          }
        } catch {
          setContent(localDraft);
        }
      }
      let activeKey = getStoredJournalKey(currentUser.uid);
      if (!activeKey) {
        activeKey = generateJournalKey();
        saveJournalKey(currentUser.uid, activeKey, true, getStoredDeviceName());
      }
      setEncryptionKey(activeKey);
      setKeyring(getStoredKeyring(currentUser.uid));
      loadedUidRef.current = currentUser.uid;
      setIsInitialDataLoading(false);
      return;
    }

    if (loadedUidRef.current !== currentUser.uid) {
      setIsInitialDataLoading(true);
    }

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      const localDevName = getStoredDeviceName();
      let remoteKeyDeviceName = '';
      let remoteSyncMode: KeySyncMode = 'auto';
      let remoteWrappedPrimary = '';
      let remoteWrappedHistory: string[] = [];

      if (userDoc.exists()) {
        const data = userDoc.data();
        if (typeof data.currentStreak === 'number') {
          setStreak(Math.max(1, data.currentStreak));
        }
        if (typeof data.deviceName === 'string' && data.deviceName.trim()) {
          remoteKeyDeviceName = data.deviceName.trim();
        }
        if (data.keySyncMode === 'pin' || data.keySyncMode === 'auto') {
          remoteSyncMode = data.keySyncMode;
        }
        if (typeof data.encryptedVaultKey === 'string') {
          remoteWrappedPrimary = data.encryptedVaultKey;
        }
        if (Array.isArray(data.encryptedKeyHistory)) {
          remoteWrappedHistory = data.encryptedKeyHistory.filter(
            (item): item is string => typeof item === 'string'
          );
        }
      }

      setKeySyncMode(remoteSyncMode);

      // 1. Gather local keys from this device
      const localPrimary = getStoredJournalKey(currentUser.uid);
      const localRing = getStoredKeyring(currentUser.uid);

      // 2. Unwrap cloud keys if wrapping secret is available (always available in 'auto' mode, or in 'pin' mode if PIN cached)
      const wrapSecret =
        remoteSyncMode === 'pin'
          ? getStoredPinPassphrase(currentUser.uid)
          : getAutoWrappingPassphrase(currentUser.uid);

      const cloudKeys: string[] = [];
      if (wrapSecret) {
        if (remoteWrappedPrimary) {
          const unwrappedMain = await unwrapSingleKey(remoteWrappedPrimary, wrapSecret);
          if (unwrappedMain) cloudKeys.push(unwrappedMain);
        }
        for (const token of remoteWrappedHistory) {
          const unwrappedItem = await unwrapSingleKey(token, wrapSecret);
          if (unwrappedItem && !cloudKeys.includes(unwrappedItem)) {
            cloudKeys.push(unwrappedItem);
          }
        }
      }

      // 3. Merge cloud keys + local keys into a unified multi-device keyring
      // Prefer cloud primary key first so new devices immediately adopt the account's primary key,
      // while preserving any local key in the keyring so entries from either device decrypt seamlessly!
      const mergedRing: string[] = [];
      for (const ck of cloudKeys) {
        if (ck && !mergedRing.includes(ck)) mergedRing.push(ck);
      }
      if (localPrimary && !mergedRing.includes(localPrimary)) {
        mergedRing.push(localPrimary);
      }
      for (const lk of localRing) {
        if (lk && !mergedRing.includes(lk)) mergedRing.push(lk);
      }

      // Fetch entries from Firestore
      const entriesRef = collection(db, 'users', currentUser.uid, 'entries');
      const snap = await getDocs(entriesRef);
      const entriesList: SavedEntry[] = [];

      for (const entryDoc of snap.docs) {
        const d = entryDoc.data();
        entriesList.push({
          id: entryDoc.id,
          date: d.date || entryDoc.id,
          promptId: d.promptId || '',
          encryptedContent: d.encryptedContent || '',
          iv: d.iv || '',
          salt: d.salt || '',
          characterCount: d.characterCount || 0,
          wordCount: d.wordCount || 0,
          writingTimeSeconds: d.writingTimeSeconds || 0,
          deviceName: typeof d.deviceName === 'string' ? d.deviceName : undefined,
          isSealed: d.isSealed || false,
          updatedAt:
            d.updatedAt instanceof Timestamp
              ? d.updatedAt.toDate().toISOString()
              : d.createdAt instanceof Timestamp
              ? d.createdAt.toDate().toISOString()
              : typeof d.updatedAt === 'string'
              ? d.updatedAt
              : undefined,
        });
      }

      entriesList.sort((a, b) => b.date.localeCompare(a.date));

      // Determine the device name where previous entries were encrypted
      const latestEntryWithDevice = entriesList.find(e => e.deviceName && e.deviceName.trim());
      const recognizedDevice =
        latestEntryWithDevice?.deviceName || remoteKeyDeviceName || localDevName;
      setEntryDeviceName(recognizedDevice);

      // If no key exists anywhere yet (brand new user or first cloud sync), generate one
      let activeKey = mergedRing[0] || '';
      if (!activeKey && remoteSyncMode === 'auto') {
        const freshKey = generateJournalKey();
        mergedRing.push(freshKey);
        activeKey = freshKey;
      }

      // Attempt to decrypt all entries using the entire merged keyring!
      let workingKeyFromEntries: string | null = null;
      const processedEntries = await Promise.all(
        entriesList.map(async entry => {
          if (!entry.encryptedContent) {
            return { ...entry, decryptionError: false };
          }
          if (mergedRing.length === 0) {
            return { ...entry, decryptedContent: undefined, decryptionError: true };
          }
          try {
            const { text, matchedKey } = await decryptTextWithKeyring(
              entry.encryptedContent,
              entry.iv,
              entry.salt,
              activeKey,
              mergedRing
            );
            if (!workingKeyFromEntries) {
              workingKeyFromEntries = matchedKey;
            }
            return { ...entry, decryptedContent: text, decryptionError: false };
          } catch {
            return { ...entry, decryptedContent: undefined, decryptionError: true };
          }
        })
      );

      // If one of the keys in the keyring matched existing entries, promote it to primary activeKey!
      if (workingKeyFromEntries && workingKeyFromEntries !== activeKey) {
        activeKey = workingKeyFromEntries;
      }

      const finalRing = saveStoredKeyring(
        currentUser.uid,
        activeKey ? [activeKey, ...mergedRing] : mergedRing
      );
      setKeyring(finalRing);

      if (activeKey) {
        saveJournalKey(currentUser.uid, activeKey, true, localDevName);
        setEncryptionKey(activeKey);
      }

      setSavedEntries(processedEntries);

      // Load & decrypt Sparkle Appreciation Cards from localStorage + Firestore
      let localSparkles: SparkleAppreciationCard[] = [];
      try {
        const rawLocalSparkles = localStorage.getItem(`kronika_sparkles_${currentUser.uid}`);
        if (rawLocalSparkles) {
          const parsed = JSON.parse(rawLocalSparkles);
          if (Array.isArray(parsed)) {
            localSparkles = parsed;
          }
        }
      } catch {
        localSparkles = [];
      }

      const sparklesMap = new Map<string, SparkleAppreciationCard>();
      for (const sc of localSparkles) {
        if (sc && sc.id) sparklesMap.set(sc.id, sc);
      }

      try {
        const sparklesRef = collection(db, 'users', currentUser.uid, 'sparkles');
        const sparklesSnap = await getDocs(sparklesRef);
        for (const sDoc of sparklesSnap.docs) {
          if (sparklesMap.has(sDoc.id)) continue;
          const sd = sDoc.data();
          if (sd.encryptedContent && sd.iv && sd.salt && finalRing.length > 0) {
            try {
              const { text } = await decryptTextWithKeyring(
                sd.encryptedContent,
                sd.iv,
                sd.salt,
                activeKey,
                finalRing
              );
              const parsedCard = JSON.parse(text);
              if (parsedCard && parsedCard.id) {
                sparklesMap.set(sDoc.id, parsedCard);
              }
            } catch {
              // ignore undecryptable card
            }
          }
        }
      } catch {
        // ignore offline or rules read
      }

      const rawSparkles = Array.from(sparklesMap.values()).sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return b.date.localeCompare(a.date);
      });

      const seenSparkleDates = new Set<string>();
      const mergedSparkles: SparkleAppreciationCard[] = [];
      const duplicateSparkleIds: string[] = [];

      for (const sc of rawSparkles) {
        if (!sc.date) continue;
        if (!seenSparkleDates.has(sc.date)) {
          seenSparkleDates.add(sc.date);
          mergedSparkles.push(sc);
        } else if (sc.id) {
          duplicateSparkleIds.push(sc.id);
        }
      }

      mergedSparkles.sort((a, b) => b.date.localeCompare(a.date));
      setSparkleCards(mergedSparkles);
      try {
        localStorage.setItem(
          `kronika_sparkles_${currentUser.uid}`,
          JSON.stringify(mergedSparkles)
        );
      } catch {
        // ignore
      }

      if (duplicateSparkleIds.length > 0 && (typeof navigator === 'undefined' || navigator.onLine)) {
        for (const dupId of duplicateSparkleIds) {
          deleteDoc(doc(db, 'users', currentUser.uid, 'sparkles', dupId)).catch(() => {});
        }
      }

      // Check non-deterministic Sparkle counter state (1..4 sealed days)
      const spState = getSparkleCounterState(currentUser.uid);
      const todayEntrySealed = Boolean(
        processedEntries.find(e => e.date === todayKey)?.isSealed
      );
      if (
        todayEntrySealed &&
        spState.lastClaimedDate !== todayKey &&
        (spState.hasPendingSparkle ||
          mergedSparkles.length === 0 ||
          spState.sealedDaysSinceLast >= spState.targetDays)
      ) {
        spState.hasPendingSparkle = true;
        saveSparkleCounterState(currentUser.uid, spState);
      }
      setHasPendingSparkle(spState.hasPendingSparkle);

      // Compute true consecutive day streak from actual entry dates
      const activeDates = new Set<string>();
      for (const e of processedEntries) {
        if (
          e.date &&
          ((e.wordCount && e.wordCount > 0) ||
            (e.characterCount && e.characterCount > 0) ||
            e.isSealed ||
            (e.decryptedContent && e.decryptedContent.trim().length > 0))
        ) {
          activeDates.add(e.date);
        }
      }
      const computeStreakFromDates = (datesSet: Set<string>, includeTodayFlag: boolean): number => {
        const setCopy = new Set(datesSet);
        if (includeTodayFlag) setCopy.add(todayKey);
        if (setCopy.size === 0) return 1;
        const formatD = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };
        const base = new Date();
        let cursor = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        if (!setCopy.has(formatD(cursor))) {
          const yesterday = new Date(cursor);
          yesterday.setDate(yesterday.getDate() - 1);
          if (setCopy.has(formatD(yesterday))) {
            cursor = yesterday;
          } else {
            const sortedDates = Array.from(setCopy).sort((a, b) => b.localeCompare(a));
            const [ly, lm, ld] = sortedDates[0].split('-').map(Number);
            if (ly && lm && ld) {
              cursor = new Date(ly, lm - 1, ld);
            }
          }
        }
        let count = 0;
        while (setCopy.has(formatD(cursor))) {
          count += 1;
          cursor.setDate(cursor.getDate() - 1);
        }
        return Math.max(1, count);
      };

      const trueStreak = computeStreakFromDates(activeDates, false);
      setStreak(trueStreak);
      if (
        userDoc.exists() &&
        userDoc.data()?.currentStreak !== trueStreak &&
        (typeof navigator === 'undefined' || navigator.onLine)
      ) {
        updateDoc(userRef, { currentStreak: trueStreak }).catch(() => {});
      }

      // Create user doc if missing, or sync merged keyring to cloud if new local keys were merged
      if (typeof navigator === 'undefined' || navigator.onLine) {
        if (!userDoc.exists()) {
          const autoSecret = getAutoWrappingPassphrase(currentUser.uid);
          const initialKey = activeKey || generateJournalKey();
          const wrappedMain = await wrapSingleKey(initialKey, autoSecret);
          await setDoc(userRef, {
            id: currentUser.uid,
            companion: companionId,
            currentStreak: 1,
            deviceName: localDevName.slice(0, 120),
            encryptedVaultKey: wrappedMain,
            encryptedKeyHistory: [wrappedMain],
            keySyncMode: 'auto',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        } else if (
          wrapSecret &&
          activeKey &&
          (finalRing.length > cloudKeys.length || !remoteWrappedPrimary)
        ) {
          // Automatically push the newly merged device key(s) to the cloud keyring!
          await syncKeyringToCloud(
            currentUser.uid,
            activeKey,
            finalRing,
            remoteSyncMode,
            wrapSecret
          );
        }
      }

      // Record all promptIds from past entries into the 30-day monthly log
      for (const entry of processedEntries) {
        if (entry.date && entry.promptId) {
          recordMonthlyPromptUsage(entry.date, entry.promptId);
        }
      }

      const todayEntry = processedEntries.find(e => e.date === todayKey);
      // Ensure today's 3-prompt pool excludes any prompts used in the past 30 days across synced devices
      const refreshedPool = getInitialThreePrompts(
        todayKey,
        processedEntries,
        todayEntry?.promptId
      );
      setPromptHistory(refreshedPool);

      if (todayEntry) {
        setIsSealed(todayEntry.isSealed);
        if (typeof todayEntry.writingTimeSeconds === 'number') {
          setWritingTimeSeconds(todayEntry.writingTimeSeconds);
        }
        if (todayEntry.deviceName) {
          setEntryDeviceName(todayEntry.deviceName);
        }
        if (todayEntry.promptId) {
          setAnsweredPromptId(todayEntry.promptId);
          setIsFreeThoughtMode(todayEntry.promptId === FREE_THOUGHT_PROMPT_ID);
          localStorage.setItem(`kronika_answered_prompt_${todayKey}`, todayEntry.promptId);
          recordMonthlyPromptUsage(todayKey, todayEntry.promptId);
          const matchedPrompt = DAILY_PROMPTS.find(p => p.id === todayEntry.promptId);
          if (matchedPrompt) {
            setPromptHistory(prev => {
              if (prev.some(p => p.id === matchedPrompt.id)) return prev;
              const updated = [
                matchedPrompt,
                ...prev.filter(p => p.id !== matchedPrompt.id),
              ].slice(0, 3);
              localStorage.setItem(`kronika_prompt_history_${todayKey}`, JSON.stringify(updated));
              return updated;
            });
          }
        }

        if (todayEntry.decryptedContent !== undefined && !todayEntry.decryptionError) {
          setContent(todayEntry.decryptedContent);
          lastSavedContentRef.current = todayEntry.decryptedContent;
          setDecryptionError(false);
          setRawCiphertext('');
        } else if (todayEntry.encryptedContent) {
          // Missing or mismatched key for today's entry — show encoded message + built-in window!
          setDecryptionError(true);
          setRawCiphertext(todayEntry.encryptedContent);
          setContent('');
        }
      } else {
        setDecryptionError(false);
        setRawCiphertext('');
        const localDraft =
          localStorage.getItem(`kronika_draft_${todayKey}`) ||
          localStorage.getItem('kronika_plg_draft');
        if (localDraft) {
          try {
            const parsed = JSON.parse(localDraft);
            const draftContent = typeof parsed.content === 'string' ? parsed.content : '';
            const draftPromptId =
              typeof parsed.promptId === 'string' && parsed.promptId
                ? parsed.promptId
                : refreshedPool[0]?.id || DAILY_PROMPTS[0].id;
            const draftTime =
              typeof parsed.writingTimeSeconds === 'number' ? parsed.writingTimeSeconds : 0;

            setContent(draftContent);
            setIsSealed(Boolean(parsed.isSealed));
            setWritingTimeSeconds(draftTime);
            if (draftPromptId) {
              setAnsweredPromptId(draftPromptId);
              setIsFreeThoughtMode(draftPromptId === FREE_THOUGHT_PROMPT_ID);
              localStorage.setItem(`kronika_answered_prompt_${todayKey}`, draftPromptId);
              const matchedPrompt = DAILY_PROMPTS.find(p => p.id === draftPromptId);
              if (matchedPrompt) {
                setPromptIndex(0);
                setPromptHistory(prev => {
                  const updated = [
                    matchedPrompt,
                    ...prev.filter(p => p.id !== matchedPrompt.id),
                  ].slice(0, 3);
                  localStorage.setItem(`kronika_prompt_history_${todayKey}`, JSON.stringify(updated));
                  return updated;
                });
              }
            }
            lastSavedContentRef.current = draftContent;

            // Automatically encrypt & save the PLG guest reflection to the user's cloud timeline!
            if (draftContent.trim().length > 0 && activeKey) {
              try {
                const encrypted = await encryptText(draftContent, activeKey);
                const wordCount = draftContent.trim().split(/\s+/).length;
                const entryRef = doc(db, 'users', currentUser.uid, 'entries', todayKey);
                await setDoc(entryRef, {
                  id: todayKey,
                  userId: currentUser.uid,
                  date: todayKey,
                  promptId: draftPromptId,
                  encryptedContent: encrypted.encryptedContent,
                  iv: encrypted.iv,
                  salt: encrypted.salt,
                  characterCount: draftContent.length,
                  wordCount,
                  writingTimeSeconds: draftTime,
                  deviceName: localDevName.slice(0, 120),
                  isSealed: Boolean(parsed.isSealed),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                localStorage.removeItem('kronika_plg_draft');
                setSaveStatus('saved');
              } catch (plgSyncErr) {
                console.warn('Could not auto-sync PLG draft on first load:', plgSyncErr);
              }
            }
          } catch {
            setContent(localDraft);
            lastSavedContentRef.current = localDraft;
          }
        } else {
          setContent('');
        }
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
    } finally {
      loadedUidRef.current = currentUser.uid;
      setIsInitialDataLoading(false);
    }
  }, [currentUser, todayKey, companionId, syncKeyringToCloud]);

  useEffect(() => {
    if (authReady && currentUser) {
      loadUserData();
    }
  }, [authReady, currentUser, loadUserData]);

  // Re-decrypt entries whenever encryptionKey or keyring is updated
  useEffect(() => {
    if ((!encryptionKey && keyring.length === 0) || savedEntries.length === 0) return;

    let isMounted = true;
    const decryptAll = async () => {
      const updated = await Promise.all(
        savedEntries.map(async entry => {
          if (!entry.encryptedContent) return { ...entry, decryptionError: false };
          try {
            const { text } = await decryptTextWithKeyring(
              entry.encryptedContent,
              entry.iv,
              entry.salt,
              encryptionKey,
              keyring
            );
            return { ...entry, decryptedContent: text, decryptionError: false };
          } catch {
            return { ...entry, decryptedContent: undefined, decryptionError: true };
          }
        })
      );
      if (isMounted) {
        setSavedEntries(updated);
        const todayUnlocked = updated.find(e => e.date === todayKey);
        if (todayUnlocked) {
          if (todayUnlocked.decryptedContent !== undefined && !todayUnlocked.decryptionError) {
            setContent(todayUnlocked.decryptedContent);
            lastSavedContentRef.current = todayUnlocked.decryptedContent;
            setDecryptionError(false);
            setRawCiphertext('');
          } else if (todayUnlocked.encryptedContent) {
            setDecryptionError(true);
            setRawCiphertext(todayUnlocked.encryptedContent);
          }
        }
      }
    };

    decryptAll();
    return () => {
      isMounted = false;
    };
  }, [encryptionKey, keyring, savedEntries.length, todayKey]);

  const handlePrevPrompt = () => {
    if (promptIndex > 0) {
      const newIdx = promptIndex - 1;
      setPromptIndex(newIdx);
      localStorage.setItem(`kronika_prompt_index_${todayKey}`, String(newIdx));
    }
  };

  const handleNextPrompt = () => {
    if (promptIndex < promptHistory.length - 1) {
      const newIdx = promptIndex + 1;
      setPromptIndex(newIdx);
      localStorage.setItem(`kronika_prompt_index_${todayKey}`, String(newIdx));
    }
  };

  // Safe Prompt Reroll (never repeats questions from the last 30 days)
  const handleRerollPrompt = (category: PromptCategory | 'all') => {
    if (remainingRerolls <= 0) return;

    const recent30DaysIds = getRecentPromptIdsLast30Days(todayKey, savedEntries);
    const excludedIds = new Set<string>([
      ...promptHistory.map(p => p.id),
      ...Array.from(recent30DaysIds),
    ]);

    const pool = DAILY_PROMPTS.filter(p => {
      if (excludedIds.has(p.id)) return false;
      if (category === 'all') return true;
      return p.category === category;
    });

    const fallbackMonthlyPool = DAILY_PROMPTS.filter(p => !excludedIds.has(p.id));
    const fallbackTodayPool = DAILY_PROMPTS.filter(p => !promptHistory.some(ph => ph.id === p.id));
    const finalPool =
      pool.length > 0
        ? pool
        : fallbackMonthlyPool.length > 0
        ? fallbackMonthlyPool
        : fallbackTodayPool.length > 0
        ? fallbackTodayPool
        : DAILY_PROMPTS;
    const randomIndex = Math.floor(Math.random() * finalPool.length);
    const newPrompt = finalPool[randomIndex];

    const updatedHistory = [...promptHistory];
    const hasWrittenText = content.trim().length > 0;
    const currentIsAnswered =
      hasWrittenText &&
      (currentPrompt.id === answeredPromptId || (!answeredPromptId && promptIndex === 0));

    let targetSlot = promptIndex;
    if (currentIsAnswered) {
      if (!answeredPromptId) {
        setAnsweredPromptId(currentPrompt.id);
        localStorage.setItem(`kronika_answered_prompt_${todayKey}`, currentPrompt.id);
      }
      targetSlot = promptIndex < 2 ? promptIndex + 1 : 2;
      if (targetSlot === promptIndex && promptIndex === 2) {
        targetSlot = 1;
      }
    }

    updatedHistory[targetSlot] = newPrompt;
    recordMonthlyPromptUsage(todayKey, newPrompt.id);

    setPromptHistory(updatedHistory);
    setPromptIndex(targetSlot);
    const newRemaining = remainingRerolls - 1;
    setRemainingRerolls(newRemaining);

    localStorage.setItem(`kronika_prompt_history_${todayKey}`, JSON.stringify(updatedHistory));
    localStorage.setItem(`kronika_prompt_index_${todayKey}`, String(targetSlot));
    localStorage.setItem(`kronika_rerolls_${todayKey}`, String(newRemaining));
  };

  const handleAssignCurrentPromptToDraft = () => {
    setAnsweredPromptId(currentPrompt.id);
    localStorage.setItem(`kronika_answered_prompt_${todayKey}`, currentPrompt.id);
    recordMonthlyPromptUsage(todayKey, currentPrompt.id);
    if (content.trim()) {
      saveEntry(content, isSealed, writingTimeSeconds, currentPrompt.id);
    }
  };

  const saveEntry = useCallback(
    async (
      textToSave: string,
      forceSeal?: boolean,
      currentTime: number = writingTimeSeconds,
      overridePromptId?: string
    ) => {
      if ((!textToSave.trim() && forceSeal === undefined) || decryptionError) return;

      setSaveStatus('saving');

      const wordCount = textToSave.trim() ? textToSave.trim().split(/\s+/).length : 0;
      const characterCount = textToSave.length;
      const targetPromptId = overridePromptId || answeredPromptId || currentPrompt.id;
      const cleanDeviceName = (currentDeviceName || getStoredDeviceName()).slice(0, 120);
      const effectiveSealed = typeof forceSeal === 'boolean' ? forceSeal : isSealed;
      recordMonthlyPromptUsage(todayKey, targetPromptId);

      localStorage.setItem(
        `kronika_draft_${todayKey}`,
        JSON.stringify({
          content: textToSave,
          isSealed: effectiveSealed,
          promptId: targetPromptId,
          writingTimeSeconds: currentTime,
          deviceName: cleanDeviceName,
          updatedAt: new Date().toISOString(),
        })
      );

      // Ensure we have an encryption key when writing a new entry
      let keyToUse = encryptionKey;
      if (currentUser && !keyToUse) {
        keyToUse = generateJournalKey();
        saveJournalKey(currentUser.uid, keyToUse, true, cleanDeviceName);
        setEncryptionKey(keyToUse);
        const updatedRing = getStoredKeyring(currentUser.uid);
        setKeyring(updatedRing);
        await syncKeyringToCloud(
          currentUser.uid,
          keyToUse,
          updatedRing,
          keySyncMode,
          undefined,
          cleanDeviceName
        );
      }

      if (currentUser && keyToUse) {
        try {
          const encrypted = await encryptText(textToSave, keyToUse);

          const entryObj: SavedEntry = {
            id: todayKey,
            date: todayKey,
            promptId: targetPromptId,
            encryptedContent: encrypted.encryptedContent,
            iv: encrypted.iv,
            salt: encrypted.salt,
            characterCount,
            wordCount,
            writingTimeSeconds: currentTime,
            deviceName: cleanDeviceName,
            isSealed: effectiveSealed,
            decryptedContent: textToSave,
            decryptionError: false,
            updatedAt: new Date().toISOString(),
          };

          setSavedEntries(prev => {
            const existingIdx = prev.findIndex(e => e.id === todayKey);
            if (existingIdx >= 0) {
              const copy = [...prev];
              copy[existingIdx] = entryObj;
              return copy;
            }
            return [entryObj, ...prev];
          });

          const pendingSyncPayload = {
            id: todayKey,
            userId: currentUser.uid,
            promptId: targetPromptId,
            promptHistoryIds: promptHistory.map(p => p.id),
            date: todayKey,
            encryptedContent: encrypted.encryptedContent,
            iv: encrypted.iv,
            salt: encrypted.salt,
            characterCount,
            wordCount,
            writingTimeSeconds: currentTime,
            deviceName: cleanDeviceName,
            isSealed: effectiveSealed,
            isEncrypted: true,
          };

          if ((typeof navigator !== 'undefined' && !navigator.onLine) || !hasValidFirebaseApiKey) {
            localStorage.setItem(
              `kronika_pending_sync_${todayKey}`,
              JSON.stringify(pendingSyncPayload)
            );
            setSaveStatus(hasValidFirebaseApiKey ? 'offline' : 'saved');
            lastSavedContentRef.current = textToSave;
            return;
          }

          const entryRef = doc(db, 'users', currentUser.uid, 'entries', todayKey);
          const entrySnap = await getDoc(entryRef);

          const payload = {
            ...pendingSyncPayload,
            updatedAt: serverTimestamp(),
          };

          if (entrySnap.exists()) {
            await updateDoc(entryRef, payload);
          } else {
            await setDoc(entryRef, {
              ...payload,
              createdAt: serverTimestamp(),
            });
          }

          // Also store deviceName on user profile
          const userRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userRef, {
            deviceName: cleanDeviceName,
            updatedAt: serverTimestamp(),
          }).catch(() => {});

          localStorage.removeItem(`kronika_pending_sync_${todayKey}`);
          setEntryDeviceName(cleanDeviceName);
          setSaveStatus('saved');
          lastSavedContentRef.current = textToSave;
        } catch (err) {
          console.error('Failed to sync encrypted entry to Firestore:', err);
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setSaveStatus('offline');
          } else {
            setSaveStatus('error');
          }
        }
      } else {
        setSaveStatus('offline');
      }
    },
    [
      answeredPromptId,
      currentDeviceName,
      currentPrompt.id,
      currentUser,
      decryptionError,
      encryptionKey,
      isSealed,
      keySyncMode,
      promptHistory,
      syncKeyringToCloud,
      todayKey,
      writingTimeSeconds,
    ]
  );

  const handleDeleteEntry = useCallback(
    async (entryId: string) => {
      setSavedEntries(prev => {
        const updated = prev.filter(e => e.id !== entryId);
        localStorage.setItem('kronika_local_entries', JSON.stringify(updated));
        return updated;
      });

      if (entryId === todayKey) {
        localStorage.removeItem(`kronika_draft_${todayKey}`);
        localStorage.removeItem(`kronika_answered_prompt_${todayKey}`);
        setContent('');
        setIsSealed(false);
        setDecryptionError(false);
        setRawCiphertext('');
        setWritingTimeSeconds(0);
        setAnsweredPromptId('');
        setIsFreeThoughtMode(false);
        setSaveStatus('idle');
        lastSavedContentRef.current = '';
      }

      if (currentUser) {
        try {
          const entryRef = doc(db, 'users', currentUser.uid, 'entries', entryId);
          await deleteDoc(entryRef);
        } catch (err) {
          console.error('Failed to delete entry from Firestore:', err);
          handleFirestoreError(
            err,
            OperationType.DELETE,
            `users/${currentUser.uid}/entries/${entryId}`
          );
        }
      }
    },
    [currentUser, todayKey]
  );

  const handleResetLockedTodayEntry = useCallback(async () => {
    await handleDeleteEntry(todayKey);
    if (currentUser && !encryptionKey) {
      const freshKey = generateJournalKey();
      const dev = (currentDeviceName || getStoredDeviceName()).slice(0, 120);
      saveJournalKey(currentUser.uid, freshKey, true, dev);
      setEncryptionKey(freshKey);
      const updatedRing = getStoredKeyring(currentUser.uid);
      setKeyring(updatedRing);
      await syncKeyringToCloud(currentUser.uid, freshKey, updatedRing, keySyncMode, undefined, dev);
    }
  }, [currentDeviceName, currentUser, encryptionKey, handleDeleteEntry, keySyncMode, syncKeyringToCloud, todayKey]);

  const handleContentChange = (newText: string) => {
    if (decryptionError) return;
    setContent(newText);

    if (!answeredPromptId && newText.trim().length > 0) {
      setAnsweredPromptId(currentPrompt.id);
      localStorage.setItem(`kronika_answered_prompt_${todayKey}`, currentPrompt.id);
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveEntry(newText, isSealed, writingTimeSeconds);
    }, 1200);
  };

  const handleSealDay = async () => {
    setIsSealed(true);
    await saveEntry(content, true, writingTimeSeconds);

    const activeDates = new Set<string>([todayKey]);
    for (const e of savedEntries) {
      if (
        e.date &&
        ((e.wordCount && e.wordCount > 0) ||
          (e.characterCount && e.characterCount > 0) ||
          e.isSealed ||
          (e.decryptedContent && e.decryptedContent.trim().length > 0))
      ) {
        activeDates.add(e.date);
      }
    }
    const formatD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const now = new Date();
    const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let trueStreak = 0;
    while (activeDates.has(formatD(cursor))) {
      trueStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    const newStreak = Math.max(1, trueStreak);
    setStreak(newStreak);

    if (currentUser && hasValidFirebaseApiKey) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          currentStreak: newStreak,
          lastActiveDate: todayKey,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Streak update error:', err);
      }
    }

    // Update non-deterministic Sparkle counter (triggers every 1..4 sealed days)
    const uid = currentUser ? currentUser.uid : 'local_guest';
    const spState = getSparkleCounterState(uid);
    if (spState.lastClaimedDate !== todayKey) {
      if (spState.lastCountedDate !== todayKey) {
        spState.sealedDaysSinceLast += 1;
        spState.lastCountedDate = todayKey;
      }
      if (spState.sealedDaysSinceLast >= spState.targetDays || sparkleCards.length === 0) {
        spState.hasPendingSparkle = true;
      }
      saveSparkleCounterState(uid, spState);
      setHasPendingSparkle(spState.hasPendingSparkle);
    }
  };

  const handleTriggerSparkle = async (forceFresh: boolean = false) => {
    const uid = currentUser ? currentUser.uid : 'local_guest';
    const isTestActive = isAuthorizedAdmin(currentUser) && (sparkleTestMode || forceFresh);
    const existingToday = !isTestActive ? sparkleCards.find(c => c.date === todayKey) : undefined;
    if (existingToday) {
      setActiveSparkleCard(existingToday);
      setShowSparkleModal(true);
      const spState = getSparkleCounterState(uid);
      spState.hasPendingSparkle = false;
      spState.lastClaimedDate = todayKey;
      saveSparkleCounterState(uid, spState);
      setHasPendingSparkle(false);
      return;
    }

    setShowSparkleModal(true);
    setIsGeneratingSparkle(true);

    try {
      // Collect up to 7 most recent decrypted entries (including today's content)
      const recentEntriesPayload: Array<{ date: string; promptText: string; content: string }> = [];
      if (content.trim()) {
        recentEntriesPayload.push({
          date: todayKey,
          promptText: getPromptText(currentPrompt, lang),
          content: content.trim(),
        });
      }

      for (const e of savedEntries) {
        if (e.date === todayKey && recentEntriesPayload.length > 0) continue;
        if (e.decryptedContent && e.decryptedContent.trim()) {
          const matchedP = DAILY_PROMPTS.find(p => p.id === e.promptId);
          recentEntriesPayload.push({
            date: e.date,
            promptText: matchedP ? getPromptText(matchedP, lang) : '',
            content: e.decryptedContent.trim(),
          });
        }
        if (recentEntriesPayload.length >= 7) break;
      }

      // If testing in Sparkle Test Mode and no entries exist yet, provide a sample entry so the AI buddy can still be tested
      if (recentEntriesPayload.length === 0 && isTestActive) {
        recentEntriesPayload.push({
          date: todayKey,
          promptText: getPromptText(currentPrompt, lang),
          content:
            lang === 'en'
              ? 'Today I took a morning walk without headphones to listen to my own thoughts instead of rushing into work.'
              : 'Dzisiaj poszedłem rano na spacer bez słuchawek, żeby posłuchać własnych myśli zamiast od razu biec głową do pracy.',
        });
      }

      const res = await fetch('/api/sparkle-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: recentEntriesPayload,
          userName: currentUser?.displayName?.split(' ')[0] || 'Bartek',
          lang,
        }),
      });

      const data = await res.json();
      const newCard: SparkleAppreciationCard = {
        id: `sparkle_${todayKey}`,
        date: todayKey,
        periodLabel: data.periodLabel || todayKey,
        greeting:
          data.greeting ||
          (lang === 'en'
            ? 'Hey friend, you did really well these past days!'
            : 'Hej stary, dobrze zrobiłeś przez te ostatnie dni!'),
        content: data.content || '',
        highlights: Array.isArray(data.highlights) ? data.highlights : [],
        createdAt: new Date().toISOString(),
      };

      const staleSameDayIds = sparkleCards
        .filter(c => c.date === todayKey && c.id !== newCard.id)
        .map(c => c.id);
      const updatedCards = [
        newCard,
        ...sparkleCards.filter(c => c.date !== todayKey && c.id !== newCard.id),
      ];
      setSparkleCards(updatedCards);
      setActiveSparkleCard(newCard);

      try {
        localStorage.setItem(`kronika_sparkles_${uid}`, JSON.stringify(updatedCards));
      } catch {
        // ignore
      }

      // Encrypt and save Sparkle Appreciation Card in Firestore /users/{uid}/sparkles/{cardId}
      const keyToUse = encryptionKey || keyring[0];
      if (currentUser && keyToUse && hasValidFirebaseApiKey) {
        try {
          for (const oldId of staleSameDayIds) {
            deleteDoc(doc(db, 'users', currentUser.uid, 'sparkles', oldId)).catch(() => {});
          }
          const encrypted = await encryptText(JSON.stringify(newCard), keyToUse);
          const sparkleRef = doc(db, 'users', currentUser.uid, 'sparkles', newCard.id);
          await setDoc(sparkleRef, {
            id: newCard.id,
            userId: currentUser.uid,
            date: newCard.date,
            periodLabel: (newCard.periodLabel || newCard.date).slice(0, 120),
            encryptedContent: encrypted.encryptedContent,
            iv: encrypted.iv,
            salt: encrypted.salt,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn('Could not sync Sparkle card to Firestore:', err);
        }
      }

      // Reset counter and draw new non-deterministic target in [1..4] sealed days
      const nextTargetDays = Math.floor(Math.random() * 4) + 1;
      const nextState: SparkleCounterState = {
        sealedDaysSinceLast: 0,
        targetDays: nextTargetDays,
        hasPendingSparkle: false,
        lastCountedDate: todayKey,
        lastClaimedDate: todayKey,
      };
      saveSparkleCounterState(uid, nextState);
      setHasPendingSparkle(false);
    } catch (err) {
      console.error('Sparkle generation error:', err);
    } finally {
      setIsGeneratingSparkle(false);
    }
  };

  const handleUnsealDay = async () => {
    setIsSealed(false);
    await saveEntry(content, false, writingTimeSeconds);
  };

  const handleCompanionChange = async (newId: CompanionId) => {
    setCompanionId(newId);
    localStorage.setItem('kronika_companion', newId);

    if (currentUser && hasValidFirebaseApiKey) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          companion: newId,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Error updating companion in Firestore:', err);
      }
    }
  };

  const handleDeviceNameChange = (newDeviceName: string) => {
    setCurrentDeviceName(newDeviceName);
    if (newDeviceName.trim()) {
      saveDeviceName(newDeviceName.trim());
    }
  };

  const handleSaveKey = async (newKey: string, persist: boolean, customDeviceName?: string) => {
    const cleanNewKey = newKey.trim();
    if (!cleanNewKey) return;

    const userId = currentUser ? currentUser.uid : 'local_guest';
    const effectiveDevice = (customDeviceName || currentDeviceName || getStoredDeviceName()).slice(
      0,
      120
    );
    setCurrentDeviceName(effectiveDevice);
    saveDeviceName(effectiveDevice);
    saveJournalKey(userId, cleanNewKey, persist, effectiveDevice);
    const updatedRing = getStoredKeyring(userId);
    setKeyring(updatedRing);
    setEncryptionKey(cleanNewKey);

    if (currentUser) {
      await syncKeyringToCloud(
        currentUser.uid,
        cleanNewKey,
        updatedRing,
        keySyncMode,
        undefined,
        effectiveDevice
      );
    }

    // Immediately attempt to decrypt today's entry if it was locked
    const todaySaved = savedEntries.find(e => e.date === todayKey);
    if (todaySaved && todaySaved.encryptedContent) {
      try {
        const { text } = await decryptTextWithKeyring(
          todaySaved.encryptedContent,
          todaySaved.iv,
          todaySaved.salt,
          cleanNewKey,
          updatedRing
        );
        setContent(text);
        lastSavedContentRef.current = text;
        setDecryptionError(false);
        setRawCiphertext('');
      } catch {
        // Still mismatched key
      }
    } else if (content.trim()) {
      saveEntry(content, isSealed, writingTimeSeconds);
    }
  };

  const handleUnlockWithPin = async (pin: string): Promise<boolean> => {
    if (!currentUser || !pin.trim()) return false;
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) return false;

      const data = userDoc.data();
      const wrappedPrimary = typeof data.encryptedVaultKey === 'string' ? data.encryptedVaultKey : '';
      const wrappedHistory: string[] = Array.isArray(data.encryptedKeyHistory)
        ? data.encryptedKeyHistory.filter((x): x is string => typeof x === 'string')
        : [];

      const unlockedKeys: string[] = [];
      if (wrappedPrimary) {
        const k = await unwrapSingleKey(wrappedPrimary, pin.trim());
        if (k) unlockedKeys.push(k);
      }
      for (const token of wrappedHistory) {
        const k = await unwrapSingleKey(token, pin.trim());
        if (k && !unlockedKeys.includes(k)) unlockedKeys.push(k);
      }

      if (unlockedKeys.length === 0) {
        return false;
      }

      saveStoredPinPassphrase(currentUser.uid, pin.trim());
      const merged = saveStoredKeyring(currentUser.uid, [
        ...unlockedKeys,
        ...getStoredKeyring(currentUser.uid),
      ]);
      saveJournalKey(currentUser.uid, merged[0], true, currentDeviceName);
      setKeyring(merged);
      setEncryptionKey(merged[0]);
      return true;
    } catch {
      return false;
    }
  };

  const handleUpdateKeySyncMode = async (mode: KeySyncMode, customPin?: string) => {
    if (!currentUser) return;
    const primary = encryptionKey || keyring[0] || generateJournalKey();
    const allKeys = keyring.length > 0 ? keyring : [primary];

    if (mode === 'pin' && customPin?.trim()) {
      saveStoredPinPassphrase(currentUser.uid, customPin.trim());
      setKeySyncMode('pin');
      await syncKeyringToCloud(
        currentUser.uid,
        primary,
        allKeys,
        'pin',
        customPin.trim(),
        currentDeviceName
      );
    } else {
      saveStoredPinPassphrase(currentUser.uid, null);
      setKeySyncMode('auto');
      await syncKeyringToCloud(
        currentUser.uid,
        primary,
        allKeys,
        'auto',
        undefined,
        currentDeviceName
      );
    }
  };

  const flushPendingOfflineSync = useCallback(async () => {
    if (!currentUser) return;
    const rawPending = localStorage.getItem(`kronika_pending_sync_${todayKey}`);
    if (!rawPending) return;

    try {
      const parsed = JSON.parse(rawPending);
      if (!parsed || parsed.userId !== currentUser.uid) return;
      setSaveStatus('saving');
      const entryRef = doc(db, 'users', currentUser.uid, 'entries', todayKey);
      const entrySnap = await getDoc(entryRef);
      const payload = {
        ...parsed,
        updatedAt: serverTimestamp(),
      };
      if (entrySnap.exists()) {
        await updateDoc(entryRef, payload);
      } else {
        await setDoc(entryRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
      localStorage.removeItem(`kronika_pending_sync_${todayKey}`);
      setSaveStatus('saved');
    } catch {
      // keep pending in localStorage until next online connection
    }
  }, [currentUser, todayKey]);

  useNetworkStatus(flushPendingOfflineSync);

  // Check for scheduled daily writing reminders every 30 seconds
  useEffect(() => {
    checkAndTriggerScheduledReminder(todayKey, isSealed, lang);
    const intervalId = setInterval(() => {
      checkAndTriggerScheduledReminder(todayKey, isSealed, lang);
    }, 30000);
    return () => clearInterval(intervalId);
  }, [todayKey, isSealed, lang]);

  const [showLandingPreview, setShowLandingPreview] = useState<boolean>(false);
  const headerRef = useRef<HTMLElement>(null);

  // Sync visualViewport.offsetTop and header height to CSS variables so sticky header & editor dock
  // stay pinned to the top of the mobile screen even when the virtual keyboard opens or pans
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;

    const updateViewportVars = () => {
      const vv = window.visualViewport;
      const offsetTop = vv ? Math.max(0, Math.round(vv.offsetTop)) : 0;
      const vvHeight = vv ? Math.round(vv.height) : window.innerHeight;
      root.style.setProperty('--vv-offset-top', `${offsetTop}px`);
      root.style.setProperty('--vv-height', `${vvHeight}px`);
      if (headerRef.current) {
        root.style.setProperty('--header-h', `${headerRef.current.offsetHeight}px`);
      }
    };

    updateViewportVars();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', updateViewportVars);
    vv?.addEventListener('scroll', updateViewportVars);
    window.addEventListener('resize', updateViewportVars);
    window.addEventListener('scroll', updateViewportVars, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && headerRef.current) {
      ro = new ResizeObserver(updateViewportVars);
      ro.observe(headerRef.current);
    }

    return () => {
      vv?.removeEventListener('resize', updateViewportVars);
      vv?.removeEventListener('scroll', updateViewportVars);
      window.removeEventListener('resize', updateViewportVars);
      window.removeEventListener('scroll', updateViewportVars);
      ro?.disconnect();
    };
  }, [authReady, currentUser, showLandingPreview]);

  const isAdminCampaignRoute =
    currentPathname === '/admin/campaign' || currentPathname.startsWith('/admin/campaign/');

  useEffect(() => {
    if ((!authReady && !activeShareId && !isAdminCampaignRoute) || typeof document === 'undefined')
      return;
    const loader = document.getElementById('initial-app-loader');
    if (!loader) return;
    const rafId = window.requestAnimationFrame(() => {
      loader.classList.add('is-loaded');
    });
    const timerId = window.setTimeout(() => {
      loader.remove();
    }, 480);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [authReady, activeShareId, isAdminCampaignRoute]);

  if (isAdminCampaignRoute) {
    return (
      <AdminCampaignView
        initialLang={lang}
        onNavigateHome={() => navigateTo('/')}
      />
    );
  }

  if (activeShareId) {
    return (
      <SharedEntryView
        shareId={activeShareId}
        onExitShareView={() => {
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', window.location.pathname);
          }
          setActiveShareId(null);
        }}
      />
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] text-[#1C1A18] flex flex-col items-center justify-center p-6 font-serif-literary antialiased">
        <div className="flex flex-col items-center gap-4 max-w-[280px] text-center">
          <svg viewBox="0 0 148 124" className="w-[148px] h-[124px] overflow-visible" aria-hidden="true">
            <path
              d="M30 22 C30 27.5 32.5 30 38 30 C32.5 30 30 32.5 30 38 C30 32.5 27.5 30 22 30 C27.5 30 30 27.5 30 22 Z"
              fill="#EBC5CF"
              stroke="#1C1A18"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M122 45 C122 49.5 124.5 52 129 52 C124.5 52 122 54.5 122 59 C122 54.5 119.5 52 115 52 C119.5 52 122 49.5 122 45 Z"
              fill="#789A82"
              stroke="#1C1A18"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="24" cy="76" r="3" fill="#FAF8F5" stroke="#1C1A18" strokeWidth="1.5" />
            <circle cx="94" cy="31" r="11.5" fill="#EBC5CF" stroke="#1C1A18" strokeWidth="1.8" />
            <path
              d="M52 53 H93 C99.5 53 102.5 47.8 100.5 42.5 C99 38.4 94.8 37.3 92 38.4 C89.8 30 81.5 25.8 74.2 29 C69 24.8 60.8 26.8 58.6 34.2 C52.4 34.6 47.2 39.4 47.6 45.6 C47.8 49.8 49.8 53 52 53 Z"
              fill="#FAF8F5"
              stroke="#1C1A18"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="41" y="66" width="70" height="46" rx="8" fill="#EAE5DA" />
            <rect
              x="38"
              y="63"
              width="70"
              height="46"
              rx="8"
              fill="#FAF8F5"
              stroke="#1C1A18"
              strokeWidth="1.8"
            />
            <path
              d="M92 63 V76 L96.5 72.5 L101 76 V63 Z"
              fill="#789A82"
              stroke="#1C1A18"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <line
              x1="48"
              y1="77"
              x2="84"
              y2="77"
              stroke="#1C1A18"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <line
              x1="48"
              y1="86"
              x2="82"
              y2="86"
              stroke="#1C1A18"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <line
              x1="48"
              y1="95"
              x2="72"
              y2="95"
              stroke="#7A756D"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="96" cy="96" r="4" fill="#EBC5CF" stroke="#1C1A18" strokeWidth="1.5" />
          </svg>
          <p className="text-xl font-medium text-[#1C1A18] tracking-wide">
            {lang === 'en' || lang === 'fr' ? 'Moments' : lang === 'es' ? 'Momentos' : 'Momenty'}
          </p>
          <p className="text-[11px] font-mono-meta uppercase tracking-[0.14em] text-[#7A756D] -mt-2">
            {lang === 'en'
              ? 'A quiet page for today'
              : lang === 'es'
              ? 'Una página tranquila para hoy'
              : lang === 'fr'
              ? 'Une page calme pour aujourd’hui'
              : 'Cicha kartka na dziś'}
          </p>
        </div>
      </div>
    );
  }

  const isPromptsRoute =
    currentPathname === '/prompts' || currentPathname.startsWith('/prompts/');
  const activePromptSlug = currentPathname.startsWith('/prompts/')
    ? decodeURIComponent(currentPathname.slice('/prompts/'.length).replace(/\/+$/, ''))
    : null;

  if (isPromptsRoute) {
    return (
      <PromptLibraryView
        slug={activePromptSlug}
        lang={lang}
        onLanguageChange={handleChangeLang}
        onNavigate={navigateTo}
        onGoogleLogin={handleGoogleLogin}
        onOpenInEditorWithPrompt={(selectedPrompt, draftText) => {
          setIsFreeThoughtMode(false);
          setAnsweredPromptId(selectedPrompt.id);
          localStorage.setItem(`kronika_answered_prompt_${todayKey}`, selectedPrompt.id);
          setPromptIndex(0);
          setPromptHistory(prev => {
            const updated = [
              selectedPrompt,
              ...prev.filter(p => p.id !== selectedPrompt.id),
            ].slice(0, 3);
            localStorage.setItem(`kronika_prompt_history_${todayKey}`, JSON.stringify(updated));
            return updated;
          });
          if (draftText.trim().length > 0) {
            setContent(draftText);
            saveEntry(draftText, false, writingTimeSeconds, selectedPrompt.id);
          }
          setShowLandingPreview(false);
          navigateTo('/');
        }}
        isSignedIn={Boolean(currentUser)}
        userName={currentUser?.displayName?.split(' ')[0] || undefined}
        userPhotoURL={currentUser?.photoURL || undefined}
        isAuthLoading={isAuthLoading}
        authError={authError}
      />
    );
  }

  if (!currentUser || showLandingPreview) {
    return (
      <LandingPage
        lang={lang}
        onLanguageChange={handleChangeLang}
        onGoogleLogin={handleGoogleLogin}
        onNavigate={navigateTo}
        onReturnToEditor={currentUser ? () => setShowLandingPreview(false) : undefined}
        userName={currentUser?.displayName?.split(' ')[0] || undefined}
        userPhotoURL={currentUser?.photoURL || undefined}
        isAuthLoading={isAuthLoading}
        authError={authError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C1A18] flex flex-col font-serif-literary antialiased selection:bg-[#E2DDD3]">
      {/* Top Header aligned with the centered main editorial column */}
      <header
        ref={headerRef}
        style={{
          top: 0,
          transform: 'translate3d(0, var(--vv-offset-top, 0px), 0)',
        }}
        className="w-full border-b border-[#EAE5DA]/80 select-none bg-[#F7F5F0]/95 sticky top-0 z-40 backdrop-blur-[2px] will-change-transform"
      >
        <div className="max-w-2xl mx-auto w-full px-6 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-base sm:text-lg font-serif-literary font-normal text-[#1C1A18] tracking-wide">
            {/* Cloud with sun logo mark only — no text */}
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
            <div className="inline-flex items-center gap-1">
              <span>
                {lang === 'en'
                  ? 'Hello'
                  : lang === 'es'
                  ? 'Hola'
                  : lang === 'fr'
                  ? 'Bonjour'
                  : 'Cześć'}
              </span>
              <button
                onClick={() => setShowAuthModal(true)}
                title={
                  lang === 'en'
                    ? 'Options, language & cloud sync'
                    : lang === 'es'
                    ? 'Opciones, idioma y sincronización en la nube'
                    : lang === 'fr'
                    ? 'Options, langue et synchronisation cloud'
                    : 'Opcje, język i synchronizacja chmurowa'
                }
                className="inline-flex items-center gap-1.5 py-0.5 rounded-md hover:bg-[#EAE5DA]/60 text-[#1C1A18] transition-colors cursor-pointer"
              >
                <span className="font-medium">
                  {currentUser?.displayName?.split(' ')[0] || 'Bartek'}
                </span>
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Avatar'}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-3.5 h-3.5 text-[#7A756D]" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Focus Writing Area & Sliding Crocodile Pages */}
      <main className="flex-1 flex flex-col text-left">
        <FocusEditor
          prompt={currentPrompt}
          promptIndex={promptIndex}
          totalPromptsInHistory={promptHistory.length}
          answeredPromptId={answeredPromptId}
          content={content}
          isSealed={isSealed}
          isLoadingEntry={isInitialDataLoading}
          saveStatus={saveStatus}
          companionId={companionId}
          hasKey={Boolean(encryptionKey)}
          encryptionKey={encryptionKey}
          decryptionError={decryptionError}
          rawCiphertext={rawCiphertext}
          entryDeviceName={entryDeviceName}
          currentDeviceName={currentDeviceName}
          keySyncMode={keySyncMode}
          syncedKeysCount={Math.max(1, keyring.length)}
          remainingRerolls={remainingRerolls}
          writingTimeSeconds={writingTimeSeconds}
          streak={streak}
          archiveCount={savedEntries.length}
          savedEntries={savedEntries}
          allPrompts={[...DAILY_PROMPTS, FREE_THOUGHT_PROMPT]}
          lang={lang}
          isFreeThoughtMode={isFreeThoughtMode}
          onToggleFreeThought={(enable: boolean) => {
            setIsFreeThoughtMode(enable);
            if (enable) {
              setAnsweredPromptId(FREE_THOUGHT_PROMPT_ID);
              localStorage.setItem(`kronika_answered_prompt_${todayKey}`, FREE_THOUGHT_PROMPT_ID);
              if (content.trim()) {
                saveEntry(content, isSealed, writingTimeSeconds, FREE_THOUGHT_PROMPT_ID);
              }
            } else {
              const restoredId = content.trim() ? baseDailyPrompt.id : '';
              setAnsweredPromptId(restoredId);
              if (restoredId) {
                localStorage.setItem(`kronika_answered_prompt_${todayKey}`, restoredId);
                saveEntry(content, isSealed, writingTimeSeconds, restoredId);
              } else {
                localStorage.removeItem(`kronika_answered_prompt_${todayKey}`);
              }
            }
          }}
          onContentChange={handleContentChange}
          onPrevPrompt={handlePrevPrompt}
          onNextPrompt={handleNextPrompt}
          onRerollPrompt={handleRerollPrompt}
          onAssignPromptToDraft={handleAssignCurrentPromptToDraft}
          onSealDay={handleSealDay}
          onUnsealDay={handleUnsealDay}
          onSaveKey={handleSaveKey}
          onUnlockWithPin={handleUnlockWithPin}
          onUpdateKeySyncMode={handleUpdateKeySyncMode}
          onResetLockedTodayEntry={handleResetLockedTodayEntry}
          onDeviceNameChange={handleDeviceNameChange}
          onDeleteEntry={handleDeleteEntry}
          onSelectCompanion={() => setShowCompanionModal(true)}
          onTickWritingTime={() => setWritingTimeSeconds(sec => sec + 1)}
          onSignOut={handleSignOut}
          hasPendingSparkle={hasPendingSparkle}
          sparkleTestMode={isAuthorizedAdmin(currentUser) && sparkleTestMode}
          sparkleCards={sparkleCards}
          onTriggerSparkle={() => handleTriggerSparkle(false)}
          onViewSparkleCard={card => {
            setActiveSparkleCard(card);
            setShowSparkleModal(true);
          }}
          onOpenOneTimeShare={customEntry => {
            if (customEntry && customEntry.content.trim()) {
              setShareModalTarget(customEntry);
            } else {
              setShareModalTarget({
                content,
                promptText: getPromptText(currentPrompt, lang),
                date: todayKey,
              });
            }
            setShowOneTimeShareModal(true);
          }}
        />
      </main>

      {/* Modals */}
      <SparkleModal
        isOpen={showSparkleModal}
        isLoading={isGeneratingSparkle}
        card={activeSparkleCard}
        lang={lang}
        onClose={() => setShowSparkleModal(false)}
      />

      <OneTimeShareModal
        isOpen={showOneTimeShareModal}
        content={shareModalTarget ? shareModalTarget.content : content}
        promptText={
          shareModalTarget ? shareModalTarget.promptText : getPromptText(currentPrompt, lang)
        }
        date={shareModalTarget ? shareModalTarget.date : todayKey}
        senderName={currentUser?.displayName?.split(' ')[0] || ''}
        currentLang={lang}
        onClose={() => {
          setShowOneTimeShareModal(false);
          setShareModalTarget(null);
        }}
      />

      <CompanionPickerModal
        isOpen={showCompanionModal}
        currentCompanion={companionId}
        lang={lang}
        onSelect={handleCompanionChange}
        onClose={() => setShowCompanionModal(false)}
      />

      <AuthModal
        isOpen={showAuthModal}
        user={currentUser}
        lang={lang}
        onLanguageChange={handleChangeLang}
        onAccountDeleted={() => {
          setSavedEntries([]);
          setSparkleCards([]);
          setHasPendingSparkle(false);
          setContent('');
          setIsSealed(false);
          setDecryptionError(false);
          setRawCiphertext('');
          setWritingTimeSeconds(0);
          setAnsweredPromptId('');
          setEncryptionKey('');
          setKeyring([]);
          setSaveStatus('idle');
          lastSavedContentRef.current = '';
        }}
        onOpenAdminPanel={
          isAuthorizedAdmin(currentUser)
            ? () => {
                setShowAuthModal(false);
                setShowAdminModal(true);
              }
            : undefined
        }
        sparkleTestMode={isAuthorizedAdmin(currentUser) ? sparkleTestMode : false}
        onToggleSparkleTestMode={
          isAuthorizedAdmin(currentUser)
            ? (enabled: boolean) => {
                setSparkleTestMode(enabled);
                try {
                  localStorage.setItem('kronika_sparkle_test_mode', String(enabled));
                } catch {
                  // ignore
                }
              }
            : undefined
        }
        onTestSparkleNow={
          isAuthorizedAdmin(currentUser)
            ? () => {
                handleTriggerSparkle(true);
              }
            : undefined
        }
        onClose={() => setShowAuthModal(false)}
      />

      <AdminPanelModal
        isOpen={showAdminModal}
        user={currentUser}
        lang={lang}
        onClose={() => setShowAdminModal(false)}
      />
    </div>
  );
}


