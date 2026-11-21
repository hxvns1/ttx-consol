import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { IncidentNarrative } from '../types/ttx';

interface NarrativeEditorModalProps {
  isOpen: boolean;
  narrative: IncidentNarrative;
  onClose: () => void;
  onSave: (updated: IncidentNarrative) => void;
}

export function NarrativeEditorModal({
  isOpen,
  narrative,
  onClose,
  onSave,
}: NarrativeEditorModalProps) {
  const [title, setTitle] = useState(narrative.title);
  const [time, setTime] = useState(narrative.time);
  const [pageNumber, setPageNumber] = useState(String(narrative.pageNumber));
  const [body, setBody] = useState(narrative.body);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(narrative.title);
    setTime(narrative.time);
    setPageNumber(String(narrative.pageNumber));
    setBody(narrative.body);
  }, [isOpen, narrative]);

  if (!isOpen) return null;

  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave({
      title: title.trim(),
      time: time.trim() || 'Pukul 10.15 WITA · Runway 12',
      pageNumber: Math.max(1, parseInt(pageNumber, 10) || 3),
      body: body.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="narrative-editor-title"
        className="w-full max-w-xl bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2
            id="narrative-editor-title"
            className="text-base font-bold text-[#0E2439]"
          >
            Edit Narasi Dinamika Kejadian (Bagian IV)
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
              Judul Kejadian
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Waktu &amp; Lokasi Kejadian
              </label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="Pukul 10.15 WITA · Runway 12"
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
              Uraian Kronologi Insiden
            </label>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
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
              Simpan Narasi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
