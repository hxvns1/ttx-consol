import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { CommunicationBlock, PhaseId } from '../types/ttx';
import { SCENARIO_PHASES } from '../data/scenarioData';

interface BlockEditorModalProps {
  isOpen: boolean;
  editingBlock: CommunicationBlock | null;
  defaultPhaseId: PhaseId;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    phaseId: PhaseId;
    code: string;
    title: string;
    channelType: string;
    description: string;
    pageNumber: number;
  }) => void;
}

export function BlockEditorModal({
  isOpen,
  editingBlock,
  defaultPhaseId,
  onClose,
  onSave,
}: BlockEditorModalProps) {
  const [phaseId, setPhaseId] = useState<PhaseId>(defaultPhaseId);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [channelType, setChannelType] = useState('');
  const [description, setDescription] = useState('');
  const [pageNumber, setPageNumber] = useState('1');

  useEffect(() => {
    if (!isOpen) return;
    if (editingBlock) {
      setPhaseId(editingBlock.phaseId);
      setCode(editingBlock.code);
      setTitle(editingBlock.title);
      setChannelType(editingBlock.channelType);
      setDescription(editingBlock.description);
      setPageNumber(String(editingBlock.pageNumber));
    } else {
      setPhaseId(defaultPhaseId);
      setCode('');
      setTitle('');
      setChannelType('Radio Koordinasi / Telepon Darurat');
      setDescription('');
      setPageNumber('1');
    }
  }, [isOpen, editingBlock, defaultPhaseId]);

  if (!isOpen) return null;

  const canSubmit = code.trim().length > 0 && title.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const parsedPage = Math.max(1, parseInt(pageNumber, 10) || 1);
    onSave({
      id: editingBlock?.id,
      phaseId,
      code: code.trim(),
      title: title.trim(),
      channelType: channelType.trim() || 'Jalur Komunikasi',
      description: description.trim(),
      pageNumber: parsedPage,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-editor-title"
        className="w-full max-w-lg bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2
            id="block-editor-title"
            className="text-base font-bold text-[#0E2439]"
          >
            {editingBlock ? 'Edit Blok Komunikasi' : 'Tambah Blok Komunikasi Baru'}
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kode Blok
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Contoh: Blok 3E"
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Judul Blok
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Jalur Koordinasi Basarnas & Medis"
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Saluran / Media Komunikasi
              </label>
              <input
                type="text"
                value={channelType}
                onChange={(e) => setChannelType(e.target.value)}
                placeholder="Contoh: Frekuensi Tower (VHF) & Crash Phone"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
              />
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
              Deskripsi Singkat (Opsional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ringkasan alur komunikasi pada blok ini..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
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
              {editingBlock ? 'Simpan Perubahan' : 'Tambahkan Blok'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
