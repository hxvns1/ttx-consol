import { useEffect, useState } from 'react';
import {
  ArchiveRestore,
  BookmarkPlus,
  Check,
  Cloud,
  CloudUpload,
  HardDrive,
  Layers,
  Loader2,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import type { WorkspaceSavestate } from '../types/ttx';
import {
  MAX_SAVESTATE_NAME_LEN,
  MAX_SAVESTATE_NOTE_LEN,
} from '../lib/cloudSync';

interface CurrentWorkspaceSummary {
  blockCount: number;
  dialogueCount: number;
  narrativeCount: number;
  sopCount: number;
  audioCount: number;
}

interface SavestateModalProps {
  isOpen: boolean;
  savestates: WorkspaceSavestate[];
  currentSummary: CurrentWorkspaceSummary;
  isCloudConnected: boolean;
  busyMessage: string | null;
  onClose: () => void;
  onCreateSavestate: (name: string, note: string) => Promise<boolean>;
  onLoadSavestate: (
    savestate: WorkspaceSavestate,
    saveCurrentFirst: boolean,
  ) => Promise<boolean>;
  onOverwriteSavestate: (savestate: WorkspaceSavestate) => Promise<boolean>;
  onRenameSavestate: (
    savestateId: string,
    name: string,
    note: string,
  ) => Promise<boolean>;
  onDeleteSavestate: (savestate: WorkspaceSavestate) => Promise<boolean>;
  onSyncLocalSavestates: () => Promise<void>;
  onSyncSingleSavestate: (savestate: WorkspaceSavestate) => Promise<boolean>;
}

function formatSavedTimestamp(ms: number): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

export function SavestateModal({
  isOpen,
  savestates,
  currentSummary,
  isCloudConnected,
  busyMessage,
  onClose,
  onCreateSavestate,
  onLoadSavestate,
  onOverwriteSavestate,
  onRenameSavestate,
  onDeleteSavestate,
  onSyncLocalSavestates,
  onSyncSingleSavestate,
}: SavestateModalProps) {
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const unsyncedCount = savestates.filter((s) => !s.syncedToCloud).length;

  const [pendingLoad, setPendingLoad] = useState<WorkspaceSavestate | null>(null);
  const [pendingOverwriteId, setPendingOverwriteId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');

  const isBusy = Boolean(busyMessage);

  useEffect(() => {
    if (!isOpen) {
      setPendingLoad(null);
      setPendingOverwriteId(null);
      setPendingDeleteId(null);
      setEditingId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newName.trim();
    if (!trimmedName || isBusy) return;
    const ok = await onCreateSavestate(trimmedName, newNote.trim());
    if (ok) {
      setNewName('');
      setNewNote('');
    }
  };

  const handleStartRename = (state: WorkspaceSavestate) => {
    setPendingOverwriteId(null);
    setPendingDeleteId(null);
    setEditingId(state.id);
    setEditName(state.name);
    setEditNote(state.note || '');
  };

  const handleCommitRename = async (stateId: string) => {
    const trimmed = editName.trim();
    if (!trimmed || isBusy) return;
    const ok = await onRenameSavestate(stateId, trimmed, editNote.trim());
    if (ok) {
      setEditingId(null);
    }
  };

  const handleConfirmLoad = async (saveCurrentFirst: boolean) => {
    if (!pendingLoad || isBusy) return;
    const ok = await onLoadSavestate(pendingLoad, saveCurrentFirst);
    if (ok) {
      setPendingLoad(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/55">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="savestate-modal-title"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0E2439] shrink-0" />
              <h2
                id="savestate-modal-title"
                className="text-base font-bold text-[#0E2439]"
              >
                Kelola Savestate Halaman
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Simpan potret penuh seluruh teks naskah, blok, dialog, narasi, SOP, urutan SOP/blok, dan semua file audio agar Anda bebas bereksperimen tanpa mengubah versi asli.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Tutup panel savestate"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md disabled:opacity-40 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Busy Progress Banner */}
        {busyMessage && (
          <div className="px-5 py-2.5 bg-[#F0F7FF] border-b border-sky-200 flex items-center gap-2 text-xs font-medium text-[#0E2439] shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-[#0284C7]" />
            <span>{busyMessage}</span>
          </div>
        )}

        {/* Safe Load Confirmation View */}
        {pendingLoad ? (
          <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0E2439]">
                <ShieldCheck className="w-4 h-4 text-[#0E2439] shrink-0" />
                <span>Konfirmasi Muat Savestate</span>
              </div>
              <p className="text-sm text-slate-800 leading-relaxed">
                Anda akan memuat savestate{' '}
                <strong className="font-semibold text-[#0E2439]">
                  &ldquo;{pendingLoad.name}&rdquo;
                </strong>
                . Seluruh isi halaman aktif saat ini (teks dialog, narasi, SOP, urutan, dan file audio aktif) akan diganti dengan isi savestate tersebut.
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-mono tabular-nums">
                <span>
                  {
                    pendingLoad.dialogues.filter(
                      (d) => d.entryType !== 'narrative',
                    ).length
                  }{' '}
                  dialog
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {
                    pendingLoad.dialogues.filter(
                      (d) => d.entryType === 'narrative',
                    ).length
                  }{' '}
                  narasi
                </span>
                <span aria-hidden="true">·</span>
                <span>{pendingLoad.sopItems.length} SOP</span>
                <span aria-hidden="true">·</span>
                <span>{pendingLoad.audioRefs.length} file audio</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  void handleConfirmLoad(true);
                }}
                className="w-full flex items-center justify-center gap-2 min-h-[42px] px-4 py-2.5 text-xs font-semibold text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] disabled:opacity-50 transition-colors"
              >
                <BookmarkPlus className="w-4 h-4 shrink-0" />
                <span>Simpan Kondisi Aktif Dulu &amp; Muat Savestate</span>
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  void handleConfirmLoad(false);
                }}
                className="w-full flex items-center justify-center gap-2 min-h-[42px] px-4 py-2.5 text-xs font-medium text-[#B91C1C] bg-white border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <ArchiveRestore className="w-4 h-4 shrink-0" />
                <span>Langsung Muat Tanpa Menyimpan Kondisi Aktif</span>
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => setPendingLoad(null)}
                className="w-full min-h-[40px] px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
            {/* Section 1: Create New Savestate */}
            <form
              onSubmit={(e) => {
                void handleCreateSubmit(e);
              }}
              className="p-5 bg-slate-50/70 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="savestate-name-input"
                  className="text-xs font-semibold text-[#0E2439]"
                >
                  Buat Savestate Baru dari Kondisi Aktif
                </label>
                {savestates.length === 0 && !newName && (
                  <button
                    type="button"
                    onClick={() => setNewName('Versi Original')}
                    className="text-xs font-medium text-[#0284C7] hover:text-[#0369A1] underline underline-offset-2"
                  >
                    Gunakan nama &ldquo;Versi Original&rdquo;
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  id="savestate-name-input"
                  type="text"
                  maxLength={MAX_SAVESTATE_NAME_LEN}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={isBusy}
                  placeholder="Nama savestate (mis. Versi Original)"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0E2439]"
                />
                <input
                  type="text"
                  maxLength={MAX_SAVESTATE_NOTE_LEN}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  disabled={isBusy}
                  placeholder="Catatan singkat (opsional)"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0E2439]"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
                <div className="text-xs text-slate-600 font-mono tabular-nums">
                  Tercakup: {currentSummary.blockCount} blok ·{' '}
                  {currentSummary.dialogueCount} dialog ·{' '}
                  {currentSummary.narrativeCount} narasi ·{' '}
                  {currentSummary.sopCount} SOP ·{' '}
                  <strong className="font-semibold text-[#0E2439]">
                    {currentSummary.audioCount} audio
                  </strong>
                </div>

                <button
                  type="submit"
                  disabled={isBusy || !newName.trim()}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 shrink-0" />
                  <span>Simpan Kondisi Saat Ini</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                {isCloudConnected
                  ? 'Savestate dan file audionya (maks. 10 MB per file) akan disimpan lokal sekaligus disinkronkan ke Cloud Google.'
                  : 'Mode lokal aktif: savestate disimpan di browser perangkat ini. Masuk Cloud Google kapan saja untuk sinkronisasi antar-perangkat.'}
              </p>
            </form>

            {/* Section 2: Saved Savestates List */}
            <div className="p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-700">
                  Daftar Savestate Tersimpan ({savestates.length})
                </h3>
                {isCloudConnected && unsyncedCount > 0 && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      void onSyncLocalSavestates();
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-white bg-[#0E2439] rounded hover:bg-[#193A58] disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    <CloudUpload className="w-3.5 h-3.5 shrink-0" />
                    <span>Sinkronkan Semua ke Cloud ({unsyncedCount})</span>
                  </button>
                )}
              </div>

              {savestates.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center space-y-1.5">
                  <p className="text-sm font-medium text-slate-800">
                    Belum ada savestate tersimpan
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Simpan kondisi awal halaman sebagai &ldquo;Versi Original&rdquo; terlebih dahulu sebelum mengotak-atik teks, urutan SOP/blok, atau audio.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savestates.map((state) => {
                    const dlgCount = state.dialogues.filter(
                      (d) => d.entryType !== 'narrative',
                    ).length;
                    const narCount = state.dialogues.filter(
                      (d) => d.entryType === 'narrative',
                    ).length;
                    const isEditing = editingId === state.id;
                    const isConfirmingOverwrite = pendingOverwriteId === state.id;
                    const isConfirmingDelete = pendingDeleteId === state.id;

                    return (
                      <div
                        key={state.id}
                        className="rounded-md border border-slate-200 bg-white p-4 space-y-3"
                      >
                        {isEditing ? (
                          <div className="space-y-2.5">
                            <input
                              type="text"
                              maxLength={MAX_SAVESTATE_NAME_LEN}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              disabled={isBusy}
                              aria-label="Ubah nama savestate"
                              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-[#0E2439]"
                            />
                            <input
                              type="text"
                              maxLength={MAX_SAVESTATE_NOTE_LEN}
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              disabled={isBusy}
                              placeholder="Catatan singkat (opsional)"
                              aria-label="Ubah catatan savestate"
                              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-700 focus:outline-none focus:border-[#0E2439]"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                disabled={isBusy || !editName.trim()}
                                onClick={() => {
                                  void handleCommitRename(state.id);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Simpan Nama</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-[#0E2439] break-words">
                                  {state.name}
                                </div>
                                {state.note && (
                                  <p className="text-xs text-slate-600 mt-0.5 break-words">
                                    {state.note}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 text-[11px] shrink-0">
                                {state.syncedToCloud ? (
                                  <span className="inline-flex items-center gap-1 text-[#059669] font-medium whitespace-nowrap">
                                    <Cloud className="w-3.5 h-3.5 shrink-0" />
                                    <span>Lokal &amp; Cloud</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-slate-500 whitespace-nowrap">
                                    <HardDrive className="w-3.5 h-3.5 shrink-0" />
                                    <span>Lokal Perangkat</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 font-mono tabular-nums">
                              <span>{formatSavedTimestamp(state.updatedAt)}</span>
                              <span aria-hidden="true">·</span>
                              <span>{dlgCount} dialog</span>
                              <span aria-hidden="true">·</span>
                              <span>{narCount} narasi</span>
                              <span aria-hidden="true">·</span>
                              <span>{state.sopItems.length} SOP</span>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-700 font-medium">
                                {state.audioRefs.length} audio
                              </span>
                            </div>

                            {/* Inline Confirmation for Overwrite */}
                            {isConfirmingOverwrite && (
                              <div className="rounded border border-amber-200 bg-amber-50/70 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <span className="text-xs text-amber-900">
                                  Timpa savestate ini dengan kondisi halaman aktif saat ini?
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => setPendingOverwriteId(null)}
                                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                                  >
                                    Batal
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      const ok = await onOverwriteSavestate(state);
                                      if (ok) setPendingOverwriteId(null);
                                    }}
                                    className="px-2.5 py-1.5 text-xs font-medium text-white bg-[#0E2439] rounded hover:bg-[#193A58] disabled:opacity-50"
                                  >
                                    Ya, Timpa
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Inline Confirmation for Delete */}
                            {isConfirmingDelete && (
                              <div className="rounded border border-red-200 bg-red-50/70 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <span className="text-xs text-red-900">
                                  Hapus savestate &ldquo;{state.name}&rdquo;? Halaman aktif saat ini tidak berubah.
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => setPendingDeleteId(null)}
                                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                                  >
                                    Batal
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      const ok = await onDeleteSavestate(state);
                                      if (ok) setPendingDeleteId(null);
                                    }}
                                    className="px-2.5 py-1.5 text-xs font-medium text-white bg-[#DC2626] rounded hover:bg-[#B91C1C] disabled:opacity-50"
                                  >
                                    Hapus Permanen
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Action Row */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setPendingOverwriteId(null);
                                  setPendingDeleteId(null);
                                  setPendingLoad(state);
                                }}
                                className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                              >
                                <ArchiveRestore className="w-3.5 h-3.5 shrink-0" />
                                <span>Muat</span>
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setPendingDeleteId(null);
                                  setPendingOverwriteId(
                                    isConfirmingOverwrite ? null : state.id,
                                  );
                                }}
                                title="Perbarui isi savestate ini dengan kondisi halaman aktif sekarang"
                                className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                              >
                                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                                <span>Perbarui</span>
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleStartRename(state)}
                                className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                              >
                                <Pencil className="w-3.5 h-3.5 shrink-0" />
                                <span>Ubah Nama</span>
                              </button>

                              {isCloudConnected && !state.syncedToCloud && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => {
                                    void onSyncSingleSavestate(state);
                                  }}
                                  title="Unggah savestate lokal ini beserta audionya ke Cloud Google Anda"
                                  className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-medium text-[#0E2439] bg-sky-50 border border-sky-200 rounded-md hover:bg-sky-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                                >
                                  <CloudUpload className="w-3.5 h-3.5 shrink-0" />
                                  <span>Sinkronkan ke Cloud</span>
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setPendingOverwriteId(null);
                                  setPendingDeleteId(
                                    isConfirmingDelete ? null : state.id,
                                  );
                                }}
                                className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-medium text-[#B91C1C] bg-white border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
