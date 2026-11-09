import React, { useState, useMemo } from 'react';
import {
  X,
  BookOpen,
  Calendar,
  Lock,
  Unlock,
  Download,
  Award,
  BarChart2,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { DailyPrompt } from '../data/prompts';
import { formatWritingTime } from './FocusEditor';

export interface SavedEntry {
  id: string;
  date: string;
  promptId: string;
  encryptedContent: string;
  iv: string;
  salt: string;
  characterCount: number;
  wordCount: number;
  writingTimeSeconds?: number;
  deviceName?: string;
  isSealed: boolean;
  decryptedContent?: string;
  decryptionError?: boolean;
  updatedAt?: string;
}

interface ChronicleArchiveModalProps {
  isOpen: boolean;
  entries: SavedEntry[];
  prompts: DailyPrompt[];
  currentKey: string;
  onOpenKeyModal: () => void;
  onClose: () => void;
}

export const ChronicleArchiveModal: React.FC<ChronicleArchiveModalProps> = ({
  isOpen,
  entries,
  prompts,
  currentKey,
  onOpenKeyModal,
  onClose,
}) => {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(
    entries.length > 0 ? entries[0].id : null
  );
  const [chartDays, setChartDays] = useState<14 | 30>(14);
  const [activeTab, setActiveTab] = useState<'reader' | 'stats'>('reader');

  // Compute past N days chart data
  const chartData = useMemo(() => {
    const list = [];
    const today = new Date();

    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${day}`;
      const shortLabel = `${day}.${m}`;

      const matched = entries.find(e => e.date === dateKey);
      list.push({
        dateKey,
        shortLabel,
        wordCount: matched ? matched.wordCount || 0 : 0,
        characterCount: matched ? matched.characterCount || 0 : 0,
        writingTimeSeconds: matched ? matched.writingTimeSeconds || 0 : 0,
        isSealed: matched ? matched.isSealed : false,
      });
    }

    return list;
  }, [entries, chartDays]);

  if (!isOpen) return null;

  const selectedEntry = entries.find(e => e.id === selectedEntryId) || entries[0];
  const matchedPrompt = selectedEntry
    ? prompts.find(p => p.id === selectedEntry.promptId)
    : null;

  const totalWords = entries.reduce((acc, curr) => acc + (curr.wordCount || 0), 0);
  const totalSeconds = entries.reduce((acc, curr) => acc + (curr.writingTimeSeconds || 0), 0);
  const sealedCount = entries.filter(e => e.isSealed).length;
  const avgWords = chartData.filter(d => d.wordCount > 0).length > 0
    ? Math.round(
        chartData.reduce((acc, curr) => acc + curr.wordCount, 0) /
          chartData.filter(d => d.wordCount > 0).length
      )
    : 0;

  const handleExportAll = () => {
    const exportData = entries.map(e => ({
      date: e.date,
      prompt: prompts.find(p => p.id === e.promptId)?.promptPl || '',
      content: e.decryptedContent || '[Zaszyfrowany]',
      wordCount: e.wordCount,
      characterCount: e.characterCount,
      writingTimeSeconds: e.writingTimeSeconds || 0,
      writingTimeFormatted: formatWritingTime(e.writingTimeSeconds || 0),
      isSealed: e.isSealed,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `momenty_eksport_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#FAF8F5] border border-[#DDD6C8] px-3 py-2 rounded shadow-md text-xs font-serif-literary text-[#1C1A18]">
          <div className="font-mono-meta text-[11px] text-[#7A756D] mb-0.5">{data.dateKey}</div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#1C1A18]">{data.wordCount} słów</span>
            {data.writingTimeSeconds > 0 && (
              <span className="text-[#7A756D] font-mono-meta text-[10px]">
                ({formatWritingTime(data.writingTimeSeconds)})
              </span>
            )}
            {data.isSealed && (
              <span className="text-[10px] text-[#8B2635] font-mono-meta">● pieczęć</span>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]">
      <div
        className="w-full max-w-4xl h-[88vh] bg-[#FAF8F5] border border-[#E2DDD3] rounded-xl shadow-2xl flex flex-col text-[#1C1A18] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ECE7DC] bg-[#F5F2EB]">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-[#EAE5DA] text-[#1C1A18]">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-serif-literary font-medium text-[#1C1A18]">
                Momenty / Moments
              </h3>
              <div className="flex items-center gap-2 text-xs font-mono-meta text-[#7A756D]">
                <span>{entries.length} {entries.length === 1 ? 'wpis' : 'wpisów'}</span>
                <span>·</span>
                <span>{totalWords} słów</span>
                <span>·</span>
                <span>{formatWritingTime(totalSeconds)} łącznie</span>
                <span>·</span>
                <span className="flex items-center gap-1 text-[#8B2635]">
                  <Award className="w-3.5 h-3.5" />
                  {sealedCount} zapieczętowanych
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switch */}
            <div className="flex items-center bg-[#EAE5DA] p-0.5 rounded-lg text-xs font-mono-meta">
              <button
                onClick={() => setActiveTab('reader')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activeTab === 'reader'
                    ? 'bg-[#FAF8F5] text-[#1C1A18] shadow-2xs font-medium'
                    : 'text-[#7A756D] hover:text-[#1C1A18]'
                }`}
              >
                Czytelnia
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  activeTab === 'stats'
                    ? 'bg-[#FAF8F5] text-[#1C1A18] shadow-2xs font-medium'
                    : 'text-[#7A756D] hover:text-[#1C1A18]'
                }`}
              >
                <BarChart2 className="w-3 h-3" />
                <span>Wykres słów</span>
              </button>
            </div>

            <button
              onClick={handleExportAll}
              title="Eksportuj wszystkie wpisy do pliku JSON"
              className="hidden sm:flex px-3 py-1.5 text-xs font-mono-meta text-[#524D46] hover:text-[#1C1A18] border border-[#DDD6C8] rounded-md hover:bg-[#EAE5DA] transition-colors items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Eksportuj
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-[#7A756D] hover:text-[#1C1A18] hover:bg-[#EAE5DA] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Recharts Analytics Panel */}
        {activeTab === 'stats' ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-[#FAF8F5]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#ECE7DC] pb-4">
              <div>
                <h4 className="text-base font-serif-literary font-medium text-[#1C1A18]">
                  Wykres aktywności pisarskiej
                </h4>
                <p className="text-xs font-mono-meta text-[#7A756D] mt-0.5">
                  Liczba napisanych słów w poszczególnych dniach
                </p>
              </div>

              {/* Range Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono-meta text-[#7A756D]">Zakres:</span>
                <div className="inline-flex bg-[#EFECE4] p-0.5 rounded border border-[#DDD6C8] text-xs font-mono-meta">
                  <button
                    onClick={() => setChartDays(14)}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      chartDays === 14
                        ? 'bg-[#FAF8F5] text-[#1C1A18] font-medium shadow-2xs'
                        : 'text-[#7A756D] hover:text-[#1C1A18]'
                    }`}
                  >
                    14 dni
                  </button>
                  <button
                    onClick={() => setChartDays(30)}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      chartDays === 30
                        ? 'bg-[#FAF8F5] text-[#1C1A18] font-medium shadow-2xs'
                        : 'text-[#7A756D] hover:text-[#1C1A18]'
                    }`}
                  >
                    30 dni
                  </button>
                </div>
              </div>
            </div>

            {/* Metric counters */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-[#ECE7DC] bg-[#F7F5F0]">
                <div className="text-[11px] font-mono-meta text-[#7A756D] uppercase">Suma w okresie</div>
                <div className="text-xl font-serif-literary font-medium text-[#1C1A18] mt-1">
                  {chartData.reduce((acc, curr) => acc + curr.wordCount, 0)} <span className="text-xs font-mono-meta text-[#7A756D]">słów</span>
                </div>
              </div>
              <div className="p-4 rounded-lg border border-[#ECE7DC] bg-[#F7F5F0]">
                <div className="text-[11px] font-mono-meta text-[#7A756D] uppercase">Średnia dzienna</div>
                <div className="text-xl font-serif-literary font-medium text-[#1C1A18] mt-1">
                  {avgWords} <span className="text-xs font-mono-meta text-[#7A756D]">słów/dzień</span>
                </div>
              </div>
              <div className="p-4 rounded-lg border border-[#ECE7DC] bg-[#F7F5F0]">
                <div className="text-[11px] font-mono-meta text-[#7A756D] uppercase">Dni z wpisem</div>
                <div className="text-xl font-serif-literary font-medium text-[#8B2635] mt-1">
                  {chartData.filter(d => d.wordCount > 0).length} / {chartDays} <span className="text-xs font-mono-meta text-[#7A756D]">dni</span>
                </div>
              </div>
            </div>

            {/* Recharts Bar Chart */}
            <div className="p-4 sm:p-6 rounded-lg border border-[#ECE7DC] bg-[#FAF8F5] h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="shortLabel"
                    stroke="#9E978C"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E2DDD3' }}
                    fontFamily="'JetBrains Mono', monospace"
                  />
                  <YAxis
                    stroke="#9E978C"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E2DDD3' }}
                    fontFamily="'JetBrains Mono', monospace"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="wordCount" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.isSealed
                            ? '#8B2635'
                            : entry.wordCount > 0
                            ? '#1C1A18'
                            : '#E5DFD3'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between text-xs font-mono-meta text-[#7A756D] px-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#1C1A18]" />
                  Wpis szkicowy
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#8B2635]" />
                  Zapieczętowany wpis
                </span>
              </div>
              <span className="italic font-serif-literary">Kronika rośnie z każdym słowem</span>
            </div>
          </div>
        ) : (
          /* Reader Tab */
          <div className="flex-1 flex overflow-hidden">
            <div className="w-72 border-r border-[#ECE7DC] bg-[#F7F5F0] overflow-y-auto p-3 space-y-1.5">
              <div className="text-[11px] font-mono-meta uppercase tracking-wider text-[#9E978C] px-2 py-1">
                Spis Dni
              </div>
              {entries.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#7A756D] font-mono-meta">
                  Brak zapisanych wpisów. Dzisiejszy wpis pojawi się tutaj po rozpoczęciu pisania!
                </div>
              ) : (
                entries.map(entry => {
                  const isSelected = selectedEntry?.id === entry.id;
                  const p = prompts.find(pr => pr.id === entry.promptId);
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedEntryId(entry.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-[#1C1A18] bg-[#FFFFFF] shadow-xs'
                          : 'border-[#EBE6DB] bg-[#FAF8F5] hover:border-[#D4CEBF] hover:bg-[#F2EFE8]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono-meta mb-1">
                        <span className="font-medium text-[#1C1A18]">{entry.date}</span>
                        {entry.isSealed ? (
                          <span className="text-[10px] text-[#8B2635] flex items-center gap-0.5">
                            ● pieczęć
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#7A756D]">szkic</span>
                        )}
                      </div>
                      <div className="text-xs font-serif-literary text-[#524D46] line-clamp-1">
                        {p?.promptPl || 'Prompt dnia'}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono-meta text-[#9E978C] mt-1.5">
                        <span>{entry.wordCount || 0} słów</span>
                        {typeof entry.writingTimeSeconds === 'number' && entry.writingTimeSeconds > 0 && (
                          <>
                            <span>·</span>
                            <span>{formatWritingTime(entry.writingTimeSeconds)}</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Reader Page View */}
            <div className="flex-1 overflow-y-auto p-8 lg:p-12 bg-[#FAF8F5] flex flex-col justify-between">
              {selectedEntry ? (
                <div className="max-w-2xl mx-auto w-full space-y-6">
                  <div className="border-b border-[#ECE7DC] pb-4">
                    <div className="flex items-center justify-between text-xs font-mono-meta text-[#7A756D] mb-2">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {selectedEntry.date}
                      </span>
                      <div className="flex items-center gap-3">
                        {typeof selectedEntry.writingTimeSeconds === 'number' && selectedEntry.writingTimeSeconds > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#9E978C]" />
                            {formatWritingTime(selectedEntry.writingTimeSeconds)}
                          </span>
                        )}
                        <span>{selectedEntry.wordCount || 0} słów</span>
                        {selectedEntry.isSealed && (
                          <span className="text-[#8B2635] font-serif-literary italic">
                            Zapieczętowany
                          </span>
                        )}
                      </div>
                    </div>

                    {matchedPrompt && (
                      <div className="text-base font-serif-literary italic text-[#7A756D] mt-2 leading-relaxed">
                        „{matchedPrompt.promptPl}”
                      </div>
                    )}
                  </div>

                  <div>
                    {selectedEntry.decryptedContent ? (
                      <div className="text-base font-serif-literary text-[#1C1A18] leading-relaxed whitespace-pre-wrap selection:bg-[#E5DFD3]">
                        {selectedEntry.decryptedContent}
                      </div>
                    ) : (
                      <div className="p-6 rounded-lg border border-[#E3DDD1] bg-[#F2EFE8] text-center space-y-3">
                        <Lock className="w-6 h-6 text-[#7A756D] mx-auto" />
                        <h4 className="text-sm font-serif-literary font-medium text-[#1C1A18]">
                          Wpis jest bezpiecznie zaszyfrowany w chmurze
                        </h4>
                        <p className="text-xs text-[#7A756D] font-mono-meta max-w-md mx-auto">
                          Treść została zabezpieczona Twoim kluczem AES-256. Wprowadź klucz w ustawieniach, aby odkodować ten wpis na obecnym urządzeniu.
                        </p>
                        <button
                          onClick={onOpenKeyModal}
                          className="px-4 py-1.5 text-xs font-mono-meta text-white bg-[#1C1A18] rounded-md hover:bg-[#33302B] transition-colors inline-flex items-center gap-1.5"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          Podaj klucz szyfrowania
                        </button>
                      </div>
                    )}
                  </div>

                  {selectedEntry.isSealed && (
                    <div className="pt-8 mt-12 border-t border-[#ECE7DC] flex justify-end">
                      <div className="flex items-center gap-2 text-xs font-serif-literary text-[#8B2635] border border-[#8B2635]/30 px-3 py-1.5 rounded bg-[#8B2635]/5 select-none">
                        <span className="w-2 h-2 rounded-full bg-[#8B2635]" />
                        Pieczęć autentyczności kronikarskiej
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center my-auto text-[#7A756D] font-serif-literary">
                  Wybierz dzień z indeksu po lewej stronie, aby odczytać wpis.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
