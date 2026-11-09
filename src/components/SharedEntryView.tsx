import React, { useState, useEffect } from 'react';
import { Lock, Unlock, ShieldAlert, Calendar, ArrowLeft, KeyRound } from 'lucide-react';
import { decryptText, computePinVerifierHash } from '../services/crypto';

interface SharedEntryViewProps {
  shareId: string;
  onExitShareView: () => void;
}

interface DecryptedShareData {
  content: string;
  promptText: string;
  date: string;
  senderName?: string;
  targetLang: 'pl' | 'en' | 'es' | 'fr';
}

export const SharedEntryView: React.FC<SharedEntryViewProps> = ({
  shareId,
  onExitShareView,
}) => {
  const [status, setStatus] = useState<'loading' | 'locked' | 'decrypted' | 'burned'>('loading');
  const [uiLang, setUiLang] = useState<'pl' | 'en' | 'es' | 'fr'>('pl');
  const [senderName, setSenderName] = useState<string>('');
  const [shareDate, setShareDate] = useState<string>('');
  const [saltHex, setSaltHex] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [remainingAttempts, setRemainingAttempts] = useState<number>(5);
  const [pinError, setPinError] = useState<boolean>(false);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);
  const [decryptedData, setDecryptedData] = useState<DecryptedShareData | null>(null);

  const isEn = uiLang === 'en';
  const isEs = uiLang === 'es';
  const isFr = uiLang === 'fr';
  const tr = (pl: string, en: string, es: string, fr?: string) =>
    isEn ? en : isEs ? es : isFr ? fr ?? en : pl;

  useEffect(() => {
    let mounted = true;
    const checkShareStatus = async () => {
      try {
        const res = await fetch(`/api/shares/${encodeURIComponent(shareId)}/status`);
        if (!res.ok) {
          if (mounted) setStatus('burned');
          return;
        }
        const data = await res.json();
        if (!mounted) return;

        if (data.targetLang && ['pl', 'en', 'es', 'fr'].includes(data.targetLang)) {
          setUiLang(data.targetLang);
        }
        if (data.senderName) setSenderName(data.senderName);
        if (data.date) setShareDate(data.date);
        if (typeof data.remainingAttempts === 'number') {
          setRemainingAttempts(data.remainingAttempts);
        }

        if (!data.exists || data.burned || !data.salt) {
          setStatus('burned');
        } else {
          setSaltHex(data.salt);
          setStatus('locked');
        }
      } catch {
        if (mounted) setStatus('burned');
      }
    };

    checkShareStatus();
    return () => {
      mounted = false;
    };
  }, [shareId]);

  const handleUnlockShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInput.trim();
    if (cleanPin.length < 4 || isUnlocking || !saltHex) return;

    setIsUnlocking(true);
    setPinError(false);

    try {
      const pinVerifierHash = await computePinVerifierHash(cleanPin, saltHex);
      const res = await fetch(`/api/shares/${encodeURIComponent(shareId)}/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinVerifierHash }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403 && data.error === 'invalid_pin') {
        setPinError(true);
        if (typeof data.remainingAttempts === 'number') {
          setRemainingAttempts(data.remainingAttempts);
        }
        if (data.burned) {
          setStatus('burned');
        }
        return;
      }

      if (!res.ok || data.burned || !data.encryptedContent) {
        setStatus('burned');
        return;
      }

      // Decrypt in browser memory using the PIN
      const rawJson = await decryptText(
        data.encryptedContent,
        data.iv,
        data.salt,
        cleanPin
      );
      const parsed = JSON.parse(rawJson);

      setDecryptedData({
        content: parsed.content || '',
        promptText: parsed.promptText || '',
        date: parsed.date || shareDate,
        senderName: parsed.senderName || senderName,
        targetLang: parsed.targetLang || uiLang,
      });
      setStatus('decrypted');
    } catch {
      setPinError(true);
    } finally {
      setIsUnlocking(false);
    }
  };

  const renderInlineShareMarkup = (segmentText: string) => {
    if (!segmentText) return null;
    const normalized = segmentText
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
      );

    const parts = normalized.split(
      /(\u2063[^\u2063]*\u2063|\u2062[^\u2062]*\u2062|\u2064[^\u2064]*\u2064|\u2063[^\u2063]+$|\u2062[^\u2062]+$|\u2064[^\u2064]+$)/g
    );

    return parts.map((part, i) => {
      if (!part) return null;
      const cleanText = part.replace(/[\u200B-\u200D\uFEFF\u2062\u2063\u2064]/g, '');
      if (!cleanText) return null;

      if (part.startsWith('\u2063')) {
        return (
          <strong key={i} className="italic font-semibold text-[#1C1A18]">
            {cleanText}
          </strong>
        );
      }
      if (part.startsWith('\u2062')) {
        return (
          <strong key={i} className="font-semibold text-[#1C1A18]">
            {cleanText}
          </strong>
        );
      }
      if (part.startsWith('\u2064')) {
        return (
          <em key={i} className="italic text-[#1C1A18]">
            {cleanText}
          </em>
        );
      }
      return <span key={i}>{cleanText}</span>;
    });
  };

  const renderFormattedShareContent = (rawText: string) => {
    if (!rawText) return null;
    const lines = rawText.split('\n');

    return lines.map((line, idx) => {
      const cleanTrimmed = line
        .replace(/[\u200B-\u200D\uFEFF\u2062\u2063\u2064]/g, '')
        .replace(/^\*{1,3}|\*{1,3}$/g, '')
        .trim();

      const hasInvisibleQuestionMarker =
        line.startsWith('\u2063') && !line.slice(1).includes('\u2063');

      const isStandaloneQuestionLine =
        cleanTrimmed.length >= 8 &&
        cleanTrimmed.length <= 240 &&
        /^[¿A-ZĄĆĘŁŃÓŚŹŻÁÉÍÓÚÑÜÀÂÇÈÉÊËÎÏÔÙÛÜ][^.!?\n]{6,235}\?$/.test(cleanTrimmed);

      const isQuestionLine =
        cleanTrimmed.length > 0 && (hasInvisibleQuestionMarker || isStandaloneQuestionLine);

      let questionPart = cleanTrimmed;
      let remainderPart = '';
      if (hasInvisibleQuestionMarker && !isStandaloneQuestionLine) {
        const rawClean = line.replace(/[\u200B-\u200D\uFEFF\u2062\u2063\u2064]/g, '');
        const qIdx = rawClean.indexOf('?');
        if (qIdx !== -1 && qIdx < rawClean.length - 1) {
          questionPart = rawClean.slice(0, qIdx + 1);
          remainderPart = rawClean.slice(qIdx + 1);
        } else {
          questionPart = rawClean;
        }
      }

      return (
        <React.Fragment key={idx}>
          {isQuestionLine ? (
            <>
              <strong className="italic font-semibold text-[#1C1A18]">
                {questionPart}
              </strong>
              {remainderPart && renderInlineShareMarkup(remainderPart)}
            </>
          ) : (
            renderInlineShareMarkup(line)
          )}
          {idx < lines.length - 1 ? '\n' : ''}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C1A18] flex flex-col font-serif-literary antialiased selection:bg-[#E2DDD3]">
      {/* Header */}
      <header className="w-full border-b border-[#EAE5DA] bg-[#F7F5F0]/95">
        <div className="max-w-2xl mx-auto w-full px-6 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-base sm:text-lg font-serif-literary text-[#1C1A18]">
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
            <span>Momenty</span>
          </div>

          <button
            type="button"
            onClick={onExitShareView}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-[#DDD6C8] bg-[#F5F2EB] hover:bg-[#EAE5DA] text-xs font-mono-meta text-[#524D46] hover:text-[#1C1A18] transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>
              {tr(
                'Twój dziennik',
                'Your journal',
                'Tu diario',
                'Votre journal'
              )}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="max-w-xl w-full">
          {status === 'loading' && (
            <div className="p-8 rounded-2xl bg-[#FAF8F5] border border-[#E2DDD3] text-center space-y-3">
              <Lock className="w-6 h-6 text-[#8B2635] mx-auto animate-pulse" />
              <div className="text-sm font-mono-meta text-[#7A756D]">
                {tr(
                  'Sprawdzanie pieczęci wiadomości...',
                  'Checking message seal...',
                  'Verificando el sello del mensaje...',
                  'Vérification du sceau du message...'
                )}
              </div>
            </div>
          )}

          {status === 'locked' && (
            <div className="p-6 sm:p-8 rounded-2xl bg-[#FAF8F5] border border-[#DDD6C8] shadow-lg space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
              {/* Envelope with rose wax seal */}
              <div className="w-14 h-14 rounded-full bg-[#F3EFE7] border border-[#DDD6C8] flex items-center justify-center mx-auto">
                <svg viewBox="0 0 28 26" className="w-7 h-7 overflow-visible" aria-hidden="true">
                  <rect
                    x="3"
                    y="4"
                    width="22"
                    height="18"
                    rx="3"
                    fill="#FAF8F5"
                    stroke="#1C1A18"
                    strokeWidth="1.7"
                  />
                  <path
                    d="M3.5 6 L14 13.5 L24.5 6"
                    fill="none"
                    stroke="#1C1A18"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="14"
                    cy="14.5"
                    r="4.2"
                    fill="#EBC5CF"
                    stroke="#1C1A18"
                    strokeWidth="1.6"
                  />
                </svg>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-mono-meta uppercase tracking-widest text-[#8B2635]">
                  {tr(
                    'Jednorazowa wiadomość z Dziennika',
                    'One-Time Journal Message',
                    'Mensaje único del Diario',
                    'Message unique du Journal'
                  )}
                </div>
                <h1 className="text-2xl font-serif-literary font-normal text-[#1C1A18]">
                  {senderName
                    ? tr(
                        `${senderName} dzieli się z Tobą swoim momentem`,
                        `${senderName} shared a moment with you`,
                        `${senderName} compartió un momento contigo`,
                        `${senderName} a partagé un moment avec vous`
                      )
                    : tr(
                        'Ktoś podzielił się z Tobą swoim momentem',
                        'Someone shared a moment with you',
                        'Alguien compartió un momento contigo',
                        'Quelqu’un a partagé un moment avec vous'
                      )}
                </h1>
                <p className="text-xs sm:text-sm font-serif-literary text-[#6E6961] max-w-md mx-auto leading-relaxed">
                  {tr(
                    'Wpisz kod PIN otrzymany od nadawcy. Uwaga: wiadomość można odczytać tylko jeden raz — po otwarciu jej zaszyfrowana kopia na serwerze ulegnie natychmiastowemu zniszczeniu.',
                    'Enter the PIN code from the sender. Note: this message can only be read once — upon opening, its encrypted copy on the server is immediately destroyed.',
                    'Introduce el código PIN del remitente. Nota: este mensaje solo se puede leer una vez; al abrirlo se destruye inmediatamente del servidor.',
                    'Entrez le code PIN reçu. Remarque : ce message ne peut être lu qu’une seule fois ; dès son ouverture, il est détruit du serveur.'
                  )}
                </p>
              </div>

              <form onSubmit={handleUnlockShare} className="space-y-4 max-w-xs mx-auto">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono-meta text-[#7A756D] flex items-center justify-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#8B2635]" />
                    <span>{tr('Kod PIN', 'PIN Code', 'Código PIN', 'Code PIN')}</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    value={pinInput}
                    onChange={e => {
                      setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setPinError(false);
                    }}
                    placeholder="••••"
                    className="w-full px-4 py-3 text-xl font-mono-meta tracking-[0.4em] text-center bg-[#F7F5F0] border border-[#D4CEBF] rounded-xl focus:outline-none focus:border-[#1C1A18] text-[#1C1A18] font-semibold"
                  />
                </div>

                {pinError && (
                  <p className="text-xs font-mono-meta text-[#9E2A2B]">
                    {tr(
                      `Nieprawidłowy kod PIN (pozostało prób: ${remainingAttempts}).`,
                      `Incorrect PIN code (${remainingAttempts} attempts left).`,
                      `Código PIN incorrecto (intentos restantes: ${remainingAttempts}).`,
                      `Code PIN incorrect (essais restants : ${remainingAttempts}).`
                    )}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pinInput.trim().length < 4 || isUnlocking}
                  className="w-full py-2.5 px-4 rounded border border-[#1C1A18] bg-[#1C1A18] hover:bg-[#33302B] disabled:opacity-40 text-[#FAF8F5] text-xs font-mono-meta font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Unlock className="w-4 h-4 text-[#EBC5CF]" />
                  <span>
                    {isUnlocking
                      ? tr(
                          'Odszyfrowywanie...',
                          'Decrypting...',
                          'Descifrando...',
                          'Déchiffrement...'
                        )
                      : tr(
                          'Otwórz i odczytaj wiadomość',
                          'Unlock & read message',
                          'Abrir y leer mensaje',
                          'Ouvrir et lire le message'
                        )}
                  </span>
                </button>
              </form>
            </div>
          )}

          {status === 'decrypted' && decryptedData && (
            <div className="space-y-5 animate-in fade-in duration-300 text-left">
              {/* Self-destruct warning banner */}
              <div className="p-3.5 rounded-xl bg-[#FDF2F2] border border-[#8B2635]/30 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-[#8B2635] shrink-0 mt-0.5" />
                <p className="text-xs font-mono-meta text-[#8B2635] leading-relaxed">
                  {tr(
                    'Wiadomość jednorazowa — szyfrogram na serwerze został właśnie bezpowrotnie zniszczony. Po zamknięciu lub odświeżeniu tej karty nie będzie już do niej dostępu.',
                    'One-time message — the ciphertext on the server has just been permanently destroyed. Once you close or refresh this tab, it can never be accessed again.',
                    'Mensaje de lectura única: la copia cifrada en el servidor acaba de ser destruida. Al cerrar o recargar esta página ya no habrá acceso.',
                    'Message à lecture unique — la copie chiffrée sur le serveur vient d’être détruite. Si vous fermez ou actualisez cette page, l’accès sera définitivement perdu.'
                  )}
                </p>
              </div>

              {/* Paper Card */}
              <div className="p-6 sm:p-10 rounded-2xl bg-[#FAF8F5] border border-[#DDD6C8] shadow-lg space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE5DA] pb-4 text-xs font-mono-meta text-[#7A756D]">
                  <span className="inline-flex items-center gap-1.5 text-[#1C1A18] font-medium">
                    <Calendar className="w-3.5 h-3.5 text-[#8B2635]" />
                    <span>{decryptedData.date}</span>
                  </span>
                  {decryptedData.senderName && (
                    <span>
                      {tr('Od:', 'From:', 'De:', 'De :')} {decryptedData.senderName}
                    </span>
                  )}
                </div>

                {decryptedData.promptText && (
                  <h2 className="text-lg sm:text-xl font-serif-literary italic text-[#6E6961] leading-snug">
                    „{decryptedData.promptText}”
                  </h2>
                )}

                <div className="text-base sm:text-lg font-serif-literary text-[#1C1A18] leading-relaxed whitespace-pre-wrap break-words pt-1">
                  {renderFormattedShareContent(decryptedData.content)}
                </div>
              </div>
            </div>
          )}

          {status === 'burned' && (
            <div className="p-6 sm:p-8 rounded-2xl bg-[#F3EFE7] border border-[#DDD6C8] space-y-5 text-center animate-in fade-in duration-200 select-none">
              <div className="w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#DDD6C8] flex items-center justify-center mx-auto">
                <Lock className="w-5 h-5 text-[#8B2635]" />
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-mono-meta uppercase tracking-widest text-[#8B2635]">
                  AES-GCM-256 · SHREDDED CIPHERTEXT
                </div>
                <h2 className="text-xl sm:text-2xl font-serif-literary font-normal text-[#1C1A18]">
                  {tr(
                    'Ta wiadomość uległa już zaszyfrowaniu i wygasła',
                    'This one-time message has already been read and destroyed',
                    'Este mensaje único ya fue leído y destruido',
                    'Ce message unique a déjà été lu et détruit'
                  )}
                </h2>
                <p className="text-xs sm:text-sm font-serif-literary text-[#6E6961] max-w-md mx-auto leading-relaxed">
                  {tr(
                    'Link był jednorazowy. Po pierwszym odczytaniu klucz oraz szyfrogram zostały bezpowrotnie usunięte, dlatego ponowne wyświetlenie treści nie jest możliwe.',
                    'This link was strictly one-time. Upon the first read, the key and ciphertext were permanently erased, so the content can no longer be accessed.',
                    'Este enlace era de un solo uso. Tras la primera lectura, el texto cifrado fue eliminado de forma irreversible.',
                    'Ce lien était à usage unique. Après la première lecture, le texte chiffré a été définitivement effacé.'
                  )}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF8F5]/70 border border-[#E2DDD3] font-mono-meta text-[11px] text-[#9E978C] break-all blur-[0.4px]">
                0f9a8c4e71b2d0356e8f12a49c7b3d8e50129fa3b8c7d6e5f4a3b2c1d0e9f8a7 · BURNED
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onExitShareView}
                  className="px-4 py-2 rounded border border-[#1C1A18] bg-[#1C1A18] hover:bg-[#33302B] text-[#FAF8F5] text-xs font-mono-meta font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  {tr(
                    'Przejdź do aplikacji Momenty',
                    'Go to Moments app',
                    'Ir a la aplicación Moments',
                    'Aller à l’application Moments'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
