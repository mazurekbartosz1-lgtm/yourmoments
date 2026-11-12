import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Download,
  ArrowLeft,
  ShieldCheck,
  Feather,
  Calendar,
  RefreshCw,
  Instagram,
  Image as ImageIcon,
  Bookmark,
  Layers,
  Send,
  Trash2,
  ExternalLink,
  Wand2,
  Database,
  Smartphone,
  Square,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  db,
  auth,
  hasValidFirebaseApiKey,
  OperationType,
  handleFirestoreError,
} from '../services/firebase';

export interface GeneratedCampaignPost {
  id: string;
  partLabel: string;
  featureTitle: string;
  accentHex: string;
  headline: string;
  visualQuote: string;
  caption: string;
  hashtags: string[];
  imageUrl: string;
  imageSource: 'doop_api' | 'doop_svg_fallback';
  doopStatusMessage: string;
  dimensions: string;
  format?: 'post' | 'story';
  stylePrompt?: string;
  doopProjectId?: string;
}

export interface RefinedProposal {
  id: string;
  angleBadge: string;
  angleRationale: string;
  headline: string;
  visualQuote: string;
  caption: string;
  hashtags: string[];
  nanoBananaPrompt: string;
  accentHex: string;
  format: 'post' | 'story';
  initialCardPreviewUrl: string;
  nanoBananaImageUrl?: string;
  nanoBananaModelUsed?: string;
  nanoBananaStatus?: string;
  isGeneratingNanoBanana?: boolean;
}

export interface SavedCampaignLineage {
  id: string;
  userId: string;
  rawIdea: string;
  format: 'post' | 'story';
  lang: 'pl' | 'en';
  selectedAngleTitle: string;
  headline: string;
  visualQuote: string;
  caption: string;
  hashtags: string[];
  nanoBananaPrompt: string;
  lineageSummary: string;
  userNotes: string;
  doopProjectId: string;
  doopProjectUrl: string;
  doopPostCount: number;
  previewImageUrl?: string;
  createdAtIso: string;
}

interface AdminCampaignViewProps {
  initialLang?: 'pl' | 'en' | 'es' | 'fr';
  onNavigateHome: () => void;
}

const LOCAL_SAVED_IDEAS_KEY = 'momenty_saved_campaign_lineages_v1';

export const AdminCampaignView: React.FC<AdminCampaignViewProps> = ({
  initialLang = 'pl',
  onNavigateHome,
}) => {
  const [campaignLang, setCampaignLang] = useState<'en' | 'pl'>(
    initialLang === 'en' ? 'en' : 'pl'
  );
  const [igFormat, setIgFormat] = useState<'post' | 'story'>('post');
  const [rawIdea, setRawIdea] = useState<string>('');
  const [userNotes, setUserNotes] = useState<string>('');
  const [doopProjectNameInput, setDoopProjectNameInput] = useState<string>('');

  // Step 2: 3 Refined Proposals from Google AI
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [proposals, setProposals] = useState<RefinedProposal[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);

  // Step 5: Doop Expanded Series & Project
  const [isExpandingInDoop, setIsExpandingInDoop] = useState<boolean>(false);
  const [doopSeriesPosts, setDoopSeriesPosts] = useState<GeneratedCampaignPost[]>([]);
  const [activeDoopProject, setActiveDoopProject] = useState<{
    projectName: string;
    projectId: string;
    projectUrl: string;
    dimensions: string;
    format: 'post' | 'story';
  } | null>(null);

  // Quick 3-Pillar Generator state
  const [isGeneratingPillars, setIsGeneratingPillars] = useState<boolean>(false);

  // Step 4: Database Lineage Persistence (Firestore + LocalStorage mirror)
  const [savedLineages, setSavedLineages] = useState<SavedCampaignLineage[]>([]);
  const [isSavingLineage, setIsSavingLineage] = useState<string | null>(null);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const isPl = campaignLang === 'pl';
  const tr = (pl: string, en: string) => (isPl ? pl : en);

  // Load saved campaign lineages from localStorage + Firestore
  const loadSavedLineages = useCallback(async () => {
    let localItems: SavedCampaignLineage[] = [];
    try {
      const raw = localStorage.getItem(LOCAL_SAVED_IDEAS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localItems = parsed;
        }
      }
    } catch {
      // ignore local storage parse errors
    }

    const currentUser = auth?.currentUser;
    if (hasValidFirebaseApiKey && currentUser) {
      const path = 'campaign_ideas';
      try {
        const q = query(collection(db, path), where('userId', '==', currentUser.uid));
        const snap = await getDocs(q);
        const remoteItems: SavedCampaignLineage[] = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          remoteItems.push({
            id: d.id || docSnap.id,
            userId: d.userId || currentUser.uid,
            rawIdea: d.rawIdea || '',
            format: d.format === 'story' ? 'story' : 'post',
            lang: d.lang === 'en' ? 'en' : 'pl',
            selectedAngleTitle: d.selectedAngleTitle || '',
            headline: d.headline || '',
            visualQuote: d.visualQuote || '',
            caption: d.caption || '',
            hashtags: Array.isArray(d.hashtags) ? d.hashtags : [],
            nanoBananaPrompt: d.nanoBananaPrompt || '',
            lineageSummary: d.lineageSummary || '',
            userNotes: d.userNotes || '',
            doopProjectId: d.doopProjectId || '',
            doopProjectUrl: d.doopProjectUrl || '',
            doopPostCount: typeof d.doopPostCount === 'number' ? d.doopPostCount : 0,
            createdAtIso:
              d.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
          });
        });

        // Merge remote + local by ID
        const mergedMap = new Map<string, SavedCampaignLineage>();
        for (const item of localItems) mergedMap.set(item.id, item);
        for (const item of remoteItems) {
          const existingLocal = mergedMap.get(item.id);
          mergedMap.set(item.id, {
            ...item,
            previewImageUrl: existingLocal?.previewImageUrl,
          });
        }
        const merged = Array.from(mergedMap.values()).sort((a, b) =>
          b.createdAtIso.localeCompare(a.createdAtIso)
        );
        setSavedLineages(merged);
        try {
          localStorage.setItem(LOCAL_SAVED_IDEAS_KEY, JSON.stringify(merged.slice(0, 40)));
        } catch {
          // ignore quota
        }
        return;
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.LIST, path);
        } catch {
          // Fallback to local items if Firestore permissions/offline
        }
      }
    }

    setSavedLineages(
      localItems.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
    );
  }, []);

  useEffect(() => {
    loadSavedLineages();
  }, [loadSavedLineages]);

  // STEP 1 -> STEP 2: Refine Raw Idea into 3 Google AI Proposals
  const handleRefineIdea = async () => {
    const clean = rawIdea.trim();
    if (!clean || isRefining) return;

    setIsRefining(true);
    setErrorMsg(null);
    setSaveSuccessBanner(null);

    try {
      const response = await fetch('/api/admin/campaign/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIdea: clean,
          format: igFormat,
          lang: campaignLang,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data.proposals) && data.proposals.length > 0) {
        setProposals(data.proposals);
        setSelectedProposalId(data.proposals[0].id);
        setDoopProjectNameInput(
          `YourMoments · ${String(data.proposals[0].headline || clean).slice(0, 34)}`
        );
      } else {
        throw new Error('Brak propozycji w odpowiedzi serwera');
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          tr(
            'Nie udało się wygenerować 3 propozycji Google AI.',
            'Failed to refine raw idea into 3 proposals.'
          )
      );
    } finally {
      setIsRefining(false);
    }
  };

  // STEP 3: Generate Google Nano Banana Initial Preview for a Proposal
  const handleGenerateNanoBanana = async (proposalId: string) => {
    const target = proposals.find(p => p.id === proposalId);
    if (!target || target.isGeneratingNanoBanana) return;

    setProposals(prev =>
      prev.map(p =>
        p.id === proposalId ? { ...p, isGeneratingNanoBanana: true } : p
      )
    );
    setErrorMsg(null);

    try {
      const response = await fetch('/api/admin/campaign/nano-banana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: target.nanoBananaPrompt,
          format: igFormat,
          headline: target.headline,
          visualQuote: target.visualQuote,
          angleBadge: target.angleBadge,
          accentHex: target.accentHex,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setProposals(prev =>
        prev.map(p =>
          p.id === proposalId
            ? {
                ...p,
                nanoBananaImageUrl: data.imageUrl,
                nanoBananaModelUsed: data.modelUsed,
                nanoBananaStatus: data.statusMessage,
                isGeneratingNanoBanana: false,
              }
            : p
        )
      );
      setSelectedProposalId(proposalId);
    } catch (err: any) {
      setProposals(prev =>
        prev.map(p =>
          p.id === proposalId ? { ...p, isGeneratingNanoBanana: false } : p
        )
      );
      setErrorMsg(
        err?.message ||
          tr(
            'Błąd generowania podglądu Nano Banana.',
            'Failed to generate Nano Banana preview.'
          )
      );
    }
  };

  // STEP 4: Save Liked Proposal + How We Got There (Lineage) to Database (Firestore + LocalStorage)
  const handleSaveLineageToDb = async (
    proposal: RefinedProposal,
    doopMeta?: { projectId: string; projectUrl: string; postCount: number }
  ) => {
    setIsSavingLineage(proposal.id);
    setErrorMsg(null);

    const ideaId = `idea_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const currentUser = auth?.currentUser;
    const ownerUid = currentUser?.uid || 'local_founder_admin';

    // Build complete "Jak do tego doszliśmy" lineage summary across all 3 proposals
    const allProposalsPath = proposals
      .map(
        (p, idx) =>
          `[${idx + 1}] ${p.angleBadge}: "${p.headline}" (Uzasadnienie AI: ${p.angleRationale})`
      )
      .join('\n');

    const lineageSummary = [
      `1. SUROWY POMYSŁ (RAW IDEA): ${rawIdea.trim() || proposal.headline}`,
      `2. FORMAT INSTAGRAM: ${
        igFormat === 'story' ? 'Stories 9:16 (1080×1920)' : 'Post 1:1 (1080×1080)'
      }`,
      `3. 3 PROPOZYCJE GOOGLE AI:\n${allProposalsPath}`,
      `4. WYBRANY KIERUNEK: ${proposal.angleBadge} — ${proposal.angleRationale}`,
      `5. PROMPT NANO BANANA: ${proposal.nanoBananaPrompt}`,
      doopMeta
        ? `6. PROJEKT W DOOP: ID=${doopMeta.projectId} (${doopMeta.postCount} wygenerowane kreacje w stylu Nano Banana)`
        : `6. STATUS DOOP: Zapisano przed wysłaniem serii do Doop`,
    ]
      .join('\n\n')
      .slice(0, 11800);

    const cleanHashtags = (proposal.hashtags || [])
      .map(h => String(h).trim().slice(0, 110))
      .filter(Boolean)
      .slice(0, 15);

    const newRecord: SavedCampaignLineage = {
      id: ideaId,
      userId: ownerUid,
      rawIdea: (rawIdea.trim() || proposal.headline).slice(0, 3900),
      format: igFormat,
      lang: campaignLang,
      selectedAngleTitle: proposal.angleBadge.slice(0, 290),
      headline: proposal.headline.slice(0, 490),
      visualQuote: proposal.visualQuote.slice(0, 980),
      caption: proposal.caption.slice(0, 7900),
      hashtags: cleanHashtags,
      nanoBananaPrompt: proposal.nanoBananaPrompt.slice(0, 2900),
      lineageSummary,
      userNotes: (userNotes.trim() || 'Podoba mi się ten kierunek i ton Idea Explorera.').slice(
        0,
        1900
      ),
      doopProjectId: (doopMeta?.projectId || activeDoopProject?.projectId || '').slice(0, 250),
      doopProjectUrl: (doopMeta?.projectUrl || activeDoopProject?.projectUrl || '').slice(
        0,
        980
      ),
      doopPostCount: doopMeta?.postCount ?? doopSeriesPosts.length ?? 0,
      previewImageUrl: proposal.nanoBananaImageUrl || proposal.initialCardPreviewUrl,
      createdAtIso: new Date().toISOString(),
    };

    // 1. Save immediately to LocalStorage mirror
    const updatedLocal = [newRecord, ...savedLineages.filter(x => x.id !== ideaId)].slice(
      0,
      40
    );
    setSavedLineages(updatedLocal);
    try {
      localStorage.setItem(LOCAL_SAVED_IDEAS_KEY, JSON.stringify(updatedLocal));
    } catch {
      // ignore storage quota
    }

    // 2. Save to Firestore if signed in
    let savedInFirestore = false;
    if (hasValidFirebaseApiKey && currentUser) {
      const path = `campaign_ideas/${ideaId}`;
      try {
        await setDoc(doc(db, 'campaign_ideas', ideaId), {
          id: newRecord.id,
          userId: currentUser.uid,
          rawIdea: newRecord.rawIdea,
          format: newRecord.format,
          lang: newRecord.lang,
          selectedAngleTitle: newRecord.selectedAngleTitle,
          headline: newRecord.headline,
          visualQuote: newRecord.visualQuote,
          caption: newRecord.caption,
          hashtags: newRecord.hashtags,
          nanoBananaPrompt: newRecord.nanoBananaPrompt,
          lineageSummary: newRecord.lineageSummary,
          userNotes: newRecord.userNotes,
          doopProjectId: newRecord.doopProjectId,
          doopProjectUrl: newRecord.doopProjectUrl,
          doopPostCount: newRecord.doopPostCount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        savedInFirestore = true;
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.CREATE, path);
        } catch {
          // Keep local copy if Firestore write fails
        }
      }
    }

    setIsSavingLineage(null);
    setSaveSuccessBanner(
      savedInFirestore
        ? tr(
            `Zapisano pomysł i pełną ścieżkę ("jak do tego doszliśmy") w bazie Firestore (${ideaId}).`,
            `Saved idea and full creative lineage to Firestore database (${ideaId}).`
          )
        : tr(
            `Zapisano pomysł i pełną ścieżkę ("jak do tego doszliśmy") w bazie (${ideaId}).`,
            `Saved idea and full creative lineage to database (${ideaId}).`
          )
    );
  };

  // STEP 5: Send Chosen Proposal + Nano Banana Style to Doop for More Posts & Save Project in Doop
  const handleSendToDoop = async (proposal: RefinedProposal) => {
    if (isExpandingInDoop) return;
    setIsExpandingInDoop(true);
    setSelectedProposalId(proposal.id);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/admin/campaign/doop-expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIdea: rawIdea.trim() || proposal.headline,
          format: igFormat,
          lang: campaignLang,
          proposal,
          nanoBananaPrompt: proposal.nanoBananaPrompt,
          projectName:
            doopProjectNameInput.trim() ||
            `YourMoments · ${proposal.headline.slice(0, 36)}`,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data.posts)) {
        setDoopSeriesPosts(data.posts);
        const projMeta = {
          projectName: data.projectName || 'YourMoments Campaign',
          projectId: data.doopProjectId || 'doop_project',
          projectUrl: data.doopProjectUrl || 'https://app.doop.ai',
          dimensions: data.dimensions || (igFormat === 'story' ? '1080x1920' : '1080x1080'),
          format: (data.format === 'story' ? 'story' : 'post') as 'post' | 'story',
        };
        setActiveDoopProject(projMeta);

        // Automatically persist this winning path & Doop project reference to the database!
        await handleSaveLineageToDb(proposal, {
          projectId: projMeta.projectId,
          projectUrl: projMeta.projectUrl,
          postCount: data.posts.length,
        });
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          tr(
            'Nie udało się wygenerować serii i zapisać projektu w Doop.',
            'Failed to expand series and save project in Doop.'
          )
      );
    } finally {
      setIsExpandingInDoop(false);
    }
  };

  // Classic 1-Click 3 Core Pillars Generator
  const handleGenerateCorePillars = async () => {
    if (isGeneratingPillars) return;
    setIsGeneratingPillars(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/admin/campaign/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang: campaignLang,
          customNote: rawIdea.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data.posts)) {
        setDoopSeriesPosts(data.posts);
        setActiveDoopProject({
          projectName: 'YourMoments · 3 Core Feature Highlights',
          projectId: `doop_core_${Date.now().toString(36)}`,
          projectUrl: 'https://app.doop.ai',
          dimensions: '1080x1080',
          format: 'post',
        });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to generate 3 core pillars.');
    } finally {
      setIsGeneratingPillars(false);
    }
  };

  const handleDeleteSavedLineage = async (id: string) => {
    const updated = savedLineages.filter(x => x.id !== id);
    setSavedLineages(updated);
    try {
      localStorage.setItem(LOCAL_SAVED_IDEAS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    const currentUser = auth?.currentUser;
    if (hasValidFirebaseApiKey && currentUser) {
      try {
        await deleteDoc(doc(db, 'campaign_ideas', id));
      } catch {
        // ignore if local-only
      }
    }
  };

  const handleLoadSavedIntoStudio = (item: SavedCampaignLineage) => {
    setRawIdea(item.rawIdea);
    setIgFormat(item.format);
    setCampaignLang(item.lang);
    setUserNotes(item.userNotes);
    setDoopProjectNameInput(`YourMoments · ${item.headline.slice(0, 34)}`);
    const restoredProposal: RefinedProposal = {
      id: 'proposal_restored_1',
      angleBadge: item.selectedAngleTitle || 'SAVED ANGLE',
      angleRationale: item.lineageSummary.slice(0, 260),
      headline: item.headline,
      visualQuote: item.visualQuote,
      caption: item.caption,
      hashtags: item.hashtags,
      nanoBananaPrompt: item.nanoBananaPrompt,
      accentHex: '#C96839',
      format: item.format,
      initialCardPreviewUrl: item.previewImageUrl || '',
      nanoBananaImageUrl: item.previewImageUrl,
    };
    setProposals([restoredProposal]);
    setSelectedProposalId(restoredProposal.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateProposalField = (
    id: string,
    field: keyof RefinedProposal,
    value: string
  ) => {
    setProposals(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleUpdateDoopPostCaption = (id: string, newCaption: string) => {
    setDoopSeriesPosts(prev =>
      prev.map(post => (post.id === id ? { ...post, caption: newCaption } : post))
    );
  };

  const handleCopyText = (id: string, caption: string, hashtags: string[]) => {
    const fullText = `${caption.trim()}\n\n${hashtags.join(' ')}`;
    navigator.clipboard.writeText(fullText);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(prev => (prev === id ? null : prev));
    }, 2200);
  };

  const handleDownloadVisualAsset = async (
    id: string,
    imageUrl: string,
    format: 'post' | 'story' = igFormat
  ) => {
    setDownloadingId(id);
    const targetW = 1080;
    const targetH = format === 'story' ? 1920 : 1080;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image load error'));
          img.src = imageUrl;
        });
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const pngDataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngDataUrl;
        link.download = `yourmoments-${format}-${id}-${targetW}x${targetH}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.target = '_blank';
      link.download = `yourmoments-${format}-${id}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingId(null);
    }
  };

  const quickIdeaPresets = isPl
    ? [
        {
          label: '🔒 Szyfrowanie E2EE w przeglądarce',
          text: 'Zastanawiałem się dziś, dlaczego większość aplikacji do pisania dziennika trzyma nasze najbardziej prywatne myśli otwartym tekstem na serwerze. W YourMoments każdy wpis szyfruje się kluczem AES-256 w przeglądarce zanim opuści urządzenie.',
        },
        {
          label: '📄 Ciepła kartka papieru bez rozpraszaczy',
          text: 'Zamiast budować kolejny przeładowany dashboard z powiadomieniami, zaprojektowałem ekran przypominający spokojną kartkę papieru z jednym cichym pytaniem na marginesie i małym liskiem przy maszynie do pisania.',
        },
        {
          label: '🎙️ 3 zdania głosem na wieczornym spacerze',
          text: 'Pusta strona o 22:00 potrafi przytłoczyć. Odkryłem, że o wiele łatwiej utrzymać nawyk, kiedy możesz podyktować 3 szczere zdania głosem podczas wieczornego spaceru i zamknąć dzień jednym kliknięciem.',
        },
      ]
    : [
        {
          label: '🔒 Client-Side E2EE Privacy',
          text: 'Why do so many journaling apps store our most personal thoughts in plain text on their servers? In YourMoments, every word is encrypted with AES-256 directly inside your browser before it ever touches the cloud.',
        },
        {
          label: '📄 Warm Archival Paper vs. Digital Noise',
          text: 'Instead of another noisy productivity dashboard, we stripped away feeds and login walls — leaving only warm archival paper, one quiet margin follow-up question, and a tiny pixel companion typing along.',
        },
        {
          label: '🎙️ 60-Second Voice Ritual on an Evening Walk',
          text: 'Staring at a blank page at 10 PM feels like homework. Speaking three honest sentences via voice dictation during an evening walk is enough to seal the day and light up appreciation stars in your calendar.',
        },
      ];

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C1A18] flex flex-col">
      {/* Top Studio Header Bar */}
      <header className="sticky top-0 z-30 bg-[#F7F5F0]/95 backdrop-blur-sm border-b border-[#E5DFD3] px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateHome}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#DDD6C8] bg-[#FAF8F5] hover:bg-[#EFECE4] text-xs font-mono-meta text-[#524D46] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{tr('Wróć do YourMoments', 'Back to YourMoments')}</span>
            </button>
            <div className="h-4 w-[1px] bg-[#E5DFD3] hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#C96839]" />
              <span className="font-mono-meta text-xs uppercase tracking-widest text-[#7A756D]">
                /ADMIN/CAMPAIGN · IDEA → GOOGLE AI → NANO BANANA → DB → DOOP
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Format Switcher: Post (1:1) vs Story (9:16) */}
            <div className="inline-flex items-center rounded-lg border border-[#DDD6C8] bg-[#FAF8F5] p-0.5">
              <button
                type="button"
                onClick={() => setIgFormat('post')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono-meta inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  igFormat === 'post'
                    ? 'bg-[#1C1A18] text-[#FAF8F5]'
                    : 'text-[#524D46] hover:text-[#1C1A18]'
                }`}
              >
                <Square className="w-3 h-3" />
                <span>Post 1:1 (1080×1080)</span>
              </button>
              <button
                type="button"
                onClick={() => setIgFormat('story')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono-meta inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  igFormat === 'story'
                    ? 'bg-[#1C1A18] text-[#FAF8F5]'
                    : 'text-[#524D46] hover:text-[#1C1A18]'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                <span>Stories 9:16 (1080×1920)</span>
              </button>
            </div>

            {/* Language Switcher */}
            <div className="inline-flex rounded-lg border border-[#DDD6C8] bg-[#FAF8F5] p-0.5">
              <button
                type="button"
                onClick={() => setCampaignLang('pl')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono-meta transition-colors cursor-pointer ${
                  campaignLang === 'pl'
                    ? 'bg-[#1C1A18] text-[#FAF8F5]'
                    : 'text-[#524D46] hover:text-[#1C1A18]'
                }`}
              >
                PL
              </button>
              <button
                type="button"
                onClick={() => setCampaignLang('en')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono-meta transition-colors cursor-pointer ${
                  campaignLang === 'en'
                    ? 'bg-[#1C1A18] text-[#FAF8F5]'
                    : 'text-[#524D46] hover:text-[#1C1A18]'
                }`}
              >
                EN
              </button>
            </div>

            {/* Jump to Saved Lineages DB */}
            <a
              href="#saved-lineage-vault"
              className="px-3 py-1.5 rounded-lg border border-[#DDD6C8] bg-[#FAF8F5] hover:bg-[#EFECE4] text-xs font-mono-meta text-[#1C1A18] inline-flex items-center gap-1.5 transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-[#2E6F40]" />
              <span>
                {tr('Zapisane w bazie', 'Saved in DB')} ({savedLineages.length})
              </span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 space-y-10">
        {/* Visual Pipeline Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {[
            {
              step: '01',
              title: tr('Twój Pomysł', 'Your Raw Idea'),
              desc: tr('Textbox + Format (Post / Stories)', 'Textbox + Post or Story format'),
              done: Boolean(rawIdea.trim()),
            },
            {
              step: '02',
              title: tr('Google AI Refinement', 'Google AI Refinement'),
              desc: tr('3 propozycje w tonie Idea Explorera', '3 distinct refined proposals'),
              done: proposals.length > 0,
            },
            {
              step: '03',
              title: tr('Nano Banana Preview', 'Nano Banana Preview'),
              desc: tr('Wstępna kreacja Google Nano Banana', 'Initial visual concept preview'),
              done: proposals.some(p => Boolean(p.nanoBananaImageUrl)),
            },
            {
              step: '04',
              title: tr('Zapis w Bazie', 'Save Lineage to DB'),
              desc: tr('Co się podoba i jak do tego doszliśmy', 'Save liked concept & path'),
              done: savedLineages.length > 0,
            },
            {
              step: '05',
              title: tr('Seria i Projekt w Doop', 'Expand & Save in Doop'),
              desc: tr('Więcej postów w stylu Nano Banana', 'More posts + editable Doop project'),
              done: doopSeriesPosts.length > 0,
            },
          ].map(item => (
            <div
              key={item.step}
              className={`rounded-xl border px-3.5 py-3 transition-colors ${
                item.done
                  ? 'bg-[#FAF8F5] border-[#C96839]/60 shadow-2xs'
                  : 'bg-[#FAF8F5]/60 border-[#E5DFD3]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono-meta text-[11px] uppercase tracking-wider text-[#C96839] font-semibold">
                  KROK {item.step}
                </span>
                {item.done && <Check className="w-3.5 h-3.5 text-[#2E6F40]" />}
              </div>
              <p className="font-serif text-sm font-medium text-[#1C1A18]">{item.title}</p>
              <p className="text-[11px] text-[#7A756D] leading-snug mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* STEP 1: RAW IDEA TEXTBOX & FORMAT */}
        <section className="bg-[#FAF8F5] border border-[#E5DFD3] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5 max-w-3xl">
              <div className="inline-flex items-center gap-2 text-xs font-mono-meta uppercase tracking-widest text-[#C96839]">
                <Instagram className="w-3.5 h-3.5" />
                <span>
                  {tr(
                    `KROK 1 · WPISZ SWÓJ POMYSŁ (${
                      igFormat === 'story' ? 'INSTAGRAM STORIES 9:16' : 'INSTAGRAM POST 1:1'
                    })`,
                    `STEP 1 · ENTER YOUR RAW IDEA (${
                      igFormat === 'story' ? 'INSTAGRAM STORIES 9:16' : 'INSTAGRAM POST 1:1'
                    })`
                  )}
                </span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-medium text-[#1C1A18] tracking-tight">
                {tr(
                  'Od luźnej myśli do serii postów w Nano Banana i Doop',
                  'From Raw Idea to Nano Banana Preview & Doop Campaign Project'
                )}
              </h1>
              <p className="font-serif text-sm sm:text-base text-[#524D46] leading-relaxed">
                {tr(
                  'Wpisz surowy pomysł, obserwację lub funkcję. Google AI rozwinie go w 3 różne propozycje (Post lub Stories), wygeneruje wstępny podgląd w Google Nano Banana, zapisze w bazie historię tego jak do tego doszliśmy i wyśle wybrany styl do Doop po więcej postów wraz z zapisem projektu.',
                  'Type your raw thought or feature angle below. Google AI refines it into 3 proposals (Post or Stories), renders a Google Nano Banana preview, saves your creative lineage to the database, and dispatches the style to Doop to generate more posts and save the editable project.'
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerateCorePillars}
              disabled={isGeneratingPillars}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#DDD6C8] bg-[#F2EFE8] hover:bg-[#E6E0D4] text-xs font-mono-meta text-[#1C1A18] transition-colors cursor-pointer disabled:opacity-60"
            >
              {isGeneratingPillars ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#C96839]" />
              )}
              <span>
                {tr('Generate Feature Highlights (3 filary)', 'Generate Feature Highlights')}
              </span>
            </button>
          </div>

          {/* Quick Idea Presets */}
          <div className="space-y-2">
            <span className="block text-[11px] font-mono-meta uppercase tracking-wider text-[#7A756D]">
              {tr(
                'Szybkie inspiracje na start (lub wpisz własny pomysł poniżej):',
                'Quick starter ideas (or type your own thought below):'
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              {quickIdeaPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setRawIdea(preset.text)}
                  className="px-3 py-1.5 rounded-lg border border-[#E5DFD3] bg-[#F7F5F0] hover:bg-[#EFECE4] text-xs font-mono-meta text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Idea Textbox */}
          <div className="space-y-3">
            <label
              htmlFor="raw-campaign-idea"
              className="block text-xs font-mono-meta uppercase tracking-wider text-[#524D46]"
            >
              {tr(
                'Twój surowy pomysł / notatka (Textbox):',
                'Your raw idea / founder note (Textbox):'
              )}
            </label>
            <textarea
              id="raw-campaign-idea"
              rows={4}
              value={rawIdea}
              onChange={e => setRawIdea(e.target.value)}
              placeholder={tr(
                'np. Szliśmy wieczorem z psem i podyktowałem 3 zdania do YourMoments zamiast siedzieć przed komputerem. Fajnie pokazać, że mikro-dziennik to 60 sekund spokoju z pełnym szyfrowaniem...',
                'e.g. Dictated 3 honest sentences while walking home tonight instead of staring at a blank laptop screen. Want to show how 60 seconds of encrypted micro-journaling clears your head...'
              )}
              className="w-full px-4 py-3.5 rounded-xl border border-[#DDD6C8] bg-[#F7F5F0] text-sm sm:text-base font-serif text-[#1C1A18] placeholder:text-[#9E978E] leading-relaxed focus:outline-none focus:border-[#C96839]"
            />
          </div>

          {/* Optional Founder Notes & Doop Project Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-[11px] font-mono-meta uppercase tracking-wider text-[#7A756D] mb-1.5">
                {tr(
                  'Notatka do bazy (dlaczego ten pomysł / co chcemy osiągnąć):',
                  'Database lineage note (why this angle matters):'
                )}
              </label>
              <input
                type="text"
                value={userNotes}
                onChange={e => setUserNotes(e.target.value)}
                placeholder={tr(
                  'np. Autentyczny post wieczorny, bez korpo-języka, nacisk na spokój',
                  'e.g. Authentic evening tone, emphasize calm archival paper & privacy'
                )}
                className="w-full px-3.5 py-2 rounded-lg border border-[#DDD6C8] bg-[#F7F5F0] text-xs font-serif text-[#1C1A18] placeholder:text-[#9E978E] focus:outline-none focus:border-[#C96839]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono-meta uppercase tracking-wider text-[#7A756D] mb-1.5">
                {tr(
                  'Nazwa projektu do zapisu w Doop:',
                  'Project name to save inside Doop:'
                )}
              </label>
              <input
                type="text"
                value={doopProjectNameInput}
                onChange={e => setDoopProjectNameInput(e.target.value)}
                placeholder={tr(
                  'np. YourMoments · Wieczorny Rytuał (Nano Banana)',
                  'e.g. YourMoments · Evening Ritual (Nano Banana)'
                )}
                className="w-full px-3.5 py-2 rounded-lg border border-[#DDD6C8] bg-[#F7F5F0] text-xs font-mono-meta text-[#1C1A18] placeholder:text-[#9E978E] focus:outline-none focus:border-[#C96839]"
              />
            </div>
          </div>

          {/* Step 1 Submit CTA */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#ECE7DC]">
            <div className="flex items-center gap-2 text-xs font-mono-meta text-[#7A756D]">
              <span>
                {tr('Aktywny kontekst:', 'Active context:')}{' '}
                <strong className="text-[#1C1A18]">
                  {igFormat === 'story'
                    ? 'Instagram Stories (9:16 · 1080×1920)'
                    : 'Instagram Post (1:1 · 1080×1080)'}
                </strong>
              </span>
            </div>

            <button
              type="button"
              onClick={handleRefineIdea}
              disabled={isRefining || !rawIdea.trim()}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#C96839] hover:bg-[#B5592D] text-[#FAF8F5] font-mono-meta text-xs sm:text-sm font-medium tracking-wide border-2 border-[#1C1A18] shadow-[2px_2px_0px_#1C1A18] transition-all cursor-pointer disabled:opacity-50"
            >
              {isRefining ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>
                    {tr(
                      'Google AI tworzy 3 propozycje...',
                      'Google AI is refining into 3 proposals...'
                    )}
                  </span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>
                    {tr(
                      '1. Rozwiń mój pomysł w 3 propozycje (Google AI)',
                      '1. Refine My Idea into 3 Proposals (Google AI)'
                    )}
                  </span>
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-[#FDF2F2] border border-[#E8C5C5] text-xs font-mono-meta text-[#8B2635]">
              {errorMsg}
            </div>
          )}

          {saveSuccessBanner && (
            <div className="p-4 rounded-xl bg-[#EBF2EB] border border-[#B8D4B8] text-xs font-mono-meta text-[#2E6F40] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{saveSuccessBanner}</span>
              </div>
              <a
                href="#saved-lineage-vault"
                className="underline font-semibold shrink-0"
              >
                {tr('Zobacz w bazie ↓', 'View in DB ↓')}
              </a>
            </div>
          )}
        </section>

        {/* STEP 2 & 3 & 4: 3 GOOGLE AI PROPOSALS + NANO BANANA INITIAL PREVIEW */}
        {proposals.length > 0 && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-mono-meta text-xs uppercase tracking-widest text-[#C96839]">
                  {tr(
                    'KROK 2, 3 i 4 · WYBIERZ PROPOZYCJĘ, SPRAWDŹ NANO BANANA I WYŚLIJ DO DOOP',
                    'STEP 2, 3 & 4 · REVIEW 3 AI PROPOSALS, PREVIEW IN NANO BANANA & SEND TO DOOP'
                  )}
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-medium text-[#1C1A18] mt-0.5">
                  {tr(
                    '3 propozycje rozwinięte przez Google AI z Twojego pomysłu',
                    '3 Proposals Refined by Google AI from Your Raw Idea'
                  )}
                </h2>
              </div>
              <span className="text-xs font-mono-meta text-[#7A756D]">
                {tr(
                  'Każdą propozycję możesz edytować przed wygenerowaniem Nano Banana lub wysłaniem do Doop',
                  'Every proposal is editable before generating Nano Banana or sending to Doop'
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {proposals.map((prop, index) => {
                const isSelected = selectedProposalId === prop.id;
                const activePreviewUrl =
                  prop.nanoBananaImageUrl || prop.initialCardPreviewUrl;
                const isStoryFormat = igFormat === 'story';

                return (
                  <article
                    key={prop.id}
                    onClick={() => setSelectedProposalId(prop.id)}
                    className={`bg-[#FAF8F5] rounded-2xl border-2 transition-all overflow-hidden flex flex-col ${
                      isSelected
                        ? 'border-[#1C1A18] shadow-[3px_3px_0px_#1C1A18]'
                        : 'border-[#E5DFD3] hover:border-[#C96839]/60'
                    }`}
                  >
                    {/* Top Proposal Header */}
                    <div className="px-5 py-3.5 bg-[#F2EFE8] border-b border-[#E5DFD3] flex items-center justify-between gap-2">
                      <span className="font-mono-meta text-[11px] font-semibold uppercase tracking-wider text-[#1C1A18] truncate">
                        {prop.angleBadge}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#DDD6C8] text-[10px] font-mono-meta text-[#7A756D] shrink-0">
                        {isStoryFormat ? '9:16 STORY' : '1:1 POST'}
                      </span>
                    </div>

                    {/* "Jak do tego doszliśmy" AI Rationale Box */}
                    <div className="px-5 py-3 bg-[#F7F5F0] border-b border-[#ECE7DC] text-xs font-serif text-[#524D46]">
                      <span className="font-mono-meta text-[10px] uppercase tracking-wider text-[#C96839] block mb-0.5">
                        {tr('Jak do tego doszliśmy (Ścieżka AI):', 'How we got here (AI Path):')}
                      </span>
                      {prop.angleRationale}
                    </div>

                    {/* STEP 3: Nano Banana Visual Preview Area */}
                    <div className="p-5 border-b border-[#ECE7DC] space-y-3">
                      <div
                        className={`relative w-full mx-auto rounded-xl overflow-hidden border border-[#DDD6C8] bg-[#F7F5F0] ${
                          isStoryFormat ? 'aspect-[9/16] max-w-[260px]' : 'aspect-square'
                        }`}
                      >
                        {activePreviewUrl ? (
                          <img
                            src={activePreviewUrl}
                            alt={prop.headline}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-mono-meta text-[#7A756D]">
                            {tr('Brak podglądu', 'No preview')}
                          </div>
                        )}

                        {prop.nanoBananaImageUrl && (
                          <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-[#1C1A18]/85 text-[#FAF8F5] font-mono-meta text-[10px] tracking-wider">
                            🍌 Google Nano Banana
                          </span>
                        )}
                      </div>

                      {/* Nano Banana Prompt & Trigger Button */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-mono-meta uppercase tracking-wider text-[#7A756D]">
                          {tr(
                            'Prompt wizualny dla Google Nano Banana (możesz zmienić):',
                            'Google Nano Banana Visual Prompt (editable):'
                          )}
                        </label>
                        <textarea
                          rows={2}
                          value={prop.nanoBananaPrompt}
                          onChange={e =>
                            handleUpdateProposalField(
                              prop.id,
                              'nanoBananaPrompt',
                              e.target.value
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#DDD6C8] bg-[#F7F5F0] text-[11px] font-mono-meta text-[#524D46] focus:outline-none focus:border-[#C96839]"
                        />

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleGenerateNanoBanana(prop.id);
                            }}
                            disabled={prop.isGeneratingNanoBanana}
                            className="flex-1 py-2 px-3 rounded-lg border border-[#1C1A18] bg-[#F2EFE8] hover:bg-[#E5DFD3] text-xs font-mono-meta font-medium text-[#1C1A18] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {prop.isGeneratingNanoBanana ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>
                                  {tr('Nano Banana rysuje...', 'Nano Banana rendering...')}
                                </span>
                              </>
                            ) : (
                              <>
                                <ImageIcon className="w-3.5 h-3.5 text-[#C96839]" />
                                <span>
                                  {prop.nanoBananaImageUrl
                                    ? tr(
                                        '2. Odśwież Nano Banana Preview',
                                        '2. Regenerate Nano Banana Preview'
                                      )
                                    : tr(
                                        '2. Generuj podgląd Nano Banana',
                                        '2. Generate Nano Banana Preview'
                                      )}
                                </span>
                              </>
                            )}
                          </button>

                          {activePreviewUrl && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleDownloadVisualAsset(
                                  prop.id,
                                  activePreviewUrl,
                                  igFormat
                                );
                              }}
                              disabled={downloadingId === prop.id}
                              title={tr('Pobierz obraz PNG', 'Download PNG')}
                              className="p-2 rounded-lg border border-[#DDD6C8] bg-[#FAF8F5] hover:bg-[#EFECE4] text-[#1C1A18] transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {prop.nanoBananaStatus && (
                          <p className="text-[10px] font-mono-meta text-[#7A756D]">
                            {prop.nanoBananaStatus}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Editable Headline, Quote & Caption */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-mono-meta uppercase tracking-wider text-[#7A756D] mb-1">
                            {tr('Nagłówek na grafice (Headline):', 'Card Headline:')}
                          </label>
                          <input
                            type="text"
                            value={prop.headline}
                            onChange={e =>
                              handleUpdateProposalField(prop.id, 'headline', e.target.value)
                            }
                            className="w-full px-3 py-1.5 rounded-lg border border-[#DDD6C8] bg-[#F7F5F0] font-serif text-sm font-medium text-[#1C1A18] focus:outline-none focus:border-[#C96839]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono-meta uppercase tracking-wider text-[#7A756D] mb-1">
                            {isStoryFormat
                              ? tr(
                                  'Scenariusz Instagram Stories (3 klatki):',
                                  'Instagram Story Script (3 frames):'
                                )
                              : tr('Treść posta na Instagram:', 'Instagram Post Caption:')}
                          </label>
                          <textarea
                            rows={7}
                            value={prop.caption}
                            onChange={e =>
                              handleUpdateProposalField(prop.id, 'caption', e.target.value)
                            }
                            className="w-full px-3 py-2 rounded-xl border border-[#DDD6C8] bg-[#F7F5F0] text-xs font-serif text-[#1C1A18] leading-relaxed focus:outline-none focus:border-[#C96839] resize-y"
                          />
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {prop.hashtags.map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded bg-[#F2EFE8] text-[10px] font-mono-meta text-[#7A756D]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* STEP 4 & STEP 5 CTA BUTTONS */}
                      <div className="space-y-2 pt-3 border-t border-[#ECE7DC]">
                        <div className="flex items-center gap-2">
                          {/* Step 4: Save to DB */}
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleSaveLineageToDb(prop);
                            }}
                            disabled={isSavingLineage === prop.id}
                            className="flex-1 py-2 px-3 rounded-lg border border-[#2E6F40] bg-[#EBF2EB] hover:bg-[#DCE8DC] text-xs font-mono-meta font-medium text-[#2E6F40] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                            <span>
                              {isSavingLineage === prop.id
                                ? tr('Zapisywanie...', 'Saving...')
                                : tr(
                                    '3. Podoba mi się — Zapisz w bazie',
                                    '3. I Like This — Save to DB'
                                  )}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleCopyText(prop.id, prop.caption, prop.hashtags);
                            }}
                            title={tr('Kopiuj tekst', 'Copy caption')}
                            className="p-2 rounded-lg border border-[#DDD6C8] bg-[#FAF8F5] hover:bg-[#EFECE4] text-[#1C1A18] transition-colors cursor-pointer"
                          >
                            {copiedId === prop.id ? (
                              <Check className="w-3.5 h-3.5 text-[#2E6F40]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Step 5: Send to Doop for More Posts in Nano Banana Style + Save Project */}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleSendToDoop(prop);
                          }}
                          disabled={isExpandingInDoop}
                          className="w-full py-2.5 px-3.5 rounded-xl bg-[#1C1A18] hover:bg-[#33302B] text-[#FAF8F5] text-xs font-mono-meta font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isExpandingInDoop && selectedProposalId === prop.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>
                                {tr(
                                  'Wysyłanie do Doop i zapisywanie projektu...',
                                  'Sending to Doop & saving project...'
                                )}
                              </span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5 text-[#C96839]" />
                              <span>
                                {tr(
                                  '4. Wyślij do Doop (Więcej postów w stylu Nano Banana + Zapisz projekt)',
                                  '4. Send to Doop (More Nano Banana Posts + Save Project)'
                                )}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* STEP 5 OUTPUT: DOOP SERIES IN NANO BANANA STYLE + SAVED DOOP PROJECT */}
        {doopSeriesPosts.length > 0 && (
          <section className="bg-[#FAF8F5] border-2 border-[#1C1A18] rounded-2xl p-6 sm:p-8 space-y-6 shadow-[4px_4px_0px_#1C1A18]">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-[#E5DFD3]">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-xs font-mono-meta uppercase tracking-widest text-[#2E6F40]">
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    {tr(
                      'KROK 5 · SERIA DOOP W STYLU NANO BANANA + ZAPISANY PROJEKT W DOOP',
                      'STEP 5 · DOOP SERIES IN NANO BANANA STYLE + SAVED DOOP PROJECT'
                    )}
                  </span>
                </div>
                <h2 className="font-serif text-2xl font-medium text-[#1C1A18]">
                  {activeDoopProject?.projectName || 'YourMoments · Doop Series'}
                </h2>
                <p className="text-xs font-mono-meta text-[#7A756D]">
                  {tr('ID Projektu w Doop:', 'Doop Project ID:')}{' '}
                  <code className="px-1.5 py-0.5 rounded bg-[#F2EFE8] text-[#1C1A18]">
                    {activeDoopProject?.projectId}
                  </code>{' '}
                  · {tr('Format:', 'Format:')}{' '}
                  <strong className="text-[#1C1A18]">
                    {activeDoopProject?.dimensions}
                  </strong>
                </p>
              </div>

              {activeDoopProject && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href={activeDoopProject.projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-[#C96839] hover:bg-[#B5592D] text-[#FAF8F5] text-xs font-mono-meta font-medium inline-flex items-center gap-2 border border-[#1C1A18] transition-colors"
                  >
                    <span>
                      {tr(
                        'Otwórz i modyfikuj projekt w Doop',
                        'Open & Edit Project in Doop'
                      )}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {doopSeriesPosts.map(post => {
                const isStoryCard = post.format === 'story' || post.dimensions === '1080x1920';
                return (
                  <article
                    key={post.id}
                    className="bg-[#F7F5F0] border border-[#DDD6C8] rounded-xl overflow-hidden flex flex-col"
                  >
                    <div className="px-4 py-3 bg-[#F2EFE8] border-b border-[#DDD6C8] flex items-center justify-between gap-2">
                      <span className="font-mono-meta text-[11px] font-semibold text-[#1C1A18] truncate">
                        {post.partLabel} · {post.featureTitle}
                      </span>
                      <span className="font-mono-meta text-[10px] text-[#7A756D] shrink-0">
                        {post.dimensions}
                      </span>
                    </div>

                    <div className="p-4 border-b border-[#E5DFD3] space-y-3">
                      <div
                        className={`w-full mx-auto rounded-lg overflow-hidden border border-[#DDD6C8] bg-[#FAF8F5] ${
                          isStoryCard ? 'aspect-[9/16] max-w-[240px]' : 'aspect-square'
                        }`}
                      >
                        <img
                          src={post.imageUrl}
                          alt={post.headline}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono-meta text-[#7A756D] truncate">
                          {post.doopStatusMessage}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadVisualAsset(
                              post.id,
                              post.imageUrl,
                              isStoryCard ? 'story' : 'post'
                            )
                          }
                          disabled={downloadingId === post.id}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1C1A18] bg-[#FAF8F5] hover:bg-[#EFECE4] text-xs font-mono-meta text-[#1C1A18] transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PNG</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <textarea
                        rows={7}
                        value={post.caption}
                        onChange={e =>
                          handleUpdateDoopPostCaption(post.id, e.target.value)
                        }
                        className="w-full p-3 rounded-lg border border-[#DDD6C8] bg-[#FAF8F5] text-xs font-serif text-[#1C1A18] leading-relaxed focus:outline-none focus:border-[#C96839]"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(post.id, post.caption, post.hashtags)
                        }
                        className="w-full py-2 px-3 rounded-lg bg-[#1C1A18] hover:bg-[#33302B] text-[#FAF8F5] text-xs font-mono-meta inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedId === post.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#A8E6CF]" />
                            <span>{tr('Skopiowano!', 'Copied!')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>
                              {tr('Kopiuj tekst + hashtagi', 'Copy Caption + Hashtags')}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* STEP 4 VAULT: SAVED CAMPAIGN IDEAS & LINEAGE DATABASE ("CO MI SIĘ PODOBA I JAK DO TEGO DOSZLIŚMY") */}
        <section
          id="saved-lineage-vault"
          className="bg-[#FAF8F5] border border-[#E5DFD3] rounded-2xl p-6 sm:p-8 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECE7DC] pb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-mono-meta uppercase tracking-widest text-[#2E6F40]">
                <Database className="w-3.5 h-3.5" />
                <span>
                  {tr(
                    'BAZA POMYSŁÓW (FIRESTORE + LOKALNA) · CO MI SIĘ PODOBA I JAK DO TEGO DOSZLIŚMY',
                    'SAVED IDEA LINEAGE DATABASE · WHAT WORKED & HOW WE GOT THERE'
                  )}
                </span>
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-medium text-[#1C1A18] mt-1">
                {tr(
                  'Zapisane kierunki kreatywne, prompty Nano Banana i projekty Doop',
                  'Saved Creative Directions, Nano Banana Prompts & Doop Projects'
                )}
              </h2>
            </div>

            <span className="px-3 py-1 rounded-full bg-[#F2EFE8] border border-[#DDD6C8] text-xs font-mono-meta text-[#524D46]">
              {savedLineages.length} {tr('zapisanych ścieżek', 'saved lineages')}
            </span>
          </div>

          {savedLineages.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-[#DDD6C8] bg-[#F7F5F0] space-y-2">
              <p className="font-serif text-base text-[#524D46]">
                {tr(
                  'Nie masz jeszcze zapisanych ścieżek w bazie. Wpisz swój pomysł na górze, wybierz ulubioną z 3 propozycji Google AI i kliknij „Zapisz w bazie” lub „Wyślij do Doop”.',
                  'No saved idea lineages yet. Enter a raw idea above, pick your favorite of the 3 Google AI proposals, and click "Save to DB" or "Send to Doop".'
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedLineages.map(item => (
                <div
                  key={item.id}
                  className="p-5 rounded-xl border border-[#DDD6C8] bg-[#F7F5F0] flex flex-col lg:flex-row gap-5 justify-between"
                >
                  <div className="space-y-2.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-[#1C1A18] text-[#FAF8F5] font-mono-meta text-[10px] uppercase">
                        {item.format === 'story' ? 'STORY 9:16' : 'POST 1:1'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded bg-[#EBF2EB] text-[#2E6F40] font-mono-meta text-[10px] font-semibold">
                        {item.selectedAngleTitle}
                      </span>
                      {item.doopProjectId && (
                        <span className="px-2.5 py-0.5 rounded bg-[#F2EFE8] border border-[#DDD6C8] text-[#524D46] font-mono-meta text-[10px]">
                          Doop Project: {item.doopProjectId} ({item.doopPostCount} posts)
                        </span>
                      )}
                      <span className="text-[11px] font-mono-meta text-[#7A756D]">
                        {new Date(item.createdAtIso).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      <div className="p-3 rounded-lg bg-[#FAF8F5] border border-[#E5DFD3]">
                        <span className="block font-mono-meta text-[10px] uppercase tracking-wider text-[#7A756D] mb-1">
                          {tr('1. Mój surowy pomysł:', '1. Raw Idea:')}
                        </span>
                        <p className="font-serif text-xs text-[#1C1A18] leading-relaxed">
                          {item.rawIdea}
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-[#FAF8F5] border border-[#E5DFD3]">
                        <span className="block font-mono-meta text-[10px] uppercase tracking-wider text-[#C96839] mb-1">
                          {tr(
                            '2. Wybrany efekt po Google AI:',
                            '2. Refined Google AI Outcome:'
                          )}
                        </span>
                        <p className="font-serif text-xs font-medium text-[#1C1A18] mb-1">
                          {item.headline}
                        </p>
                        <p className="font-serif text-[11px] text-[#524D46] line-clamp-3">
                          {item.caption}
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-[#FAF8F5] border border-[#E5DFD3]">
                        <span className="block font-mono-meta text-[10px] uppercase tracking-wider text-[#2E6F40] mb-1">
                          {tr(
                            '3. Styl Nano Banana & Notatki:',
                            '3. Nano Banana Prompt & Notes:'
                          )}
                        </span>
                        <p className="font-mono-meta text-[10px] text-[#524D46] line-clamp-3 mb-1">
                          {item.nanoBananaPrompt}
                        </p>
                        {item.userNotes && (
                          <p className="font-serif text-[11px] italic text-[#1C1A18]">
                            „{item.userNotes}”
                          </p>
                        )}
                      </div>
                    </div>

                    <details className="text-xs font-mono-meta text-[#7A756D] pt-1">
                      <summary className="cursor-pointer hover:text-[#1C1A18]">
                        {tr(
                          'Pokaż pełny zapis „Jak do tego doszliśmy” (wszystkie 3 propozycje i ścieżka)',
                          'Show full "How we got here" lineage log'
                        )}
                      </summary>
                      <pre className="mt-2 p-3 rounded-lg bg-[#FAF8F5] border border-[#E5DFD3] whitespace-pre-wrap text-[11px] text-[#524D46] leading-relaxed">
                        {item.lineageSummary}
                      </pre>
                    </details>
                  </div>

                  <div className="flex lg:flex-col items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLoadSavedIntoStudio(item)}
                      className="px-3.5 py-2 rounded-lg border border-[#1C1A18] bg-[#FAF8F5] hover:bg-[#EFECE4] text-xs font-mono-meta text-[#1C1A18] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{tr('Wczytaj do edytora', 'Load into Studio')}</span>
                    </button>

                    {item.doopProjectUrl && (
                      <a
                        href={item.doopProjectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-lg border border-[#DDD6C8] bg-[#F2EFE8] hover:bg-[#E5DFD3] text-xs font-mono-meta text-[#1C1A18] inline-flex items-center gap-1.5 transition-colors"
                      >
                        <span>Doop Project</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteSavedLineage(item.id)}
                      className="p-2 rounded-lg border border-[#E8C5C5] text-[#8B2635] hover:bg-[#FDF2F2] transition-colors cursor-pointer"
                      title={tr('Usuń z bazy', 'Delete from DB')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
export default AdminCampaignView;
