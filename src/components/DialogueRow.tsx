import { useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Mic,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  VolumeX,
} from 'lucide-react';
import type { AudioEntryView, DialogueItem } from '../types/ttx';
import {
  formatDuration,
  formatFileSize,
  formatSequenceNumber,
} from '../lib/formatters';

export const DIALOGUE_DRAG_MIME = 'application/x-ttx-dialogue-id';

interface DialogueRowProps {
  dialogue: DialogueItem;
  audio?: AudioEntryView;
  isCurrentTrack: boolean;
  isPlaying: boolean;
  currentTime: number;
  activeDuration: number;
  isPlayed: boolean;
  isGeneratingAudio: boolean;
  canEdit: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  reorderingEnabled: boolean;
  onTogglePlay: (dialogueId: string) => void;
  onReplay: (dialogueId: string) => void;
  onSeek: (dialogueId: string, timeSeconds: number) => void;
  onUploadAudio: (dialogueId: string, file: File) => void;
  onOpenRecordAudio: (dialogue: DialogueItem) => void;
  onOpenGenerateAudio: (dialogue: DialogueItem) => void;
  onRequestRemoveAudio: (dialogue: DialogueItem) => void;
  onTogglePlayed: (dialogueId: string) => void;
  onMoveDialogue: (dialogueId: string, direction: 'up' | 'down') => void;
  onDropReorderDialogue: (sourceDialogueId: string, targetDialogueId: string) => void;
  onInsertDialogueAfter: (dialogue: DialogueItem) => void;
  onEditDialogue: (dialogue: DialogueItem) => void;
  onRequestDeleteDialogue: (dialogue: DialogueItem) => void;
}

export function DialogueRow({
  dialogue,
  audio,
  isCurrentTrack,
  isPlaying,
  currentTime,
  activeDuration,
  isPlayed,
  isGeneratingAudio,
  canEdit,
  canMoveUp,
  canMoveDown,
  reorderingEnabled,
  onTogglePlay,
  onReplay,
  onSeek,
  onUploadAudio,
  onOpenRecordAudio,
  onOpenGenerateAudio,
  onRequestRemoveAudio,
  onTogglePlayed,
  onMoveDialogue,
  onDropReorderDialogue,
  onInsertDialogueAfter,
  onEditDialogue,
  onRequestDeleteDialogue,
}: DialogueRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragState, setDragState] = useState<'none' | 'file' | 'reorder'>('none');

  const hasAudio = Boolean(audio);
  const displayDuration = isCurrentTrack
    ? activeDuration || audio?.duration || 0
    : audio?.duration || 0;
  const displayCurrent = isCurrentTrack ? currentTime : 0;
  const progressPct =
    displayDuration > 0 ? Math.min(100, (displayCurrent / displayDuration) * 100) : 0;

  const effectiveReordering = canEdit && reorderingEnabled;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (file) {
      onUploadAudio(dialogue.id, file);
      e.target.value = '';
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!effectiveReordering) return;
    e.dataTransfer.setData(DIALOGUE_DRAG_MIME, dialogue.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    const types = Array.from(e.dataTransfer.types);
    if (types.includes(DIALOGUE_DRAG_MIME) && effectiveReordering) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragState !== 'reorder') setDragState('reorder');
    } else if (types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (dragState !== 'file') setDragState('file');
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDragState('none');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    e.preventDefault();
    const prevState = dragState;
    setDragState('none');

    const draggedDialogueId = e.dataTransfer.getData(DIALOGUE_DRAG_MIME);
    if (draggedDialogueId && effectiveReordering) {
      if (draggedDialogueId !== dialogue.id) {
        onDropReorderDialogue(draggedDialogueId, dialogue.id);
      }
      return;
    }

    if (prevState === 'file' || e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files?.[0];
      if (file) {
        onUploadAudio(dialogue.id, file);
      }
    }
  };

  const renderTranscript = (text: string) => {
    const highlightTerms = ['MAYDAY MAYDAY MAYDAY', 'FULL EMERGENCY', 'Full Emergency!'];
    let parts: (string | { strong: string })[] = [text];

    for (const term of highlightTerms) {
      const next: (string | { strong: string })[] = [];
      for (const part of parts) {
        if (typeof part !== 'string') {
          next.push(part);
          continue;
        }
        const split = part.split(term);
        split.forEach((seg, idx) => {
          if (seg) next.push(seg);
          if (idx < split.length - 1) {
            next.push({ strong: term });
          }
        });
      }
      parts = next;
    }

    return parts.map((p, idx) =>
      typeof p === 'string' ? (
        <span key={idx}>{p}</span>
      ) : (
        <strong key={idx} className="font-semibold text-[#B91C1C]">
          {p.strong}
        </strong>
      ),
    );
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`px-4 py-4 sm:px-5 transition-colors ${
        dragState === 'reorder'
          ? 'bg-slate-100/90 ring-2 ring-inset ring-[#0E2439]/35'
          : dragState === 'file'
            ? 'bg-sky-50 ring-1 ring-inset ring-sky-400'
            : isCurrentTrack && isPlaying
              ? 'bg-[#F0F7FF]'
              : isCurrentTrack
                ? 'bg-slate-50'
                : 'bg-white hover:bg-slate-50/60'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Left: Drag Handle + Sequence Index + Speaker & Transcript */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Drag handle + Sequence & Played Toggle */}
          <div className="flex items-start gap-1.5 pt-0.5 shrink-0">
            {canEdit && (
              <div
                draggable={effectiveReordering}
                onDragStart={handleDragStart}
                title={
                  effectiveReordering
                    ? 'Seret untuk memindahkan urutan percakapan'
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

            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <span
                className={`font-mono text-xs font-semibold tabular-nums ${
                  isCurrentTrack && isPlaying
                    ? 'text-[#0284C7]'
                    : dialogue.isEmergencyPriority
                      ? 'text-[#DC2626]'
                      : 'text-slate-500'
                }`}
              >
                {formatSequenceNumber(dialogue.sequenceNumber)}
              </span>
              <button
                type="button"
                onClick={() => onTogglePlayed(dialogue.id)}
                title={isPlayed ? 'Tandai belum diputar' : 'Tandai sudah diputar'}
                aria-label={
                  isPlayed
                    ? `Dialog ${dialogue.sequenceNumber} sudah diputar`
                    : `Tandai dialog ${dialogue.sequenceNumber} sudah diputar`
                }
                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  isPlayed
                    ? 'bg-[#15803D] border-[#15803D] text-white'
                    : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                }`}
              >
                <Check className="w-3 h-3" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Dialogue Header & Text */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0E2439]">
                  <span>{dialogue.sender}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{dialogue.receiver}</span>
                </span>

                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>

                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Hal. {dialogue.pageNumber}
                </span>

                {dialogue.isEmergencyPriority && (
                  <>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-xs font-semibold text-[#DC2626]">
                      Prioritas Darurat
                    </span>
                  </>
                )}

                {isCurrentTrack && isPlaying && (
                  <>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0284C7]">
                      <span
                        className="inline-flex items-end gap-[2px] h-3"
                        aria-hidden="true"
                      >
                        <span className="w-[2px] h-full bg-[#0284C7] animate-eq-1" />
                        <span className="w-[2px] h-full bg-[#0284C7] animate-eq-2" />
                        <span className="w-[2px] h-full bg-[#0284C7] animate-eq-3" />
                      </span>
                      <span>Sedang Diputar</span>
                    </span>
                  </>
                )}
              </div>

              {/* Row Structure Controls: Reorder Up/Down, Insert Below, Edit, Delete */}
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onMoveDialogue(dialogue.id, 'up')}
                    disabled={!effectiveReordering || !canMoveUp}
                    title={
                      effectiveReordering
                        ? 'Pindahkan percakapan ke atas'
                        : 'Hapus filter untuk mengubah urutan'
                    }
                    aria-label={`Pindahkan dialog ${dialogue.sequenceNumber} ke atas`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveDialogue(dialogue.id, 'down')}
                    disabled={!effectiveReordering || !canMoveDown}
                    title={
                      effectiveReordering
                        ? 'Pindahkan percakapan ke bawah'
                        : 'Hapus filter untuk mengubah urutan'
                    }
                    aria-label={`Pindahkan dialog ${dialogue.sequenceNumber} ke bawah`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onInsertDialogueAfter(dialogue)}
                    title="Sisipkan percakapan baru di bawah baris ini"
                    aria-label={`Sisipkan dialog baru setelah dialog ${dialogue.sequenceNumber}`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-[#0E2439] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditDialogue(dialogue)}
                    title="Edit percakapan ini"
                    aria-label={`Edit percakapan ${dialogue.sequenceNumber}`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-[#0E2439] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestDeleteDialogue(dialogue)}
                    title="Hapus percakapan ini"
                    aria-label={`Hapus percakapan ${dialogue.sequenceNumber}`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 bg-white text-slate-500 hover:text-[#DC2626] hover:border-red-200 hover:bg-red-50/50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <p className="text-[15px] leading-[1.6] text-slate-800 max-w-[72ch]">
              &ldquo;{renderTranscript(dialogue.transcript)}&rdquo;
            </p>

            {dialogue.note && (
              <p className="mt-1.5 text-xs text-slate-500">
                Catatan: {dialogue.note}
              </p>
            )}

            {/* Inline Audio Scrubber & File Info when audio exists */}
            {hasAudio && audio && (
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <span className="font-mono text-[11px] tabular-nums text-slate-600 shrink-0 w-[40px]">
                    {formatDuration(displayCurrent)}
                  </span>
                  <div className="relative flex-1 flex items-center">
                    <input
                      type="range"
                      min={0}
                      max={displayDuration > 0 ? displayDuration : 1}
                      step={0.1}
                      value={displayCurrent}
                      onChange={(e) => onSeek(dialogue.id, parseFloat(e.target.value))}
                      aria-label={`Posisi waktu audio dialog ${dialogue.sequenceNumber}`}
                      className="audio-scrubber w-full"
                      style={{
                        background: `linear-gradient(to right, #0E2439 0%, #0E2439 ${progressPct}%, #CBD5E1 ${progressPct}%, #CBD5E1 100%)`,
                        height: '4px',
                        borderRadius: '9999px',
                      }}
                    />
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-slate-500 shrink-0 w-[40px] text-right">
                    {formatDuration(displayDuration)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0 sm:max-w-[260px]">
                  <span
                    className="truncate font-mono text-[11px] text-slate-600"
                    title={audio.fileName}
                  >
                    {audio.fileName}
                  </span>
                  <span className="text-slate-300 shrink-0" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono text-[11px] tabular-nums shrink-0">
                    {formatFileSize(audio.size)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Compact Icon-Only Audio Playback, Upload, Record & Gemini TTS Controls */}
        <div
          className={`flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end ${
            canEdit ? 'pl-9 lg:pl-0' : 'pl-7 lg:pl-0'
          }`}
        >
          {/* Play / Pause Button */}
          <button
            type="button"
            onClick={() => onTogglePlay(dialogue.id)}
            disabled={!hasAudio}
            title={
              hasAudio
                ? isCurrentTrack && isPlaying
                  ? 'Jeda audio'
                  : 'Putar audio percakapan ini'
                : canEdit
                  ? 'Unggah file audio, rekam suara, atau buat audio dengan Gemini terlebih dahulu'
                  : 'Audio belum tersedia untuk percakapan ini'
            }
            aria-label={
              isCurrentTrack && isPlaying
                ? `Jeda audio dialog ${dialogue.sequenceNumber}`
                : `Putar audio dialog ${dialogue.sequenceNumber}`
            }
            className={`inline-flex items-center justify-center w-10 h-10 rounded-md transition-colors shrink-0 ${
              !hasAudio
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : isCurrentTrack && isPlaying
                  ? 'bg-[#0284C7] text-white hover:bg-[#0369A1]'
                  : 'bg-[#0E2439] text-white hover:bg-[#193A58]'
            }`}
          >
            {isCurrentTrack && isPlaying ? (
              <Pause className="w-4 h-4 shrink-0" />
            ) : (
              <Play className="w-4 h-4 shrink-0" />
            )}
          </button>

          {/* Replay button when active */}
          {hasAudio && isCurrentTrack && (
            <button
              type="button"
              onClick={() => onReplay(dialogue.id)}
              title="Ulangi dari awal"
              aria-label={`Ulangi audio dialog ${dialogue.sequenceNumber}`}
              className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
            </button>
          )}

          {canEdit && (
            <>
              {/* Upload / Replace Audio Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={hasAudio ? 'Ganti file audio' : 'Unggah file audio'}
                aria-label={
                  hasAudio
                    ? `Ganti file audio dialog ${dialogue.sequenceNumber}`
                    : `Unggah file audio dialog ${dialogue.sequenceNumber}`
                }
                className={`inline-flex items-center justify-center w-10 h-10 rounded-md border transition-colors shrink-0 ${
                  hasAudio
                    ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    : 'bg-white text-[#0E2439] border-[#0E2439]/40 hover:bg-slate-100'
                }`}
              >
                <Upload className="w-4 h-4 shrink-0" />
              </button>

              {/* Direct Browser Voice Recording Button */}
              <button
                type="button"
                onClick={() => onOpenRecordAudio(dialogue)}
                title="Rekam suara langsung menggunakan mikrofon browser"
                aria-label={`Rekam suara dialog ${dialogue.sequenceNumber}`}
                className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-slate-300 bg-white text-[#DC2626] hover:bg-red-50/70 hover:border-red-300 transition-colors shrink-0"
              >
                <Mic className="w-4 h-4 shrink-0" />
              </button>

              {/* Generate Audio with Gemini Button */}
              <button
                type="button"
                onClick={() => onOpenGenerateAudio(dialogue)}
                disabled={isGeneratingAudio || !dialogue.transcript.trim()}
                title={
                  isGeneratingAudio
                    ? 'Sedang membuat audio dengan Gemini...'
                    : !dialogue.transcript.trim()
                      ? 'Isi naskah percakapan terlebih dahulu untuk membuat audio dengan Gemini'
                      : 'Buat suara percakapan ini secara otomatis menggunakan Gemini'
                }
                aria-label={`Buat audio dengan Gemini untuk dialog ${dialogue.sequenceNumber}`}
                className={`inline-flex items-center justify-center w-10 h-10 rounded-md transition-colors shrink-0 disabled:opacity-50 ${
                  hasAudio
                    ? 'bg-white text-[#0E2439] border border-slate-300 hover:bg-slate-100'
                    : 'bg-[#0E2439] text-white hover:bg-[#193A58]'
                }`}
              >
                {isGeneratingAudio ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 shrink-0" />
                )}
              </button>

              {/* Remove Audio Button (Triggers Confirmation) */}
              {hasAudio && (
                <button
                  type="button"
                  onClick={() => onRequestRemoveAudio(dialogue)}
                  title="Hapus file audio dari percakapan ini"
                  aria-label={`Hapus audio dialog ${dialogue.sequenceNumber}`}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-red-200 bg-white text-[#B91C1C] hover:bg-red-50 hover:border-red-300 transition-colors shrink-0"
                >
                  <VolumeX className="w-4 h-4 shrink-0" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
