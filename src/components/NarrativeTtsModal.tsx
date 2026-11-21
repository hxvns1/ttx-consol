import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Volume2, X } from 'lucide-react';
import type { DialogueItem, GeminiTtsVoice } from '../types/ttx';
import { formatSequenceNumber } from '../lib/formatters';

interface VoiceOption {
  id: GeminiTtsVoice;
  label: string;
  gender: string;
  character: string;
}

interface StylePreset {
  id: string;
  label: string;
  description: string;
  instruction: string;
}

export const GEMINI_VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'Kore',
    label: 'Kore',
    gender: 'Wanita',
    character: 'Jelas, formal, artikulasi berita/briefing',
  },
  {
    id: 'Charon',
    label: 'Charon',
    gender: 'Pria',
    character: 'Tegas, berwibawa, cocok untuk komando TTX',
  },
  {
    id: 'Fenrir',
    label: 'Fenrir',
    gender: 'Pria',
    character: 'Mendalam, dramatis, laporan situasi darurat',
  },
  {
    id: 'Zephyr',
    label: 'Zephyr',
    gender: 'Wanita',
    character: 'Hangat, tenang, dan informatif',
  },
  {
    id: 'Puck',
    label: 'Puck',
    gender: 'Pria',
    character: 'Ringan, lincah, dan komunikatif',
  },
];

export const NARRATIVE_STYLE_PRESETS: StylePreset[] = [
  {
    id: 'radio-atc',
    label: 'Komunikasi Radio / ATC (Jelas & Profesional)',
    description: 'Artikulasi singkat, tegas, dan jelas seperti percakapan radio penerbangan atau komando bandara.',
    instruction:
      'Ucapkan dengan nada komunikasi radio penerbangan yang jelas, tegas, profesional, dan artikulasi tajam tanpa bertele-tele.',
  },
  {
    id: 'formal-ttx',
    label: 'Narator Resmi TTX (Jelas & Tenang)',
    description: 'Tempo terukur, intonasi resmi bahasa Indonesia untuk pengantar skenario.',
    instruction:
      'Bacakan dalam bahasa Indonesia dengan nada narator resmi latihan penanggulangan keadaan darurat bandara, jelas, tenang, dan tempo terukur.',
  },
  {
    id: 'urgent-emergency',
    label: 'Situasi Darurat (Tegas & Mendesak)',
    description: 'Intonasi serius dan penuh kewaspadaan untuk momen kritis atau panggilan darurat.',
    instruction:
      'Bacakan dengan nada tegas, serius, dan penuh kewaspadaan seperti panggilan atau laporan situasi darurat penerbangan.',
  },
  {
    id: 'dramatic-chronology',
    label: 'Kronologi Dramatis (Berbobot)',
    description: 'Penekanan suasana lapangan agar peserta TTX merasakan kondisi insiden.',
    instruction:
      'Bacakan dalam bahasa Indonesia dengan gaya penceritaan kronologi insiden yang berbobot, jelas, dan dramatis namun tetap profesional.',
  },
  {
    id: 'custom',
    label: 'Gaya Kustom (Tulis Sendiri)',
    description: 'Tentukan sendiri tempo, emosi, atau instruksi khusus untuk suara Gemini.',
    instruction: '',
  },
];

interface NarrativeTtsModalProps {
  isOpen: boolean;
  narrative: DialogueItem | null;
  hasExistingAudio: boolean;
  isGenerating: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onGenerate: (params: {
    narrativeId: string;
    textToSpeak: string;
    voiceName: GeminiTtsVoice;
    styleInstruction: string;
  }) => Promise<void>;
}

export function NarrativeTtsModal({
  isOpen,
  narrative,
  hasExistingAudio,
  isGenerating,
  errorMessage,
  onClose,
  onGenerate,
}: NarrativeTtsModalProps) {
  const [voiceName, setVoiceName] = useState<GeminiTtsVoice>('Kore');
  const [presetId, setPresetId] = useState<string>('formal-ttx');
  const [customStyle, setCustomStyle] = useState<string>('');
  const [includeTitle, setIncludeTitle] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !narrative) return;

    const isNarrativeItem = narrative.entryType === 'narrative';
    const initialVoice =
      narrative.ttsVoice ?? (isNarrativeItem ? 'Kore' : 'Charon');
    setVoiceName(initialVoice);

    if (narrative.ttsStyle) {
      const matched = NARRATIVE_STYLE_PRESETS.find(
        (p) => p.instruction && p.instruction === narrative.ttsStyle,
      );
      if (matched) {
        setPresetId(matched.id);
        setCustomStyle('');
      } else {
        setPresetId('custom');
        setCustomStyle(narrative.ttsStyle);
      }
    } else if (isNarrativeItem) {
      setPresetId('formal-ttx');
      setCustomStyle('');
    } else {
      setPresetId(
        narrative.isEmergencyPriority ? 'urgent-emergency' : 'radio-atc',
      );
      setCustomStyle('');
    }
    setIncludeTitle(false);
  }, [isOpen, narrative]);

  if (!isOpen || !narrative) return null;

  const isNarrativeItem = narrative.entryType === 'narrative';
  const selectedPreset = NARRATIVE_STYLE_PRESETS.find((p) => p.id === presetId);
  const effectiveStyle =
    presetId === 'custom'
      ? customStyle.trim()
      : selectedPreset?.instruction ?? '';

  const textToSpeak =
    isNarrativeItem && includeTitle && narrative.title?.trim()
      ? `${narrative.title.trim()}. ${narrative.transcript.trim()}`
      : narrative.transcript.trim();

  const itemSubtitle = isNarrativeItem
    ? `${narrative.title || 'Narasi Skenario'} · Hasil tersimpan & siap diputar`
    : `#${formatSequenceNumber(narrative.sequenceNumber)} · ${narrative.sender} → ${narrative.receiver} · Hasil tersimpan & siap diputar`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textToSpeak || isGenerating) return;
    await onGenerate({
      narrativeId: narrative.id,
      textToSpeak,
      voiceName,
      styleInstruction: effectiveStyle,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="narrative-tts-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-[#0E2439] shrink-0" />
            <div className="min-w-0">
              <h2
                id="narrative-tts-title"
                className="text-base font-semibold text-[#0E2439] truncate"
              >
                {hasExistingAudio
                  ? isNarrativeItem
                    ? 'Buat Ulang Audio Narasi (Gemini)'
                    : 'Buat Ulang Audio Percakapan (Gemini)'
                  : isNarrativeItem
                    ? 'Buat Audio Narasi dengan Gemini'
                    : 'Buat Audio dengan Gemini'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {itemSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            aria-label="Tutup dialog"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Voice Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                1. Pilih Suara Gemini
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GEMINI_VOICE_OPTIONS.map((v) => {
                  const selected = voiceName === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={isGenerating}
                      onClick={() => setVoiceName(v.id)}
                      className={`text-left px-3 py-2.5 rounded-md border transition-colors ${
                        selected
                          ? 'border-[#0E2439] bg-[#0E2439]/5 ring-1 ring-[#0E2439]'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#0E2439]">
                          {v.label}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {v.gender}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                        {v.character}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reading Style Selection */}
            <div className="space-y-2.5">
              <label
                htmlFor="tts-style-preset"
                className="block text-xs font-semibold text-slate-700"
              >
                2. Gaya Pembacaan Suara
              </label>
              <select
                id="tts-style-preset"
                value={presetId}
                disabled={isGenerating}
                onChange={(e) => setPresetId(e.target.value)}
                className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0E2439]/20 focus:border-[#0E2439]"
              >
                {NARRATIVE_STYLE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              {selectedPreset && presetId !== 'custom' && (
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {selectedPreset.description}
                </p>
              )}

              {presetId === 'custom' && (
                <div>
                  <textarea
                    rows={2}
                    value={customStyle}
                    disabled={isGenerating}
                    maxLength={300}
                    onChange={(e) => setCustomStyle(e.target.value)}
                    placeholder="Contoh: Bacakan tegas, cepat, dengan intonasi komunikasi radio pilot/ATC..."
                    className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0E2439]/20 focus:border-[#0E2439]"
                  />
                </div>
              )}
            </div>

            {/* Preview Text */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  3. Pratinjau Teks yang Dibacakan
                </span>
                {isNarrativeItem && narrative.title?.trim() && (
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeTitle}
                      disabled={isGenerating}
                      onChange={(e) => setIncludeTitle(e.target.checked)}
                      className="accent-[#0E2439]"
                    />
                    <span>Bacakan judul di awal</span>
                  </label>
                )}
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 leading-relaxed max-h-36 overflow-y-auto whitespace-pre-line">
                {textToSpeak || 'Teks kosong.'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums text-right">
                {textToSpeak.length} karakter
              </div>
            </div>
          </div>

          {/* Sticky Error & Footer Actions */}
          <div className="shrink-0 border-t border-slate-200 bg-slate-50/70 px-5 py-3.5 space-y-3">
            {errorMessage && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-[#DC2626] leading-relaxed"
              >
                {errorMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isGenerating}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isGenerating || !textToSpeak}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                    <span>Menghasilkan Audio...</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {hasExistingAudio ? 'Buat Ulang & Simpan' : 'Hasilkan & Simpan Audio'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
