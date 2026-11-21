import React, { useState } from 'react';
import { ShieldCheck, Trash2, UserPlus, X } from 'lucide-react';
import type { AdminEntryRecord } from '../types/ttx';
import { isValidAdminEmail, normalizeAdminEmail } from '../lib/cloudSync';

interface AdminManagementModalProps {
  open: boolean;
  currentUserEmail: string | null;
  admins: AdminEntryRecord[];
  onClose: () => void;
  onAddAdmin: (email: string, note: string) => Promise<void>;
  onRemoveAdmin: (email: string) => Promise<void>;
}

export const AdminManagementModal: React.FC<AdminManagementModalProps> = ({
  open,
  currentUserEmail,
  admins,
  onClose,
  onAddAdmin,
  onRemoveAdmin,
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [confirmRemoveEmail, setConfirmRemoveEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const normalizedCurrent = currentUserEmail
    ? normalizeAdminEmail(currentUserEmail)
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const normalized = normalizeAdminEmail(emailInput);
    if (!isValidAdminEmail(normalized)) {
      setErrorMsg('Masukkan alamat email Google yang valid (contoh: nama@gmail.com).');
      return;
    }

    if (admins.some((a) => normalizeAdminEmail(a.email) === normalized)) {
      setErrorMsg('Email tersebut sudah terdaftar sebagai Admin.');
      return;
    }

    setSubmitting(true);
    try {
      await onAddAdmin(normalized, noteInput.trim());
      setEmailInput('');
      setNoteInput('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menambahkan akun Admin.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRemove = async (email: string) => {
    setErrorMsg(null);
    setRemovingEmail(email);
    try {
      await onRemoveAdmin(email);
      setConfirmRemoveEmail(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menghapus akses Admin.',
      );
    } finally {
      setRemovingEmail(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-management-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 shrink-0 text-[#0E2439]" />
              <h2
                id="admin-management-title"
                className="text-base font-bold text-[#0F172A]"
              >
                Kelola Akses Admin
              </h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
              Akun Google di daftar ini dapat membuka Kunci Edit dan menyinkronkan perubahan skenario serta audio ke semua perangkat Pengguna.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-[#64748B] transition-colors hover:border-[#CBD5E1] hover:bg-white hover:text-[#0F172A]"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Add Admin Form */}
          <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#475569]">
              Tambah Akun Google Admin
            </p>
            <div className="space-y-2.5">
              <div>
                <label
                  htmlFor="admin-email-input"
                  className="mb-1 block text-xs font-medium text-[#334155]"
                >
                  Email Akun Google
                </label>
                <input
                  id="admin-email-input"
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="fasilitator@gmail.com"
                  className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0E2439] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="admin-note-input"
                  className="mb-1 block text-xs font-medium text-[#334155]"
                >
                  Catatan Jabatan / Nama (Opsional)
                </label>
                <input
                  id="admin-note-input"
                  type="text"
                  maxLength={120}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Contoh: Koordinator Latihan / Operator TTX"
                  className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0E2439] focus:outline-none"
                />
              </div>
            </div>

            {errorMsg && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !emailInput.trim()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0E2439] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#1B3A57] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {submitting ? 'Menambahkan...' : 'Tambahkan Sebagai Admin'}
            </button>
          </form>

          {/* Current Admin List */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                Daftar Admin Terdaftar ({admins.length})
              </p>
              <span className="text-[11px] text-[#64748B]">
                Akun lain otomatis Mode Pengguna
              </span>
            </div>

            <div className="divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0] bg-white">
              {admins.map((admin) => {
                const isSelf = normalizeAdminEmail(admin.email) === normalizedCurrent;
                const isConfirming = confirmRemoveEmail === admin.email;
                const isRemoving = removingEmail === admin.email;

                return (
                  <div
                    key={admin.email}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-mono text-xs font-semibold text-[#0F172A]">
                          {admin.email}
                        </span>
                        {admin.isPrimary && (
                          <span className="rounded border border-[#CBD5E1] bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0E2439]">
                            Utama
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[11px] font-medium text-[#059669]">
                            (Anda)
                          </span>
                        )}
                      </div>
                      {admin.note && (
                        <p className="mt-0.5 truncate text-xs text-[#64748B]">
                          {admin.note}
                        </p>
                      )}
                    </div>

                    {!admin.isPrimary && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        {isConfirming ? (
                          <>
                            <button
                              type="button"
                              disabled={isRemoving}
                              onClick={() => handleConfirmRemove(admin.email)}
                              className="h-8 rounded-lg bg-[#DC2626] px-2.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                            >
                              {isRemoving ? 'Menghapus...' : 'Ya, Cabut'}
                            </button>
                            <button
                              type="button"
                              disabled={isRemoving}
                              onClick={() => setConfirmRemoveEmail(null)}
                              className="h-8 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs font-medium text-[#475569] hover:bg-[#F8FAFC]"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveEmail(admin.email)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-xs font-medium text-[#64748B] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-[#DC2626]"
                            title="Cabut akses Admin"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Cabut
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[#CBD5E1] bg-white px-4 text-xs font-semibold text-[#0F172A] transition-colors hover:bg-[#F1F5F9]"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
