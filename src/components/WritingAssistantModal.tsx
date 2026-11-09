import React, { useState } from 'react';
import { X, CheckCheck, Lightbulb, Wand2, Sparkles, Check } from 'lucide-react';
import {
  checkPolishSpelling,
  generateExpansionQuestions,
  SpellCheckResult,
} from '../services/writingAssistant';

interface WritingAssistantModalProps {
  isOpen: boolean;
  content: string;
  promptText: string;
  initialTab?: 'spelling' | 'questions';
  onApplyCorrection: (newText: string) => void;
  onInsertText: (textToAppend: string) => void;
  onClose: () => void;
}

export const WritingAssistantModal: React.FC<WritingAssistantModalProps> = ({
  isOpen,
  content,
  promptText,
  initialTab = 'spelling',
  onApplyCorrection,
  onInsertText,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'spelling' | 'questions'>(initialTab);
  const [copiedQuestion, setCopiedQuestion] = useState<number | null>(null);

  if (!isOpen) return null;

  const spellResult: SpellCheckResult = checkPolishSpelling(content);
  const questions = generateExpansionQuestions(content, promptText);

  const handleApplyAll = () => {
    onApplyCorrection(spellResult.correctedText);
    onClose();
  };

  const handleCopyQuestion = (q: string, idx: number) => {
    navigator.clipboard.writeText(q);
    setCopiedQuestion(idx);
    setTimeout(() => setCopiedQuestion(null), 2000);
  };

  const handleAppendQuestion = (q: string) => {
    onInsertText(`\n\n[Pytanie pomocnicze: ${q}]\n`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div
        className="w-full max-w-lg bg-[#FAF8F5] border border-[#E2DDD3] rounded-xl shadow-xl flex flex-col text-[#1C1A18] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with tabs */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#ECE7DC] bg-[#F5F2EB]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('spelling')}
              className={`px-3 py-1 rounded-md text-xs font-mono-meta transition-colors flex items-center gap-1.5 ${
                activeTab === 'spelling'
                  ? 'bg-[#FAF8F5] text-[#1C1A18] font-medium shadow-2xs'
                  : 'text-[#7A756D] hover:text-[#1C1A18]'
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Pisownia ({spellResult.suggestions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('questions')}
              className={`px-3 py-1 rounded-md text-xs font-mono-meta transition-colors flex items-center gap-1.5 ${
                activeTab === 'questions'
                  ? 'bg-[#FAF8F5] text-[#1C1A18] font-medium shadow-2xs'
                  : 'text-[#7A756D] hover:text-[#1C1A18]'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Rozwiń myśl</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[#7A756D] hover:text-[#1C1A18] hover:bg-[#EAE5DA] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content area */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
          {activeTab === 'spelling' ? (
            <div>
              {spellResult.suggestions.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-[#EBF2EB] text-[#3E7B44] flex items-center justify-center mx-auto">
                    <CheckCheck className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-serif-literary font-medium text-[#1C1A18]">
                    Czysty maszynopis
                  </h4>
                  <p className="text-xs text-[#7A756D] font-serif-literary max-w-sm mx-auto">
                    Nie znaleziono typowych literówek ani problemów z polską interpunkcją. Twój tekst płynie bez przeszkód.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono-meta text-[#7A756D] pb-1 border-b border-[#ECE7DC]">
                    <span>Znalezione sugestie ({spellResult.suggestions.length})</span>
                    <button
                      onClick={handleApplyAll}
                      className="text-[#3E7B44] hover:underline font-medium flex items-center gap-1"
                    >
                      <Wand2 className="w-3 h-3" />
                      Zastosuj wszystkie
                    </button>
                  </div>

                  <div className="space-y-2">
                    {spellResult.suggestions.map(s => (
                      <div
                        key={s.id}
                        className="p-3 rounded-lg border border-[#E8E2D5] bg-[#F7F5F0] flex items-start justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2 font-mono-meta">
                            <span className="line-through text-[#9E2A2B]">{s.original}</span>
                            <span className="text-[#7A756D]">→</span>
                            <span className="font-semibold text-[#3E7B44]">{s.replacement}</span>
                          </div>
                          <div className="text-[11px] text-[#7A756D] font-serif-literary mt-0.5">
                            {s.explanation}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-[#7A756D] font-serif-literary">
                Pytania dobrane do Twojego tekstu, aby pomóc Ci pogłębić opis i wywołać więcej zmysłowych wspomnień:
              </div>

              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-[#E8E2D5] bg-[#F7F5F0] space-y-2.5"
                  >
                    <p className="text-xs font-serif-literary text-[#1C1A18] leading-relaxed italic">
                      „{q}”
                    </p>
                    <div className="flex items-center justify-end gap-2 text-[11px] font-mono-meta">
                      <button
                        onClick={() => handleCopyQuestion(q, idx)}
                        className="px-2.5 py-1 rounded text-[#7A756D] hover:text-[#1C1A18] hover:bg-[#EAE5DA] transition-colors flex items-center gap-1"
                      >
                        {copiedQuestion === idx ? (
                          <>
                            <Check className="w-3 h-3 text-[#3E7B44]" />
                            <span>Skopiowano</span>
                          </>
                        ) : (
                          <span>Kopiuj</span>
                        )}
                      </button>
                      <button
                        onClick={() => handleAppendQuestion(q)}
                        className="px-2.5 py-1 rounded bg-[#EFECE4] text-[#1C1A18] hover:bg-[#E2DDD3] transition-colors flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Wstaw pod tekstem</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#ECE7DC] bg-[#F5F2EB] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-mono-meta text-[#7A756D] hover:text-[#1C1A18] transition-colors"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
