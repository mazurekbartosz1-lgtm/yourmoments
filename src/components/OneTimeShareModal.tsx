import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Copy,
  Check,
  RefreshCw,
  Globe,
  ShieldAlert,
  Share2,
  KeyRound,
} from 'lucide-react';
import {
  encryptText,
  generateSharePin,
  computePinVerifierHash,
} from '../services/crypto';

interface OneTimeShareModalProps {
  isOpen: boolean;
  content: string;
  promptText: string;
  date: string;
  senderName?: string;
  currentLang: 'pl' | 'en' | 'es' | 'fr';
  onClose: () => void;
}

const TARGET_LANGUAGES: Array<{
  id: 'pl' | 'en' | 'es' | 'fr';
  label: string;
  nativeNote: string;
}> = [
  { id: 'pl', label: 'Polski', nativeNote: 'PL' },
  { id: 'en', label: 'English', nativeNote: 'EN' },
  { id: 'es', label: 'Español', nativeNote: 'ES' },
  { id: 'fr', label: 'Français', nativeNote: 'FR' },
];

export const OneTimeShareModal: React.FC<OneTimeShareModalProps> = ({
  isOpen,
  content,
  promptText,
  date,
  senderName = '',
  currentLang,
  onClose,
}) => {
  const isEn = currentLang === 'en';
  const isEs = currentLang === 'es';
  const isFr = currentLang === 'fr';
  const tr = (pl: string, en: string, es: string, fr?: string) =>
    isEn ? en : isEs ? es : isFr ? fr ?? en : pl;

  const [targetLang, setTargetLang] = useState<'pl' | 'en' | 'es' | 'fr'>(currentLang);
  const [pin, setPin] = useState<string>(() => generateSharePin());
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'both' | 'link' | 'pin' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTargetLang(currentLang);
      setPin(generateSharePin());
      setShareUrl('');
      setErrorMsg(null);
      setCopiedType(null);
    }
  }, [isOpen, currentLang]);

  if (!isOpen) return null;

  const cleanPin = pin.replace(/\D/g, '').slice(0, 6);
  const isPinValid = cleanPin.length >= 4;

  const formatContentForShare = (raw: string): string => {
    const withoutZeroWidth = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    const lines = withoutZeroWidth.split('\n').map(line => {
      // 1. Convert paired inline markers first (*bold*, _italic_, *_bolditalic_*)
      let converted = line
        .replace(/\u2063([^\u2063\n]+)\u2063/g, '*_$1_*')
        .replace(/\u2062([^\u2062\n]+)\u2062/g, '*$1*')
        .replace(/\u2064([^\u2064\n]+)\u2064/g, '_$1_');

      // 2. Convert line-leading \u2063 follow-up question marker
      if (converted.startsWith('\u2063')) {
        const cleanLine = converted.replace(/[\u2062\u2063\u2064]/g, '').trim();
        if (cleanLine) {
          const qIdx = cleanLine.indexOf('?');
          if (qIdx !== -1 && qIdx < cleanLine.length - 1) {
            return `***${cleanLine.slice(0, qIdx + 1)}***${cleanLine.slice(qIdx + 1)}`;
          }
          return `***${cleanLine}***`;
        }
      }

      // Clean any stray single markers
      converted = converted.replace(/[\u2062\u2063\u2064]/g, '');
      const trimmed = converted.trim();

      // 3. Wrap standalone follow-up question lines in ***...*** if not already formatted
      if (
        trimmed.length >= 8 &&
        trimmed.length <= 240 &&
        !trimmed.startsWith('*') &&
        /^[¿A-ZĄĆĘŁŃÓŚŹŻÁÉÍÓÚÑÜÀÂÇÈÉÊËÎÏÔÙÛÜ][^.!?\n]{6,235}\?$/.test(trimmed)
      ) {
        return `***${trimmed}***`;
      }

      return converted;
    });

    return lines.join('\n');
  };

  const handleCreateShareLink = async () => {
    if (!isPinValid || isCreating || !content.trim()) return;
    setIsCreating(true);
    setErrorMsg(null);

    try {
      const cleanRawText = formatContentForShare(content);
      let finalContent = cleanRawText;
      let finalPrompt = promptText.trim();

      // 1. Translate into recipient's target language if different from current language
      if (targetLang !== currentLang) {
        const transRes = await fetch('/api/translate-share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: cleanRawText,
            promptText: finalPrompt,
            sourceLang: currentLang,
            targetLang,
          }),
        });
        if (transRes.ok) {
          const transData = await transRes.json();
          if (transData.translatedContent) {
            finalContent = transData.translatedContent;
          }
          if (transData.translatedPrompt) {
            finalPrompt = transData.translatedPrompt;
          }
        }
      }

      // 2. Encrypt payload client-side using the PIN code (AES-GCM 256 + PBKDF2)
      const payloadToEncrypt = JSON.stringify({
        content: finalContent,
        promptText: finalPrompt,
        date,
        senderName,
        targetLang,
      });

      const encrypted = await encryptText(payloadToEncrypt, cleanPin);
      const pinVerifierHash = await computePinVerifierHash(cleanPin, encrypted.salt);

      // 3. Store one-time encrypted record on server
      const shareRes = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedContent: encrypted.encryptedContent,
          iv: encrypted.iv,
          salt: encrypted.salt,
          pinVerifierHash,
          targetLang,
          senderName,
          date,
        }),
      });

      if (!shareRes.ok) {
        throw new Error('Failed to create one-time share');
      }

      const { shareId } = await shareRes.json();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setShareUrl(`${origin}/?share=${shareId}`);
    } catch {
      setErrorMsg(
        tr(
          'Nie udało się wygenerować linku. Spróbuj ponownie.',
          'Could not generate the one-time link. Please try again.',
          'No se pudo generar el enlace único. Inténtalo de nuevo.',
          'Impossible de générer le lien unique. Veuillez réessayer.'
        )
      );
    } finally {
      setIsCreating(false);
    }
  };

  const buildShareMessageWithPin = () => {
    if (targetLang === 'en') {
      return `I’m sharing a one-time note from my journal with you (it will self-destruct right after you read it):\n${shareUrl}\nPIN code: ${cleanPin}`;
    }
    if (targetLang === 'es') {
      return `Te comparto una nota de lectura única de mi diario (se autodestruirá en cuanto la leas):\n${shareUrl}\nCódigo PIN: ${cleanPin}`;
    }
    if (targetLang === 'fr') {
      return `Je partage avec toi une note à lecture unique de mon journal (elle s’autodétruira dès que tu l’auras lue) :\n${shareUrl}\nCode PIN : ${cleanPin}`;
    }
    return `Dzielę się z Tobą jednorazową myślą z mojego dziennika (po przeczytaniu wiadomość zaszyfruje się i zniknie na zawsze):\n${shareUrl}\nKod PIN: ${cleanPin}`;
  };

  const handleCopy = (type: 'both' | 'link' | 'pin') => {
    const textToCopy =
      type === 'both'
        ? buildShareMessageWithPin()
        : type === 'link'
        ? shareUrl
        : cleanPin;
    navigator.clipboard.writeText(textToCopy);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2400);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#FAF8F5] border border-[#DDD6C8] rounded-2xl shadow-2xl overflow-hidden text-[#1C1A18] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE5DA] bg-[#F5F2EB]">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded border border-[#DDD6C8] bg-[#FAF8F5] flex items-center justify-center text-[#8B2635]">
              <svg
                viewBox="0 0 18 18"
                className="w-4 h-4 shrink-0"
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
            </span>
            <div>
              <div className="text-[10px] font-mono-meta uppercase tracking-widest text-[#8B2635]">
                {tr(
                  'Jednorazowy link · Szyfrowany PIN-em',
                  'One-Time Link · PIN Encrypted',
                  'Enlace único · Cifrado con PIN',
                  'Lien unique · Chiffré par PIN'
                )}
              </div>
              <h3 className="text-base font-serif-literary font-medium text-[#1C1A18]">
                {tr(
                  'Podziel się myślą',
                  'Share a thought',
                  'Compartir pensamiento',
                  'Partager une pensée'
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
        <div className="p-6 space-y-5 text-left">
          {/* Self-destruction notice */}
          <div className="p-3.5 rounded-xl bg-[#F3EFE7] border border-[#E2DDD3] flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-[#8B2635] shrink-0 mt-0.5" />
            <p className="text-xs font-serif-literary text-[#524D46] leading-relaxed">
              {tr(
                'Wiadomość zostanie zaszyfrowana kodem PIN. Gdy odbiorca wpisze PIN i przeczyta wpis po raz pierwszy, link natychmiast wygaśnie — kolejne odświeżenie zablokuje dostęp na zawsze.',
                'The message is encrypted with a PIN code. Once the recipient enters the PIN and reads the entry for the first time, the link immediately self-destructs — any refresh permanently blocks access.',
                'El mensaje se cifra con un código PIN. En cuanto el destinatario introduzca el PIN y lea la entrada por primera vez, el enlace se autodestruirá de inmediato.',
                'Le message est chiffré avec un code PIN. Dès que le destinataire saisit le PIN et lit l’entrée, le lien s’autodétruit immédiatement.'
              )}
            </p>
          </div>

          {!shareUrl ? (
            <>
              {/* 1. Target Language Selection */}
              <div className="space-y-2">
                <label className="text-xs font-mono-meta text-[#524D46] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#6F4E37]" />
                  <span>
                    {tr(
                      'W jakim języku odbiorca ma przeczytać tę wiadomość?',
                      'In which language should the recipient read this message?',
                      '¿En qué idioma debe leer el destinatario este mensaje?',
                      'Dans quelle langue le destinataire doit-il lire ce message ?'
                    )}
                  </span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TARGET_LANGUAGES.map(l => {
                    const isSelected = targetLang === l.id;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setTargetLang(l.id)}
                        className={`px-3 py-1.5 rounded border text-xs font-mono-meta flex items-center justify-between transition-colors cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? 'border-[#1C1A18] bg-[#1C1A18] text-[#FAF8F5] font-medium'
                            : 'border-[#DDD6C8] bg-[#F5F2EB] text-[#524D46] hover:bg-[#EAE5DA] hover:text-[#1C1A18]'
                        }`}
                      >
                        <span>{l.label}</span>
                        <span
                          className={`text-[10px] ${
                            isSelected ? 'text-[#EBC5CF]' : 'text-[#9E978C]'
                          }`}
                        >
                          {l.nativeNote}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {targetLang !== currentLang && (
                  <p className="text-[11px] font-mono-meta text-[#8B2635]">
                    {tr(
                      '✨ Twój wpis i pytanie dnia zostaną automatycznie przetłumaczone przed zaszyfrowaniem.',
                      '✨ Your entry and daily question will be automatically translated before encryption.',
                      '✨ Tu entrada y la pregunta del día se traducirán automáticamente antes de cifrarse.',
                      '✨ Votre entrée et la question du jour seront traduites automatiquement avant le chiffrement.'
                    )}
                  </p>
                )}
              </div>

              {/* 2. PIN Code Configuration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono-meta text-[#524D46] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#6F4E37]" />
                    <span>
                      {tr(
                        'Kod PIN do otwarcia wiadomości (4–6 cyfr):',
                        'PIN code to unlock the message (4–6 digits):',
                        'Código PIN para abrir el mensaje (4–6 dígitos):',
                        'Code PIN pour déverrouiller le message (4–6 chiffres) :'
                      )}
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setPin(generateSharePin())}
                    className="px-2 py-0.5 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[11px] font-mono-meta text-[#524D46] hover:text-[#1C1A18] inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{tr('Losuj inny PIN', 'Randomize PIN', 'Otro PIN', 'Autre PIN')}</span>
                  </button>
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={cleanPin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-2.5 text-lg font-mono-meta tracking-[0.35em] text-center bg-[#F7F5F0] border border-[#D4CEBF] rounded focus:outline-none focus:border-[#1C1A18] text-[#1C1A18] font-semibold"
                />
              </div>

              {errorMsg && (
                <p className="text-xs font-mono-meta text-[#9E2A2B]">{errorMsg}</p>
              )}

              {/* Create Button */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-xs font-mono-meta text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer whitespace-nowrap"
                >
                  {tr('Anuluj', 'Cancel', 'Cancelar', 'Annuler')}
                </button>

                <button
                  type="button"
                  disabled={!isPinValid || isCreating}
                  onClick={handleCreateShareLink}
                  className="px-4 py-2 rounded border border-[#1C1A18] bg-[#1C1A18] hover:bg-[#33302B] disabled:opacity-40 text-[#FAF8F5] text-xs font-mono-meta font-medium inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#EBC5CF]" />
                      <span>
                        {targetLang !== currentLang
                          ? tr(
                              'Tłumaczenie i szyfrowanie...',
                              'Translating & encrypting...',
                              'Traduciendo y cifrando...',
                              'Traduction et chiffrement...'
                            )
                          : tr(
                              'Szyfrowanie linku...',
                              'Encrypting link...',
                              'Cifrando enlace...',
                              'Chiffrement du lien...'
                            )}
                      </span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-[#EBC5CF]" />
                      <span>
                        {tr(
                          'Utwórz jednorazowy link z PIN-em',
                          'Create one-time link with PIN',
                          'Crear enlace único con PIN',
                          'Créer un lien unique avec PIN'
                        )}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Ready Link + PIN View */
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 rounded-xl bg-[#F7F5F0] border border-[#D4CEBF] space-y-3">
                <div className="flex items-center justify-between text-xs font-mono-meta text-[#7A756D]">
                  <span>
                    {tr('Jednorazowy link:', 'One-time link:', 'Enlace único:', 'Lien unique :')}
                  </span>
                  <span className="text-[#8B2635] font-medium">
                    {TARGET_LANGUAGES.find(l => l.id === targetLang)?.label}
                  </span>
                </div>

                <div className="px-3 py-2 rounded bg-[#FAF8F5] border border-[#E2DDD3] font-mono-meta text-xs text-[#1C1A18] break-all select-all">
                  {shareUrl}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#EAE5DA]">
                  <span className="text-xs font-mono-meta text-[#7A756D]">
                    {tr('Kod PIN do otwarcia:', 'Unlock PIN code:', 'Código PIN:', 'Code PIN :')}
                  </span>
                  <span className="px-3 py-1 rounded bg-[#EBC5CF]/50 border border-[#1C1A18] font-mono-meta text-base font-semibold tracking-[0.25em] text-[#1C1A18] select-all">
                    {cleanPin}
                  </span>
                </div>
              </div>

              {/* Copy buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => handleCopy('both')}
                  className="flex-1 px-4 py-2 rounded border border-[#1C1A18] bg-[#1C1A18] hover:bg-[#33302B] text-[#FAF8F5] text-xs font-mono-meta font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {copiedType === 'both' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#A3D9A5]" />
                      <span>
                        {tr(
                          'Skopiowano link wraz z PIN-em!',
                          'Copied link & PIN!',
                          '¡Enlace y PIN copiados!',
                          'Lien et PIN copiés !'
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#EBC5CF]" />
                      <span>
                        {tr(
                          'Kopiuj gotową wiadomość (link + PIN)',
                          'Copy ready message (link + PIN)',
                          'Copiar mensaje listo (enlace + PIN)',
                          'Copier le message prêt (lien + PIN)'
                        )}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy('link')}
                  className="px-3.5 py-2 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-[#524D46] hover:text-[#1C1A18] text-xs font-mono-meta inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {copiedType === 'link' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#2E5C33]" />
                      <span>{tr('Skopiowano!', 'Copied!', '¡Copiado!', 'Copié !')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#7A756D]" />
                      <span>{tr('Sam link', 'Link only', 'Solo enlace', 'Lien seul')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
