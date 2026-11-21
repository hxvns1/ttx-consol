import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type {
  BlockEntryType,
  CommunicationBlock,
  DialogueItem,
} from '../types/ttx';

interface DialogueEditorModalProps {
  isOpen: boolean;
  blocks: CommunicationBlock[];
  editingDialogue: DialogueItem | null;
  defaultBlockId: string;
  defaultEntryType: BlockEntryType;
  insertAfterDialogueId?: string | null;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    entryType: BlockEntryType;
    blockId: string;
    insertAfterDialogueId?: string | null;
    title: string;
    sender: string;
    receiver: string;
    transcript: string;
    note: string;
    pageNumber: number;
    isEmergencyPriority: boolean;
  }) => void;
}

export function DialogueEditorModal({
  isOpen,
  blocks,
  editingDialogue,
  defaultBlockId,
  defaultEntryType,
  insertAfterDialogueId,
  onClose,
  onSave,
}: DialogueEditorModalProps) {
  const [entryType, setEntryType] = useState<BlockEntryType>(defaultEntryType);
  const [blockId, setBlockId] = useState(defaultBlockId);
  const [title, setTitle] = useState('');
  const [sender, setSender] = useState('');
  const [receiver, setReceiver] = useState('');
  const [transcript, setTranscript] = useState('');
  const [note, setNote] = useState('');
  const [pageNumber, setPageNumber] = useState('1');
  const [isEmergencyPriority, setIsEmergencyPriority] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingDialogue) {
      setEntryType(editingDialogue.entryType ?? 'dialogue');
      setBlockId(editingDialogue.blockId);
      setTitle(editingDialogue.title ?? '');
      setSender(editingDialogue.sender);
      setReceiver(editingDialogue.receiver);
      setTranscript(editingDialogue.transcript);
      setNote(editingDialogue.note ?? '');
      setPageNumber(String(editingDialogue.pageNumber));
      setIsEmergencyPriority(Boolean(editingDialogue.isEmergencyPriority));
    } else {
      const targetId = defaultBlockId || blocks[0]?.id || '';
      const targetBlock = blocks.find((b) => b.id === targetId);
      setEntryType(defaultEntryType);
      setBlockId(targetId);
      setTitle('');
      setSender('');
      setReceiver('');
      setTranscript('');
      setNote('');
      setPageNumber(String(targetBlock?.pageNumber ?? 1));
      setIsEmergencyPriority(false);
    }
  }, [isOpen, editingDialogue, defaultBlockId, defaultEntryType, blocks]);

  if (!isOpen) return null;

  const isNarrative = entryType === 'narrative';

  const canSubmit = isNarrative
    ? blockId.length > 0 && transcript.trim().length > 0
    : blockId.length > 0 &&
      sender.trim().length > 0 &&
      receiver.trim().length > 0 &&
      transcript.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave({
      id: editingDialogue?.id,
      entryType,
      blockId,
      insertAfterDialogueId: editingDialogue ? null : insertAfterDialogueId,
      title: isNarrative ? title.trim() : '',
      sender: isNarrative ? '' : sender.trim(),
      receiver: isNarrative ? '' : receiver.trim(),
      transcript: transcript.trim(),
      note: note.trim(),
      pageNumber: Math.max(1, parseInt(pageNumber, 10) || 1),
      isEmergencyPriority: isNarrative ? false : isEmergencyPriority,
    });
    onClose();
  };

  const modalTitle = editingDialogue
    ? isNarrative
      ? 'Edit Narasi di Dalam Blok'
      : 'Edit Percakapan Skenario'
    : insertAfterDialogueId
      ? isNarrative
        ? 'Sisipkan Narasi Baru'
        : 'Sisipkan Percakapan Baru'
      : isNarrative
        ? 'Tambah Narasi di Dalam Blok'
        : 'Tambah Percakapan Baru';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialogue-editor-title"
        className="w-full max-w-lg bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2
            id="dialogue-editor-title"
            className="text-base font-bold text-[#0E2439]"
          >
            {modalTitle}
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
          {/* Entry type selector when adding a new item */}
          {!editingDialogue && (
            <div>
              <span className="block text-xs font-medium text-slate-700 mb-1.5">
                Jenis Item
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
                <button
                  type="button"
                  onClick={() => setEntryType('dialogue')}
                  className={`py-1.5 px-3 text-xs font-medium rounded transition-colors ${
                    entryType === 'dialogue'
                      ? 'bg-white text-[#0E2439] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Percakapan (dengan Audio)
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('narrative')}
                  className={`py-1.5 px-3 text-xs font-medium rounded transition-colors ${
                    entryType === 'narrative'
                      ? 'bg-white text-[#0E2439] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Narasi (Audio Gemini)
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Blok Komunikasi
              </label>
              <select
                value={blockId}
                onChange={(e) => setBlockId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
              >
                {blocks.map((blk) => (
                  <option key={blk.id} value={blk.id}>
                    {blk.code} — {blk.title}
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

          {isNarrative ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Judul / Label Narasi (Opsional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Situasi Pendekatan Akhir / Transisi Kejadian"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pengirim / Pembicara
                </label>
                <input
                  type="text"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  placeholder="Contoh: Pilot, TW, OSC"
                  required
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Penerima
                </label>
                <input
                  type="text"
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder="Contoh: TW, PKP-PK, EOC"
                  required
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {isNarrative ? 'Isi Narasi' : 'Naskah Percakapan'}
            </label>
            <textarea
              rows={4}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={
                isNarrative
                  ? 'Tuliskan narasi situasi atau keterangan skenario yang terjadi pada titik ini...'
                  : 'Tulis teks percakapan yang akan diputar pada skenario ini...'
              }
              required
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Catatan Fasilitator (Opsional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Jeda diskusi 2 menit sebelum lanjut ke dialog berikutnya"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
            />
          </div>

          {!isNarrative && (
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isEmergencyPriority}
                onChange={(e) => setIsEmergencyPriority(e.target.checked)}
                className="rounded border-slate-300 text-[#0E2439]"
              />
              <span>
                Tandai sebagai dialog prioritas darurat (MAYDAY / Full Emergency)
              </span>
            </label>
          )}

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
              {editingDialogue
                ? 'Simpan Perubahan'
                : isNarrative
                  ? 'Tambahkan Narasi'
                  : 'Tambahkan Dialog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
