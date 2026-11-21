import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import type { PhaseId, SopItem } from '../types/ttx';
import { SCENARIO_PHASES } from '../data/scenarioData';

interface SopEditorModalProps {
  isOpen: boolean;
  editingSop: SopItem | null;
  defaultPhaseId: PhaseId;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    phaseId: PhaseId;
    unit: string;
    steps: string[];
    pageNumber: number;
  }) => void;
}

export function SopEditorModal({
  isOpen,
  editingSop,
  defaultPhaseId,
  onClose,
  onSave,
}: SopEditorModalProps) {
  const [phaseId, setPhaseId] = useState<PhaseId>(defaultPhaseId);
  const [unit, setUnit] = useState('');
  const [pageNumber, setPageNumber] = useState('1');
  const [steps, setSteps] = useState<string[]>(['']);

  useEffect(() => {
    if (!isOpen) return;
    if (editingSop) {
      setPhaseId(editingSop.phaseId);
      setUnit(editingSop.unit);
      setPageNumber(String(editingSop.pageNumber));
      setSteps(editingSop.steps.length > 0 ? [...editingSop.steps] : ['']);
    } else {
      const defaultPage =
        defaultPhaseId === 'fase-2'
          ? '1'
          : defaultPhaseId === 'fase-3'
            ? '3'
            : defaultPhaseId === 'fase-4'
              ? '3'
              : '5';
      setPhaseId(defaultPhaseId);
      setUnit('');
      setPageNumber(defaultPage);
      setSteps(['']);
    }
  }, [isOpen, editingSop, defaultPhaseId]);

  if (!isOpen) return null;

  const cleanedSteps = steps.map((s) => s.trim()).filter(Boolean);
  const canSubmit = unit.trim().length > 0 && cleanedSteps.length > 0;

  const handleStepChange = (index: number, value: string) => {
    setSteps((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const handleAddStep = () => {
    setSteps((prev) => [...prev, '']);
  };

  const handleRemoveStep = (index: number) => {
    setSteps((prev) => {
      if (prev.length <= 1) return [''];
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    setSteps((prev) => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave({
      id: editingSop?.id,
      phaseId,
      unit: unit.trim(),
      steps: cleanedSteps,
      pageNumber: Math.max(1, parseInt(pageNumber, 10) || 1),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sop-editor-title"
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h2 id="sop-editor-title" className="text-base font-bold text-[#0E2439]">
            {editingSop
              ? 'Edit Rincian Tindakan SOP'
              : 'Tambah Rincian Tindakan SOP'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tahap Skenario (Fase)
              </label>
              <select
                value={phaseId}
                onChange={(e) => setPhaseId(e.target.value as PhaseId)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
              >
                {SCENARIO_PHASES.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.roman}. {phase.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Halaman PDF
              </label>
              <input
                type="number"
                min={1}
                value={pageNumber}
                onChange={(e) => setPageNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Petugas / Unit
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Contoh: Regu PKP-PK (ARFF), Komando Lapangan (MCP & OSC)"
              required
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-700">
                Rincian Tindakan Operasional Lapangan
              </label>
              <button
                type="button"
                onClick={handleAddStep}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#0E2439] bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Langkah</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {steps.map((stepText, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 bg-slate-50/70 border border-slate-200 rounded-md p-2.5"
                >
                  <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums pt-2 w-5 text-center shrink-0">
                    {idx + 1}.
                  </span>

                  <textarea
                    rows={2}
                    value={stepText}
                    onChange={(e) => handleStepChange(idx, e.target.value)}
                    placeholder={`Tuliskan rincian langkah tindakan ke-${idx + 1}...`}
                    className="flex-1 px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
                  />

                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveStep(idx, 'up')}
                      disabled={idx === 0}
                      title="Geser langkah ke atas"
                      className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveStep(idx, 'down')}
                      disabled={idx === steps.length - 1}
                      title="Geser langkah ke bawah"
                      className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      title="Hapus langkah"
                      className="p-1 rounded border border-slate-200 bg-white text-slate-500 hover:text-[#DC2626] hover:border-red-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] disabled:opacity-50 transition-colors"
            >
              {editingSop ? 'Simpan Perubahan SOP' : 'Tambahkan SOP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
