import { useRef, useState } from 'react';
import { Check, FolderUp, Trash2, X } from 'lucide-react';
import type { DialogueItem } from '../types/ttx';
import {
  formatFileSize,
  formatSequenceNumber,
  isValidAudioFile,
} from '../lib/formatters';

interface StagedAudioMapping {
  id: string;
  file: File;
  targetDialogueId: string;
}

interface BulkUploadModalProps {
  isOpen: boolean;
  dialogues: DialogueItem[];
  onClose: () => void;
  onCommitUploads: (items: { dialogueId: string; file: File }[]) => Promise<void>;
}

function guessDialogueId(
  fileName: string,
  index: number,
  sortedDialogues: DialogueItem[],
): string {
  const match = fileName.match(/^0*(\d{1,2})[\s._-]/);
  if (match) {
    const num = parseInt(match[1], 10);
    const found = sortedDialogues.find((d) => d.sequenceNumber === num);
    if (found) return found.id;
  }
  return sortedDialogues[index]?.id ?? sortedDialogues[0]?.id ?? '';
}

export function BulkUploadModal({
  isOpen,
  dialogues,
  onClose,
  onCommitUploads,
}: BulkUploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<StagedAudioMapping[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const sortedDialogues = dialogues
    .filter((d) => d.entryType !== 'narrative')
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg(null);

    const files = Array.from(fileList).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );

    const validFiles = files.filter(isValidAudioFile);
    if (validFiles.length === 0) {
      setErrorMsg(
        'Tidak ada file audio yang valid. Gunakan format MP3, WAV, M4A, OGG, atau WebM.',
      );
      return;
    }

    const nextStaged: StagedAudioMapping[] = validFiles.map((file, idx) => ({
      id: `${file.name}-${file.size}-${idx}-${Date.now()}`,
      file,
      targetDialogueId: guessDialogueId(file.name, idx, sortedDialogues),
    }));

    setStaged(nextStaged);
  };

  const handleUpdateTarget = (rowId: string, dialogueId: string) => {
    setStaged((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, targetDialogueId: dialogueId } : row,
      ),
    );
  };

  const handleRemoveRow = (rowId: string) => {
    setStaged((prev) => prev.filter((row) => row.id !== rowId));
  };

  const handleSubmit = async () => {
    const valid = staged.filter((s) => Boolean(s.targetDialogueId));
    if (valid.length === 0) return;
    setSaving(true);
    try {
      await onCommitUploads(
        valid.map((v) => ({ dialogueId: v.targetDialogueId, file: v.file })),
      );
      setStaged([]);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menyimpan file audio.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-upload-title"
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2
              id="bulk-upload-title"
              className="text-base font-bold text-[#0E2439]"
            >
              Unggah Audio Massal
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih banyak file audio sekaligus. Nama file berawalan nomor (contoh: 01_pilot.mp3) akan otomatis dipetakan ke nomor dialog.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full py-6 px-4 border border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100/80 transition-colors flex flex-col items-center justify-center gap-2 text-center"
          >
            <FolderUp className="w-5 h-5 text-[#0E2439]" />
            <span className="text-sm font-medium text-[#0E2439]">
              Pilih Beberapa File Audio (MP3, WAV, M4A, OGG)
            </span>
            <span className="text-xs text-slate-500">
              Anda dapat menyesuaikan pemetaan setiap file ke dialog sebelum disimpan
            </span>
          </button>

          {errorMsg && (
            <div className="px-3.5 py-2.5 text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-md">
              {errorMsg}
            </div>
          )}

          {staged.length > 0 && (
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600 flex items-center justify-between">
                <span>{staged.length} file siap dipetakan</span>
                <button
                  type="button"
                  onClick={() => setStaged([])}
                  className="text-slate-500 hover:text-slate-900"
                >
                  Bersihkan daftar
                </button>
              </div>
              <div className="divide-y divide-slate-200 max-h-[300px] overflow-y-auto">
                {staged.map((row) => (
                  <div
                    key={row.id}
                    className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs font-medium text-slate-900 truncate">
                        {row.file.name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {formatFileSize(row.file.size)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={row.targetDialogueId}
                        onChange={(e) =>
                          handleUpdateTarget(row.id, e.target.value)
                        }
                        className="max-w-[260px] px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:border-[#0E2439]"
                      >
                        {sortedDialogues.map((d) => (
                          <option key={d.id} value={d.id}>
                            #{formatSequenceNumber(d.sequenceNumber)} — {d.sender} →{' '}
                            {d.receiver}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        aria-label={`Hapus ${row.file.name}`}
                        className="p-1.5 text-slate-400 hover:text-[#DC2626] rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={staged.length === 0 || saving}
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] disabled:opacity-50 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>
              {saving
                ? 'Menyimpan...'
                : `Simpan ${staged.length} File Audio`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
