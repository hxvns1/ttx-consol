import {
  BookOpen,
  Cloud,
  CloudOff,
  CloudUpload,
  Download,
  FileText,
  FolderUp,
  Headphones,
  Layers,
  LogIn,
  LogOut,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import type {
  CloudSyncStatus,
  PhaseId,
  ScenarioMeta,
  UserRole,
  WorkspaceView,
} from '../types/ttx';
import { SCENARIO_PHASES } from '../data/scenarioData';

interface SidebarProps {
  scenarioMeta: ScenarioMeta;
  activeView: WorkspaceView;
  onChangeView: (view: WorkspaceView) => void;
  onJumpToPhase: (phaseId: PhaseId) => void;
  phaseCounts: Record<PhaseId, { total: number; ready: number }>;
  totalDialogues: number;
  uploadedCount: number;
  playedCount: number;
  userRole: UserRole;
  isAdmin: boolean;
  canEdit: boolean;
  isEditLocked: boolean;
  adminCount: number;
  onOpenAdminModal: () => void;
  cloudUserEmail: string | null;
  cloudUserName: string | null;
  cloudSyncStatus: CloudSyncStatus;
  cloudSyncDetail: string | null;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  onPushLocalToCloud: () => void;
  onRefreshFromCloud: () => void;
  onOpenSavestates: () => void;
  savestateCount: number;
  onOpenBulkUpload: () => void;
  onExportPdf: () => void;
  onExportBundle: () => void;
  onImportBundle: (file: File) => void;
  onResetPlayed: () => void;
  isExporting: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  scenarioMeta,
  activeView,
  onChangeView,
  onJumpToPhase,
  phaseCounts,
  totalDialogues,
  uploadedCount,
  playedCount,
  isAdmin,
  canEdit,
  isEditLocked,
  adminCount,
  onOpenAdminModal,
  cloudUserEmail,
  cloudUserName,
  cloudSyncStatus,
  cloudSyncDetail,
  onSignInGoogle,
  onSignOutGoogle,
  onPushLocalToCloud,
  onRefreshFromCloud,
  onOpenSavestates,
  savestateCount,
  onOpenBulkUpload,
  onExportPdf,
  onExportBundle,
  onImportBundle,
  onResetPlayed,
  isExporting,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const readinessPct =
    totalDialogues > 0 ? Math.round((uploadedCount / totalDialogues) * 100) : 0;

  const isSignedIn = Boolean(cloudUserEmail);
  const isBusySyncing =
    cloudSyncStatus === 'connecting' || cloudSyncStatus === 'syncing';

  const syncStatusLabel =
    cloudSyncStatus === 'synced'
      ? isAdmin
        ? 'Terpublikasi ke Cloud Admin'
        : 'Tersambung ke skenario Admin'
      : cloudSyncStatus === 'syncing'
        ? cloudSyncDetail || 'Menyinkronkan data...'
        : cloudSyncStatus === 'connecting'
          ? 'Menghubungkan ke cloud...'
          : cloudSyncStatus === 'error'
            ? cloudSyncDetail || 'Gagal menyinkronkan'
            : 'Mode lokal (menunggu Cloud Admin)';

  const roleLine = isAdmin
    ? isEditLocked
      ? 'Mode Admin · Edit Terkunci'
      : 'Mode Admin · Edit Aktif'
    : 'Mode Pengguna · Hanya Putar';

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200 shrink-0">
        <div className="min-w-0">
          <div className="font-semibold text-[15px] tracking-tight text-[#0E2439] truncate">
            TTX Tanjung Api
          </div>
          <div
            className={`text-[11px] font-medium truncate ${
              isAdmin && !isEditLocked
                ? 'text-[#B45309]'
                : isAdmin
                  ? 'text-[#0E2439]'
                  : 'text-slate-500'
            }`}
            title={`${scenarioMeta.callSign} · ${roleLine}`}
          >
            {roleLine}
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Tutup menu navigasi"
          className="lg:hidden p-2 -mr-2 text-slate-500 hover:text-slate-900 rounded-md"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <nav aria-label="Navigasi utama" className="space-y-1">
          <div className="px-2.5 pb-1.5 text-[11px] font-medium text-slate-500">
            Ruang Kerja
          </div>
          <button
            type="button"
            onClick={() => {
              onChangeView('console');
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeView === 'console'
                ? 'bg-[#0E2439] text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Headphones className="w-4 h-4 shrink-0" />
              <span className="truncate">Konsol Dialog &amp; Audio</span>
            </span>
            <span
              className={`font-mono text-xs tabular-nums ${
                activeView === 'console' ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {totalDialogues}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onChangeView('reference');
              onCloseMobile();
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeView === 'reference'
                ? 'bg-[#0E2439] text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="truncate">Data Pokok &amp; SOP</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onChangeView('pdf');
              onCloseMobile();
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeView === 'pdf'
                ? 'bg-[#0E2439] text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate">Naskah PDF Asli</span>
          </button>
        </nav>

        {/* Phase Quick Jump */}
        <div className="space-y-1">
          <div className="px-2.5 pb-1.5 text-[11px] font-medium text-slate-500">
            Tahapan Dialog Skenario
          </div>
          {SCENARIO_PHASES.map((phase) => {
            const counts = phaseCounts[phase.id] ?? { total: 0, ready: 0 };
            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => {
                  onJumpToPhase(phase.id);
                  onCloseMobile();
                }}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-[13px] text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors text-left"
              >
                <span className="truncate font-medium">{phase.shortTitle}</span>
                <span className="font-mono text-[11px] tabular-nums text-slate-500 shrink-0">
                  {counts.ready}/{counts.total}
                </span>
              </button>
            );
          })}
        </div>

        {/* Readiness Progress */}
        <div className="px-2.5 pt-3 border-t border-slate-200 space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-700">Kesiapan Audio</span>
              <span className="font-mono tabular-nums text-slate-600">
                {uploadedCount}/{totalDialogues} ({readinessPct}%)
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0E2439] transition-all duration-200"
                style={{ width: `${readinessPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Sudah diputar</span>
            <span className="font-mono tabular-nums text-slate-700">
              {playedCount} / {totalDialogues}
            </span>
          </div>
        </div>

        {/* Account & Cloud Synchronization Panel */}
        <div className="px-2.5 pt-3 border-t border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500">
              Akun &amp; Cloud Skenario
            </span>
            {cloudSyncStatus === 'synced' || cloudSyncStatus === 'syncing' || isSignedIn ? (
              <Cloud
                className={`w-3.5 h-3.5 shrink-0 ${
                  cloudSyncStatus === 'error'
                    ? 'text-[#DC2626]'
                    : 'text-[#059669]'
                }`}
              />
            ) : (
              <CloudOff className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            )}
          </div>

          {isSignedIn ? (
            <div className="rounded-md border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="text-xs font-semibold text-[#0E2439] truncate">
                    {cloudUserName || 'Akun Google'}
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
                      isAdmin ? 'text-[#0E2439]' : 'text-slate-500'
                    }`}
                  >
                    {isAdmin ? 'Admin' : 'Pengguna'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {cloudUserEmail}
                </div>
              </div>

              <div
                className={`text-[11px] leading-snug flex items-start gap-1.5 ${
                  cloudSyncStatus === 'error'
                    ? 'text-[#DC2626] font-medium'
                    : cloudSyncStatus === 'synced'
                      ? 'text-[#059669]'
                      : 'text-slate-600'
                }`}
              >
                {isBusySyncing && (
                  <RefreshCw className="w-3 h-3 shrink-0 mt-0.5 animate-spin" />
                )}
                <span className="break-words">{syncStatusLabel}</span>
              </div>

              {!isAdmin && (
                <p className="text-[11px] text-slate-500 leading-snug">
                  Akun ini berada di Mode Pengguna (hanya putar &amp; baca).
                </p>
              )}

              <div className="flex items-center gap-1.5 pt-0.5">
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={onPushLocalToCloud}
                    disabled={isBusySyncing}
                    title="Publikasikan ulang seluruh data & audio lokal ke Cloud agar diterima semua Pengguna"
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium text-[#0E2439] bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    <CloudUpload className="w-3 h-3 shrink-0" />
                    <span>Sinkronkan</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onRefreshFromCloud}
                    disabled={isBusySyncing}
                    title="Muat ulang skenario & audio terbaru dari server Cloud Admin"
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium text-[#0E2439] bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    <RefreshCw
                      className={`w-3 h-3 shrink-0 ${isBusySyncing ? 'animate-spin' : ''}`}
                    />
                    <span>Segarkan</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSignOutGoogle}
                  className="inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:text-[#DC2626] hover:border-red-200 transition-colors whitespace-nowrap"
                >
                  <LogOut className="w-3 h-3 shrink-0" />
                  <span>Keluar</span>
                </button>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile();
                    onOpenAdminModal();
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#0E2439] bg-white border border-slate-200 rounded hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Kelola Admin ({adminCount})</span>
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
              <div
                className={`text-[11px] leading-snug flex items-start gap-1.5 ${
                  cloudSyncStatus === 'error'
                    ? 'text-[#DC2626] font-medium'
                    : cloudSyncStatus === 'synced'
                      ? 'text-[#059669]'
                      : 'text-slate-600'
                }`}
              >
                {isBusySyncing && (
                  <RefreshCw className="w-3 h-3 shrink-0 mt-0.5 animate-spin" />
                )}
                <span className="break-words">{syncStatusLabel}</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Skenario &amp; audio dimuat otomatis dari Cloud Admin. Masuk dengan akun Google Admin jika ingin mengedit.
              </p>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={onRefreshFromCloud}
                  disabled={isBusySyncing}
                  title="Muat ulang skenario & audio terbaru dari server Cloud Admin"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#0E2439] bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 shrink-0 ${isBusySyncing ? 'animate-spin' : ''}`}
                  />
                  <span>Segarkan dari Cloud</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile();
                    onSignInGoogle();
                  }}
                  disabled={isBusySyncing}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isBusySyncing ? 'Menghubungkan...' : 'Masuk Admin (Google)'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Facilitator File Tools */}
      <div className="p-3 border-t border-slate-200 space-y-1.5 shrink-0 bg-slate-50/70">
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onOpenSavestates();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] transition-colors whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>
              Kelola Savestate{savestateCount > 0 ? ` (${savestateCount})` : ''}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onExportPdf();
          }}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            canEdit
              ? 'text-[#0E2439] bg-white border border-slate-300 hover:bg-slate-100'
              : 'text-white bg-[#0E2439] hover:bg-[#193A58]'
          }`}
        >
          <Printer className="w-3.5 h-3.5 shrink-0" />
          <span>Ekspor PDF (Cetak)</span>
        </button>

        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => {
                onOpenBulkUpload();
                onCloseMobile();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-[#0E2439] bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <FolderUp className="w-3.5 h-3.5 shrink-0" />
              <span>Unggah Audio Massal</span>
            </button>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={onExportBundle}
                disabled={isExporting}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>{isExporting ? 'Ekspor...' : 'Ekspor'}</span>
              </button>

              <label className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap">
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span>Impor</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onImportBundle(file);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
          </>
        )}

        {playedCount > 0 && (
          <button
            type="button"
            onClick={onResetPlayed}
            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-md transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Reset Status Putar</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[280px] max-w-[85vw] h-full shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
