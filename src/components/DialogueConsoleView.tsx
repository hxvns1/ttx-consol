import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Layers,
  ListMusic,
  Pause,
  Pencil,
  Play,
  Plus,
  Printer,
  Search,
  SkipForward,
  Square,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  AudioEntryView,
  AudioFilter,
  BlockEntryType,
  CommunicationBlock,
  DialogueItem,
  IncidentNarrative,
  PhaseId,
  PhaseSopPositions,
  ScenarioMeta,
  SopItem,
} from '../types/ttx';
import { SCENARIO_PHASES } from '../data/scenarioData';
import { DIALOGUE_DRAG_MIME, DialogueRow } from './DialogueRow';
import { BlockNarrativeRow } from './BlockNarrativeRow';
import { PhaseSopTable, SOP_PANEL_DRAG_MIME } from './PhaseSopTable';
import { formatDuration, formatSequenceNumber } from '../lib/formatters';

const BLOCK_DRAG_MIME = 'application/x-ttx-block-id';

interface DialogueConsoleViewProps {
  scenarioMeta: ScenarioMeta;
  blocks: CommunicationBlock[];
  dialogues: DialogueItem[];
  sopItems: SopItem[];
  sopPositions: PhaseSopPositions;
  incidentNarrative: IncidentNarrative;
  audioMap: Record<string, AudioEntryView>;
  playedSet: Set<string>;
  activeDialogueId: string | null;
  isPlaying: boolean;
  isSequenceActive: boolean;
  sequenceQueueRemaining: number;
  currentTime: number;
  activeDuration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  sequenceGapSeconds: number;
  searchQuery: string;
  audioFilter: AudioFilter;
  speakerFilter: string;
  onSearchChange: (q: string) => void;
  onAudioFilterChange: (filter: AudioFilter) => void;
  onSpeakerFilterChange: (speaker: string) => void;
  onTogglePlay: (dialogueId: string) => void;
  onReplay: (dialogueId: string) => void;
  onSeek: (dialogueId: string, timeSeconds: number) => void;
  onPlayBlockSequence: (blockId: string) => void;
  onStopPlayback: () => void;
  onSkipNextInQueue: () => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onSequenceGapChange: (seconds: number) => void;
  onUploadAudio: (dialogueId: string, file: File) => void;
  onOpenRecordAudio: (dialogue: DialogueItem) => void;
  onRequestRemoveAudio: (dialogue: DialogueItem) => void;
  onTogglePlayed: (dialogueId: string) => void;
  onOpenAddEntry: (
    blockId: string,
    entryType: BlockEntryType,
    insertAfterDialogueId?: string,
  ) => void;
  onEditDialogue: (dialogue: DialogueItem) => void;
  onRequestDeleteDialogue: (dialogue: DialogueItem) => void;
  onMoveDialogue: (dialogueId: string, direction: 'up' | 'down') => void;
  onDropReorderDialogue: (sourceDialogueId: string, targetDialogueId: string) => void;
  onDropDialogueIntoBlock: (sourceDialogueId: string, targetBlockId: string) => void;
  onOpenAddBlock: (phaseId: PhaseId) => void;
  onEditBlock: (block: CommunicationBlock) => void;
  onRequestDeleteBlock: (block: CommunicationBlock) => void;
  onMoveBlock: (blockId: string, direction: 'up' | 'down') => void;
  onDropReorderBlock: (sourceBlockId: string, targetBlockId: string) => void;
  onMoveSopPanel: (phaseId: PhaseId, direction: 'up' | 'down') => void;
  onDropSopPanelOnBlock: (sopPhaseId: PhaseId, targetBlockId: string) => void;
  onDropBlockOnSopPanel: (sourceBlockId: string, targetPhaseId: PhaseId) => void;
  onOpenAddSop: (phaseId: PhaseId) => void;
  onEditSop: (sop: SopItem) => void;
  onRequestDeleteSop: (sop: SopItem) => void;
  onMoveSop: (sopId: string, direction: 'up' | 'down') => void;
  onDropReorderSop: (sourceSopId: string, targetSopId: string) => void;
  onEditNarrative: () => void;
  onEditScenarioMeta: () => void;
  onOpenGenerateNarrativeAudio: (narrative: DialogueItem) => void;
  generatingTtsId: string | null;
  canEdit: boolean;
  isAdmin: boolean;
  savestateCount: number;
  onOpenSavestates: () => void;
  onExportPdf: () => void;
  onOpenBulkUpload: () => void;
}

export function DialogueConsoleView({
  scenarioMeta,
  blocks,
  dialogues,
  sopItems,
  sopPositions,
  incidentNarrative,
  audioMap,
  playedSet,
  activeDialogueId,
  isPlaying,
  isSequenceActive,
  sequenceQueueRemaining,
  currentTime,
  activeDuration,
  volume,
  isMuted,
  playbackRate,
  sequenceGapSeconds,
  searchQuery,
  audioFilter,
  speakerFilter,
  onSearchChange,
  onAudioFilterChange,
  onSpeakerFilterChange,
  onTogglePlay,
  onReplay,
  onSeek,
  onPlayBlockSequence,
  onStopPlayback,
  onSkipNextInQueue,
  onVolumeChange,
  onToggleMute,
  onPlaybackRateChange,
  onSequenceGapChange,
  onUploadAudio,
  onOpenRecordAudio,
  onRequestRemoveAudio,
  onTogglePlayed,
  onOpenAddEntry,
  onEditDialogue,
  onRequestDeleteDialogue,
  onMoveDialogue,
  onDropReorderDialogue,
  onDropDialogueIntoBlock,
  onOpenAddBlock,
  onEditBlock,
  onRequestDeleteBlock,
  onMoveBlock,
  onDropReorderBlock,
  onMoveSopPanel,
  onDropSopPanelOnBlock,
  onDropBlockOnSopPanel,
  onOpenAddSop,
  onEditSop,
  onRequestDeleteSop,
  onMoveSop,
  onDropReorderSop,
  onEditNarrative,
  onEditScenarioMeta,
  onOpenGenerateNarrativeAudio,
  generatingTtsId,
  canEdit,
  isAdmin,
  savestateCount,
  onOpenSavestates,
  onExportPdf,
  onOpenBulkUpload,
}: DialogueConsoleViewProps) {
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);

  const uniqueSpeakers = useMemo(() => {
    const set = new Set<string>();
    dialogues.forEach((d) => {
      if (d.entryType === 'narrative') return;
      if (d.sender) set.add(d.sender);
      if (d.receiver) set.add(d.receiver);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dialogues]);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const hasDialogueOnlyFilter =
    audioFilter !== 'all' || speakerFilter !== 'all';
  const hasFiltersActive = trimmedQuery !== '' || hasDialogueOnlyFilter;

  const filteredDialogues = useMemo(() => {
    return dialogues.filter((d) => {
      const isNarrative = d.entryType === 'narrative';

      if (isNarrative) {
        if (speakerFilter !== 'all') return false;
        const hasAudio = Boolean(audioMap[d.id]);
        if (audioFilter === 'has-audio' && !hasAudio) return false;
        if (audioFilter === 'missing-audio' && hasAudio) return false;
        if (audioFilter === 'unplayed' && (!hasAudio || playedSet.has(d.id))) {
          return false;
        }
      } else {
        const hasAudio = Boolean(audioMap[d.id]);
        if (audioFilter === 'has-audio' && !hasAudio) return false;
        if (audioFilter === 'missing-audio' && hasAudio) return false;
        if (audioFilter === 'unplayed' && playedSet.has(d.id)) return false;

        if (speakerFilter !== 'all') {
          if (d.sender !== speakerFilter && d.receiver !== speakerFilter) {
            return false;
          }
        }
      }

      if (trimmedQuery) {
        const hay = `${d.sequenceNumber} ${d.title ?? ''} ${d.sender} ${d.receiver} ${d.transcript} ${d.note ?? ''}`.toLowerCase();
        if (!hay.includes(trimmedQuery)) return false;
      }
      return true;
    });
  }, [
    dialogues,
    audioMap,
    playedSet,
    trimmedQuery,
    audioFilter,
    speakerFilter,
    hasDialogueOnlyFilter,
  ]);

  const filteredSops = useMemo(() => {
    if (hasDialogueOnlyFilter) return [];
    if (!trimmedQuery) return sopItems;
    return sopItems.filter((sop) => {
      const hay = `${sop.unit} ${sop.phaseTitle} ${sop.steps.join(' ')}`.toLowerCase();
      return hay.includes(trimmedQuery);
    });
  }, [sopItems, trimmedQuery, hasDialogueOnlyFilter]);

  const narrativeMatchesFilter = useMemo(() => {
    if (hasDialogueOnlyFilter) return false;
    if (!trimmedQuery) return true;
    const hay = `${incidentNarrative.title} ${incidentNarrative.time} ${incidentNarrative.body}`.toLowerCase();
    return hay.includes(trimmedQuery);
  }, [incidentNarrative, trimmedQuery, hasDialogueOnlyFilter]);

  const activeDialogue = useMemo(
    () => dialogues.find((d) => d.id === activeDialogueId) ?? null,
    [dialogues, activeDialogueId],
  );

  const onlyDialogues = useMemo(
    () => dialogues.filter((d) => d.entryType !== 'narrative'),
    [dialogues],
  );

  const uploadedCount = useMemo(
    () => onlyDialogues.filter((d) => Boolean(audioMap[d.id])).length,
    [onlyDialogues, audioMap],
  );

  const reorderingEnabled = canEdit && !hasFiltersActive;

  const nothingMatchesSearch =
    hasFiltersActive &&
    filteredDialogues.length === 0 &&
    filteredSops.length === 0 &&
    !narrativeMatchesFilter;

  const renderBlockCard = (
    block: CommunicationBlock,
    blockIdx: number,
    phaseBlockCount: number,
    clampedSopPos: number,
  ) => {
    // Preserve exact interleaved array order of dialogues and narratives
    const blockEntries = filteredDialogues.filter((d) => d.blockId === block.id);

    if (hasFiltersActive && blockEntries.length === 0) {
      return null;
    }

    const allBlockEntries = dialogues.filter((d) => d.blockId === block.id);
    const allBlockDialogues = allBlockEntries.filter(
      (d) => d.entryType !== 'narrative',
    );
    const allBlockNarratives = allBlockEntries.filter(
      (d) => d.entryType === 'narrative',
    );
    const blockNarrativeCount = allBlockNarratives.length;
    const blockNarrativeAudioCount = allBlockNarratives.filter((d) =>
      Boolean(audioMap[d.id]),
    ).length;
    const hasConversations = allBlockDialogues.length > 0;
    const blockDialogueReadyCount = allBlockDialogues.filter((d) =>
      Boolean(audioMap[d.id]),
    ).length;
    const blockTotalPlayableCount =
      blockDialogueReadyCount + blockNarrativeAudioCount;

    const globalBlockIndex = blocks.findIndex((b) => b.id === block.id);
    const canMoveBlockUp =
      globalBlockIndex > 0 || (blockIdx === 0 && clampedSopPos === 0);
    const canMoveBlockDown =
      (globalBlockIndex !== -1 && globalBlockIndex < blocks.length - 1) ||
      (blockIdx === phaseBlockCount - 1 && clampedSopPos === phaseBlockCount);

    return (
      <div
        key={block.id}
        onDragOver={(e) => {
          if (!reorderingEnabled) return;
          const types = Array.from(e.dataTransfer.types);
          if (
            types.includes(BLOCK_DRAG_MIME) ||
            types.includes(SOP_PANEL_DRAG_MIME) ||
            types.includes(DIALOGUE_DRAG_MIME)
          ) {
            e.preventDefault();
            if (dragOverBlockId !== block.id) {
              setDragOverBlockId(block.id);
            }
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setDragOverBlockId((curr) => (curr === block.id ? null : curr));
          }
        }}
        onDrop={(e) => {
          setDragOverBlockId(null);
          if (!reorderingEnabled) return;
          const draggedSopPhase = e.dataTransfer.getData(SOP_PANEL_DRAG_MIME) as
            | PhaseId
            | '';
          if (draggedSopPhase) {
            e.preventDefault();
            onDropSopPanelOnBlock(draggedSopPhase, block.id);
            return;
          }
          const draggedBlockId = e.dataTransfer.getData(BLOCK_DRAG_MIME);
          if (draggedBlockId && draggedBlockId !== block.id) {
            e.preventDefault();
            onDropReorderBlock(draggedBlockId, block.id);
            return;
          }
          const draggedDialogueId = e.dataTransfer.getData(DIALOGUE_DRAG_MIME);
          if (draggedDialogueId && allBlockEntries.length === 0) {
            e.preventDefault();
            onDropDialogueIntoBlock(draggedDialogueId, block.id);
          }
        }}
        className={`bg-white border rounded-lg overflow-hidden transition-colors ${
          dragOverBlockId === block.id
            ? 'border-[#0E2439] ring-1 ring-[#0E2439]/30'
            : 'border-slate-200'
        }`}
      >
        {/* Block Toolbar Header */}
        <div className="px-4 py-3.5 sm:px-5 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            {canEdit && (
              <div
                draggable={reorderingEnabled}
                onDragStart={(e) => {
                  if (!reorderingEnabled) return;
                  e.dataTransfer.setData(BLOCK_DRAG_MIME, block.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                title={
                  reorderingEnabled
                    ? 'Seret untuk mengubah urutan blok'
                    : 'Hapus filter untuk menggeser blok'
                }
                className={`mt-0.5 p-0.5 -ml-1 rounded text-slate-400 shrink-0 ${
                  reorderingEnabled
                    ? 'cursor-grab active:cursor-grabbing hover:text-slate-800'
                    : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <GripVertical className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-mono text-xs font-semibold text-[#0E2439]">
                  {block.code}
                </span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <h3 className="text-sm font-semibold text-slate-900">
                  {block.title}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-slate-500">
                <span>{block.channelType}</span>
                {hasConversations && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {blockDialogueReadyCount}/{allBlockDialogues.length} audio dialog
                    </span>
                  </>
                )}
                {blockNarrativeCount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {blockNarrativeAudioCount > 0
                        ? `${blockNarrativeAudioCount}/${blockNarrativeCount} audio narasi`
                        : `${blockNarrativeCount} narasi`}
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Urutan blok {blockIdx + 1}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {/* Audio sequence play button when block has dialogues or narrative audio */}
            {(hasConversations || blockNarrativeAudioCount > 0) && (
              <button
                type="button"
                onClick={() => onPlayBlockSequence(block.id)}
                disabled={blockTotalPlayableCount === 0}
                title={
                  blockTotalPlayableCount > 0
                    ? 'Putar seluruh audio dialog dan narasi siap dalam blok ini secara berurutan'
                    : canEdit
                      ? 'Unggah audio dialog atau buat audio narasi pada blok ini terlebih dahulu'
                      : 'Belum ada audio yang tersedia pada blok ini'
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                  blockTotalPlayableCount > 0
                    ? 'bg-white text-[#0E2439] border-slate-300 hover:bg-slate-100'
                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5 shrink-0" />
                <span>Putar Blok ({blockTotalPlayableCount})</span>
              </button>
            )}

            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAddEntry(block.id, 'dialogue')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Dialog</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenAddEntry(block.id, 'narrative')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Narasi</span>
                </button>

                <div
                  className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block"
                  aria-hidden="true"
                />

                <button
                  type="button"
                  onClick={() => onMoveBlock(block.id, 'up')}
                  disabled={!reorderingEnabled || !canMoveBlockUp}
                  title="Pindahkan blok ke atas"
                  aria-label={`Pindahkan ${block.code} ke atas`}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onMoveBlock(block.id, 'down')}
                  disabled={!reorderingEnabled || !canMoveBlockDown}
                  title="Pindahkan blok ke bawah"
                  aria-label={`Pindahkan ${block.code} ke bawah`}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onEditBlock(block)}
                  title="Edit blok komunikasi"
                  aria-label={`Edit ${block.code}`}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-[#0E2439] transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onRequestDeleteBlock(block)}
                  title="Hapus blok komunikasi"
                  aria-label={`Hapus ${block.code}`}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-[#DC2626] hover:border-red-200 hover:bg-red-50/50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Interleaved Dialogue & Narrative Rows or Empty Block Placeholder */}
        {blockEntries.length === 0 ? (
          <div className="px-5 py-6 text-center bg-white space-y-2.5">
            <p className="text-xs text-slate-500">
              {canEdit
                ? `Belum ada percakapan atau narasi di dalam ${block.code}. Tambahkan item baru atau seret baris ke sini.`
                : `Belum ada percakapan atau narasi di dalam ${block.code}.`}
            </p>
            {canEdit && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAddEntry(block.id, 'dialogue')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#0E2439] bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Percakapan</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAddEntry(block.id, 'narrative')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Narasi</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {blockEntries.map((entry, idx) =>
              entry.entryType === 'narrative' ? (
                <BlockNarrativeRow
                  key={entry.id}
                  item={entry}
                  audio={audioMap[entry.id]}
                  isCurrentTrack={activeDialogueId === entry.id}
                  isPlaying={activeDialogueId === entry.id && isPlaying}
                  currentTime={activeDialogueId === entry.id ? currentTime : 0}
                  activeDuration={
                    activeDialogueId === entry.id
                      ? activeDuration
                      : audioMap[entry.id]?.duration ?? 0
                  }
                  isGeneratingAudio={generatingTtsId === entry.id}
                  canEdit={canEdit}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < blockEntries.length - 1}
                  reorderingEnabled={reorderingEnabled}
                  onTogglePlay={onTogglePlay}
                  onReplay={onReplay}
                  onSeek={onSeek}
                  onOpenGenerateAudio={onOpenGenerateNarrativeAudio}
                  onRequestRemoveAudio={onRequestRemoveAudio}
                  onMoveItem={onMoveDialogue}
                  onDropReorderItem={onDropReorderDialogue}
                  onInsertDialogueAfter={(item) =>
                    onOpenAddEntry(item.blockId, 'dialogue', item.id)
                  }
                  onEditItem={onEditDialogue}
                  onRequestDeleteItem={onRequestDeleteDialogue}
                />
              ) : (
                <DialogueRow
                  key={entry.id}
                  dialogue={entry}
                  audio={audioMap[entry.id]}
                  isCurrentTrack={activeDialogueId === entry.id}
                  isPlaying={activeDialogueId === entry.id && isPlaying}
                  currentTime={activeDialogueId === entry.id ? currentTime : 0}
                  activeDuration={
                    activeDialogueId === entry.id
                      ? activeDuration
                      : audioMap[entry.id]?.duration ?? 0
                  }
                  isPlayed={playedSet.has(entry.id)}
                  isGeneratingAudio={generatingTtsId === entry.id}
                  canEdit={canEdit}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < blockEntries.length - 1}
                  reorderingEnabled={reorderingEnabled}
                  onTogglePlay={onTogglePlay}
                  onReplay={onReplay}
                  onSeek={onSeek}
                  onUploadAudio={onUploadAudio}
                  onOpenRecordAudio={onOpenRecordAudio}
                  onOpenGenerateAudio={onOpenGenerateNarrativeAudio}
                  onRequestRemoveAudio={onRequestRemoveAudio}
                  onTogglePlayed={onTogglePlayed}
                  onMoveDialogue={onMoveDialogue}
                  onDropReorderDialogue={onDropReorderDialogue}
                  onInsertDialogueAfter={(dlg) =>
                    onOpenAddEntry(dlg.blockId, 'dialogue', dlg.id)
                  }
                  onEditDialogue={onEditDialogue}
                  onRequestDeleteDialogue={onRequestDeleteDialogue}
                />
              ),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Flight Scenario Header Card */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">{scenarioMeta.unit}</div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0E2439]">
              {scenarioMeta.title}
            </h1>
            {scenarioMeta.description && (
              <p className="text-sm text-slate-600">
                {scenarioMeta.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start">
            <span className="inline-flex items-center px-2.5 py-1.5 rounded-sm border border-[#DC2626] text-[#DC2626] font-mono text-xs font-semibold tracking-wide whitespace-nowrap">
              {scenarioMeta.status}
            </span>
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={onEditScenarioMeta}
                  title="Ubah judul, unit, status darurat, dan data operasional pada kartu header ini"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#0E2439] bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <Pencil className="w-3.5 h-3.5 shrink-0" />
                  <span>Edit Header</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenSavestates}
                  title="Simpan atau muat beberapa versi savestate lengkap (teks, SOP & audio)"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] transition-colors whitespace-nowrap"
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Savestate{savestateCount > 0 ? ` (${savestateCount})` : ''}
                  </span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onExportPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#0E2439] bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span>Ekspor PDF</span>
            </button>
          </div>
        </div>

        {/* Concise Operational Fact Strip */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-3 pt-4 text-xs">
          <div>
            <dt className="text-slate-500 mb-0.5">Call Sign</dt>
            <dd className="font-mono font-semibold text-slate-900 tabular-nums">
              {scenarioMeta.callSign || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 mb-0.5">Pesawat</dt>
            <dd className="font-medium text-slate-900">
              {scenarioMeta.aircraft || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 mb-0.5">Rute</dt>
            <dd className="font-medium text-slate-900">
              {scenarioMeta.route || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 mb-0.5">ETA &amp; Landasan</dt>
            <dd className="font-mono font-medium text-slate-900 tabular-nums">
              {scenarioMeta.etaRunway || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 mb-0.5">Personel (POB)</dt>
            <dd className="font-mono font-medium text-slate-900 tabular-nums">
              {scenarioMeta.pob || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 mb-0.5">Bahan Bakar</dt>
            <dd className="font-mono font-medium text-slate-900 tabular-nums">
              {scenarioMeta.fuel || '—'}
            </dd>
          </div>
        </dl>
      </section>

      {/* Active Playback & Audio Console Bar */}
      <section className="bg-white border border-slate-200 rounded-lg px-4 py-3.5 sm:px-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Now Playing Status */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {activeDialogue ? (
              <>
                <button
                  type="button"
                  onClick={() => onTogglePlay(activeDialogue.id)}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-[#0E2439] text-white hover:bg-[#193A58] transition-colors shrink-0"
                  aria-label={isPlaying ? 'Jeda pemutaran' : 'Lanjutkan pemutaran'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {activeDialogue.entryType === 'narrative' ? (
                      <>
                        <span className="font-mono font-semibold text-[#0E2439]">
                          Narasi
                        </span>
                        <span className="font-semibold text-slate-800 truncate">
                          {activeDialogue.title || 'Narasi Skenario'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-mono font-semibold text-[#0E2439] tabular-nums">
                          #{formatSequenceNumber(activeDialogue.sequenceNumber)}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">
                          {activeDialogue.sender} → {activeDialogue.receiver}
                        </span>
                      </>
                    )}
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-slate-600 shrink-0">
                      {formatDuration(currentTime)} / {formatDuration(activeDuration)}
                    </span>
                    {isSequenceActive && (
                      <>
                        <span
                          className="text-slate-300 hidden sm:inline"
                          aria-hidden="true"
                        >
                          ·
                        </span>
                        <span className="text-[#0284C7] font-medium hidden sm:inline whitespace-nowrap">
                          Antrean otomatis ({sequenceQueueRemaining} tersisa)
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 truncate mt-0.5">
                    {activeDialogue.transcript}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isSequenceActive && sequenceQueueRemaining > 0 && (
                    <button
                      type="button"
                      onClick={onSkipNextInQueue}
                      title="Lanjut ke dialog berikutnya"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 whitespace-nowrap"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Berikutnya</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onStopPlayback}
                    title="Hentikan audio"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 whitespace-nowrap"
                  >
                    <Square className="w-3 h-3" />
                    <span className="hidden sm:inline">Hentikan</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-600">
                <span className="font-medium text-slate-900">
                  {uploadedCount} dari {onlyDialogues.length} dialog siap diputar ·{' '}
                  {sopItems.length} unit SOP.
                </span>{' '}
                <span>
                  {canEdit
                    ? 'Mode Edit Aktif — Anda dapat mengubah teks, mengunggah/merekam audio, mengatur urutan, dan mengelola savestate.'
                    : isAdmin
                      ? 'Edit sedang terkunci untuk mencegah perubahan tidak sengaja saat latihan. Buka Kunci Edit di bilah atas bila perlu mengedit.'
                      : 'Mode Pengguna — Klik tombol putar pada percakapan atau Putar Semua di bilah atas untuk menjalankan audio latihan.'}
                </span>
              </div>
            )}
          </div>

          {/* Playback Controls: Speed, Gap, Volume */}
          <div className="flex flex-wrap items-center gap-4 pt-3 xl:pt-0 border-t xl:border-t-0 border-slate-100 shrink-0 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 whitespace-nowrap">Kecepatan</span>
              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md">
                {[0.85, 1, 1.25].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => onPlaybackRateChange(rate)}
                    className={`px-2 py-1 rounded text-[11px] font-mono tabular-nums transition-colors whitespace-nowrap ${
                      playbackRate === rate
                        ? 'bg-white text-[#0E2439] font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 whitespace-nowrap">Jeda Urutan</span>
              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md">
                {[1, 2, 3].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => onSequenceGapChange(sec)}
                    className={`px-2 py-1 rounded text-[11px] font-mono tabular-nums transition-colors whitespace-nowrap ${
                      sequenceGapSeconds === sec
                        ? 'bg-white text-[#0E2439] font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sec}d
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={isMuted ? 'Aktifkan suara' : 'Bisukan suara'}
                className="p-1.5 text-slate-600 hover:text-slate-900 rounded"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                aria-label="Volume master audio"
                className="audio-scrubber w-20"
                style={{
                  background: `linear-gradient(to right, #0E2439 0%, #0E2439 ${(isMuted ? 0 : volume) * 100}%, #CBD5E1 ${(isMuted ? 0 : volume) * 100}%, #CBD5E1 100%)`,
                  height: '4px',
                  borderRadius: '9999px',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Search Toolbar */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari percakapan, narasi, atau unit SOP..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0E2439]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-md overflow-x-auto max-w-full">
            {(
              [
                { id: 'all', label: 'Semua' },
                { id: 'has-audio', label: 'Audio Siap' },
                { id: 'missing-audio', label: 'Belum Diunggah' },
                { id: 'unplayed', label: 'Belum Diputar' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onAudioFilterChange(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  audioFilter === tab.id
                    ? 'bg-white text-[#0E2439] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={speakerFilter}
            onChange={(e) => onSpeakerFilterChange(e.target.value)}
            aria-label="Filter berdasarkan unit pembicara"
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-[#0E2439]"
          >
            <option value="all">Semua Unit / Pembicara</option>
            {uniqueSpeakers.map((spk) => (
              <option key={spk} value={spk}>
                {spk}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Empty Filter State */}
      {nothingMatchesSearch ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-3">
          <p className="text-sm font-medium text-slate-900">
            Tidak ada percakapan, SOP, atau narasi yang sesuai dengan filter saat ini.
          </p>
          <p className="text-xs text-slate-500">
            Coba ubah kata kunci pencarian, status audio, atau pilihan unit pembicara.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                onAudioFilterChange('all');
                onSpeakerFilterChange('all');
              }}
              className="px-4 py-2 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] transition-colors"
            >
              Tampilkan Semua Konten
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={onOpenBulkUpload}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Unggah Audio Massal
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Integrated PDF Chronological Phases: Dialogues + Block Narratives + Incident Narrative + Editable SOPs */
        <div className="space-y-10">
          {SCENARIO_PHASES.map((phase) => {
            const phaseBlocks = blocks.filter((b) => b.phaseId === phase.id);
            const phaseSops = filteredSops.filter((s) => s.phaseId === phase.id);
            const showNarrative =
              phase.id === 'fase-4' && narrativeMatchesFilter;

            const hasMatchingEntriesInPhase = phaseBlocks.some((blk) =>
              filteredDialogues.some((d) => d.blockId === blk.id),
            );

            if (
              hasFiltersActive &&
              !hasMatchingEntriesInPhase &&
              phaseSops.length === 0 &&
              !showNarrative
            ) {
              return null;
            }

            const fallbackSopPos =
              phase.id === 'fase-4' ? 0 : phaseBlocks.length;
            const clampedSopPos = Math.max(
              0,
              Math.min(
                phaseBlocks.length,
                sopPositions[phase.id] ?? fallbackSopPos,
              ),
            );

            const blocksBeforeSop = phaseBlocks
              .slice(0, clampedSopPos)
              .map((blk, idx) =>
                renderBlockCard(blk, idx, phaseBlocks.length, clampedSopPos),
              )
              .filter(Boolean);

            const blocksAfterSop = phaseBlocks
              .slice(clampedSopPos)
              .map((blk, idx) =>
                renderBlockCard(
                  blk,
                  clampedSopPos + idx,
                  phaseBlocks.length,
                  clampedSopPos,
                ),
              )
              .filter(Boolean);

            const hasAnyRenderedBlocks =
              blocksBeforeSop.length > 0 || blocksAfterSop.length > 0;

            const showSopPanel =
              !hasDialogueOnlyFilter && (!trimmedQuery || phaseSops.length > 0);

            return (
              <section
                key={phase.id}
                id={`phase-${phase.id}`}
                className="scroll-mt-20 space-y-5"
              >
                {/* Phase Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-300">
                  <div>
                    <h2 className="text-lg font-bold text-[#0E2439]">
                      {phase.roman}. {phase.title}
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {phase.summary}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs text-slate-500 mr-1">
                      {phase.pageRange}
                    </span>
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenAddSop(phase.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span>SOP</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenAddBlock(phase.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#0E2439] bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span>Blok Dialog</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Unified Reorderable Phase Content: Narrative (Fase IV) + Interleaved Blocks & SOP Table */}
                <div className="space-y-5">
                  {phase.id === 'fase-4' && showNarrative && (
                    <div className="bg-white border border-slate-200 rounded-lg p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                          <h3 className="text-sm font-bold text-[#0E2439]">
                            {incidentNarrative.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                            <span>{incidentNarrative.time}</span>
                            <span aria-hidden="true">·</span>
                            <span>Hal. {incidentNarrative.pageNumber}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-sans">
                              Narasi kejadian (tanpa audio)
                            </span>
                          </div>
                        </div>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={onEditNarrative}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0E2439] bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 self-start"
                          >
                            <Pencil className="w-3.5 h-3.5 shrink-0" />
                            <span>Edit Narasi</span>
                          </button>
                        )}
                      </div>

                      <p className="mt-3 text-[15px] leading-[1.65] text-slate-800 max-w-[82ch] whitespace-pre-line">
                        {incidentNarrative.body}
                      </p>
                    </div>
                  )}

                  {blocksBeforeSop}

                  {showSopPanel && (
                    <PhaseSopTable
                      phaseId={phase.id}
                      items={phaseSops}
                      canEdit={canEdit}
                      reorderingEnabled={reorderingEnabled}
                      canMovePanelUp={clampedSopPos > 0}
                      canMovePanelDown={clampedSopPos < phaseBlocks.length}
                      blockDragMime={BLOCK_DRAG_MIME}
                      onMovePanel={onMoveSopPanel}
                      onDropBlockOnPanel={onDropBlockOnSopPanel}
                      onAddSop={onOpenAddSop}
                      onEditSop={onEditSop}
                      onRequestDeleteSop={onRequestDeleteSop}
                      onMoveSop={onMoveSop}
                      onDropReorderSop={onDropReorderSop}
                    />
                  )}

                  {blocksAfterSop}

                  {!hasAnyRenderedBlocks && !hasFiltersActive && canEdit && (
                    <div className="bg-white border border-dashed border-slate-300 rounded-lg px-5 py-5 text-center space-y-2">
                      <p className="text-xs text-slate-500">
                        Belum ada blok percakapan pada tahap ini.
                      </p>
                      <button
                        type="button"
                        onClick={() => onOpenAddBlock(phase.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#0E2439] bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Buat Blok Percakapan</span>
                      </button>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
