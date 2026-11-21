import { X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2
            id="confirm-modal-title"
            className="text-base font-bold text-[#0E2439]"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup konfirmasi"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm leading-relaxed text-slate-700">{description}</p>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-medium text-white bg-[#DC2626] rounded-md hover:bg-[#B91C1C] transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
