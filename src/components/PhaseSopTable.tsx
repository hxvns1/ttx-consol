import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type { PhaseId, SopItem } from '../types/ttx';

export const SOP_DRAG_MIME = 'application/x-ttx-sop-id';
export const SOP_PANEL_DRAG_MIME = 'application/x-ttx-sop-panel-phase';

interface PhaseSopTableProps {
  phaseId: PhaseId;
  title?: string;
  items: SopItem[];
  canEdit: boolean;
  reorderingEnabled: boolean;
  canMovePanelUp?: boolean;
  canMovePanelDown?: boolean;
  blockDragMime?: string;
  onMovePanel?: (phaseId: PhaseId, direction: 'up' | 'down') => void;
  onDropBlockOnPanel?: (sourceBlockId: string, targetPhaseId: PhaseId) => void;
  onAddSop: (phaseId: PhaseId) => void;
  onEditSop: (sop: SopItem) => void;
  onRequestDeleteSop: (sop: SopItem) => void;
  onMoveSop: (sopId: string, direction: 'up' | 'down') => void;
  onDropReorderSop: (sourceSopId: string, targetSopId: string) => void;
}

export function PhaseSopTable({
  phaseId,
  title,
  items,
  canEdit,
  reorderingEnabled,
  canMovePanelUp = false,
  canMovePanelDown = false,
  blockDragMime,
  onMovePanel,
  onDropBlockOnPanel,
  onAddSop,
  onEditSop,
  onRequestDeleteSop,
  onMoveSop,
  onDropReorderSop,
}: PhaseSopTableProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isBlockDragOver, setIsBlockDragOver] = useState(false);

  const effectiveReordering = canEdit && reorderingEnabled;

  const heading =
    title ??
    (phaseId === 'fase-6'
      ? 'Rincian Tindakan Penutupan Operasi & Pemulihan Bandara (Recovery)'
      : 'Rincian Tindakan Operasional Lapangan (SOP Tanggap Darurat)');

  return (
    <div
      onDragOver={(e) => {
        if (!effectiveReordering || !blockDragMime || !onDropBlockOnPanel) return;
        const types = Array.from(e.dataTransfer.types);
        if (types.includes(blockDragMime)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (!isBlockDragOver) setIsBlockDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsBlockDragOver(false);
        }
      }}
      onDrop={(e) => {
        setIsBlockDragOver(false);
        if (!effectiveReordering || !blockDragMime || !onDropBlockOnPanel) return;
        const draggedBlockId = e.dataTransfer.getData(blockDragMime);
        if (draggedBlockId) {
          e.preventDefault();
          onDropBlockOnPanel(draggedBlockId, phaseId);
        }
      }}
      className={`bg-white border rounded-lg overflow-hidden transition-colors ${
        isBlockDragOver
          ? 'border-[#0E2439] ring-2 ring-[#0E2439]/35'
          : 'border-slate-200'
      }`}
    >
      {/* SOP Panel Header */}
      <div className="px-4 py-3 sm:px-5 bg-[#0E2439] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          {canEdit && onMovePanel && (
            <div
              draggable={effectiveReordering}
              onDragStart={(e) => {
                if (!effectiveReordering) return;
                e.dataTransfer.setData(SOP_PANEL_DRAG_MIME, phaseId);
                e.dataTransfer.effectAllowed = 'move';
              }}
              title={
                effectiveReordering
                  ? 'Seret untuk memindahkan posisi panel SOP di antara blok'
                  : 'Hapus filter untuk memindahkan panel SOP'
              }
              className={`mt-0.5 p-0.5 -ml-1 rounded text-slate-300 shrink-0 ${
                effectiveReordering
                  ? 'cursor-grab active:cursor-grabbing hover:text-white'
                  : 'opacity-40 cursor-not-allowed'
              }`}
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold tracking-tight">{heading}</h3>
            <div className="text-[11px] text-slate-300 mt-0.5 font-mono tabular-nums">
              {items.length} unit operasional · Tanpa audio (tindakan lapangan)
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => onAddSop(phaseId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0E2439] bg-white rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Tambah SOP</span>
            </button>

            {onMovePanel && (
              <>
                <div
                  className="h-4 w-px bg-white/20 mx-0.5 hidden sm:block"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => onMovePanel(phaseId, 'up')}
                  disabled={!effectiveReordering || !canMovePanelUp}
                  title="Pindahkan panel SOP ke atas (melewati blok di atasnya)"
                  aria-label="Pindahkan panel SOP ke atas"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-white/25 bg-white/10 text-white hover:bg-white/20 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onMovePanel(phaseId, 'down')}
                  disabled={!effectiveReordering || !canMovePanelDown}
                  title="Pindahkan panel SOP ke bawah (melewati blok di bawahnya)"
                  aria-label="Pindahkan panel SOP ke bawah"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-white/25 bg-white/10 text-white hover:bg-white/20 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Column Labels (Desktop) */}
      {items.length > 0 && (
        <div className="hidden md:grid md:grid-cols-12 gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
          <div className={`col-span-3 ${canEdit ? 'pl-6' : ''}`}>Petugas / Unit</div>
          <div className={canEdit ? 'col-span-7' : 'col-span-9'}>
            Rincian Tindakan Operasional Lapangan
          </div>
          {canEdit && <div className="col-span-2 text-right">Aksi</div>}
        </div>
      )}

      {/* SOP Rows */}
      {items.length === 0 ? (
        <div className="px-5 py-6 text-center space-y-2">
          <p className="text-xs text-slate-500">
            Belum ada rincian SOP pada tahap ini.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => onAddSop(phaseId)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#0E2439] bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Baris SOP</span>
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {items.map((sop, idx) => (
            <div
              key={sop.id}
              onDragOver={(e) => {
                if (!effectiveReordering) return;
                if (Array.from(e.dataTransfer.types).includes(SOP_DRAG_MIME)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverId !== sop.id) setDragOverId(sop.id);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDragOverId((curr) => (curr === sop.id ? null : curr));
                }
              }}
              onDrop={(e) => {
                setDragOverId(null);
                if (!effectiveReordering) return;
                const draggedId = e.dataTransfer.getData(SOP_DRAG_MIME);
                if (draggedId && draggedId !== sop.id) {
                  e.preventDefault();
                  onDropReorderSop(draggedId, sop.id);
                }
              }}
              className={`px-4 py-4 sm:px-5 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 transition-colors ${
                dragOverId === sop.id
                  ? 'bg-slate-100 ring-2 ring-inset ring-[#0E2439]/35'
                  : 'bg-white hover:bg-slate-50/50'
              }`}
            >
              {/* Unit + Drag Handle */}
              <div className="md:col-span-3 flex items-start gap-2 min-w-0">
                {canEdit && (
                  <div
                    draggable={effectiveReordering}
                    onDragStart={(e) => {
                      if (!effectiveReordering) return;
                      e.dataTransfer.setData(SOP_DRAG_MIME, sop.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    title={
                      effectiveReordering
                        ? 'Seret untuk mengubah urutan baris SOP'
                        : 'Hapus filter untuk menggeser urutan SOP'
                    }
                    className={`mt-0.5 p-0.5 -ml-1 rounded text-slate-400 shrink-0 ${
                      effectiveReordering
                        ? 'cursor-grab active:cursor-grabbing hover:text-slate-800'
                        : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#0E2439] leading-snug">
                    {sop.unit}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 tabular-nums mt-0.5">
                    Hal. {sop.pageNumber} · {sop.steps.length} langkah
                  </div>
                </div>
              </div>

              {/* Numbered Operational Steps */}
              <div
                className={`${canEdit ? 'md:col-span-7 pl-6 md:pl-0' : 'md:col-span-9'}`}
              >
                <ol className="space-y-1.5 text-[14px] leading-relaxed text-slate-700 list-decimal pl-4">
                  {sop.steps.map((step, sIdx) => (
                    <li key={sIdx}>{step}</li>
                  ))}
                </ol>
              </div>

              {/* Row Actions: Up/Down, Edit, Delete */}
              {canEdit && (
                <div className="md:col-span-2 flex items-start md:justify-end gap-1 pl-6 md:pl-0 shrink-0">
                  <button
                    type="button"
                    onClick={() => onMoveSop(sop.id, 'up')}
                    disabled={!effectiveReordering || idx === 0}
                    title="Pindahkan SOP ke atas"
                    aria-label={`Pindahkan SOP ${sop.unit} ke atas`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveSop(sop.id, 'down')}
                    disabled={!effectiveReordering || idx === items.length - 1}
                    title="Pindahkan SOP ke bawah"
                    aria-label={`Pindahkan SOP ${sop.unit} ke bawah`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditSop(sop)}
                    title="Edit rincian SOP"
                    aria-label={`Edit SOP ${sop.unit}`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-[#0E2439] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestDeleteSop(sop)}
                    title="Hapus baris SOP"
                    aria-label={`Hapus SOP ${sop.unit}`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 bg-white text-slate-500 hover:text-[#DC2626] hover:border-red-200 hover:bg-red-50/50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
