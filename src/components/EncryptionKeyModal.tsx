import React, { useState } from 'react';
import { X, Lock, Key, Copy, Check, ShieldCheck, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { generateJournalKey } from '../services/crypto';

interface EncryptionKeyModalProps {
  isOpen: boolean;
  currentKey: string;
  onSaveKey: (newKey: string, persist: boolean) => void;
  onClose: () => void;
}

export const EncryptionKeyModal: React.FC<EncryptionKeyModalProps> = ({
  isOpen,
  currentKey,
  onSaveKey,
  onClose,
}) => {
  const [keyInput, setKeyInput] = useState(currentKey || '');
  const [persist, setPersist] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!keyInput) return;
    navigator.clipboard.writeText(keyInput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = () => {
    const fresh = generateJournalKey();
    setKeyInput(fresh);
  };

  const handleSave = () => {
    if (!keyInput.trim()) return;
    onSaveKey(keyInput.trim(), persist);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div
        className="w-full max-w-lg bg-[#FAF8F5] border border-[#E2DDD3] rounded-xl shadow-xl p-6 text-[#1C1A18] animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#ECE7DC]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-[#EAE5DA] text-[#1C1A18]">
              <Lock className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-base font-serif-literary font-medium text-[#1C1A18]">
                Prywatne szyfrowanie bazy (E2EE)
              </h3>
              <p className="text-[11px] font-mono-meta text-[#7A756D]">
                Algorytm AES-GCM 256-bit z derywacją PBKDF2
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#7A756D] hover:text-[#1C1A18] hover:bg-[#EFECE4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div className="p-3 bg-[#F2EFE8] rounded-lg border border-[#E3DDD1] text-xs text-[#524D46] leading-relaxed">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#3E7B44] shrink-0 mt-0.5" />
              <span>
                <strong>Zero-Knowledge:</strong> Twoje wpisy są szyfrowane na Twoim urządzeniu <em>przed</em> zapisem do chmury. W bazie danych zapisany jest wyłącznie nieczytelny szyfrogram. Nawet w razie włamania do bazy nikt bez Twojego klucza nie odczyta ani jednego słowa.
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono-meta text-[#7A756D] flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                Twój sekretny klucz do kroniki:
              </label>
              <button
                type="button"
                onClick={handleGenerate}
                className="text-[11px] font-mono-meta text-[#6F4E37] hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Wygeneruj nowy klucz
              </button>
            </div>

            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="Wpisz lub wygeneruj klucz..."
                className="w-full px-3 py-2 text-sm font-mono-meta bg-[#FFFFFF] border border-[#D8D2C4] rounded-md focus:outline-none focus:border-[#1C1A18] text-[#1C1A18] pr-20"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1 text-[#7A756D] hover:text-[#1C1A18] transition-colors"
                  title={showKey ? 'Ukryj klucz' : 'Pokaż klucz'}
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 text-[#7A756D] hover:text-[#1C1A18] transition-colors"
                  title="Kopiuj klucz"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#3E7B44]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-[#7A756D] mt-1 font-mono-meta">
              Zapisz ten klucz w bezpiecznym miejscu (np. menedżer haseł). Będzie potrzebny do odczytu na innym urządzeniu.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#524D46]">
            <input
              type="checkbox"
              checked={persist}
              onChange={e => setPersist(e.target.checked)}
              className="rounded border-[#C8C2B4] text-[#1C1A18] focus:ring-0"
            />
            <span>Zapamiętaj ten klucz w tej przeglądarce (automatyczne odkodowywanie po zalogowaniu)</span>
          </label>
        </div>

        <div className="pt-3 border-t border-[#ECE7DC] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-mono-meta text-[#7A756D] hover:text-[#1C1A18] transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={!keyInput.trim()}
            className="px-4 py-1.5 text-xs font-mono-meta text-white bg-[#1C1A18] rounded-md hover:bg-[#33302B] disabled:opacity-40 transition-colors"
          >
            Zastosuj klucz
          </button>
        </div>
      </div>
    </div>
  );
};
