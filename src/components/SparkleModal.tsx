import React from 'react';
import { Sparkles, X, BookOpen, Calendar, Check } from 'lucide-react';

export interface SparkleAppreciationCard {
  id: string;
  date: string;
  periodLabel: string;
  greeting: string;
  content: string;
  highlights: string[];
  createdAt: string;
}

interface SparkleModalProps {
  isOpen: boolean;
  isLoading: boolean;
  card: SparkleAppreciationCard | null;
  lang?: 'pl' | 'en' | 'es' | 'fr';
  onOpenJournal?: () => void;
  onClose: () => void;
}

export const SparkleModal: React.FC<SparkleModalProps> = ({
  isOpen,
  isLoading,
  card,
  lang = 'pl',
  onOpenJournal,
  onClose,
}) => {
  if (!isOpen) return null;

  const isEn = lang === 'en';
  const isEs = lang === 'es';
  const isFr = lang === 'fr';
  const tr = (pl: string, en: string, es: string, fr?: string) =>
    isEn ? en : isEs ? es : isFr ? fr ?? en : pl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#FAF8F5] border border-[#DDD6C8] rounded-2xl shadow-2xl overflow-hidden text-[#1C1A18] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE5DA] bg-[#F5F2EB]">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-[#EBC5CF]/60 border border-[#1C1A18] flex items-center justify-center text-[#1C1A18] shadow-2xs">
              <Sparkles className="w-4 h-4 text-[#8B2635]" />
            </span>
            <div>
              <div className="text-[10px] font-mono-meta uppercase tracking-widest text-[#8B2635]">
                {tr(
                  'Karta docenienia',
                  'Appreciation Card',
                  'Tarjeta de aprecio',
                  'Carte d’appréciation'
                )}
              </div>
              <h3 className="text-base font-serif-literary font-medium text-[#1C1A18]">
                {tr(
                  'Spojrzenie na Twoje ostatnie dni',
                  'A look back at your recent days',
                  'Una mirada a tus últimos días',
                  'Un regard sur vos derniers jours'
                )}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[78vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-10 flex flex-col items-center text-center space-y-4">
              <div className="relative w-12 h-12 rounded-full bg-[#F3EFE7] border border-[#DDD6C8] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[#8B2635] animate-pulse" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h4 className="text-lg font-serif-literary font-medium text-[#1C1A18]">
                  {tr(
                    'Zbieram Twoje myśli z ostatnich dni...',
                    'Gathering your thoughts from recent days...',
                    'Reuniendo tus pensamientos de los últimos días...',
                    'Rassemblement de vos pensées des derniers jours...'
                  )}
                </h4>
                <p className="text-xs font-mono-meta text-[#7A756D] leading-relaxed">
                  {tr(
                    'Chwila na uważne podsumowanie tego, co było najważniejsze i dlaczego dobrze zrobiłeś.',
                    'Taking a moment to summarize what mattered most and why you did well.',
                    'Un momento para resumir lo más importante y por qué lo hiciste bien.',
                    'Un instant pour résumer ce qui a compté le plus et pourquoi vous avez bien fait.'
                  )}
                </p>
              </div>
            </div>
          ) : card ? (
            <div className="space-y-6 text-left">
              {/* Period badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-meta text-[#7A756D]">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F3EFE7] border border-[#E2DDD3] text-[#524D46]">
                  <Calendar className="w-3.5 h-3.5 text-[#8B2635]" />
                  <span>{card.periodLabel || card.date}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[#2E5C33]">
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {tr(
                      'Zapisano w Dzienniku',
                      'Saved in Journal',
                      'Guardado en el Diario',
                      'Enregistré dans le Journal'
                    )}
                  </span>
                </span>
              </div>

              {/* Greeting */}
              <div className="space-y-3">
                <h4 className="text-xl sm:text-2xl font-serif-literary font-medium text-[#1C1A18] leading-snug">
                  {card.greeting}
                </h4>

                <div className="text-base sm:text-[17px] font-serif-literary text-[#33302B] leading-relaxed whitespace-pre-wrap">
                  {card.content}
                </div>
              </div>

              {/* Highlights */}
              {card.highlights && card.highlights.length > 0 && (
                <div className="p-4 sm:p-5 rounded-xl bg-[#F3EFE7]/85 border border-[#E2DDD3] space-y-2.5">
                  <div className="text-[11px] font-mono-meta uppercase tracking-wider text-[#8B2635] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {tr(
                        'Dlaczego to było dobre:',
                        'Why this mattered:',
                        'Por qué estuvo bien:',
                        'Pourquoi c’était précieux :'
                      )}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {card.highlights.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-sm sm:text-[15px] font-serif-literary text-[#1C1A18] leading-snug"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#8B2635] mt-2 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer actions */}
              <div className="pt-4 border-t border-[#EAE5DA] flex flex-wrap items-center justify-between gap-3">
                {onOpenJournal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenJournal();
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-xs font-mono-meta text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#8B2635]" />
                    <span>
                      {tr(
                        'Zobacz w Dzienniku',
                        'View in Journal',
                        'Ver en el Diario',
                        'Voir dans le Journal'
                      )}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="ml-auto px-4 py-1.5 rounded border border-[#1C1A18] bg-[#1C1A18] hover:bg-[#33302B] text-[#FAF8F5] text-xs font-mono-meta font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  {tr('Dzięki, zamknij', 'Thanks, close', 'Gracias, cerrar', 'Merci, fermer')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
