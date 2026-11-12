import React, { useState } from 'react';
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
} from 'lucide-react';

export interface GeneratedCampaignPost {
  id: 'e2ee' | 'minimal_ui' | 'daily_habit';
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
}

interface AdminCampaignViewProps {
  initialLang?: 'pl' | 'en' | 'es' | 'fr';
  onNavigateHome: () => void;
}

export const AdminCampaignView: React.FC<AdminCampaignViewProps> = ({
  initialLang = 'en',
  onNavigateHome,
}) => {
  const [campaignLang, setCampaignLang] = useState<'en' | 'pl'>(
    initialLang === 'pl' ? 'pl' : 'en'
  );
  const [customNote, setCustomNote] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [doopKeyConfigured, setDoopKeyConfigured] = useState<boolean>(false);
  const [posts, setPosts] = useState<GeneratedCampaignPost[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleGenerateCampaign = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/admin/campaign/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang: campaignLang,
          customNote: customNote.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data.posts)) {
        setPosts(data.posts);
        setGeneratedAt(data.generatedAt || new Date().toISOString());
        setDoopKeyConfigured(Boolean(data.doopKeyConfigured));
      } else {
        throw new Error('Invalid campaign payload returned from server');
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Failed to generate the 3-part Instagram campaign. Please try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateCaption = (id: GeneratedCampaignPost['id'], newCaption: string) => {
    setPosts(prev =>
      prev.map(post => (post.id === id ? { ...post, caption: newCaption } : post))
    );
  };

  const handleCopyCaption = (post: GeneratedCampaignPost) => {
    const fullText = `${post.caption.trim()}\n\n${post.hashtags.join(' ')}`;
    navigator.clipboard.writeText(fullText);
    setCopiedId(post.id);
    setTimeout(() => {
      setCopiedId(prev => (prev === post.id ? null : prev));
    }, 2200);
  };

  const handleDownloadSquareImage = async (post: GeneratedCampaignPost) => {
    setDownloadingId(post.id);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image load error'));
          img.src = post.imageUrl;
        });
        ctx.drawImage(img, 0, 0, 1080, 1080);
        const pngDataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngDataUrl;
        link.download = `yourmoments-${post.id}-1080x1080.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const link = document.createElement('a');
        link.href = post.imageUrl;
        link.download = `yourmoments-${post.id}-1080x1080.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch {
      const link = document.createElement('a');
      link.href = post.imageUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = `yourmoments-${post.id}-1080x1080`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingId(null);
    }
  };

  const renderFeatureIcon = (id: GeneratedCampaignPost['id']) => {
    switch (id) {
      case 'e2ee':
        return <ShieldCheck className="w-4 h-4 text-[#2E6F40] shrink-0" />;
      case 'minimal_ui':
        return <Feather className="w-4 h-4 text-[#C96839] shrink-0" />;
      case 'daily_habit':
        return <Calendar className="w-4 h-4 text-[#8B2635] shrink-0" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C1A18] flex flex-col font-serif-literary antialiased selection:bg-[#E2DDD3]">
      {/* Top Admin Header */}
      <header className="w-full border-b border-[#EAE5DA] bg-[#F7F5F0]/95 sticky top-0 z-40 backdrop-blur-[2px]">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateHome}
              className="px-3 py-1.5 rounded-lg border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-xs font-mono-meta text-[#524D46] hover:text-[#1C1A18] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to YourMoments</span>
            </button>
            <div className="h-4 w-px bg-[#DDD6C8] hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#C96839]" />
              <span className="text-xs font-mono-meta uppercase tracking-wider text-[#7A756D]">
                Internal Marketing Studio · /admin/campaign
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono-meta text-[#7A756D]">Caption Language:</span>
            <div className="inline-flex rounded-lg border border-[#DDD6C8] bg-[#F5F2EB] p-0.5 text-xs font-mono-meta">
              <button
                type="button"
                onClick={() => setCampaignLang('en')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  campaignLang === 'en'
                    ? 'bg-[#1C1A18] text-[#FAF8F5] font-medium'
                    : 'text-[#524D46] hover:text-[#1C1A18]'
                }`}
              >
                EN (English)
              </button>
              <button
                type="button"
                onClick={() => setCampaignLang('pl')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  campaignLang === 'pl'
                    ? 'bg-[#1C1A18] text-[#FAF8F5] font-medium'
                    : 'text-[#524D46] hover:text-[#1C1A18]'
                }`}
              >
                PL (Polski)
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 space-y-8">
        {/* Hero / Trigger Card */}
        <section className="rounded-2xl bg-[#FAF8F5] border border-[#E5DFD3] p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-mono-meta text-[#C96839]">
                <Instagram className="w-4 h-4 shrink-0" />
                <span>3-Part Instagram Feature Campaign · Doop API 1080×1080</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-serif-literary text-[#1C1A18] leading-tight">
                Idea Explorer Campaign Generator
              </h1>
              <p className="text-sm sm:text-base font-serif-literary text-[#524D46] leading-relaxed">
                Generates 3 authentic, founder-voiced Instagram captions framing you as an{' '}
                <span className="italic text-[#1C1A18] font-medium">“idea explorer”</span> sharing
                YourMoments’ progress across our core pillars —{' '}
                <span className="text-[#1C1A18]">End-to-End Encryption</span>,{' '}
                <span className="text-[#1C1A18]">Minimal Distraction-Free Interface</span>, and{' '}
                <span className="text-[#1C1A18]">Daily Micro-Journaling Habit</span> — and dispatches
                each payload to the Doop API to render 1080×1080 square visual assets.
              </p>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3">
              <button
                type="button"
                onClick={handleGenerateCampaign}
                disabled={isGenerating}
                className="px-6 py-3.5 rounded-xl bg-[#C96839] hover:bg-[#B5592C] disabled:opacity-60 text-[#FAF8F5] border border-[#1C1A18] text-xs sm:text-sm font-mono-meta font-medium inline-flex items-center justify-center gap-2.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                    <span>Generating 3 Posts & Doop 1080×1080 Assets...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>Generate Feature Highlights</span>
                  </>
                )}
              </button>
              {generatedAt && (
                <span className="text-[11px] font-mono-meta text-[#7A756D]">
                  Last generated: {new Date(generatedAt).toLocaleTimeString()} ·{' '}
                  {doopKeyConfigured ? 'DOOP_API_KEY active' : 'Doop 1080×1080 Studio Renderer'}
                </span>
              )}
            </div>
          </div>

          {/* Optional Founder Note Input */}
          <div className="pt-4 border-t border-[#ECE7DC] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <label
              htmlFor="founder-note-input"
              className="text-xs font-mono-meta text-[#7A756D] shrink-0"
            >
              Optional founder note / milestone:
            </label>
            <input
              id="founder-note-input"
              type="text"
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
              placeholder="e.g., Just launched 1-click writing on dailymoments.app without a login wall..."
              className="flex-1 px-3.5 py-2 rounded-lg border border-[#DDD6C8] bg-[#F7F5F0] text-xs sm:text-sm font-serif-literary text-[#1C1A18] placeholder:text-[#9E978C] focus:outline-none focus:border-[#1C1A18]"
            />
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#FDF2F2] border border-[#E8C5C5] text-xs font-mono-meta text-[#8B2635]">
              {errorMsg}
            </div>
          )}
        </section>

        {/* Empty State before first click */}
        {posts.length === 0 && !isGenerating && (
          <section className="rounded-2xl border border-dashed border-[#D8D0C0] bg-[#FAF8F5]/60 p-10 sm:p-14 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F2EFE8] border border-[#DDD6C8] mx-auto flex items-center justify-center text-[#C96839]">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h2 className="text-xl font-serif-literary text-[#1C1A18]">
                Ready to build your 3-part Instagram campaign
              </h2>
              <p className="text-sm font-serif-literary text-[#524D46] leading-relaxed">
                Click <span className="font-medium text-[#1C1A18]">“Generate Feature Highlights”</span>{' '}
                above to craft the 3 “idea explorer” captions and request the 1080×1080 square assets
                via the backend Doop API integration.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-mono-meta text-[#7A756D]">
              <span className="px-3 py-1 rounded-md bg-[#F2EFE8] border border-[#E5DFD3] inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2E6F40]" />
                01 · End-to-End Encryption
              </span>
              <span className="px-3 py-1 rounded-md bg-[#F2EFE8] border border-[#E5DFD3] inline-flex items-center gap-1.5">
                <Feather className="w-3.5 h-3.5 text-[#C96839]" />
                02 · Minimal Distraction-Free UI
              </span>
              <span className="px-3 py-1 rounded-md bg-[#F2EFE8] border border-[#E5DFD3] inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#8B2635]" />
                03 · Daily Micro-Journaling Habit
              </span>
            </div>
          </section>
        )}

        {/* Loading Skeleton */}
        {isGenerating && posts.length === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(idx => (
              <div
                key={idx}
                className="rounded-2xl bg-[#FAF8F5] border border-[#E5DFD3] p-5 space-y-4 animate-pulse"
              >
                <div className="h-5 w-40 rounded bg-[#EAE5DA]" />
                <div className="aspect-square w-full rounded-xl bg-[#EAE5DA]" />
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-[#EAE5DA]" />
                  <div className="h-4 w-5/6 rounded bg-[#EAE5DA]" />
                  <div className="h-4 w-4/6 rounded bg-[#EAE5DA]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3 Generated Campaign Cards */}
        {posts.length > 0 && (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {posts.map(post => {
              const isCopied = copiedId === post.id;
              const isDownloading = downloadingId === post.id;

              return (
                <article
                  key={post.id}
                  className="rounded-2xl bg-[#FAF8F5] border border-[#E5DFD3] overflow-hidden flex flex-col shadow-2xs"
                >
                  {/* Card Header */}
                  <div className="px-5 py-3.5 bg-[#F2EFE8] border-b border-[#E5DFD3] flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 text-xs font-mono-meta font-medium text-[#1C1A18]">
                      {renderFeatureIcon(post.id)}
                      <span>{post.partLabel}</span>
                      <span className="text-[#ABA497]">·</span>
                      <span className="truncate">{post.featureTitle}</span>
                    </div>
                    <span className="text-[10px] font-mono-meta px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#DDD6C8] text-[#7A756D] shrink-0">
                      {post.dimensions}
                    </span>
                  </div>

                  {/* 1080x1080 Doop Square Image Asset */}
                  <div className="p-5 pb-3 space-y-3">
                    <div className="relative group aspect-square w-full rounded-xl overflow-hidden border border-[#E5DFD3] bg-[#F7F5F0] shadow-2xs">
                      <img
                        src={post.imageUrl}
                        alt={`${post.featureTitle} — 1080x1080 Instagram Visual`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-[10px] font-mono-meta text-[#7A756D] truncate"
                        title={post.doopStatusMessage}
                      >
                        {post.doopStatusMessage}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownloadSquareImage(post)}
                        disabled={isDownloading}
                        className="px-3 py-1.5 rounded-lg border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-xs font-mono-meta text-[#1C1A18] inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-[#8B2635]" />
                        <span>{isDownloading ? 'Saving...' : 'Save 1080×1080 PNG'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Generated Caption + Hashtags */}
                  <div className="p-5 pt-2 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor={`caption-${post.id}`}
                          className="text-[11px] font-mono-meta uppercase tracking-wider text-[#7A756D]"
                        >
                          Instagram Caption (Idea Explorer Tone)
                        </label>
                        <span className="text-[10px] font-mono-meta text-[#9E978C] tabular-nums">
                          {post.caption.length} chars
                        </span>
                      </div>
                      <textarea
                        id={`caption-${post.id}`}
                        value={post.caption}
                        onChange={e => handleUpdateCaption(post.id, e.target.value)}
                        rows={10}
                        className="w-full p-3.5 rounded-xl border border-[#DDD6C8] bg-[#F7F5F0] text-xs sm:text-sm font-serif-literary text-[#1C1A18] leading-relaxed focus:outline-none focus:border-[#1C1A18] resize-y"
                      />
                    </div>

                    {/* Hashtags */}
                    <div className="space-y-3 pt-1">
                      <div className="flex flex-wrap gap-1.5">
                        {post.hashtags.map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded bg-[#F2EFE8] border border-[#E5DFD3] text-[11px] font-mono-meta text-[#524D46]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyCaption(post)}
                        className={`w-full py-2.5 px-4 rounded-xl border text-xs font-mono-meta font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                          isCopied
                            ? 'bg-[#EBF2EB] border-[#2E6F40] text-[#2E5C33]'
                            : 'bg-[#1C1A18] hover:bg-[#33302B] border-[#1C1A18] text-[#FAF8F5]'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied Caption & Hashtags!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Caption + Hashtags</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
};
