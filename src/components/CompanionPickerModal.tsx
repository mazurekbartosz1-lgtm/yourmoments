import React from 'react';
import { COMPANIONS, CompanionId } from './CompanionDesk';
import { X, Check } from 'lucide-react';

interface CompanionPickerModalProps {
  isOpen: boolean;
  currentCompanion: CompanionId;
  lang?: 'pl' | 'en' | 'es' | 'fr';
  onSelect: (companion: CompanionId) => void;
  onClose: () => void;
}

// Hand-drawn line-art SVG miniature matching the cloud-and-sun logo style
function CompanionArtIcon({ companionId }: { companionId: CompanionId }) {
  switch (companionId) {
    case 'crocodile':
      return (
        <svg viewBox="0 0 54 44" className="w-full h-full overflow-visible" aria-hidden="true">
          <polygon points="21,16 24,11 27,16" fill="#789A82" stroke="#1C1A18" strokeWidth="1.6" strokeLinejoin="round" />
          <polygon points="27,16 30,11 33,16" fill="#789A82" stroke="#1C1A18" strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="15" y="16" width="24" height="20" rx="3.5" fill="#789A82" stroke="#1C1A18" strokeWidth="1.7" />
          <rect x="7" y="24" width="13" height="10" rx="2.5" fill="#789A82" stroke="#1C1A18" strokeWidth="1.7" />
          <polygon points="11,34 15,34 13,38" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.4" strokeLinejoin="round" />
          <circle cx="24" cy="22" r="3.6" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.6" />
          <circle cx="24.5" cy="22" r="1.6" fill="#1C1A18" />
          <circle cx="10" cy="27" r="1.2" fill="#1C1A18" />
        </svg>
      );

    case 'wolf':
      return (
        <svg viewBox="0 0 54 44" className="w-full h-full overflow-visible" aria-hidden="true">
          <polygon points="16,18 20,7 26,17" fill="#8D959E" stroke="#1C1A18" strokeWidth="1.7" strokeLinejoin="round" />
          <polygon points="34,17 40,7 44,18" fill="#8D959E" stroke="#1C1A18" strokeWidth="1.7" strokeLinejoin="round" />
          <rect x="15" y="16" width="30" height="22" rx="4" fill="#8D959E" stroke="#1C1A18" strokeWidth="1.7" />
          <rect x="23" y="28" width="14" height="8" rx="2" fill="#FAF8F5" stroke="#1C1A18" strokeWidth="1.5" />
          <circle cx="30" cy="30.5" r="1.8" fill="#1C1A18" />
          <circle cx="23" cy="23" r="3.2" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.6" />
          <circle cx="23" cy="23" r="1.5" fill="#1C1A18" />
          <circle cx="37" cy="23" r="3.2" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.6" />
          <circle cx="37" cy="23" r="1.5" fill="#1C1A18" />
        </svg>
      );

    case 'axolotl':
      return (
        <svg viewBox="0 0 54 44" className="w-full h-full overflow-visible" aria-hidden="true">
          <line x1="7" y1="20" x2="16" y2="23" stroke="#1C1A18" strokeWidth="1.9" strokeLinecap="round" />
          <line x1="6" y1="26" x2="16" y2="27" stroke="#1C1A18" strokeWidth="1.9" strokeLinecap="round" />
          <line x1="7" y1="32" x2="16" y2="31" stroke="#1C1A18" strokeWidth="1.9" strokeLinecap="round" />
          <line x1="47" y1="20" x2="38" y2="23" stroke="#1C1A18" strokeWidth="1.9" strokeLinecap="round" />
          <line x1="48" y1="26" x2="38" y2="27" stroke="#1C1A18" strokeWidth="1.9" strokeLinecap="round" />
          <line x1="47" y1="32" x2="38" y2="31" stroke="#1C1A18" strokeWidth="1.9" strokeLinecap="round" />
          <rect x="14" y="16" width="26" height="21" rx="5" fill="#EBC5CF" stroke="#1C1A18" strokeWidth="1.7" />
          <circle cx="21" cy="24" r="3.2" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.6" />
          <circle cx="21" cy="24" r="1.5" fill="#1C1A18" />
          <circle cx="33" cy="24" r="3.2" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.6" />
          <circle cx="33" cy="24" r="1.5" fill="#1C1A18" />
          <path d="M24 31 Q27 33.5 30 31" fill="none" stroke="#1C1A18" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'bear':
      return (
        <svg viewBox="0 0 54 44" className="w-full h-full overflow-visible" aria-hidden="true">
          <rect x="13" y="11" width="9" height="9" rx="3" fill="#A6836C" stroke="#1C1A18" strokeWidth="1.7" />
          <rect x="38" y="11" width="9" height="9" rx="3" fill="#A6836C" stroke="#1C1A18" strokeWidth="1.7" />
          <rect x="14" y="16" width="32" height="22" rx="4.5" fill="#A6836C" stroke="#1C1A18" strokeWidth="1.7" />
          <rect x="23" y="27" width="14" height="9" rx="2" fill="#FAF8F5" stroke="#1C1A18" strokeWidth="1.5" />
          <circle cx="30" cy="30" r="1.8" fill="#1C1A18" />
          <circle cx="22" cy="23" r="3.2" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.6" />
          <circle cx="22" cy="23" r="1.5" fill="#1C1A18" />
          <circle cx="38" cy="23" r="3.2" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.6" />
          <circle cx="38" cy="23" r="1.5" fill="#1C1A18" />
        </svg>
      );

    case 'panda':
      return (
        <svg viewBox="0 0 54 44" className="w-full h-full overflow-visible" aria-hidden="true">
          <rect x="13" y="11" width="9" height="9" rx="3" fill="#1C1A18" />
          <rect x="38" y="11" width="9" height="9" rx="3" fill="#1C1A18" />
          <rect x="14" y="16" width="32" height="22" rx="4.5" fill="#FAF8F5" stroke="#1C1A18" strokeWidth="1.7" />
          <ellipse cx="22" cy="24" rx="4.2" ry="3.2" fill="#1C1A18" transform="rotate(-15 22 24)" />
          <circle cx="22" cy="24" r="1.4" fill="#FFFFFF" />
          <ellipse cx="38" cy="24" rx="4.2" ry="3.2" fill="#1C1A18" transform="rotate(15 38 24)" />
          <circle cx="38" cy="24" r="1.4" fill="#FFFFFF" />
          <circle cx="30" cy="31" r="1.8" fill="#1C1A18" />
        </svg>
      );

    case 'dragon':
      return (
        <svg viewBox="0 0 54 44" className="w-full h-full overflow-visible" aria-hidden="true">
          <polygon points="17,16 13,7 22,16" fill="#FAF8F5" stroke="#1C1A18" strokeWidth="1.7" strokeLinejoin="round" />
          <polygon points="37,16 41,7 32,16" fill="#FAF8F5" stroke="#1C1A18" strokeWidth="1.7" strokeLinejoin="round" />
          <rect x="15" y="16" width="30" height="22" rx="4.5" fill="#6C9A96" stroke="#1C1A18" strokeWidth="1.7" />
          <circle cx="23" cy="24" r="3.2" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.6" />
          <circle cx="23" cy="24" r="1.5" fill="#1C1A18" />
          <circle cx="37" cy="24" r="3.2" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.6" />
          <circle cx="37" cy="24" r="1.5" fill="#1C1A18" />
          <circle cx="27" cy="32" r="1.1" fill="#1C1A18" />
          <circle cx="33" cy="32" r="1.1" fill="#1C1A18" />
        </svg>
      );

    case 'cat':
    case 'dinosaur':
      return (
        <svg viewBox="0 0 54 44" className="w-full h-full overflow-visible" aria-hidden="true">
          <polygon points="15,18 20,6 27,17" fill="#C8B89E" stroke="#1C1A18" strokeWidth="1.7" strokeLinejoin="round" />
          <polygon points="18,17 21,9 25,16" fill="#EBC5CF" />
          <polygon points="33,17 40,6 45,18" fill="#C8B89E" stroke="#1C1A18" strokeWidth="1.7" strokeLinejoin="round" />
          <polygon points="35,16 39,9 42,17" fill="#EBC5CF" />
          <rect x="15" y="16" width="30" height="22" rx="5" fill="#C8B89E" stroke="#1C1A18" strokeWidth="1.7" />
          <line x1="5" y1="26" x2="14" y2="27" stroke="#1C1A18" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="5" y1="30" x2="14" y2="29" stroke="#1C1A18" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="46" y1="27" x2="55" y2="26" stroke="#1C1A18" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="46" y1="29" x2="55" y2="30" stroke="#1C1A18" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="23" cy="23" r="3.2" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.6" />
          <circle cx="23" cy="23" r="1.5" fill="#1C1A18" />
          <circle cx="37" cy="23" r="3.2" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.6" />
          <circle cx="37" cy="23" r="1.5" fill="#1C1A18" />
          <polygon points="28,29 32,29 30,31.5" fill="#EBC5CF" stroke="#1C1A18" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M28 32 Q30 33.8 32 32" fill="none" stroke="#1C1A18" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );

    case 'fox':
    case 'lizard':
      return (
        <svg viewBox="0 0 54 44" className="w-full h-full overflow-visible" aria-hidden="true">
          <polygon points="15,18 19,5 27,17" fill="#C96839" stroke="#1C1A18" strokeWidth="1.7" strokeLinejoin="round" />
          <polygon points="17,11 19,5 23,11" fill="#1C1A18" />
          <polygon points="18,17 20,11 24,16" fill="#FAF8F5" />
          <polygon points="33,17 41,5 45,18" fill="#C96839" stroke="#1C1A18" strokeWidth="1.7" strokeLinejoin="round" />
          <polygon points="37,11 41,5 43,11" fill="#1C1A18" />
          <polygon points="36,16 40,11 42,17" fill="#FAF8F5" />
          <rect x="15" y="16" width="30" height="22" rx="4.5" fill="#C96839" stroke="#1C1A18" strokeWidth="1.7" />
          <polygon points="15,35 25,27 30,36 35,27 45,35" fill="#FAF8F5" stroke="#1C1A18" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="30" cy="30" r="1.8" fill="#1C1A18" />
          <circle cx="23" cy="23" r="3" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.6" />
          <circle cx="23" cy="23" r="1.4" fill="#1C1A18" />
          <circle cx="37" cy="23" r="3" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.6" />
          <circle cx="37" cy="23" r="1.4" fill="#1C1A18" />
        </svg>
      );

    case 'bird':
      return (
        <svg viewBox="0 0 54 44" className="w-full h-full overflow-visible" aria-hidden="true">
          <path d="M19 36 L19 14 C19 10 24 8 29 9 C33 10 35 14 35 18 L39 26 L44 32 L33 32 L33 36 Z" fill="#1C1A18" stroke="#1C1A18" strokeWidth="1.7" strokeLinejoin="round" />
          <polygon points="26,20 36,28 31,28 24,22" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.5" strokeLinejoin="round" />
          <polygon points="19,13 10,15 19,17" fill="#FAF8F5" stroke="#1C1A18" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="25" cy="14" r="3.2" fill="#FFFFFF" stroke="#1C1A18" strokeWidth="1.5" />
          <circle cx="25" cy="14" r="1.5" fill="#1C1A18" />
        </svg>
      );
  }
}

export const CompanionPickerModal: React.FC<CompanionPickerModalProps> = ({
  isOpen,
  currentCompanion,
  lang = 'pl',
  onSelect,
  onClose,
}) => {
  if (!isOpen) return null;
  const isEn = lang === 'en';
  const isEs = lang === 'es';
  const isFr = lang === 'fr';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[2px]">
      <div
        className="w-full max-w-lg bg-[#FAF8F5] border border-[#E2DDD3] rounded-2xl shadow-xl p-6 text-[#1C1A18] animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#ECE7DC]">
          <div>
            <h3 className="text-lg font-serif-literary font-medium text-[#1C1A18]">
              {isEn
                ? 'Choose your writing companion'
                : isEs
                ? 'Elige a tu compañero de escritura'
                : isFr
                ? 'Choisissez votre compagnon d’écriture'
                : 'Wybierz towarzysza pisania'}
            </h3>
            <p className="text-xs text-[#7A756D] font-mono-meta mt-0.5">
              {isEn
                ? 'Your small companion will keep you company with every entry.'
                : isEs
                ? 'Tu pequeño compañero te acompañará en cada entrada del diario.'
                : isFr
                ? 'Votre petit compagnon vous tiendra compagnie à chaque entrée.'
                : 'Twój mały kompan będzie pracował z Tobą przy każdym wpisie.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Delicate architectural grid without heavy box frames, in the exact style of the website */}
        <div className="my-5 border border-[#E2DDD3] rounded-xl overflow-hidden divide-y divide-[#E2DDD3]/80 bg-[#FAF8F5]">
          <div className="grid grid-cols-3 divide-x divide-[#E2DDD3]/80">
            {COMPANIONS.slice(0, 3).map(comp => renderGridItem(comp))}
          </div>
          <div className="grid grid-cols-3 divide-x divide-[#E2DDD3]/80">
            {COMPANIONS.slice(3, 6).map(comp => renderGridItem(comp))}
          </div>
          <div className="grid grid-cols-3 divide-x divide-[#E2DDD3]/80">
            {COMPANIONS.slice(6, 9).map(comp => renderGridItem(comp))}
          </div>
        </div>

        <div className="pt-3 border-t border-[#ECE7DC] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-xs font-mono-meta text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer whitespace-nowrap"
          >
            {isEn ? 'Close' : isEs ? 'Cerrar' : isFr ? 'Fermer' : 'Zamknij'}
          </button>
        </div>
      </div>
    </div>
  );

  function renderGridItem(comp: (typeof COMPANIONS)[0]) {
    const isSelected =
      comp.id === currentCompanion ||
      (currentCompanion === 'dinosaur' && comp.id === 'cat') ||
      (currentCompanion === 'lizard' && comp.id === 'fox');

    return (
      <button
        key={comp.id}
        type="button"
        onClick={() => {
          onSelect(comp.id);
          onClose();
        }}
        className={`group relative flex flex-col items-center justify-between p-3.5 text-center transition-all cursor-pointer select-none ${
          isSelected
            ? 'bg-[#EFECE4] text-[#1C1A18]'
            : 'bg-[#FAF8F5] hover:bg-[#F5F2EB] text-[#33302B]'
        }`}
      >
        {isSelected && (
          <span className="absolute top-2 right-2 text-[#1C1A18]" title="Wybrany">
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          </span>
        )}
        <div className="w-13 h-10 flex items-center justify-center mb-1.5 transition-transform duration-200 group-hover:scale-105">
          <CompanionArtIcon companionId={comp.id} />
        </div>
        <span className="text-xs sm:text-sm font-serif-literary font-medium text-[#1C1A18]">
          {isEn ? comp.nameEn : isEs ? comp.nameEs : isFr ? comp.nameFr : comp.namePl}
        </span>
        <span className="text-[10px] text-[#7A756D] mt-0.5 line-clamp-2 leading-tight font-serif-literary">
          {isEn
            ? comp.descriptionEn
            : isEs
            ? comp.descriptionEs
            : isFr
            ? comp.descriptionFr
            : comp.descriptionPl}
        </span>
      </button>
    );
  }
};
