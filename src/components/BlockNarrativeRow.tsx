import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  VolumeX,
} from 'lucide-react';
import type { AudioEntryView, DialogueItem } from '../types/ttx';
import { formatDuration } from '../lib/formatters';
import { DIALOGUE_DRAG_MIME } from './DialogueRow';

interface BlockNarrativeRowProps {
  item: DialogueItem;
  audio?: AudioEntryView;
  isCurrentTrack: boolean;
  isPlaying: boolean;
  currentTime: number;
  activeDuration: number;
  isGeneratingAudio: boolean;
  canEdit: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  reorderingEnabled: boolean;
  onTogglePlay: (itemId: string) => void;
  onReplay: (itemId: string) => void;
  onSeek: (itemId: string, timeSeconds: number) => void;
  onOpenGenerateAudio: (item: DialogueItem) => void;
  onRequestRemoveAudio: (item: DialogueItem) => void;
  onMoveItem: (itemId: string, direction: 'up' | 'down') => void;
  onDropReorderItem: (sourceItemId: string, targetItemId: string) => void;
  onInsertDialogueAfter: (item: DialogueItem) => void;
  onEditItem: (item: DialogueItem) => void;
  onRequestDeleteItem: (item: DialogueItem) => void;
}

export function BlockNarrativeRow({
  item,
  audio,
  isCurrentTrack,
  isPlaying,
  currentTime,
  activeDuration,
  isGeneratingAudio,
  canEdit,
  canMoveUp,
  canMoveDown,
  reorderingEnabled,
  onTogglePlay,
  onReplay,
  onSeek,
  onOpenGenerateAudio,
  onRequestRemoveAudio,
  onMoveItem,
  onDropReorderItem,
  onInsertDialogueAfter,
  onEditItem,
  onRequestDeleteItem,
}: BlockNarrativeRowProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const hasAudio = Boolean(audio);
  const effectiveDuration =
    isCurrentTrack && activeDuration > 0 ? activeDuration : audio?.duration ?? 0;
  const displayTime = isCurrentTrack ? currentTime : 0;
  const progressPct =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (displayTime / effectiveDuration) * 100))
      : 0;

  const effectiveReordering = canEdit && reorderingEnabled;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!effectiveReordering) return;
    e.dataTransfer.setData(DIALOGUE_DRAG_MIME, item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!effectiveReordering) return;
    if (Array.from(e.dataTransfer.types).includes(DIALOGUE_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!isDragOver) setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!effectiveReordering) return;
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
    if (!effectiveReordering) return;
    const draggedId = e.dataTransfer.getData(DIALOGUE_DRAG_MIME);
    if (draggedId && draggedId !== item.id) {
      e.preventDefault();
      onDropReorderItem(draggedId, item.id);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`px-4 py-4 sm:px-5 transition-colors ${
        isDragOver
          ? 'bg-slate-100 ring-2 ring-inset ring-[#0E2439]/35'
          : isCurrentTrack
            ? 'bg-sky-50/50'
            : 'bg-slate-50/75 hover:bg-slate-100/60'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle (no dialogue sequence number) */}
        <div className="flex items-start gap-2 pt-0.5 shrink-0">
          {canEdit && (
            <div
              draggable={effectiveReordering}
              onDragStart={handleDragStart}
              title={
                effectiveReordering
                  ? 'Seret untuk memindahkan urutan narasi'
                  : 'Hapus filter untuk menyeret urutan'
              }
              className={`p-0.5 -ml-1 rounded text-slate-400 ${
                effectiveReordering
                  ? 'cursor-grab active:cursor-grabbing hover:text-slate-700'
                  : 'opacity-40 cursor-not-allowed'
              }`}
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <span className="font-mono text-[11px] font-medium text-slate-500 pt-0.5 w-6 text-center select-none">
            —
          </span>
        </div>

        {/* Narrative Content & Gemini TTS Audio Controls */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
              <span className="text-[13px] font-semibold text-[#0E2439]">
                {item.title ? item.title : 'Narasi Skenario'}
              </span>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="text-xs text-slate-500">
                {hasAudio
                  ? `Narasi · Audio Gemini${item.ttsVoice ? ` (${item.ttsVoice})` : ''}`
                  : 'Narasi Blok'}
              </span>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                Hal. {item.pageNumber}
              </span>
            </div>

            {/* Structure Controls: Up/Down, Insert After, Edit, Delete */}
            {canEdit && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onMoveItem(item.id, 'up')}
                  disabled={!effectiveReordering || !canMoveUp}
                  title={
                    effectiveReordering
                      ? 'Pindahkan narasi ke atas'
                      : 'Hapus filter untuk mengubah urutan'
                  }
                  aria-label="Pindahkan narasi ke atas"
                  className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveItem(item.id, 'down')}
                  disabled={!effectiveReordering || !canMoveDown}
                  title={
                    effectiveReordering
                      ? 'Pindahkan narasi ke bawah'
                      : 'Hapus filter untuk mengubah urutan'
                  }
                  aria-label="Pindahkan narasi ke bawah"
                  className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onInsertDialogueAfter(item)}
                  title="Sisipkan item baru di bawah narasi ini"
                  aria-label="Sisipkan item baru di bawah narasi ini"
                  className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-[#0E2439] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onEditItem(item)}
                  title="Edit narasi ini"
                  aria-label="Edit narasi ini"
                  className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-[#0E2439] transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onRequestDeleteItem(item)}
                  title="Hapus narasi ini"
                  aria-label="Hapus narasi ini"
                  className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 bg-white text-slate-500 hover:text-[#DC2626] hover:border-red-200 hover:bg-red-50/50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <p className="text-[14.5px] leading-[1.65] text-slate-700 max-w-[82ch] whitespace-pre-line">
            {item.transcript}
          </p>

          {item.note && (
            <p className="mt-1.5 text-xs text-slate-500">
              Catatan: {item.note}
            </p>
          )}

          {/* Gemini TTS Generation & Audio Playback Controls */}
          {(hasAudio || canEdit) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {hasAudio ? (
                <>
                  <button
                    type="button"
                    onClick={() => onTogglePlay(item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isPlaying
                        ? 'bg-[#0284C7] text-white hover:bg-[#0369A1]'
                        : 'bg-[#0E2439] text-white hover:bg-[#193A58]'
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5 shrink-0" />
                        <span>Jeda Narasi</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 shrink-0" />
                        <span>Putar Narasi</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2 min-w-[150px] flex-1 max-w-xs">
                    <input
                      type="range"
                      min={0}
                      max={effectiveDuration || 1}
                      step={0.1}
                      value={Math.min(displayTime, effectiveDuration || 1)}
                      onChange={(e) => onSeek(item.id, parseFloat(e.target.value))}
                      aria-label="Posisi pemutaran audio narasi"
                      className="audio-scrubber flex-1"
                      style={{
                        background: `linear-gradient(to right, #0E2439 0%, #0E2439 ${progressPct}%, #CBD5E1 ${progressPct}%, #CBD5E1 100%)`,
                        height: '4px',
                        borderRadius: '9999px',
                      }}
                    />
                    <span className="font-mono text-[11px] text-slate-600 tabular-nums shrink-0">
                      {formatDuration(displayTime)} / {formatDuration(effectiveDuration)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onReplay(item.id)}
                    title="Putar ulang narasi dari awal"
                    aria-label="Putar ulang narasi"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenGenerateAudio(item)}
                        disabled={isGeneratingAudio}
                        title="Buat ulang audio narasi dengan suara atau gaya Gemini lain"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#0E2439] bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                      >
                        {isGeneratingAudio ? (
                          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>{isGeneratingAudio ? 'Membuat...' : 'Buat Ulang'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onRequestRemoveAudio(item)}
                        title="Kosongkan file audio dari narasi ini"
                        aria-label="Hapus audio narasi"
                        className="inline-flex items-center justify-center gap-1.5 min-h-[34px] px-3 py-1.5 rounded-md text-xs font-medium border border-red-200 bg-white text-[#B91C1C] hover:bg-red-50 hover:border-red-300 transition-colors whitespace-nowrap shrink-0"
                      >
                        <VolumeX className="w-3.5 h-3.5 shrink-0" />
                        <span>Hapus Audio</span>
                      </button>
                    </>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenGenerateAudio(item)}
                  disabled={isGeneratingAudio || !item.transcript.trim()}
                  title={
                    !item.transcript.trim()
                      ? 'Isi teks narasi terlebih dahulu untuk membuat audio dengan Gemini'
                      : 'Ubah teks narasi ini menjadi suara narator menggunakan Gemini'
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                >
                  {isGeneratingAudio ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                      <span>Membuat Audio Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Buat Audio dengan Gemini</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
