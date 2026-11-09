import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  X,
  RefreshCw,
  Shield,
  Users,
  FileText,
  Clock,
  Award,
  MessageSquare,
  Trash2,
  ArrowUpDown,
  Search,
  BarChart2,
  Globe,
  Check,
  Lock,
} from 'lucide-react';
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import {
  db,
  handleFirestoreError,
  OperationType,
} from '../services/firebase';
import {
  DAILY_PROMPTS,
  PromptCategory,
  getCategoryLabel,
  getPromptText,
  formatDateKey,
} from '../data/prompts';

export const ADMIN_EMAIL = 'mazurekbartosz1@gmail.com';

export function isAuthorizedAdmin(user: FirebaseUser | null | undefined): boolean {
  if (!user || !user.email) return false;
  return user.email.trim().toLowerCase() === ADMIN_EMAIL && user.emailVerified !== false;
}

interface AdminPanelModalProps {
  isOpen: boolean;
  user: FirebaseUser | null;
  lang: 'pl' | 'en' | 'es' | 'fr';
  onClose: () => void;
}

interface AnonymizedUserRow {
  anonId: string;
  isSelf: boolean;
  companion: string;
  keySyncMode: 'auto' | 'pin';
  createdAtIso: string;
  lastActiveDate: string; // YYYY-MM-DD or derived from updatedAt
  lastUpdatedIso: string;
  daysSinceLastActive: number;
  entriesCount: number;
  sealedEntriesCount: number;
  totalWords: number;
  totalChars: number;
  totalWritingSeconds: number;
  avgWritingSeconds: number;
  avgWordsPerEntry: number;
  calculatedStreak: number;
}

interface FeedbackItem {
  id: string;
  anonUserHash: string;
  message: string;
  includeEmail: boolean;
  userEmail: string;
  lang: string;
  createdAtIso: string;
}

type UserSortKey = 'lastActive' | 'entriesCount' | 'streak' | 'totalWords' | 'avgTime';
type UserFilterMode = 'all' | 'active7d' | 'active30d' | 'withEntries';

// Deterministic one-way anonymization hash (SHA-256 -> 6 hex chars)
async function hashUserIdToAnonTag(uid: string): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const encoded = new TextEncoder().encode(`momenty_anon_salt_${uid}`);
      const digest = await window.crypto.subtle.digest('SHA-256', encoded);
      const hex = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      return `#${hex.slice(0, 6)}`;
    }
  } catch {
    // Fallback below
  }
  let h = 2166136261;
  for (let i = 0; i < uid.length; i++) {
    h ^= uid.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `#${(h >>> 0).toString(16).padStart(6, '0').slice(0, 6)}`;
}

function toIsoString(val: unknown): string {
  if (!val) return '';
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'object' && val !== null && 'seconds' in val && typeof (val as any).seconds === 'number') {
    return new Date((val as any).seconds * 1000).toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return '';
}

function computeDaysBetween(dateKeyOrIso: string, todayKey: string): number {
  if (!dateKeyOrIso) return 9999;
  const datePart = dateKeyOrIso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return 9999;
  const [y1, m1, d1] = datePart.split('-').map(Number);
  const [y2, m2, d2] = todayKey.split('-').map(Number);
  const dt1 = new Date(y1, m1 - 1, d1);
  const dt2 = new Date(y2, m2 - 1, d2);
  const diffMs = dt2.getTime() - dt1.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function computeConsecutiveStreak(entryDates: string[], todayKey: string): number {
  if (entryDates.length === 0) return 0;
  const validDates = Array.from(
    new Set(entryDates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))
  ).sort((a, b) => b.localeCompare(a));

  if (validDates.length === 0) return 0;

  const formatD = (dt: Date) => {
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  const dateSet = new Set(validDates);
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const todayDate = new Date(ty, tm - 1, td);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = formatD(yesterdayDate);

  // If the user hasn't written today or yesterday, their active streak is 0 (we also compute their latest streak run)
  const [ly, lm, ld] = validDates[0].split('-').map(Number);
  const cursor =
    dateSet.has(todayKey)
      ? todayDate
      : dateSet.has(yesterdayKey)
      ? yesterdayDate
      : new Date(ly, lm - 1, ld);

  let count = 0;
  while (dateSet.has(formatD(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  user,
  lang,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  const [userRows, setUserRows] = useState<AnonymizedUserRow[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<PromptCategory, number>>({
    sensory: 0,
    memory: 0,
    gratitude: 0,
    reflection: 0,
    vision: 0,
  });
  const [topPrompts, setTopPrompts] = useState<{ id: string; count: number }[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null);
  const [confirmDeleteFeedbackId, setConfirmDeleteFeedbackId] = useState<string | null>(null);

  // Sorting & filtering state for the anonymized users table
  const [sortKey, setSortKey] = useState<UserSortKey>('lastActive');
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<UserFilterMode>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const isEn = lang === 'en';
  const isEs = lang === 'es';
  const isFr = lang === 'fr';
  const tr = useCallback(
    (pl: string, en: string, es?: string, fr?: string) =>
      isEn ? en : isEs ? (es ?? en) : isFr ? (fr ?? en) : pl,
    [isEn, isEs, isFr]
  );

  const todayKey = useMemo(() => formatDateKey(new Date()), []);

  const fetchAdminStats = useCallback(async () => {
    if (!isAuthorizedAdmin(user)) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch all user profile documents in /users
      let usersSnap;
      try {
        usersSnap = await getDocs(collection(db, 'users'));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'users');
        return;
      }

      const catTotals: Record<PromptCategory, number> = {
        sensory: 0,
        memory: 0,
        gratitude: 0,
        reflection: 0,
        vision: 0,
      };
      const promptTotals: Record<string, number> = {};
      const promptCategoryMap = new Map<string, PromptCategory>();
      DAILY_PROMPTS.forEach(p => promptCategoryMap.set(p.id, p.category));

      // 2. For each user document, fetch their /users/{uid}/entries metadata and anonymize
      const rows: AnonymizedUserRow[] = await Promise.all(
        usersSnap.docs.map(async userDoc => {
          const uData = userDoc.data();
          const uid = userDoc.id;
          const anonId = await hashUserIdToAnonTag(uid);

          let entriesDocs: any[] = [];
          try {
            const entriesSnap = await getDocs(collection(db, 'users', uid, 'entries'));
            entriesDocs = entriesSnap.docs.map(d => d.data());
          } catch {
            entriesDocs = [];
          }

          let totalWords = 0;
          let totalChars = 0;
          let totalWritingSeconds = 0;
          let sealedEntriesCount = 0;
          const entryDates: string[] = [];
          let latestEntryDate = '';
          let latestEntryUpdatedIso = '';

          for (const entry of entriesDocs) {
            const wc = typeof entry.wordCount === 'number' ? Math.max(0, entry.wordCount) : 0;
            const cc = typeof entry.characterCount === 'number' ? Math.max(0, entry.characterCount) : 0;
            const wt =
              typeof entry.writingTimeSeconds === 'number'
                ? Math.max(0, entry.writingTimeSeconds)
                : 0;

            totalWords += wc;
            totalChars += cc;
            totalWritingSeconds += wt;
            if (entry.isSealed) sealedEntriesCount += 1;

            if (typeof entry.date === 'string' && entry.date) {
              entryDates.push(entry.date);
              if (!latestEntryDate || entry.date > latestEntryDate) {
                latestEntryDate = entry.date;
              }
            }

            const entryUpdatedIso = toIsoString(entry.updatedAt) || toIsoString(entry.createdAt);
            if (entryUpdatedIso && (!latestEntryUpdatedIso || entryUpdatedIso > latestEntryUpdatedIso)) {
              latestEntryUpdatedIso = entryUpdatedIso;
            }

            if (typeof entry.promptId === 'string' && entry.promptId) {
              promptTotals[entry.promptId] = (promptTotals[entry.promptId] || 0) + 1;
              const cat = promptCategoryMap.get(entry.promptId);
              if (cat) {
                catTotals[cat] = (catTotals[cat] || 0) + 1;
              }
            }
          }

          const createdAtIso = toIsoString(uData.createdAt);
          const profileUpdatedIso = toIsoString(uData.updatedAt) || createdAtIso;
          const lastUpdatedIso =
            latestEntryUpdatedIso > profileUpdatedIso ? latestEntryUpdatedIso : profileUpdatedIso;

          const derivedLastActiveDate =
            latestEntryDate ||
            (typeof uData.lastActiveDate === 'string' && uData.lastActiveDate) ||
            (lastUpdatedIso ? lastUpdatedIso.slice(0, 10) : '') ||
            (createdAtIso ? createdAtIso.slice(0, 10) : '');

          const daysSinceLastActive = computeDaysBetween(derivedLastActiveDate, todayKey);
          const entriesCount = entriesDocs.length;
          const calculatedStreak =
            entriesCount > 0
              ? computeConsecutiveStreak(entryDates, todayKey)
              : typeof uData.currentStreak === 'number'
              ? uData.currentStreak
              : 0;

          return {
            anonId,
            isSelf: uid === user?.uid,
            companion: typeof uData.companion === 'string' ? uData.companion : 'crocodile',
            keySyncMode: uData.keySyncMode === 'pin' ? 'pin' : 'auto',
            createdAtIso,
            lastActiveDate: derivedLastActiveDate || '—',
            lastUpdatedIso,
            daysSinceLastActive,
            entriesCount,
            sealedEntriesCount,
            totalWords,
            totalChars,
            totalWritingSeconds,
            avgWritingSeconds: entriesCount > 0 ? Math.round(totalWritingSeconds / entriesCount) : 0,
            avgWordsPerEntry: entriesCount > 0 ? Math.round(totalWords / entriesCount) : 0,
            calculatedStreak,
          };
        })
      );

      // 3. Fetch feedback submissions from /feedback
      const feedbacks: FeedbackItem[] = [];
      try {
        const fbSnap = await getDocs(collection(db, 'feedback'));
        for (const fbDoc of fbSnap.docs) {
          const d = fbDoc.data();
          const anonUserHash = await hashUserIdToAnonTag(String(d.userId || fbDoc.id));
          feedbacks.push({
            id: fbDoc.id,
            anonUserHash,
            message: String(d.message || ''),
            includeEmail: Boolean(d.includeEmail),
            userEmail: d.includeEmail && d.userEmail ? String(d.userEmail) : '',
            lang: String(d.lang || 'pl'),
            createdAtIso: toIsoString(d.createdAt),
          });
        }
        feedbacks.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
      } catch {
        // Ignore if feedback collection is empty
      }

      const sortedPrompts = Object.entries(promptTotals)
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setUserRows(rows);
      setCategoryCounts(catTotals);
      setTopPrompts(sortedPrompts);
      setFeedbackList(feedbacks);
      setLastRefreshedAt(
        new Date().toLocaleTimeString(lang === 'pl' ? 'pl-PL' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    } catch (err: any) {
      console.error('Admin stats fetch error:', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : tr('Nie udało się pobrać statystyk.', 'Failed to load admin statistics.')
      );
    } finally {
      setIsLoading(false);
    }
  }, [user, todayKey, lang, tr]);

  useEffect(() => {
    if (isOpen && isAuthorizedAdmin(user)) {
      fetchAdminStats();
    }
  }, [isOpen, user, fetchAdminStats]);

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!isAuthorizedAdmin(user)) return;
    setDeletingFeedbackId(feedbackId);
    try {
      await deleteDoc(doc(db, 'feedback', feedbackId));
      setFeedbackList(prev => prev.filter(item => item.id !== feedbackId));
      setConfirmDeleteFeedbackId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `feedback/${feedbackId}`);
    } finally {
      setDeletingFeedbackId(null);
    }
  };

  // Aggregate Platform KPIs
  const platformSummary = useMemo(() => {
    const totalUsers = userRows.length;
    const active7d = userRows.filter(u => u.daysSinceLastActive <= 7).length;
    const active30d = userRows.filter(u => u.daysSinceLastActive <= 30).length;
    const usersWithPosts = userRows.filter(u => u.entriesCount > 0).length;
    const totalPosts = userRows.reduce((acc, u) => acc + u.entriesCount, 0);
    const totalSealed = userRows.reduce((acc, u) => acc + u.sealedEntriesCount, 0);
    const totalWords = userRows.reduce((acc, u) => acc + u.totalWords, 0);
    const totalWritingSec = userRows.reduce((acc, u) => acc + u.totalWritingSeconds, 0);
    const avgWritingSecPerPost = totalPosts > 0 ? Math.round(totalWritingSec / totalPosts) : 0;
    const avgWordsPerPost = totalPosts > 0 ? Math.round(totalWords / totalPosts) : 0;
    const pinSyncCount = userRows.filter(u => u.keySyncMode === 'pin').length;
    const autoSyncCount = totalUsers - pinSyncCount;

    return {
      totalUsers,
      active7d,
      active30d,
      usersWithPosts,
      totalPosts,
      totalSealed,
      totalWords,
      totalWritingSec,
      avgWritingSecPerPost,
      avgWordsPerPost,
      pinSyncCount,
      autoSyncCount,
    };
  }, [userRows]);

  // Filtered & sorted user rows
  const displayedUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = userRows.filter(u => {
      if (filterMode === 'active7d' && u.daysSinceLastActive > 7) return false;
      if (filterMode === 'active30d' && u.daysSinceLastActive > 30) return false;
      if (filterMode === 'withEntries' && u.entriesCount === 0) return false;
      if (q) {
        return (
          u.anonId.toLowerCase().includes(q) ||
          u.lastActiveDate.toLowerCase().includes(q) ||
          u.companion.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'lastActive') {
        cmp = a.lastActiveDate.localeCompare(b.lastActiveDate);
      } else if (sortKey === 'entriesCount') {
        cmp = a.entriesCount - b.entriesCount;
      } else if (sortKey === 'streak') {
        cmp = a.calculatedStreak - b.calculatedStreak;
      } else if (sortKey === 'totalWords') {
        cmp = a.totalWords - b.totalWords;
      } else if (sortKey === 'avgTime') {
        cmp = a.avgWritingSeconds - b.avgWritingSeconds;
      }
      return sortDesc ? -cmp : cmp;
    });
  }, [userRows, filterMode, searchQuery, sortKey, sortDesc]);

  const handleSortClick = (key: UserSortKey) => {
    if (sortKey === key) {
      setSortDesc(prev => !prev);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatRelativeDays = (days: number): string => {
    if (days === 0) return tr('Dzisiaj', 'Today', 'Hoy', "Aujourd'hui");
    if (days === 1) return tr('Wczoraj', 'Yesterday', 'Ayer', 'Hier');
    if (days >= 9000) return '—';
    return tr(`${days} dni temu`, `${days}d ago`, `hace ${days}d`, `il y a ${days}j`);
  };

  if (!isOpen || !isAuthorizedAdmin(user)) return null;

  const totalCategorizedEntries = (Object.values(categoryCounts) as number[]).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/45 backdrop-blur-[2px] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-[#FAF8F5] border border-[#E2DDD3] rounded-xl shadow-2xl text-[#1C1A18] my-auto max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Admin Header */}
        <div className="px-5 sm:px-7 py-4 border-b border-[#E5DFD3] bg-[#F2EFE8]/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#1C1A18] text-[#FAF8F5] flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-[#EBC5CF]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-base sm:text-lg font-serif-literary font-medium text-[#1C1A18] truncate">
                <span>
                  {tr(
                    'Panel Administratora · Anonimowe Statystyki',
                    'Admin Panel · Anonymized Analytics',
                    'Panel de Administración · Estadísticas Anónimas',
                    'Panneau Admin · Statistiques Anonymisées'
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono-meta text-[#7A756D] truncate">
                <span>{ADMIN_EMAIL}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {tr(
                    'Szyfrowanie E2EE zachowane (0 dostępu do treści wpisów)',
                    'Zero-knowledge E2EE preserved (no entry content access)'
                  )}
                </span>
                {lastRefreshedAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {tr('Odświeżono:', 'Updated:')} {lastRefreshedAt}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchAdminStats}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg border border-[#D4CEBF] bg-[#FAF8F5] hover:bg-[#EAE5DA] text-xs font-mono-meta text-[#1C1A18] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{tr('Odśwież', 'Refresh', 'Actualizar', 'Actualiser')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#7A756D] hover:text-[#1C1A18] hover:bg-[#EAE5DA] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-8 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-[#FDF2F2] border border-[#E8C5C5] text-xs font-mono-meta text-[#8B2635]">
              {errorMsg}
            </div>
          )}

          {/* 1. PLATFORM KPI OVERVIEW (5-column grid) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono-meta uppercase tracking-wider text-[#7A756D] flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-[#524D46]" />
                <span>
                  {tr(
                    '01. Podsumowanie aktywności platformy',
                    '01. Platform Activity Overview'
                  )}
                </span>
              </h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Total Users */}
              <div className="p-4 rounded-lg bg-[#F2EFE8] border border-[#E2DDD3] space-y-1">
                <div className="text-[11px] font-mono-meta text-[#7A756D] flex items-center justify-between">
                  <span>{tr('Użytkownicy', 'Total Users')}</span>
                  <Users className="w-3.5 h-3.5 text-[#7A756D]" />
                </div>
                <div className="text-2xl font-serif-literary font-semibold text-[#1C1A18] tabular-nums">
                  {isLoading && userRows.length === 0 ? '…' : platformSummary.totalUsers}
                </div>
                <div className="text-[11px] font-mono-meta text-[#6E675F] tabular-nums">
                  {platformSummary.usersWithPosts}{' '}
                  {tr('z min. 1 wpisem', 'with ≥1 post')}
                </div>
              </div>

              {/* Active 7d / 30d */}
              <div className="p-4 rounded-lg bg-[#F2EFE8] border border-[#E2DDD3] space-y-1">
                <div className="text-[11px] font-mono-meta text-[#7A756D] flex items-center justify-between">
                  <span>{tr('Aktywni (7d / 30d)', 'Active (7d / 30d)')}</span>
                  <Award className="w-3.5 h-3.5 text-[#2E5C33]" />
                </div>
                <div className="text-2xl font-serif-literary font-semibold text-[#1C1A18] tabular-nums">
                  {isLoading && userRows.length === 0
                    ? '…'
                    : `${platformSummary.active7d} / ${platformSummary.active30d}`}
                </div>
                <div className="text-[11px] font-mono-meta text-[#2E5C33] tabular-nums">
                  {platformSummary.totalUsers > 0
                    ? `${Math.round((platformSummary.active7d / platformSummary.totalUsers) * 100)}% ${tr('w tym tyg.', 'this week')}`
                    : '0%'}
                </div>
              </div>

              {/* Total Entries */}
              <div className="p-4 rounded-lg bg-[#F2EFE8] border border-[#E2DDD3] space-y-1">
                <div className="text-[11px] font-mono-meta text-[#7A756D] flex items-center justify-between">
                  <span>{tr('Wszystkie wpisy', 'Total Entries')}</span>
                  <FileText className="w-3.5 h-3.5 text-[#7A756D]" />
                </div>
                <div className="text-2xl font-serif-literary font-semibold text-[#1C1A18] tabular-nums">
                  {isLoading && userRows.length === 0 ? '…' : platformSummary.totalPosts}
                </div>
                <div className="text-[11px] font-mono-meta text-[#6E675F] tabular-nums">
                  {platformSummary.totalSealed}{' '}
                  {tr('zapieczętowanych', 'sealed')}
                </div>
              </div>

              {/* Total Words */}
              <div className="p-4 rounded-lg bg-[#F2EFE8] border border-[#E2DDD3] space-y-1">
                <div className="text-[11px] font-mono-meta text-[#7A756D] flex items-center justify-between">
                  <span>{tr('Napisane słowa', 'Total Words')}</span>
                  <Globe className="w-3.5 h-3.5 text-[#7A756D]" />
                </div>
                <div className="text-2xl font-serif-literary font-semibold text-[#1C1A18] tabular-nums">
                  {isLoading && userRows.length === 0
                    ? '…'
                    : platformSummary.totalWords.toLocaleString()}
                </div>
                <div className="text-[11px] font-mono-meta text-[#6E675F] tabular-nums">
                  {tr('śr.', 'avg')} {platformSummary.avgWordsPerPost}{' '}
                  {tr('słów / wpis', 'words / post')}
                </div>
              </div>

              {/* Avg Writing Time */}
              <div className="p-4 rounded-lg bg-[#F2EFE8] border border-[#E2DDD3] space-y-1 col-span-2 sm:col-span-1">
                <div className="text-[11px] font-mono-meta text-[#7A756D] flex items-center justify-between">
                  <span>{tr('Śr. czas pisania', 'Avg Writing Time')}</span>
                  <Clock className="w-3.5 h-3.5 text-[#7A756D]" />
                </div>
                <div className="text-2xl font-serif-literary font-semibold text-[#1C1A18] tabular-nums">
                  {isLoading && userRows.length === 0
                    ? '…'
                    : formatDuration(platformSummary.avgWritingSecPerPost)}
                </div>
                <div className="text-[11px] font-mono-meta text-[#6E675F] tabular-nums">
                  {tr('łącznie', 'total')} {formatDuration(platformSummary.totalWritingSec)}
                </div>
              </div>
            </div>
          </section>

          {/* 2. ANONYMIZED USER COHORT TABLE */}
          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-mono-meta uppercase tracking-wider text-[#7A756D] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#524D46]" />
                  <span>
                    {tr(
                      '02. Anonimowa tabela użytkowników (SHA-256 ID)',
                      '02. Anonymized User Table (SHA-256 ID)'
                    )}
                  </span>
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Segmented Filter */}
                <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EAE5DA] border border-[#DDD6C8]">
                  {(
                    [
                      { id: 'all', label: tr('Wszyscy', 'All') },
                      { id: 'active7d', label: tr('Aktywni 7d', 'Active 7d') },
                      { id: 'active30d', label: tr('Aktywni 30d', 'Active 30d') },
                      { id: 'withEntries', label: tr('Z wpisami', 'With posts') },
                    ] as { id: UserFilterMode; label: string }[]
                  ).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterMode(tab.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono-meta transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        filterMode === tab.id
                          ? 'bg-[#1C1A18] text-[#FAF8F5] font-medium'
                          : 'text-[#524D46] hover:text-[#1C1A18]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#7A756D] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={tr('Szukaj #id lub daty...', 'Search #id or date...')}
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-[#D4CEBF] bg-[#FAF8F5] text-xs font-mono-meta text-[#1C1A18] placeholder-[#9E978C] focus:outline-none focus:border-[#1C1A18] w-44"
                  />
                </div>
              </div>
            </div>

            <div className="border border-[#E2DDD3] rounded-lg bg-[#FAF8F5] overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2DDD3] bg-[#F2EFE8] text-[11px] font-mono-meta text-[#6E675F]">
                    <th className="py-2.5 px-3.5 font-medium whitespace-nowrap">
                      {tr('Anonimowe ID', 'Anon User ID')}
                    </th>
                    <th className="py-2.5 px-3.5 font-medium whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSortClick('lastActive')}
                        className="inline-flex items-center gap-1 hover:text-[#1C1A18] cursor-pointer"
                      >
                        <span>{tr('Ostatnia aktywność', 'Last Active')}</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-2.5 px-3.5 font-medium text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSortClick('entriesCount')}
                        className="inline-flex items-center gap-1 hover:text-[#1C1A18] cursor-pointer ml-auto"
                      >
                        <span>{tr('Liczba wpisów', 'Posts')}</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-2.5 px-3.5 font-medium text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSortClick('streak')}
                        className="inline-flex items-center gap-1 hover:text-[#1C1A18] cursor-pointer ml-auto"
                      >
                        <span>{tr('Passa (dni)', 'Streak')}</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-2.5 px-3.5 font-medium text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSortClick('totalWords')}
                        className="inline-flex items-center gap-1 hover:text-[#1C1A18] cursor-pointer ml-auto"
                      >
                        <span>{tr('Słowa (łącznie / śr.)', 'Words (total / avg)')}</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-2.5 px-3.5 font-medium text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSortClick('avgTime')}
                        className="inline-flex items-center gap-1 hover:text-[#1C1A18] cursor-pointer ml-auto"
                      >
                        <span>{tr('Śr. czas / wpis', 'Avg Time')}</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-2.5 px-3.5 font-medium text-right whitespace-nowrap">
                      {tr('Tryb klucza', 'Key Sync')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECE7DC] text-xs font-mono-meta tabular-nums">
                  {displayedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#7A756D] font-serif-literary">
                        {isLoading
                          ? tr('Wczytywanie anonimowych danych...', 'Loading anonymized user data...')
                          : tr('Brak użytkowników spełniających kryteria.', 'No users match the current filter.')}
                      </td>
                    </tr>
                  ) : (
                    displayedUsers.map(u => (
                      <tr
                        key={u.anonId}
                        className="hover:bg-[#F2EFE8]/70 transition-colors"
                      >
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#1C1A18]">
                              User {u.anonId}
                            </span>
                            {u.isSelf && (
                              <span className="text-[10px] text-[#8B2635]">
                                · {tr('Ty', 'You')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-[#1C1A18]">{u.lastActiveDate}</span>
                            <span className="text-[#7A756D] text-[11px]">
                              · {formatRelativeDays(u.daysSinceLastActive)}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <span className="font-semibold text-[#1C1A18]">{u.entriesCount}</span>
                          {u.sealedEntriesCount > 0 && (
                            <span className="text-[#7A756D] text-[11px]">
                              {' '}
                              ({u.sealedEntriesCount} {tr('zamkn.', 'sealed')})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <span
                            className={
                              u.calculatedStreak >= 3
                                ? 'font-semibold text-[#2E5C33]'
                                : 'text-[#1C1A18]'
                            }
                          >
                            {u.calculatedStreak} {tr('dni', 'd')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <span className="text-[#1C1A18]">{u.totalWords.toLocaleString()}</span>
                          <span className="text-[#7A756D] text-[11px]">
                            {' '}
                            · {tr('śr.', 'avg')} {u.avgWordsPerEntry}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap text-[#524D46]">
                          {formatDuration(u.avgWritingSeconds)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap text-[#6E675F]">
                          <span className="inline-flex items-center gap-1 justify-end">
                            <Lock className="w-3 h-3 text-[#7A756D]" />
                            <span>{u.keySyncMode === 'pin' ? 'PIN' : 'Auto E2EE'}</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. PROMPT CATEGORIES & TOP QUESTIONS BREAKDOWN */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Categories distribution */}
            <div className="p-4 sm:p-5 rounded-lg bg-[#F2EFE8] border border-[#E2DDD3] space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono-meta uppercase tracking-wider text-[#7A756D]">
                  {tr('03. Popularność kategorii pytań', '03. Prompt Categories Breakdown')}
                </h4>
                <span className="text-[11px] font-mono-meta text-[#7A756D] tabular-nums">
                  {totalCategorizedEntries} {tr('odpowiedzi', 'answers')}
                </span>
              </div>

              <div className="space-y-2.5">
                {(['sensory', 'memory', 'gratitude', 'reflection', 'vision'] as PromptCategory[]).map(
                  cat => {
                    const count = categoryCounts[cat] || 0;
                    const pct =
                      totalCategorizedEntries > 0
                        ? Math.round((count / totalCategorizedEntries) * 100)
                        : 0;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-mono-meta tabular-nums">
                          <span className="text-[#1C1A18] font-medium">
                            {getCategoryLabel(cat, lang)}
                          </span>
                          <span className="text-[#6E675F]">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#E2DDD3] overflow-hidden">
                          <div
                            className="h-full bg-[#1C1A18] rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              <div className="pt-2 border-t border-[#E2DDD3] flex items-center justify-between text-[11px] font-mono-meta text-[#6E675F] tabular-nums">
                <span>
                  {tr('Synchronizacja klucza E2EE:', 'E2EE Key Sync Mode:')}
                </span>
                <span>
                  Auto: {platformSummary.autoSyncCount} · PIN: {platformSummary.pinSyncCount}
                </span>
              </div>
            </div>

            {/* Top 5 Answered Questions */}
            <div className="p-4 sm:p-5 rounded-lg bg-[#F2EFE8] border border-[#E2DDD3] space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono-meta uppercase tracking-wider text-[#7A756D]">
                  {tr('Najczęściej wybierane pytania', 'Most Answered Daily Prompts')}
                </h4>
              </div>

              {topPrompts.length === 0 ? (
                <p className="text-xs font-serif-literary text-[#7A756D] py-4">
                  {tr('Brak danych o pytaniach.', 'No prompt data yet.')}
                </p>
              ) : (
                <div className="divide-y divide-[#E2DDD3]">
                  {topPrompts.map((item, idx) => {
                    const found = DAILY_PROMPTS.find(p => p.id === item.id);
                    return (
                      <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                        <div className="text-xs font-serif-literary text-[#1C1A18] leading-snug">
                          <span className="font-mono-meta text-[11px] text-[#7A756D] mr-1.5 tabular-nums">
                            0{idx + 1}.
                          </span>
                          <span>
                            {found ? getPromptText(found, lang) : item.id}
                          </span>
                        </div>
                        <span className="text-xs font-mono-meta font-semibold text-[#1C1A18] tabular-nums shrink-0">
                          {item.count}×
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 4. USER FEEDBACK INBOX */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono-meta uppercase tracking-wider text-[#7A756D] flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#524D46]" />
                <span>
                  {tr(
                    `04. Skrzynka opinii użytkowników (${feedbackList.length})`,
                    `04. Submitted User Feedback Inbox (${feedbackList.length})`
                  )}
                </span>
              </h4>
            </div>

            {feedbackList.length === 0 ? (
              <div className="p-6 rounded-lg border border-[#E2DDD3] bg-[#F2EFE8]/50 text-center text-xs font-serif-literary text-[#7A756D]">
                {tr(
                  'Brak przesłanych opinii w bazie danych.',
                  'No feedback messages submitted yet.'
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {feedbackList.map(fb => (
                  <div
                    key={fb.id}
                    className="p-4 rounded-lg border border-[#E2DDD3] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-meta text-[#7A756D] tabular-nums">
                        <span className="font-semibold text-[#1C1A18]">
                          User {fb.anonUserHash}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {fb.includeEmail && fb.userEmail
                            ? fb.userEmail
                            : tr('Anonimowo', 'Anonymous')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="uppercase">{fb.lang}</span>
                        {fb.createdAtIso && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{fb.createdAtIso.slice(0, 16).replace('T', ' ')}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm font-serif-literary text-[#1C1A18] whitespace-pre-wrap leading-relaxed">
                        {fb.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {confirmDeleteFeedbackId === fb.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDeleteFeedback(fb.id)}
                            disabled={deletingFeedbackId === fb.id}
                            className="px-2.5 py-1 rounded bg-[#8B2635] text-white text-[11px] font-mono-meta hover:bg-[#731D2A] cursor-pointer whitespace-nowrap"
                          >
                            {deletingFeedbackId === fb.id
                              ? tr('Usuwanie...', 'Deleting...')
                              : tr('Potwierdź', 'Confirm')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteFeedbackId(null)}
                            className="px-2 py-1 rounded border border-[#D4CEBF] text-[11px] font-mono-meta text-[#524D46] hover:text-[#1C1A18] cursor-pointer whitespace-nowrap"
                          >
                            {tr('Anuluj', 'Cancel')}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteFeedbackId(fb.id)}
                          className="p-1.5 rounded text-[#7A756D] hover:text-[#8B2635] hover:bg-[#F2EFE8] transition-colors cursor-pointer"
                          title={tr('Usuń wiadomość', 'Delete feedback')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
