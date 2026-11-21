import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cloud,
  Lock,
  LockOpen,
  Menu,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
  X,
} from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type {
  AdminEntryRecord,
  AudioEntryView,
  AudioFilter,
  AudioVaultRecord,
  BlockEntryType,
  CloudSyncStatus,
  CommunicationBlock,
  DialogueItem,
  GeminiTtsVoice,
  IncidentNarrative,
  PhaseId,
  PhaseSopPositions,
  SavestateAudioRef,
  ScenarioMeta,
  SopItem,
  StoredAudioRecord,
  UserRole,
  WorkspaceSavestate,
  WorkspaceView,
} from './types/ttx';
import {
  COMMUNICATION_BLOCKS,
  DEFAULT_SCENARIO_META,
  INITIAL_DIALOGUES,
  SCENARIO_PHASES,
  SOP_ITEMS,
  TOUCHDOWN_NARRATIVE,
} from './data/scenarioData';
import {
  clearAllAudioRecords,
  createBackupBundle,
  deleteAudioRecord,
  deleteSavestateRecord,
  getAllAudioRecords,
  getAllSavestates,
  getAudioVaultRecord,
  getStateValue,
  pruneUnreferencedVaultAudios,
  restoreBackupBundle,
  saveAudioRecord,
  saveAudioVaultRecord,
  saveSavestateRecord,
  saveStateValue,
  type TtxBackupBundle,
} from './lib/audioDb';
import { auth, signInWithGoogle, signOutUser } from './lib/firebase';
import {
  addAdminEntry,
  buildVaultAssetId,
  checkUserIsAdmin,
  createAudioRevision,
  createSavestateId,
  DEFAULT_PHASE_SOP_POSITIONS,
  deleteSavestateFromCloud,
  deleteSharedAudioFromCloud,
  downloadAudioFromCloud,
  downloadSavestateAudioAssetFromCloud,
  downloadSharedAudioFromCloud,
  ensureCloudWorkspace,
  ensureSharedWorkspace,
  ensureUserProfile,
  fetchExistingSavestateAudioIds,
  fetchSharedAudiosFromServer,
  fetchSharedWorkspaceFromServer,
  pushSharedWorkspaceUpdate,
  removeAdminEntry,
  renameSavestateInCloud,
  runWithConcurrency,
  sanitizeScenarioMeta,
  sanitizeSopPositions,
  saveSavestateToCloud,
  subscribeAdminEntries,
  subscribeCloudSavestates,
  subscribeSharedAudios,
  subscribeSharedWorkspace,
  uploadSavestateAudioAssetToCloud,
  uploadSharedAudioToCloud,
  type SharedCloudAudioMeta,
  type SharedWorkspacePayload,
} from './lib/cloudSync';
import {
  formatSequenceNumber,
  isValidAudioFile,
  probeAudioDuration,
} from './lib/formatters';
import { Sidebar } from './components/Sidebar';
import { DialogueConsoleView } from './components/DialogueConsoleView';
import { SopReferenceView } from './components/SopReferenceView';
import { PdfViewerView } from './components/PdfViewerView';
import { BulkUploadModal } from './components/BulkUploadModal';
import { DialogueEditorModal } from './components/DialogueEditorModal';
import { BlockEditorModal } from './components/BlockEditorModal';
import { SopEditorModal } from './components/SopEditorModal';
import { NarrativeEditorModal } from './components/NarrativeEditorModal';
import { ScenarioMetaEditorModal } from './components/ScenarioMetaEditorModal';
import { NarrativeTtsModal } from './components/NarrativeTtsModal';
import { VoiceRecorderModal } from './components/VoiceRecorderModal';
import { SavestateModal } from './components/SavestateModal';
import { ConfirmModal } from './components/ConfirmModal';
import { AdminManagementModal } from './components/AdminManagementModal';
import { PrintDocumentView } from './components/PrintDocumentView';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

type PendingDelete =
  | { kind: 'dialogue'; dialogue: DialogueItem }
  | { kind: 'audio'; dialogue: DialogueItem }
  | { kind: 'block'; block: CommunicationBlock; dialogueCount: number }
  | { kind: 'sop'; sop: SopItem };

const PHASE_SOP_TITLE: Record<PhaseId, string> = {
  'fase-2': 'II. Fase Udara — Kesiapsiagaan Awal',
  'fase-3': 'III. Rantai Komando & Mobilisasi',
  'fase-4': 'IV. Pemadaman Api & Penyelamatan Kabin',
  'fase-6': 'VI. Penutupan Operasi & Pemulihan Bandara',
};

function normalizeBlocksOrder(blocks: CommunicationBlock[]): CommunicationBlock[] {
  const ordered: CommunicationBlock[] = [];
  for (const phase of SCENARIO_PHASES) {
    for (const blk of blocks) {
      if (blk.phaseId === phase.id) {
        ordered.push(blk);
      }
    }
  }
  return ordered;
}

function normalizeSopsOrder(items: SopItem[]): SopItem[] {
  const ordered: SopItem[] = [];
  for (const phase of SCENARIO_PHASES) {
    for (const sop of items) {
      if (sop.phaseId === phase.id) {
        ordered.push({
          ...sop,
          phaseTitle: PHASE_SOP_TITLE[phase.id],
        });
      }
    }
  }
  return ordered;
}

/**
 * Aligns all block entries (dialogues & interleaved narratives) to the visual block order,
 * preserving relative order within each block. Only dialogue items increment sequenceNumber;
 * narrative items receive sequenceNumber = 0 so dialogue numbering remains uninterrupted.
 */
function renumberDialogues(
  blocks: CommunicationBlock[],
  items: DialogueItem[],
): DialogueItem[] {
  const orderedBlocks = normalizeBlocksOrder(blocks);
  const blockRank = new Map(orderedBlocks.map((b, idx) => [b.id, idx]));
  const blockPhaseMap = new Map(orderedBlocks.map((b) => [b.id, b.phaseId]));

  const withIndex = items.map((item, idx) => ({ item, idx }));
  withIndex.sort((a, b) => {
    const ba = blockRank.get(a.item.blockId) ?? 9999;
    const bb = blockRank.get(b.item.blockId) ?? 9999;
    if (ba !== bb) return ba - bb;
    return a.idx - b.idx;
  });

  let dialogueCounter = 0;
  return withIndex.map(({ item }) => {
    const isNarrative = item.entryType === 'narrative';
    if (!isNarrative) {
      dialogueCounter += 1;
    }
    return {
      ...item,
      phaseId: blockPhaseMap.get(item.blockId) ?? item.phaseId,
      sequenceNumber: isNarrative ? 0 : dialogueCounter,
    };
  });
}

export default function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>('console');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [blocks, setBlocks] = useState<CommunicationBlock[]>(COMMUNICATION_BLOCKS);
  const [dialogues, setDialogues] = useState<DialogueItem[]>(INITIAL_DIALOGUES);
  const [sopItems, setSopItems] = useState<SopItem[]>(SOP_ITEMS);
  const [sopPositions, setSopPositions] = useState<PhaseSopPositions>(
    DEFAULT_PHASE_SOP_POSITIONS,
  );
  const [incidentNarrative, setIncidentNarrative] =
    useState<IncidentNarrative>(TOUCHDOWN_NARRATIVE);
  const [scenarioMeta, setScenarioMeta] = useState<ScenarioMeta>(
    DEFAULT_SCENARIO_META,
  );
  const [audioMap, setAudioMap] = useState<Record<string, AudioEntryView>>({});
  const [playedIds, setPlayedIds] = useState<string[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [audioFilter, setAudioFilter] = useState<AudioFilter>('all');
  const [speakerFilter, setSpeakerFilter] = useState('all');

  // Audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioMapRef = useRef<Record<string, AudioEntryView>>({});
  const queueRef = useRef<string[]>([]);
  const gapTimerRef = useRef<number | null>(null);
  const sequenceGapRef = useRef<number>(2);

  const [activeDialogueId, setActiveDialogueId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSequenceActive, setIsSequenceActive] = useState(false);
  const [sequenceQueueRemaining, setSequenceQueueRemaining] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeDuration, setActiveDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [sequenceGapSeconds, setSequenceGapSeconds] = useState(2);

  // Modals & status
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDialogue, setEditingDialogue] = useState<DialogueItem | null>(null);
  const [editorDefaultBlockId, setEditorDefaultBlockId] = useState(
    COMMUNICATION_BLOCKS[0].id,
  );
  const [editorDefaultEntryType, setEditorDefaultEntryType] =
    useState<BlockEntryType>('dialogue');
  const [insertAfterDialogueId, setInsertAfterDialogueId] = useState<string | null>(
    null,
  );

  const [blockEditorOpen, setBlockEditorOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<CommunicationBlock | null>(null);
  const [blockDefaultPhaseId, setBlockDefaultPhaseId] = useState<PhaseId>('fase-2');

  const [sopEditorOpen, setSopEditorOpen] = useState(false);
  const [editingSop, setEditingSop] = useState<SopItem | null>(null);
  const [sopDefaultPhaseId, setSopDefaultPhaseId] = useState<PhaseId>('fase-2');

  const [narrativeEditorOpen, setNarrativeEditorOpen] = useState(false);
  const [scenarioMetaEditorOpen, setScenarioMetaEditorOpen] = useState(false);
  const [recordingTargetDialogue, setRecordingTargetDialogue] =
    useState<DialogueItem | null>(null);

  const [ttsTargetNarrative, setTtsTargetNarrative] =
    useState<DialogueItem | null>(null);
  const [generatingTtsId, setGeneratingTtsId] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [savestates, setSavestates] = useState<WorkspaceSavestate[]>([]);
  const [savestateModalOpen, setSavestateModalOpen] = useState(false);
  const [savestateBusyMessage, setSavestateBusyMessage] = useState<string | null>(
    null,
  );
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Cloud authentication, RBAC role & Edit Lock state
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [isEditLocked, setIsEditLocked] = useState(true);
  const [adminEntries, setAdminEntries] = useState<AdminEntryRecord[]>([]);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] =
    useState<CloudSyncStatus>('connecting');
  const [cloudSyncDetail, setCloudSyncDetail] = useState<string | null>(
    'Memuat data dari Cloud Admin...',
  );

  const isAdmin = userRole === 'admin';
  const canEdit = isAdmin && !isEditLocked;

  const authUserRef = useRef<User | null>(null);
  const isAdminRef = useRef(false);
  const canEditRef = useRef(false);
  const sharedCloudReadyRef = useRef(false);
  const sharedWorkspaceExistsRef = useRef(false);
  const privateCloudReadyRef = useRef(false);
  const ensureSharedReadyPromiseRef = useRef<Promise<boolean> | null>(null);
  const ensurePrivateReadyPromiseRef = useRef<Promise<boolean> | null>(null);
  const cloudWriteQuotaExceededRef = useRef(false);
  const pendingWorkspacePatchRef = useRef<Partial<SharedWorkspacePayload> | null>(
    null,
  );
  const workspaceSyncTimerRef = useRef<number | null>(null);
  const workspaceSyncInFlightRef = useRef(false);
  const blocksRef = useRef<CommunicationBlock[]>(blocks);
  const dialoguesRef = useRef<DialogueItem[]>(dialogues);
  const sopItemsRef = useRef<SopItem[]>(sopItems);
  const sopPositionsRef = useRef<PhaseSopPositions>(sopPositions);
  const incidentNarrativeRef = useRef<IncidentNarrative>(incidentNarrative);
  const scenarioMetaRef = useRef<ScenarioMeta>(scenarioMeta);
  const playedIdsRef = useRef<string[]>(playedIds);
  const savestatesRef = useRef<WorkspaceSavestate[]>(savestates);
  const savingSavestateIdsRef = useRef<Set<string>>(new Set());
  const uploadingAudioIdsRef = useRef<Set<string>>(new Set());
  const downloadingAudioRevsRef = useRef<Map<string, string>>(new Map());
  const knownCloudAudioIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    audioMapRef.current = audioMap;
  }, [audioMap]);

  useEffect(() => {
    sequenceGapRef.current = sequenceGapSeconds;
  }, [sequenceGapSeconds]);

  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);

  useEffect(() => {
    isAdminRef.current = isAdmin;
    canEditRef.current = canEdit;
  }, [isAdmin, canEdit]);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    dialoguesRef.current = dialogues;
  }, [dialogues]);

  useEffect(() => {
    sopItemsRef.current = sopItems;
  }, [sopItems]);

  useEffect(() => {
    sopPositionsRef.current = sopPositions;
  }, [sopPositions]);

  useEffect(() => {
    incidentNarrativeRef.current = incidentNarrative;
  }, [incidentNarrative]);

  useEffect(() => {
    scenarioMetaRef.current = scenarioMeta;
  }, [scenarioMeta]);

  useEffect(() => {
    playedIdsRef.current = playedIds;
  }, [playedIds]);

  useEffect(() => {
    savestatesRef.current = savestates;
  }, [savestates]);

  const showToast = useCallback((text: string, tone: 'info' | 'error' = 'info') => {
    const id = Date.now();
    setToast({ id, text, tone });
    window.setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4200);
  }, []);

  const closeAllEditModals = useCallback(() => {
    setBulkUploadOpen(false);
    setEditorOpen(false);
    setInsertAfterDialogueId(null);
    setBlockEditorOpen(false);
    setSopEditorOpen(false);
    setNarrativeEditorOpen(false);
    setScenarioMetaEditorOpen(false);
    setRecordingTargetDialogue(null);
    setTtsTargetNarrative(null);
    setTtsError(null);
    setPendingDelete(null);
    setSavestateModalOpen(false);
  }, []);

  const requireEditAccess = useCallback((): boolean => {
    if (canEditRef.current) return true;
    showToast(
      isAdminRef.current
        ? 'Edit sedang terkunci. Buka Kunci Edit di bilah atas terlebih dahulu.'
        : 'Mode Pengguna hanya dapat memutar audio dan melihat naskah.',
      'error',
    );
    return false;
  }, [showToast]);

  const handleToggleEditLock = useCallback(() => {
    if (!isAdminRef.current) return;
    setIsEditLocked((prev) => {
      const nextLocked = !prev;
      canEditRef.current = !nextLocked;
      if (nextLocked) {
        closeAllEditModals();
        showToast('Edit dikunci. Halaman aman dari perubahan tidak sengaja.');
      } else {
        showToast(
          'Mode Edit Aktif. Perubahan teks & audio otomatis tersinkron ke semua Pengguna.',
        );
      }
      return nextLocked;
    });
  }, [closeAllEditModals, showToast]);

  const isFirestoreQuotaError = useCallback((err: unknown): boolean => {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const lower = rawMsg.toLowerCase();
    return (
      lower.includes('resource-exhausted') ||
      lower.includes('quota exceeded') ||
      lower.includes('quota limit exceeded')
    );
  }, []);

  const reportCloudError = useCallback(
    (err: unknown, fallbackMsg: string) => {
      const rawMsg = err instanceof Error ? err.message : String(err);
      let innerMsg = rawMsg;
      try {
        const parsed = JSON.parse(rawMsg) as { error?: string };
        if (parsed && typeof parsed.error === 'string') {
          innerMsg = parsed.error;
        }
      } catch {
        // Not a JSON-wrapped Firestore error
      }
      const lower = innerMsg.toLowerCase();
      let friendly = fallbackMsg;

      if (
        lower.includes('quota exceeded') ||
        lower.includes('quota limit exceeded') ||
        lower.includes('resource-exhausted')
      ) {
        cloudWriteQuotaExceededRef.current = true;
        friendly =
          'Kuota tulis harian Cloud (Firestore gratis) sudah habis dan akan direset besok. Perubahan tetap tersimpan aman secara lokal.';
      } else if (
        lower.includes('permission-denied') ||
        lower.includes('missing or insufficient permissions')
      ) {
        friendly = isAdminRef.current
          ? 'Izin Cloud ditolak. Pastikan email akun Anda terdaftar sebagai Admin.'
          : 'Akses Cloud ditolak. Coba segarkan halaman atau masuk ulang.';
      } else if (
        lower.includes('unavailable') ||
        lower.includes('offline') ||
        lower.includes('network') ||
        lower.includes('deadline-exceeded')
      ) {
        friendly =
          'Koneksi ke server Cloud terganggu. Periksa internet lalu coba Sinkronkan/Segarkan.';
      } else if (
        lower.includes('exceeds the maximum allowed size') ||
        lower.includes('invalid-argument')
      ) {
        friendly =
          'Data atau ukuran audio melebihi batas Cloud (maks. 10 MB per audio).';
      }

      setCloudSyncStatus('error');
      setCloudSyncDetail(friendly);
      showToast(friendly, 'error');
    },
    [showToast],
  );

  const applySharedWorkspaceData = useCallback(
    (remote: SharedWorkspacePayload) => {
      sharedWorkspaceExistsRef.current = true;
      const normalizedBlocks =
        remote.blocks.length > 0
          ? normalizeBlocksOrder(remote.blocks)
          : COMMUNICATION_BLOCKS;
      const normalizedDialogues =
        remote.dialogues.length > 0
          ? renumberDialogues(normalizedBlocks, remote.dialogues)
          : INITIAL_DIALOGUES;
      const normalizedSops =
        remote.sopItems.length > 0
          ? normalizeSopsOrder(remote.sopItems)
          : SOP_ITEMS;
      const cleanPos = sanitizeSopPositions(remote.sopPositions);
      const cleanMeta = sanitizeScenarioMeta(remote.scenarioMeta);

      setBlocks(normalizedBlocks);
      setDialogues(normalizedDialogues);
      setSopItems(normalizedSops);
      setSopPositions(cleanPos);
      if (remote.incidentNarrative?.body) {
        setIncidentNarrative(remote.incidentNarrative);
      }
      setScenarioMeta(cleanMeta);

      void saveStateValue('blocks', normalizedBlocks);
      void saveStateValue('dialogues', normalizedDialogues);
      void saveStateValue('sopItems', normalizedSops);
      void saveStateValue('sopPositions', cleanPos);
      if (remote.incidentNarrative?.body) {
        void saveStateValue('incidentNarrative', remote.incidentNarrative);
      }
      void saveStateValue('scenarioMeta', cleanMeta);
    },
    [],
  );

  const downloadSharedAudioWithRetry = useCallback(
    async (
      meta: SharedCloudAudioMeta,
      isCancelled: () => boolean,
    ): Promise<StoredAudioRecord | null> => {
      const delaysMs = [0, 1500, 3000, 5000];
      let lastError: unknown = null;

      for (let attempt = 0; attempt < delaysMs.length; attempt += 1) {
        if (isCancelled()) return null;
        if (delaysMs[attempt] > 0) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, delaysMs[attempt]),
          );
          if (isCancelled()) return null;
        }
        try {
          const rec = await downloadSharedAudioFromCloud(meta);
          if (rec) return rec;
        } catch (err) {
          lastError = err;
          const lower = (err instanceof Error ? err.message : String(err)).toLowerCase();
          if (
            lower.includes('permission-denied') ||
            lower.includes('resource-exhausted') ||
            lower.includes('quota exceeded')
          ) {
            throw err;
          }
        }
      }

      if (lastError) {
        throw lastError;
      }
      return null;
    },
    [],
  );

  const reconcileSharedAudioMetas = useCallback(
    async (
      metas: SharedCloudAudioMeta[],
      options: { fromCache: boolean; isCancelled: () => boolean },
    ): Promise<{ downloaded: number; failed: number }> => {
      const remoteIds = new Set(metas.map((m) => m.dialogueId));

      // 1. Prune audios deleted remotely:
      //    - Always prune IDs previously known to come from Cloud Admin
      //    - For Mode Pengguna on an authoritative server snapshot (once workspace exists),
      //      also prune any stale local cached audio that Admin deleted while this device was offline.
      const deletedIds = new Set<string>();
      knownCloudAudioIdsRef.current.forEach((prevId) => {
        if (!remoteIds.has(prevId) && !uploadingAudioIdsRef.current.has(prevId)) {
          deletedIds.add(prevId);
        }
      });

      if (
        !isAdminRef.current &&
        !options.fromCache &&
        sharedWorkspaceExistsRef.current
      ) {
        Object.keys(audioMapRef.current).forEach((localId) => {
          if (
            !remoteIds.has(localId) &&
            !uploadingAudioIdsRef.current.has(localId)
          ) {
            deletedIds.add(localId);
          }
        });
      }

      if (deletedIds.size > 0) {
        deletedIds.forEach((delId) => {
          void deleteAudioRecord(delId);
        });
        setAudioMap((prev) => {
          const next = { ...prev };
          let changed = false;
          deletedIds.forEach((delId) => {
            if (next[delId]) {
              URL.revokeObjectURL(next[delId].objectUrl);
              delete next[delId];
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }

      knownCloudAudioIdsRef.current = remoteIds;

      // 2. Download any new or updated audio files published by Admin
      const toDownload = metas.filter((meta) => {
        if (uploadingAudioIdsRef.current.has(meta.dialogueId)) return false;
        const localEntry = audioMapRef.current[meta.dialogueId];
        if (localEntry && localEntry.revision === meta.revision) return false;
        if (downloadingAudioRevsRef.current.get(meta.dialogueId) === meta.revision) {
          return false;
        }
        return true;
      });

      if (toDownload.length === 0) {
        if (
          !options.isCancelled() &&
          downloadingAudioRevsRef.current.size === 0 &&
          uploadingAudioIdsRef.current.size === 0
        ) {
          setCloudSyncStatus('synced');
          setCloudSyncDetail(null);
        }
        return { downloaded: 0, failed: 0 };
      }

      setCloudSyncStatus('syncing');
      setCloudSyncDetail(`Mengunduh ${toDownload.length} audio dari Cloud...`);

      let downloaded = 0;
      let completed = 0;
      let failed = 0;
      let firstError: unknown = null;

      await runWithConcurrency(toDownload, 4, async (meta) => {
        if (options.isCancelled()) return;
        downloadingAudioRevsRef.current.set(meta.dialogueId, meta.revision);
        try {
          const record = await downloadSharedAudioWithRetry(
            meta,
            options.isCancelled,
          );
          if (options.isCancelled()) return;
          if (!record) {
            failed += 1;
            return;
          }
          try {
            await saveAudioRecord(record);
          } catch {
            // Allow playback from memory if local storage quota is tight
          }
          const objectUrl = URL.createObjectURL(record.blob);
          setAudioMap((prev) => {
            const old = prev[record.dialogueId];
            if (old) URL.revokeObjectURL(old.objectUrl);
            return {
              ...prev,
              [record.dialogueId]: {
                dialogueId: record.dialogueId,
                fileName: record.fileName,
                mimeType: record.mimeType,
                size: record.size,
                duration: record.duration,
                objectUrl,
                updatedAt: record.updatedAt,
                revision: record.revision,
              },
            };
          });
          downloaded += 1;
        } catch (err) {
          failed += 1;
          if (!firstError) firstError = err;
        } finally {
          completed += 1;
          if (!options.isCancelled() && completed < toDownload.length) {
            setCloudSyncDetail(
              `Mengunduh audio ${completed}/${toDownload.length} dari Cloud...`,
            );
          }
          if (
            downloadingAudioRevsRef.current.get(meta.dialogueId) ===
            meta.revision
          ) {
            downloadingAudioRevsRef.current.delete(meta.dialogueId);
          }
        }
      });

      if (!options.isCancelled()) {
        if (failed > 0) {
          reportCloudError(
            firstError ?? new Error('Chunk audio tidak lengkap di Cloud.'),
            `${failed} audio gagal diunduh dari Cloud. Klik Segarkan untuk mencoba lagi.`,
          );
        } else if (
          downloadingAudioRevsRef.current.size === 0 &&
          uploadingAudioIdsRef.current.size === 0
        ) {
          setCloudSyncStatus('synced');
          setCloudSyncDetail(null);
        }
      }

      return { downloaded, failed };
    },
    [downloadSharedAudioWithRetry, reportCloudError],
  );

  const ensureSharedReady = useCallback(async (uid: string): Promise<boolean> => {
    if (sharedCloudReadyRef.current) return true;
    if (!isAdminRef.current) return false;
    if (ensureSharedReadyPromiseRef.current) {
      return ensureSharedReadyPromiseRef.current;
    }

    const run = (async () => {
      try {
        await ensureSharedWorkspace(uid, {
          blocks: blocksRef.current,
          dialogues: dialoguesRef.current,
          sopItems: sopItemsRef.current,
          sopPositions: sopPositionsRef.current,
          incidentNarrative: incidentNarrativeRef.current,
          scenarioMeta: scenarioMetaRef.current,
          playedIds: playedIdsRef.current,
        });
        sharedCloudReadyRef.current = true;
        sharedWorkspaceExistsRef.current = true;
        return true;
      } catch {
        return false;
      } finally {
        ensureSharedReadyPromiseRef.current = null;
      }
    })();

    ensureSharedReadyPromiseRef.current = run;
    return run;
  }, []);

  const ensurePrivateReady = useCallback(async (user: User): Promise<boolean> => {
    if (privateCloudReadyRef.current) return true;
    if (!isAdminRef.current || !user.emailVerified) return false;
    if (ensurePrivateReadyPromiseRef.current) {
      return ensurePrivateReadyPromiseRef.current;
    }

    const run = (async () => {
      try {
        await ensureUserProfile(user);
        await ensureCloudWorkspace(user.uid, {
          blocks: blocksRef.current,
          dialogues: dialoguesRef.current,
          sopItems: sopItemsRef.current,
          sopPositions: sopPositionsRef.current,
          incidentNarrative: incidentNarrativeRef.current,
          scenarioMeta: scenarioMetaRef.current,
          playedIds: playedIdsRef.current,
        });
        privateCloudReadyRef.current = true;
        return true;
      } catch (err) {
        console.warn('Private savestate cloud workspace init failed:', err);
        return false;
      } finally {
        ensurePrivateReadyPromiseRef.current = null;
      }
    })();

    ensurePrivateReadyPromiseRef.current = run;
    return run;
  }, []);

  const syncSavestatesToCloud = useCallback(
    async (
      user: User,
      targets: WorkspaceSavestate[],
      onProgress?: (msg: string) => void,
    ): Promise<{
      syncedCount: number;
      skippedLargeCount: number;
      failedCount: number;
      firstError: unknown;
    }> => {
      if (targets.length === 0) {
        return {
          syncedCount: 0,
          skippedLargeCount: 0,
          failedCount: 0,
          firstError: null,
        };
      }

      onProgress?.('Menyiapkan ruang Cloud Savestate...');
      const privReady = await ensurePrivateReady(user);
      if (!privReady) {
        throw new Error('Gagal menyiapkan ruang Cloud privat Admin untuk Savestate.');
      }

      const knownVaultIds = await fetchExistingSavestateAudioIds(user.uid);
      let activeAudiosByDialogueId: Map<string, StoredAudioRecord> | null = null;

      let syncedCount = 0;
      let skippedLargeCount = 0;
      let failedCount = 0;
      let firstError: unknown = null;

      for (let sIdx = 0; sIdx < targets.length; sIdx += 1) {
        const state = targets[sIdx];
        savingSavestateIdsRef.current.add(state.id);
        try {
          const uniqueMissingRecords = new Map<string, AudioVaultRecord>();
          for (const audioRef of state.audioRefs) {
            if (
              knownVaultIds.has(audioRef.assetId) ||
              uniqueMissingRecords.has(audioRef.assetId)
            ) {
              continue;
            }
            let vaultRec = await getAudioVaultRecord(audioRef.assetId);
            if (!vaultRec) {
              // Fallback: recover audio blob from active store if still matching
              if (!activeAudiosByDialogueId) {
                const allActive = await getAllAudioRecords();
                activeAudiosByDialogueId = new Map(
                  allActive.map((r) => [r.dialogueId, r]),
                );
              }
              const activeMatch = activeAudiosByDialogueId.get(
                audioRef.dialogueId,
              );
              if (
                activeMatch &&
                (buildVaultAssetId(activeMatch.revision || '') ===
                  audioRef.assetId ||
                  activeMatch.fileName === audioRef.fileName)
              ) {
                vaultRec = {
                  assetId: audioRef.assetId,
                  fileName: activeMatch.fileName,
                  mimeType: activeMatch.mimeType,
                  size: activeMatch.size,
                  duration: activeMatch.duration,
                  blob: activeMatch.blob,
                  createdAt: Date.now(),
                };
                try {
                  await saveAudioVaultRecord(vaultRec);
                } catch {
                  // Ignore local cache write failure while uploading
                }
              }
            }
            if (vaultRec) {
              uniqueMissingRecords.set(audioRef.assetId, vaultRec);
            }
          }

          const toUpload = Array.from(uniqueMissingRecords.values());
          let uploadedInState = 0;
          if (toUpload.length > 0) {
            onProgress?.(
              `Menyinkronkan audio savestate "${state.name}" (0/${toUpload.length})...`,
            );
            await runWithConcurrency(toUpload, 4, async (vRec) => {
              if (cloudWriteQuotaExceededRef.current) return;
              try {
                const res = await uploadSavestateAudioAssetToCloud(
                  user.uid,
                  vRec,
                  knownVaultIds,
                );
                if (!res.uploaded && res.reason === 'too-large') {
                  skippedLargeCount += 1;
                }
                uploadedInState += 1;
                onProgress?.(
                  `Menyinkronkan audio savestate "${state.name}" (${uploadedInState}/${toUpload.length})...`,
                );
              } catch (uploadErr) {
                if (isFirestoreQuotaError(uploadErr)) {
                  cloudWriteQuotaExceededRef.current = true;
                }
                throw uploadErr;
              }
            });
          }

          if (cloudWriteQuotaExceededRef.current) {
            throw new Error(
              'resource-exhausted: Quota limit exceeded for free daily write units.',
            );
          }

          onProgress?.(
            `Menyimpan savestate "${state.name}" ke Cloud (${sIdx + 1}/${targets.length})...`,
          );
          await saveSavestateToCloud(user.uid, state);
          const syncedState: WorkspaceSavestate = {
            ...state,
            syncedToCloud: true,
          };
          await saveSavestateRecord(syncedState);
          setSavestates((prev) =>
            prev.map((s) => (s.id === state.id ? syncedState : s)),
          );
          syncedCount += 1;
        } catch (err) {
          failedCount += 1;
          if (!firstError) firstError = err;
          if (isFirestoreQuotaError(err)) {
            cloudWriteQuotaExceededRef.current = true;
            break;
          }
        } finally {
          savingSavestateIdsRef.current.delete(state.id);
        }
      }

      return { syncedCount, skippedLargeCount, failedCount, firstError };
    },
    [ensurePrivateReady, isFirestoreQuotaError],
  );

  const flushPendingWorkspaceSync = useCallback(async () => {
    if (workspaceSyncInFlightRef.current) return;
    const patch = pendingWorkspacePatchRef.current;
    if (!patch) return;

    const user = authUserRef.current;
    if (
      !user ||
      !user.emailVerified ||
      !isAdminRef.current ||
      cloudWriteQuotaExceededRef.current
    ) {
      pendingWorkspacePatchRef.current = null;
      return;
    }

    pendingWorkspacePatchRef.current = null;
    workspaceSyncInFlightRef.current = true;
    setCloudSyncStatus('syncing');
    setCloudSyncDetail('Menyimpan perubahan ke Cloud...');

    try {
      const ready = await ensureSharedReady(user.uid);
      if (!ready) {
        throw new Error('Ruang kerja Cloud Admin belum siap.');
      }
      await pushSharedWorkspaceUpdate(user.uid, patch);
      if (
        !pendingWorkspacePatchRef.current &&
        downloadingAudioRevsRef.current.size === 0 &&
        uploadingAudioIdsRef.current.size === 0
      ) {
        setCloudSyncStatus('synced');
        setCloudSyncDetail(null);
      }
    } catch (err) {
      reportCloudError(err, 'Gagal menyinkronkan perubahan ke cloud.');
    } finally {
      workspaceSyncInFlightRef.current = false;
      if (
        pendingWorkspacePatchRef.current &&
        !cloudWriteQuotaExceededRef.current
      ) {
        void flushPendingWorkspaceSync();
      }
    }
  }, [ensureSharedReady, reportCloudError]);

  const syncWorkspaceToCloud = useCallback(
    (partial: Partial<SharedWorkspacePayload>) => {
      const user = authUserRef.current;
      if (
        !user ||
        !user.emailVerified ||
        !isAdminRef.current ||
        cloudWriteQuotaExceededRef.current
      ) {
        return;
      }
      pendingWorkspacePatchRef.current = {
        ...(pendingWorkspacePatchRef.current ?? {}),
        ...partial,
      };
      if (workspaceSyncTimerRef.current !== null) {
        window.clearTimeout(workspaceSyncTimerRef.current);
      }
      workspaceSyncTimerRef.current = window.setTimeout(() => {
        workspaceSyncTimerRef.current = null;
        void flushPendingWorkspaceSync();
      }, 120);
    },
    [flushPendingWorkspaceSync],
  );

  const clearGapTimer = useCallback(() => {
    if (gapTimerRef.current !== null) {
      window.clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
  }, []);

  const markDialoguePlayed = useCallback((dialogueId: string) => {
    const target = dialoguesRef.current.find((d) => d.id === dialogueId);
    if (target?.entryType === 'narrative') return;
    setPlayedIds((prev) => {
      if (prev.includes(dialogueId)) return prev;
      const next = [...prev, dialogueId];
      void saveStateValue('playedIds', next);
      return next;
    });
  }, []);

  const startTrackById = useCallback(
    async (dialogueId: string, startFromZero = true) => {
      const entry = audioMapRef.current[dialogueId];
      const audio = audioRef.current;
      if (!entry || !audio) return;

      clearGapTimer();
      try {
        if (audio.src !== entry.objectUrl) {
          audio.src = entry.objectUrl;
          audio.load();
        }
        if (startFromZero) {
          audio.currentTime = 0;
          setCurrentTime(0);
        }
        audio.volume = isMuted ? 0 : volume;
        audio.playbackRate = playbackRate;
        setActiveDialogueId(dialogueId);
        setActiveDuration(entry.duration || audio.duration || 0);
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
        showToast(
          'Browser memblokir pemutaran otomatis. Klik tombol Putar Audio lagi.',
          'error',
        );
      }
    },
    [clearGapTimer, isMuted, playbackRate, showToast, volume],
  );

  // Initialize single shared HTMLAudioElement
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setActiveDuration(audio.duration);
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration || 0);
      setActiveDialogueId((currentId) => {
        if (currentId) {
          markDialoguePlayed(currentId);
        }
        return currentId;
      });

      if (queueRef.current.length > 0) {
        const nextId = queueRef.current.shift()!;
        setSequenceQueueRemaining(queueRef.current.length);
        const delayMs = Math.max(0, sequenceGapRef.current) * 1000;
        gapTimerRef.current = window.setTimeout(() => {
          gapTimerRef.current = null;
          void startTrackById(nextId, true);
        }, delayMs);
      } else {
        setIsSequenceActive(false);
        setSequenceQueueRemaining(0);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('ended', handleEnded);

    return () => {
      clearGapTimer();
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('ended', handleEnded);
      Object.values(audioMapRef.current).forEach((entry) => {
        URL.revokeObjectURL(entry.objectUrl);
      });
    };
  }, [clearGapTimer, markDialoguePlayed, startTrackById]);

  // Sync volume & playback rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [volume, isMuted, playbackRate]);

  // Hydrate persisted state and audio Blobs from IndexedDB
  useEffect(() => {
    let active = true;
    async function hydrate() {
      try {
        const [
          savedBlocks,
          savedDialogues,
          savedSops,
          savedSopPositions,
          savedNarrative,
          savedScenarioMeta,
          savedPlayed,
          records,
          savedStates,
        ] = await Promise.all([
          getStateValue<CommunicationBlock[]>('blocks'),
          getStateValue<DialogueItem[]>('dialogues'),
          getStateValue<SopItem[]>('sopItems'),
          getStateValue<PhaseSopPositions>('sopPositions'),
          getStateValue<IncidentNarrative>('incidentNarrative'),
          getStateValue<ScenarioMeta>('scenarioMeta'),
          getStateValue<string[]>('playedIds'),
          getAllAudioRecords(),
          getAllSavestates(),
        ]);

        if (!active) return;

        const hydratedBlocks =
          savedBlocks && savedBlocks.length > 0
            ? normalizeBlocksOrder(savedBlocks)
            : COMMUNICATION_BLOCKS;
        setBlocks(hydratedBlocks);

        if (savedDialogues && savedDialogues.length > 0) {
          setDialogues(renumberDialogues(hydratedBlocks, savedDialogues));
        }
        if (savedSops && savedSops.length > 0) {
          setSopItems(normalizeSopsOrder(savedSops));
        }
        if (savedSopPositions && typeof savedSopPositions === 'object') {
          setSopPositions(sanitizeSopPositions(savedSopPositions));
        }
        if (savedNarrative && savedNarrative.body) {
          setIncidentNarrative(savedNarrative);
        }
        if (savedScenarioMeta && typeof savedScenarioMeta === 'object') {
          setScenarioMeta(sanitizeScenarioMeta(savedScenarioMeta));
        }
        if (savedPlayed && Array.isArray(savedPlayed)) {
          setPlayedIds(savedPlayed);
        }
        if (Array.isArray(savedStates)) {
          setSavestates(savedStates);
        }

        const nextMap: Record<string, AudioEntryView> = {};
        for (const rec of records) {
          nextMap[rec.dialogueId] = {
            dialogueId: rec.dialogueId,
            fileName: rec.fileName,
            mimeType: rec.mimeType,
            size: rec.size,
            duration: rec.duration,
            objectUrl: URL.createObjectURL(rec.blob),
            updatedAt: rec.updatedAt,
            revision: rec.revision,
          };
        }
        setAudioMap(nextMap);
      } catch {
        // Fallback to clean in-memory session if IndexedDB is unavailable
      } finally {
        if (active) setIsHydrating(false);
      }
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  // Track Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        isAdminRef.current = false;
        canEditRef.current = false;
        sharedCloudReadyRef.current = false;
        privateCloudReadyRef.current = false;
        setUserRole('user');
        setIsEditLocked(true);
        setAdminEntries([]);
        setAdminModalOpen(false);
        closeAllEditModals();
      }
    });
    return () => unsub();
  }, [closeAllEditModals]);

  // Effect 1: Universal real-time subscription to Cloud Admin's shared scenario & audios
  // Runs for BOTH Mode Pengguna (even without login) and Mode Admin once local hydration finishes.
  useEffect(() => {
    if (isHydrating) return;

    let cancelled = false;
    setCloudSyncStatus('connecting');
    setCloudSyncDetail('Memuat skenario & audio dari Cloud Admin...');

    const unsubSharedWorkspace = subscribeSharedWorkspace(
      (remote) => {
        if (cancelled) return;
        if (!remote) {
          sharedWorkspaceExistsRef.current = false;
          if (!isAdminRef.current) {
            setCloudSyncStatus('synced');
            setCloudSyncDetail(null);
          }
          return;
        }

        applySharedWorkspaceData(remote);

        if (
          downloadingAudioRevsRef.current.size === 0 &&
          uploadingAudioIdsRef.current.size === 0
        ) {
          setCloudSyncStatus('synced');
          setCloudSyncDetail(null);
        }
      },
      (err) => {
        if (!cancelled) {
          reportCloudError(err, 'Gagal memuat skenario dari Cloud Admin.');
        }
      },
    );

    const unsubSharedAudios = subscribeSharedAudios(
      (metas, metaInfo) => {
        if (cancelled) return;
        void reconcileSharedAudioMetas(metas, {
          fromCache: metaInfo.fromCache,
          isCancelled: () => cancelled,
        });
      },
      (err) => {
        if (!cancelled) {
          reportCloudError(err, 'Koneksi sinkronisasi audio Cloud Admin terputus.');
        }
      },
    );

    return () => {
      cancelled = true;
      unsubSharedWorkspace();
      unsubSharedAudios();
      if (workspaceSyncTimerRef.current !== null) {
        window.clearTimeout(workspaceSyncTimerRef.current);
        workspaceSyncTimerRef.current = null;
      }
    };
  }, [
    applySharedWorkspaceData,
    isHydrating,
    reconcileSharedAudioMetas,
    reportCloudError,
  ]);

  // Effect 2: Resolve Admin role & attach Admin-only cloud writers, Savestates, and Admin roster
  useEffect(() => {
    if (isHydrating || !authReady || !authUser) return;
    if (!authUser.emailVerified) {
      isAdminRef.current = false;
      canEditRef.current = false;
      sharedCloudReadyRef.current = false;
      privateCloudReadyRef.current = false;
      setUserRole('user');
      setIsEditLocked(true);
      setCloudSyncStatus('error');
      setCloudSyncDetail('Email akun Google belum terverifikasi.');
      return;
    }

    let cancelled = false;
    let unsubAdmins: (() => void) | null = null;
    let unsubSavestates: (() => void) | null = null;

    const uid = authUser.uid;

    async function initAdminSession() {
      const adminAllowed = await checkUserIsAdmin(authUser!);
      if (cancelled) return;

      // Always default Kunci Edit to locked whenever an account signs in or reloads
      setIsEditLocked(true);
      canEditRef.current = false;

      if (!adminAllowed) {
        isAdminRef.current = false;
        sharedCloudReadyRef.current = false;
        privateCloudReadyRef.current = false;
        setUserRole('user');
        setAdminEntries([]);
        setAdminModalOpen(false);
        closeAllEditModals();
        return;
      }

      isAdminRef.current = true;
      setUserRole('admin');
      setCloudSyncStatus('connecting');
      setCloudSyncDetail('Menyiapkan ruang kerja Admin...');

      try {
        // 1. Ensure shared published workspace FIRST & independently so private workspace issues
        //    can NEVER block Admin's shared Cloud sync!
        const sharedInit = await ensureSharedWorkspace(uid, {
          blocks: blocksRef.current,
          dialogues: dialoguesRef.current,
          sopItems: sopItemsRef.current,
          sopPositions: sopPositionsRef.current,
          incidentNarrative: incidentNarrativeRef.current,
          scenarioMeta: scenarioMetaRef.current,
          playedIds: playedIdsRef.current,
        });
        if (cancelled) return;

        sharedCloudReadyRef.current = true;
        sharedWorkspaceExistsRef.current = true;

        if (sharedInit.created) {
          if (sharedInit.remoteData) {
            applySharedWorkspaceData(sharedInit.remoteData);
          }

          // Migrate legacy cloud audios & any local IndexedDB audios to sharedWorkspaces/default
          const localRecords = await getAllAudioRecords();
          const byId = new Map<string, StoredAudioRecord>(
            localRecords.map((r) => [r.dialogueId, r]),
          );

          if (
            sharedInit.migratedFromLegacyUser &&
            sharedInit.legacyAudiosToMigrate &&
            sharedInit.legacyAudiosToMigrate.length > 0
          ) {
            setCloudSyncStatus('syncing');
            setCloudSyncDetail(
              `Memigrasikan ${sharedInit.legacyAudiosToMigrate.length} audio ke Cloud Admin...`,
            );
            for (const legacyMeta of sharedInit.legacyAudiosToMigrate) {
              if (cancelled) break;
              const existingLocal = byId.get(legacyMeta.dialogueId);
              if (!existingLocal || existingLocal.revision !== legacyMeta.revision) {
                try {
                  const downloaded = await downloadAudioFromCloud(uid, legacyMeta);
                  if (downloaded) {
                    byId.set(downloaded.dialogueId, downloaded);
                    try {
                      await saveAudioRecord(downloaded);
                    } catch {
                      // Ignore local quota tight error
                    }
                    const objectUrl = URL.createObjectURL(downloaded.blob);
                    setAudioMap((prev) => {
                      const old = prev[downloaded.dialogueId];
                      if (old) URL.revokeObjectURL(old.objectUrl);
                      return {
                        ...prev,
                        [downloaded.dialogueId]: {
                          dialogueId: downloaded.dialogueId,
                          fileName: downloaded.fileName,
                          mimeType: downloaded.mimeType,
                          size: downloaded.size,
                          duration: downloaded.duration,
                          objectUrl,
                          updatedAt: downloaded.updatedAt,
                          revision: downloaded.revision,
                        },
                      };
                    });
                  }
                } catch {
                  // Continue migrating remaining files
                }
              }
            }
          }

          const allToPublish = Array.from(byId.values());
          if (!cancelled && allToPublish.length > 0) {
            setCloudSyncStatus('syncing');
            for (let idx = 0; idx < allToPublish.length; idx += 1) {
              if (cancelled) break;
              const rec = allToPublish[idx];
              setCloudSyncDetail(
                `Menerbitkan audio ${idx + 1}/${allToPublish.length} ke Cloud Admin...`,
              );
              const rev = rec.revision || createAudioRevision();
              uploadingAudioIdsRef.current.add(rec.dialogueId);
              try {
                const res = await uploadSharedAudioToCloud(uid, rec, rev);
                if (res.uploaded) {
                  knownCloudAudioIdsRef.current.add(rec.dialogueId);
                  await saveAudioRecord({ ...rec, revision: rev });
                  setAudioMap((prev) =>
                    prev[rec.dialogueId]
                      ? {
                          ...prev,
                          [rec.dialogueId]: {
                            ...prev[rec.dialogueId],
                            revision: rev,
                          },
                        }
                      : prev,
                  );
                }
              } catch {
                // Keep migrating remaining files even if one audio fails
              } finally {
                uploadingAudioIdsRef.current.delete(rec.dialogueId);
              }
            }
          }
        }

        if (cancelled) return;

        // 2. Subscribe to Admin roster
        unsubAdmins = subscribeAdminEntries(
          (entries) => {
            if (!cancelled) {
              setAdminEntries(entries);
            }
          },
          (err) => {
            if (!cancelled) {
              reportCloudError(err, 'Gagal memuat daftar Admin.');
            }
          },
        );

        // 3. Independently initialize private Admin workspace for Savestates (never blocks shared sync)
        try {
          const privReady = await ensurePrivateReady(authUser!);
          if (cancelled) return;

          if (privReady) {
            unsubSavestates = subscribeCloudSavestates(
              uid,
              (remoteStates) => {
                if (cancelled) return;
                const remoteById = new Map(remoteStates.map((s) => [s.id, s]));

                for (const rs of remoteStates) {
                  void saveSavestateRecord(rs);
                }

                setSavestates((prevLocal) => {
                  const mergedMap = new Map<string, WorkspaceSavestate>();
                  const removedCloudIds: string[] = [];

                  for (const local of prevLocal) {
                    const remoteMatch = remoteById.get(local.id);
                    if (remoteMatch) {
                      mergedMap.set(local.id, remoteMatch);
                    } else if (
                      !local.syncedToCloud ||
                      savingSavestateIdsRef.current.has(local.id)
                    ) {
                      mergedMap.set(local.id, local);
                    } else {
                      removedCloudIds.push(local.id);
                    }
                  }

                  for (const rs of remoteStates) {
                    if (!mergedMap.has(rs.id)) {
                      mergedMap.set(rs.id, rs);
                    }
                  }

                  if (removedCloudIds.length > 0) {
                    void Promise.all(
                      removedCloudIds.map((id) => deleteSavestateRecord(id)),
                    ).then(() => pruneUnreferencedVaultAudios());
                  }

                  return Array.from(mergedMap.values()).sort(
                    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
                  );
                });
              },
              (err) => {
                if (!cancelled) {
                  reportCloudError(err, 'Koneksi sinkronisasi savestate terputus.');
                }
              },
            );
          }
        } catch (privateErr) {
          privateCloudReadyRef.current = false;
          console.warn(
            'Private savestate cloud workspace init skipped:',
            privateErr,
          );
        }

        if (
          !cancelled &&
          downloadingAudioRevsRef.current.size === 0 &&
          uploadingAudioIdsRef.current.size === 0
        ) {
          setCloudSyncStatus('synced');
          setCloudSyncDetail(null);
        }
      } catch (err) {
        if (!cancelled) {
          sharedCloudReadyRef.current = false;
          reportCloudError(err, 'Gagal menghubungkan sinkronisasi Cloud Admin.');
        }
      }
    }

    void initAdminSession();

    return () => {
      cancelled = true;
      sharedCloudReadyRef.current = false;
      privateCloudReadyRef.current = false;
      if (unsubAdmins) unsubAdmins();
      if (unsubSavestates) unsubSavestates();
    };
  }, [
    applySharedWorkspaceData,
    authReady,
    authUser,
    closeAllEditModals,
    ensurePrivateReady,
    isHydrating,
    reportCloudError,
  ]);

  const handleSignInGoogle = useCallback(async () => {
    try {
      setCloudSyncStatus('connecting');
      setCloudSyncDetail('Membuka login Google...');
      const cred = await signInWithGoogle();
      const adminOk = await checkUserIsAdmin(cred.user);
      const label = cred.user.email ?? cred.user.displayName ?? 'Akun Google';
      if (adminOk) {
        showToast(
          `Masuk sebagai Admin (${label}). Edit terkunci otomatis untuk keamanan.`,
        );
      } else {
        showToast(
          `Masuk sebagai Pengguna (${label}). Mode baca & putar audio aktif.`,
        );
      }
    } catch (err) {
      setCloudSyncStatus('synced');
      setCloudSyncDetail(null);
      const code = (err as { code?: string })?.code ?? '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        return;
      }
      showToast('Gagal masuk dengan akun Google. Silakan coba lagi.', 'error');
    }
  }, [showToast]);

  const handleSignOutGoogle = useCallback(async () => {
    try {
      await signOutUser();
      setAdminModalOpen(false);
      closeAllEditModals();
      showToast(
        'Keluar dari akun Google. Aplikasi dalam Mode Pengguna (memuat data Cloud Admin).',
      );
    } catch {
      showToast('Gagal keluar dari akun Google.', 'error');
    }
  }, [closeAllEditModals, showToast]);

  const handleAddAdmin = useCallback(
    async (email: string, note: string) => {
      const user = authUserRef.current;
      if (!user || !user.emailVerified || !isAdminRef.current) {
        throw new Error('Hanya Admin yang dapat menambahkan akun Admin.');
      }
      await addAdminEntry(user.uid, email, note);
      showToast(`Email "${email}" berhasil ditambahkan sebagai Admin.`);
    },
    [showToast],
  );

  const handleRemoveAdmin = useCallback(
    async (email: string) => {
      if (!isAdminRef.current) {
        throw new Error('Hanya Admin yang dapat mencabut akses Admin.');
      }
      await removeAdminEntry(email);
      showToast(`Akses Admin untuk "${email}" telah dicabut.`);
    },
    [showToast],
  );

  const handleRefreshFromCloud = useCallback(async () => {
    setCloudSyncStatus('syncing');
    setCloudSyncDetail('Mengambil skenario & audio terbaru dari Cloud Admin...');
    try {
      const [remoteWorkspace, remoteAudios] = await Promise.all([
        fetchSharedWorkspaceFromServer(),
        fetchSharedAudiosFromServer(),
      ]);

      if (!remoteWorkspace) {
        sharedWorkspaceExistsRef.current = false;
        setCloudSyncStatus('synced');
        setCloudSyncDetail(null);
        showToast(
          'Belum ada skenario yang dipublikasikan oleh Admin di Cloud.',
        );
        return;
      }

      applySharedWorkspaceData(remoteWorkspace);
      const result = await reconcileSharedAudioMetas(remoteAudios, {
        fromCache: false,
        isCancelled: () => false,
      });

      if (result.failed === 0) {
        showToast(
          result.downloaded > 0
            ? `Skenario diperbarui & ${result.downloaded} audio terbaru diunduh dari Cloud Admin.`
            : 'Skenario & audio sudah paling baru sesuai Cloud Admin.',
        );
      }
    } catch (err) {
      reportCloudError(err, 'Gagal memuat ulang data dari Cloud Admin.');
    }
  }, [
    applySharedWorkspaceData,
    reconcileSharedAudioMetas,
    reportCloudError,
    showToast,
  ]);

  const handlePushLocalToCloud = useCallback(async () => {
    const user = authUserRef.current;
    if (!user || !user.emailVerified || !isAdminRef.current) {
      showToast(
        'Masuk dengan akun Google Admin terlebih dahulu untuk menyinkronkan ke Cloud.',
        'error',
      );
      return;
    }

    cloudWriteQuotaExceededRef.current = false;
    setCloudSyncStatus('syncing');
    setCloudSyncDetail('Memeriksa perubahan skenario & audio di Cloud...');
    try {
      const ready = await ensureSharedReady(user.uid);
      if (!ready) {
        throw new Error('Gagal menyiapkan dokumen Cloud Admin.');
      }

      const [, localRecords, remoteAudios] = await Promise.all([
        pushSharedWorkspaceUpdate(user.uid, {
          blocks: blocksRef.current,
          dialogues: dialoguesRef.current,
          sopItems: sopItemsRef.current,
          sopPositions: sopPositionsRef.current,
          incidentNarrative: incidentNarrativeRef.current,
          scenarioMeta: scenarioMetaRef.current,
        }),
        getAllAudioRecords(),
        fetchSharedAudiosFromServer(),
      ]);

      const remoteRevById = new Map<string, string>();
      for (const meta of remoteAudios) {
        remoteRevById.set(meta.dialogueId, meta.revision);
        knownCloudAudioIdsRef.current.add(meta.dialogueId);
      }

      const audiosToUpload: StoredAudioRecord[] = [];
      let alreadySyncedAudioCount = 0;

      for (const rec of localRecords) {
        if (rec.revision && remoteRevById.get(rec.dialogueId) === rec.revision) {
          alreadySyncedAudioCount += 1;
        } else {
          audiosToUpload.push(rec);
        }
      }

      let uploadedAudioCount = 0;
      let skippedLargeCount = 0;
      let failedAudioCount = 0;
      let firstAudioErr: unknown = null;

      if (audiosToUpload.length > 0) {
        let completedUploads = 0;
        setCloudSyncDetail(
          `Mengunggah ${audiosToUpload.length} audio baru/berubah (${alreadySyncedAudioCount} sudah sinkron)...`,
        );

        await runWithConcurrency(audiosToUpload, 4, async (rec) => {
          if (cloudWriteQuotaExceededRef.current) return;
          const rev = rec.revision || createAudioRevision();
          uploadingAudioIdsRef.current.add(rec.dialogueId);
          try {
            const res = await uploadSharedAudioToCloud(user.uid, rec, rev);
            if (res.uploaded) {
              if (!res.skippedExisting) {
                uploadedAudioCount += 1;
              } else {
                alreadySyncedAudioCount += 1;
              }
              knownCloudAudioIdsRef.current.add(rec.dialogueId);
              if (rec.revision !== rev) {
                await saveAudioRecord({ ...rec, revision: rev });
                setAudioMap((prev) =>
                  prev[rec.dialogueId]
                    ? {
                        ...prev,
                        [rec.dialogueId]: {
                          ...prev[rec.dialogueId],
                          revision: rev,
                        },
                      }
                    : prev,
                );
              }
            } else if (res.reason === 'too-large') {
              skippedLargeCount += 1;
            }
          } catch (audioErr) {
            failedAudioCount += 1;
            if (!firstAudioErr) firstAudioErr = audioErr;
            if (isFirestoreQuotaError(audioErr)) {
              cloudWriteQuotaExceededRef.current = true;
            }
          } finally {
            uploadingAudioIdsRef.current.delete(rec.dialogueId);
            completedUploads += 1;
            if (
              !cloudWriteQuotaExceededRef.current &&
              completedUploads < audiosToUpload.length
            ) {
              setCloudSyncDetail(
                `Mengunggah audio ${completedUploads}/${audiosToUpload.length}...`,
              );
            }
          }
        });
      }

      // Sync local-only savestates unless daily write quota was just hit
      let syncedSavestateCount = 0;
      let failedSavestateCount = 0;
      let firstSavestateErr: unknown = null;
      const localUnsyncedStates = savestatesRef.current.filter(
        (s) => !s.syncedToCloud,
      );

      if (localUnsyncedStates.length > 0 && !cloudWriteQuotaExceededRef.current) {
        try {
          const svRes = await syncSavestatesToCloud(
            user,
            localUnsyncedStates,
            (msg) => setCloudSyncDetail(msg),
          );
          syncedSavestateCount = svRes.syncedCount;
          skippedLargeCount += svRes.skippedLargeCount;
          failedSavestateCount = svRes.failedCount;
          firstSavestateErr = svRes.firstError;
        } catch (svErr) {
          failedSavestateCount = localUnsyncedStates.length;
          firstSavestateErr = svErr;
        }
      }

      if (failedAudioCount > 0 || failedSavestateCount > 0) {
        const parts: string[] = [];
        if (failedAudioCount > 0) {
          parts.push(`${failedAudioCount} audio gagal`);
        }
        if (failedSavestateCount > 0) {
          parts.push(`${failedSavestateCount} savestate gagal`);
        }
        reportCloudError(
          firstAudioErr ?? firstSavestateErr,
          `Sinkronisasi sebagian: ${parts.join(' & ')}. Klik Sinkronkan lagi untuk melanjutkan.`,
        );
        return;
      }

      setCloudSyncStatus('synced');
      setCloudSyncDetail(null);

      const summaryParts: string[] = [];
      if (uploadedAudioCount > 0) {
        summaryParts.push(`${uploadedAudioCount} audio baru diunggah`);
      }
      if (alreadySyncedAudioCount > 0) {
        summaryParts.push(`${alreadySyncedAudioCount} audio sudah sinkron`);
      }
      if (syncedSavestateCount > 0) {
        summaryParts.push(`${syncedSavestateCount} savestate disinkronkan`);
      }
      const summaryText =
        summaryParts.length > 0
          ? summaryParts.join(', ')
          : 'skenario terbaru telah tersinkron';

      showToast(
        skippedLargeCount > 0
          ? `Sinkronisasi selesai (${summaryText}). ${skippedLargeCount} audio >10MB hanya tersimpan lokal.`
          : `Sinkronisasi Cloud selesai: ${summaryText}.`,
      );
    } catch (err) {
      reportCloudError(err, 'Gagal menyinkronkan data lokal ke cloud.');
    }
  }, [
    ensureSharedReady,
    isFirestoreQuotaError,
    reportCloudError,
    showToast,
    syncSavestatesToCloud,
  ]);

  const handleStopPlayback = useCallback(() => {
    clearGapTimer();
    queueRef.current = [];
    setIsSequenceActive(false);
    setSequenceQueueRemaining(0);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, [clearGapTimer]);

  const handleExportPdf = useCallback(() => {
    if (isPlaying || isSequenceActive) {
      handleStopPlayback();
    }
    window.print();
  }, [handleStopPlayback, isPlaying, isSequenceActive]);

  const handleTogglePlay = useCallback(
    (dialogueId: string) => {
      const entry = audioMapRef.current[dialogueId];
      const audio = audioRef.current;
      if (!entry || !audio) {
        showToast(
          canEditRef.current
            ? 'Unggah file audio untuk percakapan ini terlebih dahulu.'
            : 'Audio untuk percakapan ini belum tersedia dari Admin.',
          'error',
        );
        return;
      }

      clearGapTimer();

      if (activeDialogueId === dialogueId) {
        if (audio.paused) {
          if (
            audio.ended ||
            (audio.duration > 0 && audio.currentTime >= audio.duration - 0.1)
          ) {
            audio.currentTime = 0;
          }
          void audio.play().catch(() => {
            showToast('Gagal memutar file audio.', 'error');
          });
        } else {
          audio.pause();
        }
        return;
      }

      queueRef.current = [];
      setIsSequenceActive(false);
      setSequenceQueueRemaining(0);
      void startTrackById(dialogueId, true);
    },
    [activeDialogueId, clearGapTimer, showToast, startTrackById],
  );

  const handleReplay = useCallback(
    (dialogueId: string) => {
      void startTrackById(dialogueId, true);
    },
    [startTrackById],
  );

  const handleSeek = useCallback(
    (dialogueId: string, timeSeconds: number) => {
      const audio = audioRef.current;
      const entry = audioMapRef.current[dialogueId];
      if (!audio || !entry) return;

      if (activeDialogueId !== dialogueId) {
        audio.src = entry.objectUrl;
        audio.load();
        setActiveDialogueId(dialogueId);
        setActiveDuration(entry.duration || 0);
      }
      audio.currentTime = timeSeconds;
      setCurrentTime(timeSeconds);
    },
    [activeDialogueId],
  );

  const startSequenceForIds = useCallback(
    (ids: string[], label: string) => {
      const readyIds = ids.filter((id) => Boolean(audioMapRef.current[id]));
      if (readyIds.length === 0) {
        showToast(
          canEditRef.current
            ? `Belum ada file audio yang diunggah pada ${label}.`
            : `Belum ada file audio yang tersedia pada ${label}.`,
          'error',
        );
        return;
      }
      clearGapTimer();
      const [firstId, ...rest] = readyIds;
      queueRef.current = rest;
      setIsSequenceActive(rest.length > 0);
      setSequenceQueueRemaining(rest.length);
      void startTrackById(firstId, true);
    },
    [clearGapTimer, showToast, startTrackById],
  );

  const handlePlayBlockSequence = useCallback(
    (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId);
      const ids = dialogues
        .filter((d) => d.blockId === blockId)
        .map((d) => d.id);
      startSequenceForIds(ids, block?.code ?? 'blok ini');
    },
    [blocks, dialogues, startSequenceForIds],
  );

  const handlePlayAllSequence = useCallback(() => {
    const ids = dialogues.map((d) => d.id);
    startSequenceForIds(ids, 'skenario ini');
  }, [dialogues, startSequenceForIds]);

  const handleSkipNextInQueue = useCallback(() => {
    if (queueRef.current.length === 0) return;
    clearGapTimer();
    const nextId = queueRef.current.shift()!;
    setSequenceQueueRemaining(queueRef.current.length);
    if (queueRef.current.length === 0) {
      setIsSequenceActive(false);
    }
    void startTrackById(nextId, true);
  }, [clearGapTimer, startTrackById]);

  const handleUploadAudio = useCallback(
    async (dialogueId: string, file: File) => {
      if (!requireEditAccess()) return;
      if (!isValidAudioFile(file)) {
        showToast(
          'Format file tidak didukung. Gunakan file audio (MP3, WAV, M4A, OGG, WebM).',
          'error',
        );
        return;
      }

      const duration = await probeAudioDuration(file);
      const revision = createAudioRevision();
      const record: StoredAudioRecord = {
        dialogueId,
        fileName: file.name,
        mimeType: file.type || 'audio/mpeg',
        size: file.size,
        duration,
        blob: file,
        updatedAt: Date.now(),
        revision,
      };

      try {
        await saveAudioRecord(record);
      } catch {
        // Still allow playback from memory if storage quota fails
      }

      const objectUrl = URL.createObjectURL(file);

      setAudioMap((prev) => {
        const old = prev[dialogueId];
        if (old) URL.revokeObjectURL(old.objectUrl);
        return {
          ...prev,
          [dialogueId]: {
            dialogueId,
            fileName: record.fileName,
            mimeType: record.mimeType,
            size: record.size,
            duration: record.duration,
            objectUrl,
            updatedAt: record.updatedAt,
            revision,
          },
        };
      });

      if (activeDialogueId === dialogueId) {
        handleStopPlayback();
      }

      const target = dialoguesRef.current.find((d) => d.id === dialogueId);
      const isNarrativeTarget = target?.entryType === 'narrative';
      const targetLabel = isNarrativeTarget
        ? `Narasi "${target?.title || 'Narasi Skenario'}"`
        : `Dialog #${formatSequenceNumber(target?.sequenceNumber ?? 0)}`;

      const user = authUserRef.current;
      if (
        user &&
        user.emailVerified &&
        isAdminRef.current &&
        !cloudWriteQuotaExceededRef.current
      ) {
        uploadingAudioIdsRef.current.add(dialogueId);
        setCloudSyncStatus('syncing');
        setCloudSyncDetail(`Mengunggah audio ${targetLabel}...`);
        try {
          const ready = await ensureSharedReady(user.uid);
          if (!ready) {
            throw new Error('Ruang kerja Cloud Admin belum siap.');
          }
          const result = await uploadSharedAudioToCloud(user.uid, record, revision);
          if (result.uploaded) {
            knownCloudAudioIdsRef.current.add(dialogueId);
            setCloudSyncStatus('synced');
            setCloudSyncDetail(null);
            showToast(
              `Audio "${file.name}" tersimpan & tersinkron ke Cloud Admin pada ${targetLabel}.`,
            );
          } else if (result.reason === 'too-large') {
            setCloudSyncStatus('synced');
            setCloudSyncDetail(null);
            showToast(
              `Audio "${file.name}" tersimpan lokal (ukuran >10MB tidak disinkronkan ke cloud).`,
            );
          } else {
            setCloudSyncStatus('synced');
            setCloudSyncDetail(null);
            showToast(`Audio "${file.name}" tersimpan pada ${targetLabel}.`);
          }
        } catch (err) {
          reportCloudError(
            err,
            `Audio "${file.name}" tersimpan lokal, namun gagal diunggah ke cloud.`,
          );
        } finally {
          uploadingAudioIdsRef.current.delete(dialogueId);
        }
      } else if (cloudWriteQuotaExceededRef.current) {
        showToast(
          `Audio "${file.name}" tersimpan lokal pada ${targetLabel} (kuota tulis harian Cloud habis, sinkronkan besok).`,
        );
      } else {
        showToast(`Audio "${file.name}" tersimpan pada ${targetLabel}.`);
      }
    },
    [
      activeDialogueId,
      ensureSharedReady,
      handleStopPlayback,
      reportCloudError,
      requireEditAccess,
      showToast,
    ],
  );

  const handleGenerateNarrativeAudio = useCallback(
    async ({
      narrativeId,
      textToSpeak,
      voiceName,
      styleInstruction,
    }: {
      narrativeId: string;
      textToSpeak: string;
      voiceName: GeminiTtsVoice;
      styleInstruction: string;
    }) => {
      if (!requireEditAccess()) return;
      setGeneratingTtsId(narrativeId);
      setTtsError(null);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 90_000);

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: textToSpeak,
            voiceName,
            style: styleInstruction,
          }),
          signal: controller.signal,
        });

        const rawText = await res.text();
        let data: {
          audioBase64?: string;
          mimeType?: string;
          error?: string;
        } = {};
        try {
          data = rawText ? (JSON.parse(rawText) as typeof data) : {};
        } catch {
          data = {};
        }

        if (!res.ok || !data.audioBase64) {
          throw new Error(
            data.error ||
              (res.status === 404
                ? 'Endpoint /api/tts tidak ditemukan di server. Coba muat ulang aplikasi.'
                : res.status === 429
                  ? 'Batas permintaan Gemini TTS sedang penuh. Tunggu beberapa detik lalu coba lagi.'
                  : `Gagal menghasilkan audio dari Gemini (HTTP ${res.status}). Silakan coba lagi.`),
          );
        }

        const sanitizedBase64 = data.audioBase64
          .replace(/[\r\n\s]/g, '')
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        const binary = atob(sanitizedBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }

        const mimeType = data.mimeType || 'audio/wav';
        const targetItem = dialoguesRef.current.find((d) => d.id === narrativeId);
        const filePrefix =
          targetItem && targetItem.entryType !== 'narrative'
            ? `dialog-${formatSequenceNumber(targetItem.sequenceNumber)}`
            : `narasi-${narrativeId}`;
        const fileName = `${filePrefix}-gemini-${voiceName.toLowerCase()}.wav`;
        const wavFile = new File([bytes], fileName, { type: mimeType });

        // Persist last used voice & reading style on the dialogue/narrative item
        const updatedDialogues = dialoguesRef.current.map((d) =>
          d.id === narrativeId
            ? {
                ...d,
                ttsVoice: voiceName,
                ttsStyle: styleInstruction || undefined,
              }
            : d,
        );
        setDialogues(updatedDialogues);
        void saveStateValue('dialogues', updatedDialogues);
        syncWorkspaceToCloud({ dialogues: updatedDialogues });

        await handleUploadAudio(narrativeId, wavFile);
        setTtsTargetNarrative(null);
      } catch (err) {
        const isAbort =
          err instanceof DOMException && err.name === 'AbortError';
        const msg = isAbort
          ? 'Permintaan pembuatan audio Gemini melebihi batas waktu (90 detik). Silakan coba lagi.'
          : err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat membuat audio narasi Gemini.';
        setTtsError(msg);
        showToast(msg, 'error');
      } finally {
        window.clearTimeout(timeoutId);
        setGeneratingTtsId(null);
      }
    },
    [handleUploadAudio, requireEditAccess, showToast, syncWorkspaceToCloud],
  );

  const handleBulkUpload = useCallback(
    async (items: { dialogueId: string; file: File }[]) => {
      if (!requireEditAccess()) return;
      for (const item of items) {
        await handleUploadAudio(item.dialogueId, item.file);
      }
      showToast(`${items.length} file audio berhasil disimpan ke dialog skenario.`);
    },
    [handleUploadAudio, requireEditAccess, showToast],
  );

  const removeAudioSilently = useCallback(
    async (dialogueIds: string[]) => {
      if (activeDialogueId && dialogueIds.includes(activeDialogueId)) {
        handleStopPlayback();
        setActiveDialogueId(null);
      }
      const user = authUserRef.current;
      const shouldSyncCloud = Boolean(
        user &&
          user.emailVerified &&
          isAdminRef.current &&
          (await ensureSharedReady(user.uid)),
      );

      for (const id of dialogueIds) {
        try {
          await deleteAudioRecord(id);
        } catch {
          // Ignore DB error
        }
        if (shouldSyncCloud) {
          knownCloudAudioIdsRef.current.delete(id);
          try {
            await deleteSharedAudioFromCloud(id);
          } catch (err) {
            reportCloudError(err, 'Gagal menghapus audio di cloud.');
          }
        }
      }
      setAudioMap((prev) => {
        const next = { ...prev };
        for (const id of dialogueIds) {
          if (next[id]) {
            URL.revokeObjectURL(next[id].objectUrl);
            delete next[id];
          }
        }
        return next;
      });
    },
    [activeDialogueId, ensureSharedReady, handleStopPlayback, reportCloudError],
  );

  const handleRequestRemoveAudio = useCallback(
    (dialogue: DialogueItem) => {
      if (!requireEditAccess()) return;
      setPendingDelete({ kind: 'audio', dialogue });
    },
    [requireEditAccess],
  );

  const handleTogglePlayed = useCallback((dialogueId: string) => {
    setPlayedIds((prev) => {
      const exists = prev.includes(dialogueId);
      const next = exists
        ? prev.filter((id) => id !== dialogueId)
        : [...prev, dialogueId];
      void saveStateValue('playedIds', next);
      return next;
    });
  }, []);

  const handleResetPlayed = useCallback(() => {
    setPlayedIds([]);
    void saveStateValue('playedIds', []);
    showToast('Status pemutaran seluruh dialog telah direset di perangkat ini.');
  }, [showToast]);

  // --- Dialogue & Block Narrative CRUD & Reordering ---

  const handleSaveDialogue = useCallback(
    (payload: {
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
    }) => {
      if (!requireEditAccess()) return;
      const targetBlock = blocks.find((b) => b.id === payload.blockId);
      const phaseId: PhaseId = targetBlock?.phaseId ?? 'fase-2';
      const isNarrative = payload.entryType === 'narrative';

      setDialogues((prev) => {
        let updated: DialogueItem[];
        if (payload.id) {
          updated = prev.map((d) =>
            d.id === payload.id
              ? {
                  ...d,
                  entryType: payload.entryType,
                  blockId: payload.blockId,
                  phaseId,
                  title: isNarrative ? payload.title || undefined : undefined,
                  sender: isNarrative ? '' : payload.sender,
                  receiver: isNarrative ? '' : payload.receiver,
                  transcript: payload.transcript,
                  note: payload.note || undefined,
                  pageNumber: payload.pageNumber,
                  isEmergencyPriority: isNarrative
                    ? false
                    : payload.isEmergencyPriority,
                }
              : d,
          );
        } else {
          const newItem: DialogueItem = {
            id: `${isNarrative ? 'nar' : 'dlg'}-custom-${Date.now()}`,
            entryType: payload.entryType,
            sequenceNumber: 0,
            phaseId,
            blockId: payload.blockId,
            title: isNarrative ? payload.title || undefined : undefined,
            sender: isNarrative ? '' : payload.sender,
            receiver: isNarrative ? '' : payload.receiver,
            transcript: payload.transcript,
            note: payload.note || undefined,
            isEmergencyPriority: isNarrative
              ? false
              : payload.isEmergencyPriority,
            pageNumber: payload.pageNumber,
            isCustom: true,
          };

          if (payload.insertAfterDialogueId) {
            const insertIdx = prev.findIndex(
              (d) => d.id === payload.insertAfterDialogueId,
            );
            if (insertIdx !== -1) {
              updated = [
                ...prev.slice(0, insertIdx + 1),
                newItem,
                ...prev.slice(insertIdx + 1),
              ];
            } else {
              updated = [...prev, newItem];
            }
          } else {
            updated = [...prev, newItem];
          }
        }
        const renumbered = renumberDialogues(blocks, updated);
        void saveStateValue('dialogues', renumbered);
        syncWorkspaceToCloud({ dialogues: renumbered });
        return renumbered;
      });

      showToast(
        payload.id
          ? isNarrative
            ? 'Narasi blok berhasil diperbarui.'
            : 'Percakapan berhasil diperbarui.'
          : isNarrative
            ? 'Narasi baru ditambahkan ke blok.'
            : 'Percakapan baru ditambahkan ke skenario.',
      );
    },
    [blocks, requireEditAccess, showToast, syncWorkspaceToCloud],
  );

  const handleMoveDialogue = useCallback(
    (dialogueId: string, direction: 'up' | 'down') => {
      if (!requireEditAccess()) return;
      setDialogues((prev) => {
        const current = prev.find((d) => d.id === dialogueId);
        if (!current) return prev;

        const sameBlock = prev.filter((d) => d.blockId === current.blockId);
        const pos = sameBlock.findIndex((d) => d.id === dialogueId);
        const swapPos = direction === 'up' ? pos - 1 : pos + 1;
        if (pos === -1 || swapPos < 0 || swapPos >= sameBlock.length) {
          return prev;
        }

        const neighborId = sameBlock[swapPos].id;
        const idxA = prev.findIndex((d) => d.id === dialogueId);
        const idxB = prev.findIndex((d) => d.id === neighborId);
        if (idxA === -1 || idxB === -1) return prev;

        const next = [...prev];
        [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
        const renumbered = renumberDialogues(blocks, next);
        void saveStateValue('dialogues', renumbered);
        syncWorkspaceToCloud({ dialogues: renumbered });
        return renumbered;
      });
    },
    [blocks, requireEditAccess, syncWorkspaceToCloud],
  );

  const handleDropReorderDialogue = useCallback(
    (sourceDialogueId: string, targetDialogueId: string) => {
      if (!requireEditAccess()) return;
      if (sourceDialogueId === targetDialogueId) return;
      setDialogues((prev) => {
        const sourceIdx = prev.findIndex((d) => d.id === sourceDialogueId);
        const targetItem = prev.find((d) => d.id === targetDialogueId);
        if (sourceIdx === -1 || !targetItem) return prev;

        const movedItem: DialogueItem = {
          ...prev[sourceIdx],
          blockId: targetItem.blockId,
          phaseId: targetItem.phaseId,
        };
        const withoutSource = prev.filter((d) => d.id !== sourceDialogueId);
        const targetIdx = withoutSource.findIndex(
          (d) => d.id === targetDialogueId,
        );
        if (targetIdx === -1) return prev;

        const insertIndex = sourceIdx < targetIdx ? targetIdx + 1 : targetIdx;
        const next = [
          ...withoutSource.slice(0, insertIndex),
          movedItem,
          ...withoutSource.slice(insertIndex),
        ];

        const renumbered = renumberDialogues(blocks, next);
        void saveStateValue('dialogues', renumbered);
        syncWorkspaceToCloud({ dialogues: renumbered });
        return renumbered;
      });
      showToast('Urutan item di dalam blok diperbarui.');
    },
    [blocks, requireEditAccess, showToast, syncWorkspaceToCloud],
  );

  const handleDropDialogueIntoBlock = useCallback(
    (sourceDialogueId: string, targetBlockId: string) => {
      if (!requireEditAccess()) return;
      const targetBlock = blocks.find((b) => b.id === targetBlockId);
      if (!targetBlock) return;

      setDialogues((prev) => {
        const sourceItem = prev.find((d) => d.id === sourceDialogueId);
        if (!sourceItem || sourceItem.blockId === targetBlockId) return prev;

        const next = prev.map((d) =>
          d.id === sourceDialogueId
            ? { ...d, blockId: targetBlockId, phaseId: targetBlock.phaseId }
            : d,
        );
        const renumbered = renumberDialogues(blocks, next);
        void saveStateValue('dialogues', renumbered);
        syncWorkspaceToCloud({ dialogues: renumbered });
        return renumbered;
      });
      showToast(`Item dipindahkan ke ${targetBlock.code}.`);
    },
    [blocks, requireEditAccess, showToast, syncWorkspaceToCloud],
  );

  // --- Block CRUD & Reordering ---

  const commitSopPositions = useCallback(
    (nextPositions: PhaseSopPositions, toastText?: string) => {
      const clean = sanitizeSopPositions(nextPositions);
      setSopPositions(clean);
      void saveStateValue('sopPositions', clean);
      syncWorkspaceToCloud({ sopPositions: clean });
      if (toastText) showToast(toastText);
    },
    [showToast, syncWorkspaceToCloud],
  );

  const commitBlocksAndRenumber = useCallback(
    (
      nextBlocksRaw: CommunicationBlock[],
      toastText?: string,
      nextSopPositions?: PhaseSopPositions,
    ) => {
      const normalized = normalizeBlocksOrder(nextBlocksRaw);
      setBlocks(normalized);
      void saveStateValue('blocks', normalized);

      let cleanSopPos: PhaseSopPositions | undefined;
      if (nextSopPositions) {
        cleanSopPos = sanitizeSopPositions(nextSopPositions);
        setSopPositions(cleanSopPos);
        void saveStateValue('sopPositions', cleanSopPos);
      }

      setDialogues((prevDialogues) => {
        const renumbered = renumberDialogues(normalized, prevDialogues);
        void saveStateValue('dialogues', renumbered);
        syncWorkspaceToCloud({
          blocks: normalized,
          dialogues: renumbered,
          ...(cleanSopPos ? { sopPositions: cleanSopPos } : {}),
        });
        return renumbered;
      });

      if (toastText) showToast(toastText);
    },
    [showToast, syncWorkspaceToCloud],
  );

  const handleSaveBlock = useCallback(
    (payload: {
      id?: string;
      phaseId: PhaseId;
      code: string;
      title: string;
      channelType: string;
      description: string;
      pageNumber: number;
    }) => {
      if (!requireEditAccess()) return;
      if (payload.id) {
        const nextBlocks = blocks.map((b) =>
          b.id === payload.id
            ? {
                ...b,
                phaseId: payload.phaseId,
                code: payload.code,
                title: payload.title,
                channelType: payload.channelType,
                description: payload.description,
                pageNumber: payload.pageNumber,
              }
            : b,
        );
        commitBlocksAndRenumber(
          nextBlocks,
          `Blok "${payload.code}" berhasil diperbarui.`,
        );
      } else {
        const oldPhaseCount = blocks.filter(
          (b) => b.phaseId === payload.phaseId,
        ).length;
        const curSopPos = Math.max(
          0,
          Math.min(
            oldPhaseCount,
            sopPositions[payload.phaseId] ??
              (payload.phaseId === 'fase-4' ? 0 : oldPhaseCount),
          ),
        );
        const nextSopPos: PhaseSopPositions =
          curSopPos >= oldPhaseCount && payload.phaseId !== 'fase-4'
            ? { ...sopPositions, [payload.phaseId]: oldPhaseCount + 1 }
            : sopPositions;

        const newBlock: CommunicationBlock = {
          id: `blk-custom-${Date.now()}`,
          phaseId: payload.phaseId,
          code: payload.code,
          title: payload.title,
          channelType: payload.channelType,
          description: payload.description,
          pageNumber: payload.pageNumber,
        };
        commitBlocksAndRenumber(
          [...blocks, newBlock],
          `Blok baru "${payload.code}" ditambahkan.`,
          nextSopPos,
        );
      }
    },
    [blocks, sopPositions, commitBlocksAndRenumber, requireEditAccess],
  );

  const handleMoveBlock = useCallback(
    (blockId: string, direction: 'up' | 'down') => {
      if (!requireEditAccess()) return;
      const idx = blocks.findIndex((b) => b.id === blockId);
      if (idx === -1) return;

      const current = blocks[idx];
      const phaseBlocks = blocks.filter((b) => b.phaseId === current.phaseId);
      const posInPhase = phaseBlocks.findIndex((b) => b.id === blockId);
      const clampedSopPos = Math.max(
        0,
        Math.min(
          phaseBlocks.length,
          sopPositions[current.phaseId] ??
            (current.phaseId === 'fase-4' ? 0 : phaseBlocks.length),
        ),
      );

      // If the SOP panel sits immediately adjacent in the movement direction, swap past SOP first
      if (direction === 'up' && clampedSopPos === posInPhase) {
        const nextPos = Math.min(phaseBlocks.length, clampedSopPos + 1);
        commitSopPositions(
          { ...sopPositions, [current.phaseId]: nextPos },
          `${current.code} dipindahkan ke atas panel SOP.`,
        );
        return;
      }

      if (direction === 'down' && clampedSopPos === posInPhase + 1) {
        const nextPos = Math.max(0, clampedSopPos - 1);
        commitSopPositions(
          { ...sopPositions, [current.phaseId]: nextPos },
          `${current.code} dipindahkan ke bawah panel SOP.`,
        );
        return;
      }

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= blocks.length) return;

      const neighbor = blocks[swapIdx];
      const next = [...blocks];

      if (current.phaseId === neighbor.phaseId) {
        [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
        commitBlocksAndRenumber(next, `Urutan ${current.code} diperbarui.`);
      } else {
        const updatedCurrent: CommunicationBlock = {
          ...current,
          phaseId: neighbor.phaseId,
        };
        next.splice(idx, 1);
        const targetIndex = next.findIndex((b) => b.id === neighbor.id);
        const insertAt = direction === 'up' ? targetIndex + 1 : targetIndex;
        next.splice(insertAt, 0, updatedCurrent);

        const nextSopPositions: PhaseSopPositions = { ...sopPositions };
        if (posInPhase < clampedSopPos) {
          nextSopPositions[current.phaseId] = Math.max(0, clampedSopPos - 1);
        }
        const destPhaseBlocks = blocks.filter(
          (b) => b.phaseId === neighbor.phaseId,
        );
        const destSopPos = Math.max(
          0,
          Math.min(
            destPhaseBlocks.length,
            sopPositions[neighbor.phaseId] ??
              (neighbor.phaseId === 'fase-4' ? 0 : destPhaseBlocks.length),
          ),
        );
        const destInsertInPhase =
          direction === 'up' ? destPhaseBlocks.length : 0;
        if (destInsertInPhase <= destSopPos) {
          nextSopPositions[neighbor.phaseId] = destSopPos + 1;
        }

        commitBlocksAndRenumber(
          next,
          `Urutan ${current.code} diperbarui.`,
          nextSopPositions,
        );
      }
    },
    [
      blocks,
      sopPositions,
      commitBlocksAndRenumber,
      commitSopPositions,
      requireEditAccess,
    ],
  );

  const handleDropReorderBlock = useCallback(
    (sourceBlockId: string, targetBlockId: string) => {
      if (!requireEditAccess()) return;
      if (sourceBlockId === targetBlockId) return;
      const sourceIdx = blocks.findIndex((b) => b.id === sourceBlockId);
      const targetBlock = blocks.find((b) => b.id === targetBlockId);
      if (sourceIdx === -1 || !targetBlock) return;

      const movedBlock: CommunicationBlock = {
        ...blocks[sourceIdx],
        phaseId: targetBlock.phaseId,
      };
      const withoutSource = blocks.filter((b) => b.id !== sourceBlockId);
      const targetIdx = withoutSource.findIndex((b) => b.id === targetBlockId);
      if (targetIdx === -1) return;

      const insertIndex = sourceIdx < targetIdx ? targetIdx + 1 : targetIdx;
      const next = [
        ...withoutSource.slice(0, insertIndex),
        movedBlock,
        ...withoutSource.slice(insertIndex),
      ];

      commitBlocksAndRenumber(next, `Urutan ${movedBlock.code} diperbarui.`);
    },
    [blocks, commitBlocksAndRenumber, requireEditAccess],
  );

  const handleMoveSopPanel = useCallback(
    (phaseId: PhaseId, direction: 'up' | 'down') => {
      if (!requireEditAccess()) return;
      const phaseBlocks = blocks.filter((b) => b.phaseId === phaseId);
      const curPos = Math.max(
        0,
        Math.min(
          phaseBlocks.length,
          sopPositions[phaseId] ??
            (phaseId === 'fase-4' ? 0 : phaseBlocks.length),
        ),
      );
      const nextPos =
        direction === 'up'
          ? Math.max(0, curPos - 1)
          : Math.min(phaseBlocks.length, curPos + 1);
      if (nextPos === curPos) return;

      commitSopPositions(
        { ...sopPositions, [phaseId]: nextPos },
        direction === 'up'
          ? 'Panel SOP dipindahkan ke atas.'
          : 'Panel SOP dipindahkan ke bawah.',
      );
    },
    [blocks, sopPositions, commitSopPositions, requireEditAccess],
  );

  const handleDropSopPanelOnBlock = useCallback(
    (sopPhaseId: PhaseId, targetBlockId: string) => {
      if (!requireEditAccess()) return;
      const targetBlock = blocks.find((b) => b.id === targetBlockId);
      if (!targetBlock) return;
      if (targetBlock.phaseId !== sopPhaseId) {
        showToast(
          'Panel SOP dapat dipindahkan di antara blok dalam tahap yang sama.',
          'error',
        );
        return;
      }

      const phaseBlocks = blocks.filter((b) => b.phaseId === sopPhaseId);
      const targetIdx = phaseBlocks.findIndex((b) => b.id === targetBlockId);
      if (targetIdx === -1) return;

      const curPos = Math.max(
        0,
        Math.min(
          phaseBlocks.length,
          sopPositions[sopPhaseId] ??
            (sopPhaseId === 'fase-4' ? 0 : phaseBlocks.length),
        ),
      );
      const nextPos = curPos <= targetIdx ? targetIdx + 1 : targetIdx;
      if (nextPos === curPos) return;

      commitSopPositions(
        { ...sopPositions, [sopPhaseId]: nextPos },
        `Posisi panel SOP dipindahkan ${curPos <= targetIdx ? 'ke bawah' : 'ke atas'} ${targetBlock.code}.`,
      );
    },
    [blocks, sopPositions, commitSopPositions, requireEditAccess, showToast],
  );

  const handleDropBlockOnSopPanel = useCallback(
    (sourceBlockId: string, targetPhaseId: PhaseId) => {
      if (!requireEditAccess()) return;
      const sourceBlock = blocks.find((b) => b.id === sourceBlockId);
      if (!sourceBlock) return;

      const targetPhaseBlocks = blocks.filter((b) => b.phaseId === targetPhaseId);
      const curTargetSopPos = Math.max(
        0,
        Math.min(
          targetPhaseBlocks.length,
          sopPositions[targetPhaseId] ??
            (targetPhaseId === 'fase-4' ? 0 : targetPhaseBlocks.length),
        ),
      );

      if (sourceBlock.phaseId === targetPhaseId) {
        const srcIdx = targetPhaseBlocks.findIndex((b) => b.id === sourceBlockId);
        if (srcIdx === -1) return;

        const reorderedPhase = [...targetPhaseBlocks];
        const [moved] = reorderedPhase.splice(srcIdx, 1);

        let nextSopPos = curTargetSopPos;
        if (srcIdx < curTargetSopPos) {
          // Was above SOP -> place immediately below SOP
          const insertIdx = Math.max(0, curTargetSopPos - 1);
          reorderedPhase.splice(insertIdx, 0, moved);
          nextSopPos = Math.max(0, curTargetSopPos - 1);
        } else {
          // Was below SOP -> place immediately above SOP
          reorderedPhase.splice(curTargetSopPos, 0, moved);
          nextSopPos = Math.min(targetPhaseBlocks.length, curTargetSopPos + 1);
        }

        const otherBlocks = blocks.filter((b) => b.phaseId !== targetPhaseId);
        commitBlocksAndRenumber(
          [...otherBlocks, ...reorderedPhase],
          `${sourceBlock.code} dipindahkan melewati panel SOP.`,
          { ...sopPositions, [targetPhaseId]: nextSopPos },
        );
        return;
      }

      // Cross-phase drag onto another phase's SOP panel: insert right before that SOP panel
      const oldPhaseBlocks = blocks.filter(
        (b) => b.phaseId === sourceBlock.phaseId,
      );
      const oldIdx = oldPhaseBlocks.findIndex((b) => b.id === sourceBlockId);
      const oldSopPos = Math.max(
        0,
        Math.min(
          oldPhaseBlocks.length,
          sopPositions[sourceBlock.phaseId] ??
            (sourceBlock.phaseId === 'fase-4' ? 0 : oldPhaseBlocks.length),
        ),
      );

      const updatedTargetPhase = [...targetPhaseBlocks];
      updatedTargetPhase.splice(curTargetSopPos, 0, {
        ...sourceBlock,
        phaseId: targetPhaseId,
      });

      const remainingBlocks = blocks.filter(
        (b) => b.id !== sourceBlockId && b.phaseId !== targetPhaseId,
      );

      const nextSopPositions: PhaseSopPositions = {
        ...sopPositions,
        [targetPhaseId]: curTargetSopPos + 1,
      };
      if (oldIdx !== -1 && oldIdx < oldSopPos) {
        nextSopPositions[sourceBlock.phaseId] = Math.max(0, oldSopPos - 1);
      }

      commitBlocksAndRenumber(
        [...remainingBlocks, ...updatedTargetPhase],
        `${sourceBlock.code} dipindahkan ke atas panel SOP.`,
        nextSopPositions,
      );
    },
    [blocks, sopPositions, commitBlocksAndRenumber, requireEditAccess],
  );

  // --- SOP CRUD & Reordering ---

  const handleSaveSop = useCallback(
    (payload: {
      id?: string;
      phaseId: PhaseId;
      unit: string;
      steps: string[];
      pageNumber: number;
    }) => {
      if (!requireEditAccess()) return;
      setSopItems((prev) => {
        let next: SopItem[];
        if (payload.id) {
          next = prev.map((item) =>
            item.id === payload.id
              ? {
                  ...item,
                  phaseId: payload.phaseId,
                  phaseTitle: PHASE_SOP_TITLE[payload.phaseId],
                  unit: payload.unit,
                  steps: payload.steps,
                  pageNumber: payload.pageNumber,
                }
              : item,
          );
        } else {
          const newSop: SopItem = {
            id: `sop-custom-${Date.now()}`,
            phaseId: payload.phaseId,
            phaseTitle: PHASE_SOP_TITLE[payload.phaseId],
            unit: payload.unit,
            steps: payload.steps,
            pageNumber: payload.pageNumber,
          };
          next = [...prev, newSop];
        }
        const normalized = normalizeSopsOrder(next);
        void saveStateValue('sopItems', normalized);
        syncWorkspaceToCloud({ sopItems: normalized });
        return normalized;
      });

      showToast(
        payload.id
          ? `Rincian SOP "${payload.unit}" berhasil diperbarui.`
          : `Rincian SOP "${payload.unit}" ditambahkan.`,
      );
    },
    [requireEditAccess, showToast, syncWorkspaceToCloud],
  );

  const handleMoveSop = useCallback(
    (sopId: string, direction: 'up' | 'down') => {
      if (!requireEditAccess()) return;
      setSopItems((prev) => {
        const current = prev.find((s) => s.id === sopId);
        if (!current) return prev;

        const samePhase = prev.filter((s) => s.phaseId === current.phaseId);
        const pos = samePhase.findIndex((s) => s.id === sopId);
        const swapPos = direction === 'up' ? pos - 1 : pos + 1;
        if (pos === -1 || swapPos < 0 || swapPos >= samePhase.length) return prev;

        const neighborId = samePhase[swapPos].id;
        const idxA = prev.findIndex((s) => s.id === sopId);
        const idxB = prev.findIndex((s) => s.id === neighborId);
        if (idxA === -1 || idxB === -1) return prev;

        const next = [...prev];
        [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
        const normalized = normalizeSopsOrder(next);
        void saveStateValue('sopItems', normalized);
        syncWorkspaceToCloud({ sopItems: normalized });
        return normalized;
      });
    },
    [requireEditAccess, syncWorkspaceToCloud],
  );

  const handleDropReorderSop = useCallback(
    (sourceSopId: string, targetSopId: string) => {
      if (!requireEditAccess()) return;
      if (sourceSopId === targetSopId) return;
      setSopItems((prev) => {
        const sourceIdx = prev.findIndex((s) => s.id === sourceSopId);
        const targetItem = prev.find((s) => s.id === targetSopId);
        if (sourceIdx === -1 || !targetItem) return prev;

        const movedSop: SopItem = {
          ...prev[sourceIdx],
          phaseId: targetItem.phaseId,
          phaseTitle: PHASE_SOP_TITLE[targetItem.phaseId],
        };
        const withoutSource = prev.filter((s) => s.id !== sourceSopId);
        const targetIdx = withoutSource.findIndex((s) => s.id === targetSopId);
        if (targetIdx === -1) return prev;

        const insertIndex = sourceIdx < targetIdx ? targetIdx + 1 : targetIdx;
        const next = [
          ...withoutSource.slice(0, insertIndex),
          movedSop,
          ...withoutSource.slice(insertIndex),
        ];

        const normalized = normalizeSopsOrder(next);
        void saveStateValue('sopItems', normalized);
        syncWorkspaceToCloud({ sopItems: normalized });
        return normalized;
      });
      showToast('Urutan baris SOP diperbarui.');
    },
    [requireEditAccess, showToast, syncWorkspaceToCloud],
  );

  // --- Incident Narrative Edit ---

  const handleSaveNarrative = useCallback(
    (updated: IncidentNarrative) => {
      if (!requireEditAccess()) return;
      setIncidentNarrative(updated);
      void saveStateValue('incidentNarrative', updated);
      syncWorkspaceToCloud({ incidentNarrative: updated });
      showToast('Narasi Dinamika Kejadian (Bagian IV) diperbarui.');
    },
    [requireEditAccess, showToast, syncWorkspaceToCloud],
  );

  // --- Editable Scenario Header Card Metadata ---

  const handleSaveScenarioMeta = useCallback(
    (updated: ScenarioMeta) => {
      if (!requireEditAccess()) return;
      const clean = sanitizeScenarioMeta(updated);
      setScenarioMeta(clean);
      void saveStateValue('scenarioMeta', clean);
      syncWorkspaceToCloud({ scenarioMeta: clean });
      showToast('Kartu header skenario berhasil diperbarui.');
    },
    [requireEditAccess, showToast, syncWorkspaceToCloud],
  );

  const handleOpenRecordAudio = useCallback(
    (dialogue: DialogueItem) => {
      if (!requireEditAccess()) return;
      if (isPlaying || isSequenceActive) {
        handleStopPlayback();
      }
      setRecordingTargetDialogue(dialogue);
    },
    [handleStopPlayback, isPlaying, isSequenceActive, requireEditAccess],
  );

  // --- Confirmed Deletion for Dialogue/Narrative, Block, or SOP ---

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    if (!requireEditAccess()) {
      setPendingDelete(null);
      return;
    }
    const item = pendingDelete;
    setPendingDelete(null);

    if (item.kind === 'audio') {
      const isNarrative = item.dialogue.entryType === 'narrative';
      await removeAudioSilently([item.dialogue.id]);
      showToast(
        isNarrative
          ? `Audio narasi "${item.dialogue.title || 'Narasi Skenario'}" telah dikosongkan.`
          : `Audio percakapan #${formatSequenceNumber(item.dialogue.sequenceNumber)} telah dikosongkan.`,
      );
      return;
    }

    if (item.kind === 'dialogue') {
      const targetId = item.dialogue.id;
      const isNarrative = item.dialogue.entryType === 'narrative';
      await removeAudioSilently([targetId]);
      if (!isNarrative) {
        const nextPlayed = playedIdsRef.current.filter((id) => id !== targetId);
        setPlayedIds(nextPlayed);
        void saveStateValue('playedIds', nextPlayed);
      }
      setDialogues((prev) => {
        const next = renumberDialogues(
          blocks,
          prev.filter((d) => d.id !== targetId),
        );
        void saveStateValue('dialogues', next);
        syncWorkspaceToCloud({ dialogues: next });
        return next;
      });
      showToast(
        isNarrative
          ? 'Narasi blok telah dihapus.'
          : `Percakapan #${formatSequenceNumber(item.dialogue.sequenceNumber)} telah dihapus.`,
      );
      return;
    }

    if (item.kind === 'block') {
      const blockId = item.block.id;
      const affectedEntryIds = dialogues
        .filter((d) => d.blockId === blockId)
        .map((d) => d.id);

      await removeAudioSilently(affectedEntryIds);

      const removeSet = new Set(affectedEntryIds);
      const nextPlayed = playedIdsRef.current.filter((id) => !removeSet.has(id));
      setPlayedIds(nextPlayed);
      void saveStateValue('playedIds', nextPlayed);

      const phaseOfDeleted = item.block.phaseId;
      const phaseBlocksBeforeDelete = blocks.filter(
        (b) => b.phaseId === phaseOfDeleted,
      );
      const delIdxInPhase = phaseBlocksBeforeDelete.findIndex(
        (b) => b.id === blockId,
      );
      const curSopPos = Math.max(
        0,
        Math.min(
          phaseBlocksBeforeDelete.length,
          sopPositions[phaseOfDeleted] ??
            (phaseOfDeleted === 'fase-4' ? 0 : phaseBlocksBeforeDelete.length),
        ),
      );
      const nextSopPositions: PhaseSopPositions =
        delIdxInPhase !== -1 && delIdxInPhase < curSopPos
          ? { ...sopPositions, [phaseOfDeleted]: Math.max(0, curSopPos - 1) }
          : sopPositions;

      const nextBlocks = normalizeBlocksOrder(
        blocks.filter((b) => b.id !== blockId),
      );
      setBlocks(nextBlocks);
      void saveStateValue('blocks', nextBlocks);
      setSopPositions(nextSopPositions);
      void saveStateValue('sopPositions', nextSopPositions);

      setDialogues((prev) => {
        const next = renumberDialogues(
          nextBlocks,
          prev.filter((d) => d.blockId !== blockId),
        );
        void saveStateValue('dialogues', next);
        syncWorkspaceToCloud({
          blocks: nextBlocks,
          dialogues: next,
          sopPositions: nextSopPositions,
        });
        return next;
      });

      showToast(`Blok "${item.block.code}" telah dihapus.`);
      return;
    }

    if (item.kind === 'sop') {
      const targetSopId = item.sop.id;
      setSopItems((prev) => {
        const next = normalizeSopsOrder(prev.filter((s) => s.id !== targetSopId));
        void saveStateValue('sopItems', next);
        syncWorkspaceToCloud({ sopItems: next });
        return next;
      });
      showToast(`Rincian SOP "${item.sop.unit}" telah dihapus.`);
    }
  }, [
    blocks,
    dialogues,
    sopPositions,
    pendingDelete,
    removeAudioSilently,
    requireEditAccess,
    showToast,
    syncWorkspaceToCloud,
  ]);

  // --- Multi-Savestate (Full Page + Deduplicated Audio Vault, Local + Cloud) ---

  const captureCurrentSavestate = useCallback(
    async (
      id: string,
      name: string,
      note: string,
      createdAt: number,
    ): Promise<{ savestate: WorkspaceSavestate; skippedLargeCloudCount: number }> => {
      const now = Date.now();
      const activeDialogueIds = new Set(dialoguesRef.current.map((d) => d.id));
      const allActiveAudios = await getAllAudioRecords();
      const relevantAudios = allActiveAudios.filter((rec) =>
        activeDialogueIds.has(rec.dialogueId),
      );

      const audioRefs: SavestateAudioRef[] = [];
      const vaultRecordsToUpload: AudioVaultRecord[] = [];

      for (const rec of relevantAudios) {
        const rev = rec.revision || createAudioRevision();
        if (!rec.revision) {
          // Persist revision on active audio so future savestates deduplicate seamlessly
          const withRev: StoredAudioRecord = { ...rec, revision: rev };
          await saveAudioRecord(withRev);
          setAudioMap((prev) =>
            prev[rec.dialogueId]
              ? {
                  ...prev,
                  [rec.dialogueId]: {
                    ...prev[rec.dialogueId],
                    revision: rev,
                  },
                }
              : prev,
          );
        }

        const assetId = buildVaultAssetId(rev);
        const existingVault = await getAudioVaultRecord(assetId);
        const vaultRecord: AudioVaultRecord = existingVault ?? {
          assetId,
          fileName: rec.fileName,
          mimeType: rec.mimeType,
          size: rec.size,
          duration: rec.duration,
          blob: rec.blob,
          createdAt: now,
        };

        if (!existingVault) {
          await saveAudioVaultRecord(vaultRecord);
        }

        vaultRecordsToUpload.push(vaultRecord);
        audioRefs.push({
          dialogueId: rec.dialogueId,
          assetId,
          fileName: rec.fileName,
          mimeType: rec.mimeType,
          size: rec.size,
          duration: rec.duration,
        });
      }

      const clonedBlocks: CommunicationBlock[] = blocksRef.current.map((b) => ({
        ...b,
      }));
      const clonedDialogues: DialogueItem[] = dialoguesRef.current.map((d) => ({
        ...d,
      }));
      const clonedSops: SopItem[] = sopItemsRef.current.map((s) => ({
        ...s,
        steps: [...s.steps],
      }));
      const clonedPositions: PhaseSopPositions = sanitizeSopPositions(
        sopPositionsRef.current,
      );
      const clonedNarrative: IncidentNarrative = {
        ...incidentNarrativeRef.current,
      };
      const clonedScenarioMeta: ScenarioMeta = sanitizeScenarioMeta(
        scenarioMetaRef.current,
      );
      const clonedPlayed = [...playedIdsRef.current];

      let savestate: WorkspaceSavestate = {
        id,
        name: name.trim(),
        note: note.trim(),
        createdAt,
        updatedAt: now,
        blocks: clonedBlocks,
        dialogues: clonedDialogues,
        sopItems: clonedSops,
        sopPositions: clonedPositions,
        incidentNarrative: clonedNarrative,
        scenarioMeta: clonedScenarioMeta,
        playedIds: clonedPlayed,
        audioRefs,
        syncedToCloud: false,
      };

      await saveSavestateRecord(savestate);
      setSavestates((prev) => {
        const filtered = prev.filter((s) => s.id !== savestate.id);
        return [savestate, ...filtered].sort(
          (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
        );
      });

      let skippedLargeCloudCount = 0;
      const user = authUserRef.current;
      if (
        user &&
        user.emailVerified &&
        isAdminRef.current &&
        !cloudWriteQuotaExceededRef.current
      ) {
        setSavestateBusyMessage('Menyiapkan ruang Cloud Savestate...');
        const privReady = await ensurePrivateReady(user);
        if (privReady) {
          savingSavestateIdsRef.current.add(id);
          try {
            const knownVaultIds = await fetchExistingSavestateAudioIds(
              user.uid,
            );
            const missingVaultRecords = vaultRecordsToUpload.filter(
              (vRec) => !knownVaultIds.has(vRec.assetId),
            );
            if (missingVaultRecords.length > 0) {
              let completed = 0;
              setSavestateBusyMessage(
                `Menyinkronkan audio savestate (0/${missingVaultRecords.length})...`,
              );
              await runWithConcurrency(missingVaultRecords, 4, async (vRec) => {
                if (cloudWriteQuotaExceededRef.current) return;
                try {
                  const res = await uploadSavestateAudioAssetToCloud(
                    user.uid,
                    vRec,
                    knownVaultIds,
                  );
                  if (!res.uploaded && res.reason === 'too-large') {
                    skippedLargeCloudCount += 1;
                  }
                  completed += 1;
                  setSavestateBusyMessage(
                    `Menyinkronkan audio savestate (${completed}/${missingVaultRecords.length})...`,
                  );
                } catch (uploadErr) {
                  if (isFirestoreQuotaError(uploadErr)) {
                    cloudWriteQuotaExceededRef.current = true;
                  }
                  throw uploadErr;
                }
              });
            }
            if (!cloudWriteQuotaExceededRef.current) {
              setSavestateBusyMessage('Menyimpan metadata savestate ke Cloud...');
              await saveSavestateToCloud(user.uid, savestate);
              savestate = { ...savestate, syncedToCloud: true };
              await saveSavestateRecord(savestate);
              setSavestates((prev) =>
                prev.map((s) => (s.id === savestate.id ? savestate : s)),
              );
            }
          } finally {
            savingSavestateIdsRef.current.delete(id);
          }
        }
      }

      return { savestate, skippedLargeCloudCount };
    },
    [ensurePrivateReady, isFirestoreQuotaError],
  );

  const handleCreateSavestate = useCallback(
    async (name: string, note: string): Promise<boolean> => {
      if (!requireEditAccess()) return false;
      setSavestateBusyMessage('Menyimpan savestate & file audio...');
      try {
        const { savestate, skippedLargeCloudCount } =
          await captureCurrentSavestate(
            createSavestateId(),
            name,
            note,
            Date.now(),
          );
        showToast(
          skippedLargeCloudCount > 0
            ? `Savestate "${savestate.name}" tersimpan (${savestate.audioRefs.length} audio; ${skippedLargeCloudCount} file >10MB hanya lokal).`
            : savestate.syncedToCloud
              ? `Savestate "${savestate.name}" (${savestate.audioRefs.length} audio) tersimpan lokal & Cloud.`
              : `Savestate "${savestate.name}" (${savestate.audioRefs.length} audio) tersimpan di perangkat ini.`,
        );
        return true;
      } catch (err) {
        reportCloudError(
          err,
          'Savestate gagal disinkronkan penuh. Coba lagi beberapa saat.',
        );
        return false;
      } finally {
        setSavestateBusyMessage(null);
      }
    },
    [captureCurrentSavestate, reportCloudError, requireEditAccess, showToast],
  );

  const handleOverwriteSavestate = useCallback(
    async (target: WorkspaceSavestate): Promise<boolean> => {
      if (!requireEditAccess()) return false;
      setSavestateBusyMessage(`Memperbarui savestate "${target.name}"...`);
      try {
        const { savestate } = await captureCurrentSavestate(
          target.id,
          target.name,
          target.note,
          target.createdAt,
        );
        void pruneUnreferencedVaultAudios();
        showToast(
          `Savestate "${savestate.name}" diperbarui dengan kondisi halaman saat ini (${savestate.audioRefs.length} audio).`,
        );
        return true;
      } catch (err) {
        reportCloudError(err, `Gagal memperbarui savestate "${target.name}".`);
        return false;
      } finally {
        setSavestateBusyMessage(null);
      }
    },
    [captureCurrentSavestate, reportCloudError, requireEditAccess, showToast],
  );

  const handleRenameSavestate = useCallback(
    async (
      savestateId: string,
      name: string,
      note: string,
    ): Promise<boolean> => {
      if (!requireEditAccess()) return false;
      const target = savestatesRef.current.find((s) => s.id === savestateId);
      if (!target) return false;

      setSavestateBusyMessage('Menyimpan perubahan nama savestate...');
      try {
        const updated: WorkspaceSavestate = {
          ...target,
          name: name.trim(),
          note: note.trim(),
          updatedAt: Date.now(),
        };
        await saveSavestateRecord(updated);
        setSavestates((prev) =>
          prev
            .map((s) => (s.id === savestateId ? updated : s))
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
        );

        const user = authUserRef.current;
        if (
          user &&
          user.emailVerified &&
          isAdminRef.current &&
          (await ensurePrivateReady(user))
        ) {
          savingSavestateIdsRef.current.add(savestateId);
          try {
            if (target.syncedToCloud) {
              await renameSavestateInCloud(
                user.uid,
                savestateId,
                updated.name,
                updated.note,
              );
            } else {
              await saveSavestateToCloud(user.uid, updated);
              const syncedUpdated: WorkspaceSavestate = {
                ...updated,
                syncedToCloud: true,
              };
              await saveSavestateRecord(syncedUpdated);
              setSavestates((prev) =>
                prev.map((s) => (s.id === savestateId ? syncedUpdated : s)),
              );
            }
          } finally {
            savingSavestateIdsRef.current.delete(savestateId);
          }
        }

        showToast(`Nama savestate diperbarui menjadi "${updated.name}".`);
        return true;
      } catch (err) {
        reportCloudError(err, 'Gagal mengubah nama savestate di Cloud.');
        return false;
      } finally {
        setSavestateBusyMessage(null);
      }
    },
    [ensurePrivateReady, reportCloudError, requireEditAccess, showToast],
  );

  const handleDeleteSavestate = useCallback(
    async (target: WorkspaceSavestate): Promise<boolean> => {
      if (!requireEditAccess()) return false;
      setSavestateBusyMessage(`Menghapus savestate "${target.name}"...`);
      try {
        await deleteSavestateRecord(target.id);
        setSavestates((prev) => prev.filter((s) => s.id !== target.id));

        const user = authUserRef.current;
        if (
          user &&
          user.emailVerified &&
          isAdminRef.current &&
          (await ensurePrivateReady(user))
        ) {
          await deleteSavestateFromCloud(user.uid, target.id);
        }

        await pruneUnreferencedVaultAudios();
        showToast(`Savestate "${target.name}" telah dihapus.`);
        return true;
      } catch (err) {
        reportCloudError(err, `Gagal menghapus savestate "${target.name}".`);
        return false;
      } finally {
        setSavestateBusyMessage(null);
      }
    },
    [ensurePrivateReady, reportCloudError, requireEditAccess, showToast],
  );

  const handleSyncSingleSavestate = useCallback(
    async (target: WorkspaceSavestate): Promise<boolean> => {
      const user = authUserRef.current;
      if (!user || !user.emailVerified || !isAdminRef.current) {
        showToast(
          'Masuk dengan akun Google Admin untuk menyinkronkan savestate ke Cloud.',
          'error',
        );
        return false;
      }
      cloudWriteQuotaExceededRef.current = false;
      setSavestateBusyMessage(
        `Menyinkronkan savestate "${target.name}" ke Cloud...`,
      );
      try {
        const res = await syncSavestatesToCloud(user, [target], (msg) =>
          setSavestateBusyMessage(msg),
        );
        if (res.failedCount > 0) {
          reportCloudError(
            res.firstError,
            `Savestate "${target.name}" gagal disinkronkan ke Cloud.`,
          );
          return false;
        }
        showToast(
          res.skippedLargeCount > 0
            ? `Savestate "${target.name}" tersinkron ke Cloud (${res.skippedLargeCount} audio >10MB hanya lokal).`
            : `Savestate "${target.name}" berhasil disinkronkan ke Cloud.`,
        );
        return true;
      } catch (err) {
        reportCloudError(
          err,
          `Gagal menyinkronkan savestate "${target.name}" ke Cloud.`,
        );
        return false;
      } finally {
        setSavestateBusyMessage(null);
      }
    },
    [reportCloudError, showToast, syncSavestatesToCloud],
  );

  const handleSyncLocalSavestates = useCallback(async () => {
    const user = authUserRef.current;
    if (!user || !user.emailVerified || !isAdminRef.current) {
      showToast(
        'Masuk dengan akun Google Admin untuk menyinkronkan savestate ke Cloud.',
        'error',
      );
      return;
    }
    const targets = savestatesRef.current.filter((s) => !s.syncedToCloud);
    if (targets.length === 0) {
      showToast('Semua savestate sudah tersinkron di Cloud.');
      return;
    }

    cloudWriteQuotaExceededRef.current = false;
    setSavestateBusyMessage(
      `Menyinkronkan ${targets.length} savestate lokal ke Cloud...`,
    );
    try {
      const res = await syncSavestatesToCloud(user, targets, (msg) =>
        setSavestateBusyMessage(msg),
      );
      if (res.failedCount > 0) {
        reportCloudError(
          res.firstError,
          `${res.syncedCount} savestate tersinkron, ${res.failedCount} gagal. Silakan coba lagi.`,
        );
        return;
      }
      showToast(
        res.skippedLargeCount > 0
          ? `${res.syncedCount} savestate tersinkron ke Cloud (${res.skippedLargeCount} audio >10MB hanya lokal).`
          : `${res.syncedCount} savestate lokal berhasil disinkronkan ke Cloud.`,
      );
    } catch (err) {
      reportCloudError(err, 'Gagal menyinkronkan savestate lokal ke Cloud.');
    } finally {
      setSavestateBusyMessage(null);
    }
  }, [reportCloudError, showToast, syncSavestatesToCloud]);

  const handleLoadSavestate = useCallback(
    async (
      target: WorkspaceSavestate,
      saveCurrentFirst: boolean,
    ): Promise<boolean> => {
      if (!requireEditAccess()) return false;
      handleStopPlayback();
      setActiveDialogueId(null);

      try {
        if (saveCurrentFirst) {
          const timeLabel = new Intl.DateTimeFormat('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date());
          setSavestateBusyMessage('Menyimpan kondisi aktif sebagai cadangan...');
          await captureCurrentSavestate(
            createSavestateId(),
            `Cadangan Otomatis (${timeLabel})`,
            `Disimpan otomatis sebelum memuat "${target.name}"`,
            Date.now(),
          );
        }

        setSavestateBusyMessage(`Memulihkan file audio dari "${target.name}"...`);
        const user = authUserRef.current;
        const canFetchVaultCloud = Boolean(
          user &&
            user.emailVerified &&
            isAdminRef.current &&
            (await ensurePrivateReady(user)),
        );
        const canSyncSharedCloud = Boolean(
          user &&
            user.emailVerified &&
            isAdminRef.current &&
            (await ensureSharedReady(user.uid)),
        );

        const restoredRecords: StoredAudioRecord[] = [];
        let missingAudioCount = 0;
        let restoredCompleted = 0;

        await runWithConcurrency(target.audioRefs, 4, async (audioRef) => {
          let vaultRec = await getAudioVaultRecord(audioRef.assetId);
          if (!vaultRec && canFetchVaultCloud && user) {
            vaultRec = await downloadSavestateAudioAssetFromCloud(
              user.uid,
              audioRef,
            );
            if (vaultRec) {
              try {
                await saveAudioVaultRecord(vaultRec);
              } catch {
                // Continue even if local cache quota is tight
              }
            }
          }

          restoredCompleted += 1;
          setSavestateBusyMessage(
            `Memulihkan audio (${restoredCompleted}/${target.audioRefs.length})...`,
          );

          if (!vaultRec) {
            missingAudioCount += 1;
            return;
          }

          const nextRev = createAudioRevision();
          restoredRecords.push({
            dialogueId: audioRef.dialogueId,
            fileName: vaultRec.fileName,
            mimeType: vaultRec.mimeType,
            size: vaultRec.size,
            duration: vaultRec.duration,
            blob: vaultRec.blob,
            updatedAt: Date.now(),
            revision: nextRev,
          });
        });

        // Replace active audio store cleanly so audios not in this savestate become empty
        await clearAllAudioRecords();
        for (const rec of restoredRecords) {
          await saveAudioRecord(rec);
        }

        const restoredBlocks =
          target.blocks.length > 0
            ? normalizeBlocksOrder(target.blocks)
            : COMMUNICATION_BLOCKS;
        const restoredDialogues = renumberDialogues(
          restoredBlocks,
          target.dialogues,
        );
        const restoredSops =
          target.sopItems.length > 0
            ? normalizeSopsOrder(target.sopItems)
            : SOP_ITEMS;
        const restoredSopPositions = sanitizeSopPositions(target.sopPositions);
        const restoredNarrative = target.incidentNarrative?.body
          ? target.incidentNarrative
          : TOUCHDOWN_NARRATIVE;
        const restoredScenarioMeta = target.scenarioMeta
          ? sanitizeScenarioMeta(target.scenarioMeta)
          : DEFAULT_SCENARIO_META;
        const restoredPlayed = Array.isArray(target.playedIds)
          ? [...target.playedIds]
          : [];

        setBlocks(restoredBlocks);
        setDialogues(restoredDialogues);
        setSopItems(restoredSops);
        setSopPositions(restoredSopPositions);
        setIncidentNarrative(restoredNarrative);
        setScenarioMeta(restoredScenarioMeta);
        setPlayedIds(restoredPlayed);

        void saveStateValue('blocks', restoredBlocks);
        void saveStateValue('dialogues', restoredDialogues);
        void saveStateValue('sopItems', restoredSops);
        void saveStateValue('sopPositions', restoredSopPositions);
        void saveStateValue('incidentNarrative', restoredNarrative);
        void saveStateValue('scenarioMeta', restoredScenarioMeta);
        void saveStateValue('playedIds', restoredPlayed);

        setAudioMap((prev) => {
          Object.values(prev).forEach((entry) =>
            URL.revokeObjectURL(entry.objectUrl),
          );
          const nextMap: Record<string, AudioEntryView> = {};
          for (const rec of restoredRecords) {
            nextMap[rec.dialogueId] = {
              dialogueId: rec.dialogueId,
              fileName: rec.fileName,
              mimeType: rec.mimeType,
              size: rec.size,
              duration: rec.duration,
              objectUrl: URL.createObjectURL(rec.blob),
              updatedAt: rec.updatedAt,
              revision: rec.revision,
            };
          }
          return nextMap;
        });

        // Synchronize the newly loaded active workspace & active audios to Cloud Admin
        if (canSyncSharedCloud && user) {
          setSavestateBusyMessage('Menyinkronkan halaman aktif baru ke Cloud Admin...');
          setCloudSyncStatus('syncing');
          setCloudSyncDetail(`Memuat savestate "${target.name}"...`);
          try {
            await pushSharedWorkspaceUpdate(user.uid, {
              blocks: restoredBlocks,
              dialogues: restoredDialogues,
              sopItems: restoredSops,
              sopPositions: restoredSopPositions,
              incidentNarrative: restoredNarrative,
              scenarioMeta: restoredScenarioMeta,
            });

            const restoredIds = new Set(restoredRecords.map((r) => r.dialogueId));
            const obsoleteCloudAudioIds = Array.from(
              knownCloudAudioIdsRef.current,
            ).filter((id) => !restoredIds.has(id));

            await runWithConcurrency(obsoleteCloudAudioIds, 4, async (oldId) => {
              knownCloudAudioIdsRef.current.delete(oldId);
              await deleteSharedAudioFromCloud(oldId);
            });

            let syncedRestored = 0;
            await runWithConcurrency(restoredRecords, 4, async (rec) => {
              const rev = rec.revision || createAudioRevision();
              uploadingAudioIdsRef.current.add(rec.dialogueId);
              try {
                const res = await uploadSharedAudioToCloud(user.uid, rec, rev);
                if (res.uploaded) {
                  knownCloudAudioIdsRef.current.add(rec.dialogueId);
                }
              } finally {
                uploadingAudioIdsRef.current.delete(rec.dialogueId);
                syncedRestored += 1;
                setSavestateBusyMessage(
                  `Menyinkronkan audio halaman aktif (${syncedRestored}/${restoredRecords.length})...`,
                );
              }
            });

            setCloudSyncStatus('synced');
            setCloudSyncDetail(null);
          } catch (err) {
            reportCloudError(
              err,
              `Savestate "${target.name}" dimuat lokal, namun sinkronisasi Cloud belum lengkap.`,
            );
          }
        }

        showToast(
          missingAudioCount > 0
            ? `Savestate "${target.name}" dimuat (${restoredRecords.length} audio pulih, ${missingAudioCount} audio tidak tersedia di perangkat ini).`
            : `Savestate "${target.name}" berhasil dimuat (${restoredRecords.length} file audio).`,
        );
        return true;
      } catch (err) {
        reportCloudError(err, `Gagal memuat savestate "${target.name}".`);
        return false;
      } finally {
        setSavestateBusyMessage(null);
      }
    },
    [
      captureCurrentSavestate,
      ensurePrivateReady,
      ensureSharedReady,
      handleStopPlayback,
      reportCloudError,
      requireEditAccess,
      showToast,
    ],
  );

  // --- Backup Export / Import ---

  const handleExportBundle = useCallback(async () => {
    if (!requireEditAccess()) return;
    setIsExporting(true);
    try {
      const bundle = await createBackupBundle(
        blocks,
        dialogues,
        sopItems,
        incidentNarrative,
        playedIds,
        sopPositions,
        scenarioMeta,
      );
      const json = JSON.stringify(bundle);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `paket-audio-ttx-tanjung-api-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(
        `Paket skenario (${blocks.length} blok, ${sopItems.length} SOP, ${bundle.audios.length} audio) berhasil diekspor.`,
      );
    } catch {
      showToast('Gagal mengekspor paket audio TTX.', 'error');
    } finally {
      setIsExporting(false);
    }
  }, [
    blocks,
    dialogues,
    sopItems,
    sopPositions,
    incidentNarrative,
    scenarioMeta,
    playedIds,
    requireEditAccess,
    showToast,
  ]);

  const handleImportBundle = useCallback(
    async (file: File) => {
      if (!requireEditAccess()) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as TtxBackupBundle;
        handleStopPlayback();
        const restored = await restoreBackupBundle(parsed);

        const restoredBlocks = restored.blocks
          ? normalizeBlocksOrder(restored.blocks)
          : COMMUNICATION_BLOCKS;
        const restoredDialogues = renumberDialogues(
          restoredBlocks,
          restored.dialogues,
        );
        const restoredSops = restored.sopItems
          ? normalizeSopsOrder(restored.sopItems)
          : sopItemsRef.current;
        const restoredSopPositions = restored.sopPositions
          ? sanitizeSopPositions(restored.sopPositions)
          : sopPositionsRef.current;
        const restoredNarrative =
          restored.incidentNarrative ?? incidentNarrativeRef.current;
        const restoredScenarioMeta = restored.scenarioMeta
          ? sanitizeScenarioMeta(restored.scenarioMeta)
          : scenarioMetaRef.current;

        setBlocks(restoredBlocks);
        setDialogues(restoredDialogues);
        setSopItems(restoredSops);
        setSopPositions(restoredSopPositions);
        setIncidentNarrative(restoredNarrative);
        setScenarioMeta(restoredScenarioMeta);
        setPlayedIds(restored.playedIds);

        setAudioMap((prev) => {
          Object.values(prev).forEach((entry) =>
            URL.revokeObjectURL(entry.objectUrl),
          );
          const nextMap: Record<string, AudioEntryView> = {};
          for (const rec of restored.records) {
            nextMap[rec.dialogueId] = {
              dialogueId: rec.dialogueId,
              fileName: rec.fileName,
              mimeType: rec.mimeType,
              size: rec.size,
              duration: rec.duration,
              objectUrl: URL.createObjectURL(rec.blob),
              updatedAt: rec.updatedAt,
              revision: rec.revision,
            };
          }
          return nextMap;
        });

        const user = authUserRef.current;
        if (user && user.emailVerified && isAdminRef.current) {
          setCloudSyncStatus('syncing');
          setCloudSyncDetail('Menyinkronkan paket impor ke Cloud Admin...');
          try {
            const ready = await ensureSharedReady(user.uid);
            if (!ready) {
              throw new Error('Ruang kerja Cloud Admin belum siap.');
            }
            await pushSharedWorkspaceUpdate(user.uid, {
              blocks: restoredBlocks,
              dialogues: restoredDialogues,
              sopItems: restoredSops,
              sopPositions: restoredSopPositions,
              incidentNarrative: restoredNarrative,
              scenarioMeta: restoredScenarioMeta,
            });
            const restoredIds = new Set(restored.records.map((r) => r.dialogueId));
            const remoteIdsToRemove = Array.from(knownCloudAudioIdsRef.current).filter(
              (oldId) => !restoredIds.has(oldId),
            );
            for (const oldId of remoteIdsToRemove) {
              knownCloudAudioIdsRef.current.delete(oldId);
              await deleteSharedAudioFromCloud(oldId);
            }
            for (const rec of restored.records) {
              const rev = createAudioRevision();
              uploadingAudioIdsRef.current.add(rec.dialogueId);
              try {
                const res = await uploadSharedAudioToCloud(user.uid, rec, rev);
                if (res.uploaded) {
                  knownCloudAudioIdsRef.current.add(rec.dialogueId);
                  await saveAudioRecord({ ...rec, revision: rev });
                  setAudioMap((prev) =>
                    prev[rec.dialogueId]
                      ? {
                          ...prev,
                          [rec.dialogueId]: {
                            ...prev[rec.dialogueId],
                            revision: rev,
                          },
                        }
                      : prev,
                  );
                }
              } finally {
                uploadingAudioIdsRef.current.delete(rec.dialogueId);
              }
            }
            setCloudSyncStatus('synced');
            setCloudSyncDetail(null);
          } catch (err) {
            reportCloudError(
              err,
              'Paket dimuat lokal, namun gagal disinkronkan ke cloud.',
            );
          }
        }

        showToast(
          `Paket TTX berhasil dimuat (${restored.records.length} file audio).`,
        );
      } catch {
        showToast(
          'File paket tidak valid. Pilih file .json hasil ekspor aplikasi ini.',
          'error',
        );
      }
    },
    [
      ensureSharedReady,
      handleStopPlayback,
      reportCloudError,
      requireEditAccess,
      showToast,
    ],
  );

  // Spacebar toggles active playback when not editing text or recording
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code !== 'Space' ||
        !activeDialogueId ||
        recordingTargetDialogue ||
        scenarioMetaEditorOpen ||
        adminModalOpen
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      handleTogglePlay(activeDialogueId);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeDialogueId,
    adminModalOpen,
    handleTogglePlay,
    recordingTargetDialogue,
    scenarioMetaEditorOpen,
  ]);

  const playedSet = useMemo(() => new Set(playedIds), [playedIds]);

  const onlyDialogues = useMemo(
    () => dialogues.filter((d) => d.entryType !== 'narrative'),
    [dialogues],
  );

  const uploadedCount = useMemo(
    () => onlyDialogues.filter((d) => Boolean(audioMap[d.id])).length,
    [onlyDialogues, audioMap],
  );

  const totalPlayableAudioCount = useMemo(
    () => dialogues.filter((d) => Boolean(audioMap[d.id])).length,
    [dialogues, audioMap],
  );

  const phaseCounts = useMemo(() => {
    const result = {} as Record<PhaseId, { total: number; ready: number }>;
    for (const phase of SCENARIO_PHASES) {
      const list = onlyDialogues.filter((d) => d.phaseId === phase.id);
      result[phase.id] = {
        total: list.length,
        ready: list.filter((d) => Boolean(audioMap[d.id])).length,
      };
    }
    return result;
  }, [onlyDialogues, audioMap]);

  const handleJumpToPhase = useCallback((phaseId: PhaseId) => {
    setActiveView('console');
    window.setTimeout(() => {
      const el = document.getElementById(`phase-${phaseId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  }, []);

  const currentViewLabel =
    activeView === 'console'
      ? 'Konsol Dialog & Audio'
      : activeView === 'reference'
        ? 'Data Pokok & SOP'
        : 'Naskah PDF Asli';

  const confirmModalTitle =
    pendingDelete?.kind === 'block'
      ? `Hapus ${pendingDelete.block.code}?`
      : pendingDelete?.kind === 'sop'
        ? `Hapus SOP "${pendingDelete.sop.unit}"?`
        : pendingDelete?.kind === 'audio'
          ? pendingDelete.dialogue.entryType === 'narrative'
            ? 'Hapus Audio Narasi?'
            : `Hapus Audio Percakapan #${formatSequenceNumber(pendingDelete.dialogue.sequenceNumber)}?`
          : pendingDelete
            ? pendingDelete.dialogue.entryType === 'narrative'
              ? 'Hapus Narasi Blok?'
              : `Hapus Percakapan #${formatSequenceNumber(pendingDelete.dialogue.sequenceNumber)}?`
            : '';

  const confirmModalDescription =
    pendingDelete?.kind === 'block'
      ? pendingDelete.dialogueCount > 0
        ? `Blok "${pendingDelete.block.title}" berisi ${pendingDelete.dialogueCount} item percakapan/narasi beserta file audionya. Semua isi di dalam blok ini akan ikut terhapus.`
        : `Blok "${pendingDelete.block.title}" akan dihapus dari skenario.`
      : pendingDelete?.kind === 'sop'
        ? `Rincian tindakan operasional lapangan untuk "${pendingDelete.sop.unit}" (${pendingDelete.sop.steps.length} langkah) akan dihapus dari skenario.`
        : pendingDelete?.kind === 'audio'
          ? pendingDelete.dialogue.entryType === 'narrative'
            ? `File audio pada narasi "${pendingDelete.dialogue.title || 'Narasi Skenario'}" akan dikosongkan. Teks narasi dan audio di dalam savestate yang sudah disimpan tetap aman.`
            : `File audio pada percakapan "${pendingDelete.dialogue.sender} → ${pendingDelete.dialogue.receiver}" akan dikosongkan. Teks percakapan dan audio di dalam savestate yang sudah disimpan tetap aman.`
          : pendingDelete
            ? pendingDelete.dialogue.entryType === 'narrative'
              ? `Narasi "${pendingDelete.dialogue.title || 'Narasi Skenario'}" akan dihapus dari blok ini.`
              : `Percakapan "${pendingDelete.dialogue.sender} → ${pendingDelete.dialogue.receiver}" beserta file audio yang terpasang (jika ada) akan dihapus dari skenario.`
            : '';

  const confirmModalLabel =
    pendingDelete?.kind === 'block'
      ? 'Hapus Blok'
      : pendingDelete?.kind === 'sop'
        ? 'Hapus SOP'
        : pendingDelete?.kind === 'audio'
          ? 'Kosongkan Audio'
          : pendingDelete?.dialogue.entryType === 'narrative'
            ? 'Hapus Narasi'
            : 'Hapus Percakapan';

  const currentWorkspaceSummary = useMemo(
    () => ({
      blockCount: blocks.length,
      dialogueCount: onlyDialogues.length,
      narrativeCount: dialogues.length - onlyDialogues.length,
      sopCount: sopItems.length,
      audioCount: totalPlayableAudioCount,
    }),
    [
      blocks.length,
      onlyDialogues.length,
      dialogues.length,
      sopItems.length,
      totalPlayableAudioCount,
    ],
  );

  return (
    <>
      {/* Interactive Web Workspace (Hidden when printing to PDF) */}
      <div className="min-h-screen flex bg-[#F6F8FA] text-[#0F172A] print:hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          scenarioMeta={scenarioMeta}
          activeView={activeView}
          onChangeView={setActiveView}
          onJumpToPhase={handleJumpToPhase}
          phaseCounts={phaseCounts}
          totalDialogues={onlyDialogues.length}
          uploadedCount={uploadedCount}
          playedCount={playedIds.length}
          userRole={userRole}
          isAdmin={isAdmin}
          canEdit={canEdit}
          isEditLocked={isEditLocked}
          adminCount={Math.max(1, adminEntries.length)}
          onOpenAdminModal={() => {
            if (isAdminRef.current) setAdminModalOpen(true);
          }}
          cloudUserEmail={authUser?.email ?? null}
          cloudUserName={authUser?.displayName ?? null}
          cloudSyncStatus={cloudSyncStatus}
          cloudSyncDetail={cloudSyncDetail}
          onSignInGoogle={() => {
            void handleSignInGoogle();
          }}
          onSignOutGoogle={() => {
            void handleSignOutGoogle();
          }}
          onPushLocalToCloud={() => {
            void handlePushLocalToCloud();
          }}
          onRefreshFromCloud={() => {
            void handleRefreshFromCloud();
          }}
          onOpenSavestates={() => {
            if (requireEditAccess()) setSavestateModalOpen(true);
          }}
          savestateCount={savestates.length}
          onOpenBulkUpload={() => {
            if (requireEditAccess()) setBulkUploadOpen(true);
          }}
          onExportPdf={handleExportPdf}
          onExportBundle={handleExportBundle}
          onImportBundle={handleImportBundle}
          onResetPlayed={handleResetPlayed}
          isExporting={isExporting}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Shell */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar Contract: Breadcrumb on Left, Role / Edit Lock & Actions on Right */}
          <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Buka menu navigasi"
                className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md"
              >
                <Menu className="w-5 h-5" />
              </button>
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-2 text-sm min-w-0"
              >
                <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                  TTX Bandara Tanjung Api
                </span>
                <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                  /
                </span>
                <span className="font-semibold text-[#0E2439] truncate">
                  {currentViewLabel}
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isAdmin ? (
                <>
                  {/* Admin Edit Lock Toggle — defaults to locked on every page load */}
                  <button
                    type="button"
                    onClick={handleToggleEditLock}
                    aria-pressed={!isEditLocked}
                    title={
                      isEditLocked
                        ? 'Edit sedang dikunci untuk mencegah perubahan tidak sengaja. Klik untuk membuka Mode Edit.'
                        : 'Mode Edit sedang aktif. Klik untuk mengunci kembali agar aman saat simulasi.'
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                      isEditLocked
                        ? 'bg-slate-100 text-[#0E2439] border-slate-300 hover:bg-slate-200'
                        : 'bg-[#FFFBEB] text-[#B45309] border-[#F59E0B] hover:bg-amber-100'
                    }`}
                  >
                    {isEditLocked ? (
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <LockOpen className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>
                      {isEditLocked ? 'Edit Terkunci' : 'Mode Edit Aktif'}
                    </span>
                  </button>

                  {/* Admin Cloud Sync Status / Manual Re-sync */}
                  <button
                    type="button"
                    onClick={() => {
                      void handlePushLocalToCloud();
                    }}
                    title={`Terhubung sebagai Admin (${authUser?.email ?? 'Google'}). Klik untuk sinkronkan ulang ke Cloud Admin.`}
                    className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                      cloudSyncStatus === 'error'
                        ? 'bg-red-50 text-[#DC2626] border-red-200 hover:bg-red-100'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {cloudSyncStatus === 'syncing' ||
                    cloudSyncStatus === 'connecting' ? (
                      <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin text-[#0E2439]" />
                    ) : (
                      <Cloud
                        className={`w-3.5 h-3.5 shrink-0 ${
                          cloudSyncStatus === 'error'
                            ? 'text-[#DC2626]'
                            : 'text-[#059669]'
                        }`}
                      />
                    )}
                    <span className="hidden md:inline">
                      {cloudSyncStatus === 'syncing' ||
                      cloudSyncStatus === 'connecting'
                        ? 'Menyinkronkan...'
                        : cloudSyncStatus === 'error'
                          ? 'Gagal Sinkron'
                          : 'Cloud Admin'}
                    </span>
                  </button>
                </>
              ) : (
                <>
                  {/* Mode Pengguna Cloud Status & Manual Refresh */}
                  <button
                    type="button"
                    onClick={() => {
                      void handleRefreshFromCloud();
                    }}
                    disabled={
                      cloudSyncStatus === 'syncing' ||
                      cloudSyncStatus === 'connecting'
                    }
                    title={
                      cloudSyncDetail ??
                      'Klik untuk menyegarkan skenario & audio terbaru dari Cloud Admin'
                    }
                    className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 ${
                      cloudSyncStatus === 'error'
                        ? 'bg-red-50 text-[#DC2626] border-red-200 hover:bg-red-100'
                        : 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100 hover:text-[#0E2439]'
                    }`}
                  >
                    {cloudSyncStatus === 'syncing' ||
                    cloudSyncStatus === 'connecting' ? (
                      <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin text-[#0E2439]" />
                    ) : (
                      <Cloud
                        className={`w-3.5 h-3.5 shrink-0 ${
                          cloudSyncStatus === 'error'
                            ? 'text-[#DC2626]'
                            : 'text-[#059669]'
                        }`}
                      />
                    )}
                    <span>
                      {cloudSyncStatus === 'syncing' ||
                      cloudSyncStatus === 'connecting'
                        ? 'Memuat Cloud...'
                        : cloudSyncStatus === 'error'
                          ? 'Segarkan Cloud'
                          : 'Mode Pengguna'}
                    </span>
                  </button>

                  {!authUser && (
                    <button
                      type="button"
                      onClick={() => {
                        void handleSignInGoogle();
                      }}
                      title="Masuk dengan akun Google Admin untuk mengedit skenario dan audio"
                      className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium text-[#0E2439] bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-[#0E2439]" />
                      <span>Masuk Admin</span>
                    </button>
                  )}
                </>
              )}

              {isPlaying || isSequenceActive ? (
                <button
                  type="button"
                  onClick={handleStopPlayback}
                  className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-medium text-white bg-[#DC2626] rounded-md hover:bg-[#B91C1C] transition-colors whitespace-nowrap shrink-0"
                >
                  <Square className="w-3.5 h-3.5 shrink-0" />
                  <span>Hentikan</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePlayAllSequence}
                  disabled={totalPlayableAudioCount === 0}
                  title={
                    totalPlayableAudioCount > 0
                      ? 'Putar semua dialog dan narasi yang sudah memiliki audio secara berurutan'
                      : canEdit
                        ? 'Unggah audio dialog atau buat audio narasi terlebih dahulu'
                        : 'Belum ada file audio yang tersedia dari Admin'
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5 shrink-0" />
                  <span>Putar Semua ({totalPlayableAudioCount})</span>
                </button>
              )}
            </div>
          </header>

          {/* Main Workspace Container */}
          <main className="flex-1 w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            {isHydrating ? (
              <div className="space-y-4">
                <div className="h-32 bg-white border border-slate-200 rounded-lg animate-pulse" />
                <div className="h-16 bg-white border border-slate-200 rounded-lg animate-pulse" />
                <div className="h-64 bg-white border border-slate-200 rounded-lg animate-pulse" />
              </div>
            ) : activeView === 'console' ? (
              <DialogueConsoleView
                scenarioMeta={scenarioMeta}
                blocks={blocks}
                dialogues={dialogues}
                sopItems={sopItems}
                sopPositions={sopPositions}
                incidentNarrative={incidentNarrative}
                audioMap={audioMap}
                playedSet={playedSet}
                activeDialogueId={activeDialogueId}
                isPlaying={isPlaying}
                isSequenceActive={isSequenceActive}
                sequenceQueueRemaining={sequenceQueueRemaining}
                currentTime={currentTime}
                activeDuration={activeDuration}
                volume={volume}
                isMuted={isMuted}
                playbackRate={playbackRate}
                sequenceGapSeconds={sequenceGapSeconds}
                searchQuery={searchQuery}
                audioFilter={audioFilter}
                speakerFilter={speakerFilter}
                onSearchChange={setSearchQuery}
                onAudioFilterChange={setAudioFilter}
                onSpeakerFilterChange={setSpeakerFilter}
                onTogglePlay={handleTogglePlay}
                onReplay={handleReplay}
                onSeek={handleSeek}
                onPlayBlockSequence={handlePlayBlockSequence}
                onStopPlayback={handleStopPlayback}
                onSkipNextInQueue={handleSkipNextInQueue}
                onVolumeChange={(v) => {
                  setVolume(v);
                  if (v > 0 && isMuted) setIsMuted(false);
                }}
                onToggleMute={() => setIsMuted((m) => !m)}
                onPlaybackRateChange={setPlaybackRate}
                onSequenceGapChange={setSequenceGapSeconds}
                onUploadAudio={handleUploadAudio}
                onOpenRecordAudio={handleOpenRecordAudio}
                onRequestRemoveAudio={handleRequestRemoveAudio}
                onTogglePlayed={handleTogglePlayed}
                onOpenAddEntry={(blkId, entryType, afterId) => {
                  if (!requireEditAccess()) return;
                  setEditingDialogue(null);
                  setEditorDefaultBlockId(blkId);
                  setEditorDefaultEntryType(entryType);
                  setInsertAfterDialogueId(afterId ?? null);
                  setEditorOpen(true);
                }}
                onEditDialogue={(dlg) => {
                  if (!requireEditAccess()) return;
                  setEditingDialogue(dlg);
                  setEditorDefaultBlockId(dlg.blockId);
                  setEditorDefaultEntryType(dlg.entryType ?? 'dialogue');
                  setInsertAfterDialogueId(null);
                  setEditorOpen(true);
                }}
                onRequestDeleteDialogue={(dlg) => {
                  if (!requireEditAccess()) return;
                  setPendingDelete({ kind: 'dialogue', dialogue: dlg });
                }}
                onMoveDialogue={handleMoveDialogue}
                onDropReorderDialogue={handleDropReorderDialogue}
                onDropDialogueIntoBlock={handleDropDialogueIntoBlock}
                onOpenAddBlock={(phaseId) => {
                  if (!requireEditAccess()) return;
                  setEditingBlock(null);
                  setBlockDefaultPhaseId(phaseId);
                  setBlockEditorOpen(true);
                }}
                onEditBlock={(blk) => {
                  if (!requireEditAccess()) return;
                  setEditingBlock(blk);
                  setBlockDefaultPhaseId(blk.phaseId);
                  setBlockEditorOpen(true);
                }}
                onRequestDeleteBlock={(blk) => {
                  if (!requireEditAccess()) return;
                  const count = dialogues.filter((d) => d.blockId === blk.id).length;
                  setPendingDelete({
                    kind: 'block',
                    block: blk,
                    dialogueCount: count,
                  });
                }}
                onMoveBlock={handleMoveBlock}
                onDropReorderBlock={handleDropReorderBlock}
                onMoveSopPanel={handleMoveSopPanel}
                onDropSopPanelOnBlock={handleDropSopPanelOnBlock}
                onDropBlockOnSopPanel={handleDropBlockOnSopPanel}
                onOpenAddSop={(phaseId) => {
                  if (!requireEditAccess()) return;
                  setEditingSop(null);
                  setSopDefaultPhaseId(phaseId);
                  setSopEditorOpen(true);
                }}
                onEditSop={(sop) => {
                  if (!requireEditAccess()) return;
                  setEditingSop(sop);
                  setSopDefaultPhaseId(sop.phaseId);
                  setSopEditorOpen(true);
                }}
                onRequestDeleteSop={(sop) => {
                  if (!requireEditAccess()) return;
                  setPendingDelete({ kind: 'sop', sop });
                }}
                onMoveSop={handleMoveSop}
                onDropReorderSop={handleDropReorderSop}
                onEditNarrative={() => {
                  if (requireEditAccess()) setNarrativeEditorOpen(true);
                }}
                onEditScenarioMeta={() => {
                  if (requireEditAccess()) setScenarioMetaEditorOpen(true);
                }}
                onOpenGenerateNarrativeAudio={(nar) => {
                  if (!requireEditAccess()) return;
                  setTtsError(null);
                  setTtsTargetNarrative(nar);
                }}
                generatingTtsId={generatingTtsId}
                canEdit={canEdit}
                isAdmin={isAdmin}
                savestateCount={savestates.length}
                onOpenSavestates={() => {
                  if (requireEditAccess()) setSavestateModalOpen(true);
                }}
                onExportPdf={handleExportPdf}
                onOpenBulkUpload={() => {
                  if (requireEditAccess()) setBulkUploadOpen(true);
                }}
              />
            ) : activeView === 'reference' ? (
              <SopReferenceView
                scenarioMeta={scenarioMeta}
                sopItems={sopItems}
                incidentNarrative={incidentNarrative}
                canEdit={canEdit}
                onAddSop={(phaseId) => {
                  if (!requireEditAccess()) return;
                  setEditingSop(null);
                  setSopDefaultPhaseId(phaseId);
                  setSopEditorOpen(true);
                }}
                onEditSop={(sop) => {
                  if (!requireEditAccess()) return;
                  setEditingSop(sop);
                  setSopDefaultPhaseId(sop.phaseId);
                  setSopEditorOpen(true);
                }}
                onRequestDeleteSop={(sop) => {
                  if (!requireEditAccess()) return;
                  setPendingDelete({ kind: 'sop', sop });
                }}
                onMoveSop={handleMoveSop}
                onDropReorderSop={handleDropReorderSop}
                onEditNarrative={() => {
                  if (requireEditAccess()) setNarrativeEditorOpen(true);
                }}
                onEditScenarioMeta={() => {
                  if (requireEditAccess()) setScenarioMetaEditorOpen(true);
                }}
              />
            ) : (
              <PdfViewerView />
            )}
          </main>
        </div>

        {/* Modals */}
        <BulkUploadModal
          isOpen={bulkUploadOpen}
          dialogues={dialogues}
          onClose={() => setBulkUploadOpen(false)}
          onCommitUploads={handleBulkUpload}
        />

        <DialogueEditorModal
          isOpen={editorOpen}
          blocks={blocks}
          editingDialogue={editingDialogue}
          defaultBlockId={editorDefaultBlockId}
          defaultEntryType={editorDefaultEntryType}
          insertAfterDialogueId={insertAfterDialogueId}
          onClose={() => {
            setEditorOpen(false);
            setInsertAfterDialogueId(null);
          }}
          onSave={handleSaveDialogue}
        />

        <BlockEditorModal
          isOpen={blockEditorOpen}
          editingBlock={editingBlock}
          defaultPhaseId={blockDefaultPhaseId}
          onClose={() => setBlockEditorOpen(false)}
          onSave={handleSaveBlock}
        />

        <SopEditorModal
          isOpen={sopEditorOpen}
          editingSop={editingSop}
          defaultPhaseId={sopDefaultPhaseId}
          onClose={() => setSopEditorOpen(false)}
          onSave={handleSaveSop}
        />

        <NarrativeEditorModal
          isOpen={narrativeEditorOpen}
          narrative={incidentNarrative}
          onClose={() => setNarrativeEditorOpen(false)}
          onSave={handleSaveNarrative}
        />

        <ScenarioMetaEditorModal
          isOpen={scenarioMetaEditorOpen}
          meta={scenarioMeta}
          onClose={() => setScenarioMetaEditorOpen(false)}
          onSave={handleSaveScenarioMeta}
        />

        <VoiceRecorderModal
          isOpen={Boolean(recordingTargetDialogue)}
          dialogue={recordingTargetDialogue}
          hasExistingAudio={
            recordingTargetDialogue
              ? Boolean(audioMap[recordingTargetDialogue.id])
              : false
          }
          onClose={() => setRecordingTargetDialogue(null)}
          onSaveRecording={handleUploadAudio}
        />

        <NarrativeTtsModal
          isOpen={Boolean(ttsTargetNarrative)}
          narrative={ttsTargetNarrative}
          hasExistingAudio={
            ttsTargetNarrative ? Boolean(audioMap[ttsTargetNarrative.id]) : false
          }
          isGenerating={Boolean(generatingTtsId)}
          errorMessage={ttsError}
          onClose={() => {
            if (!generatingTtsId) {
              setTtsTargetNarrative(null);
              setTtsError(null);
            }
          }}
          onGenerate={handleGenerateNarrativeAudio}
        />

        <SavestateModal
          isOpen={savestateModalOpen}
          savestates={savestates}
          currentSummary={currentWorkspaceSummary}
          isCloudConnected={Boolean(authUser && authUser.emailVerified && isAdmin)}
          busyMessage={savestateBusyMessage}
          onClose={() => setSavestateModalOpen(false)}
          onCreateSavestate={handleCreateSavestate}
          onLoadSavestate={handleLoadSavestate}
          onOverwriteSavestate={handleOverwriteSavestate}
          onRenameSavestate={handleRenameSavestate}
          onDeleteSavestate={handleDeleteSavestate}
          onSyncLocalSavestates={handleSyncLocalSavestates}
          onSyncSingleSavestate={handleSyncSingleSavestate}
        />

        <ConfirmModal
          isOpen={Boolean(pendingDelete)}
          title={confirmModalTitle}
          description={confirmModalDescription}
          confirmLabel={confirmModalLabel}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void handleConfirmDelete();
          }}
        />

        <AdminManagementModal
          open={isAdmin && adminModalOpen}
          currentUserEmail={authUser?.email ?? null}
          admins={adminEntries}
          onClose={() => setAdminModalOpen(false)}
          onAddAdmin={handleAddAdmin}
          onRemoveAdmin={handleRemoveAdmin}
        />

        {/* Toast Notification */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-md shadow-lg border text-xs font-medium flex items-center justify-between gap-3 ${
              toast.tone === 'error'
                ? 'bg-[#DC2626] text-white border-[#B91C1C]'
                : 'bg-[#0E2439] text-white border-[#193A58]'
            }`}
          >
            <span>{toast.text}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Tutup notifikasi"
              className="opacity-80 hover:opacity-100 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Print-Only Clean A4 Document Layout (Zero audio or interactive buttons) */}
      <PrintDocumentView
        scenarioMeta={scenarioMeta}
        blocks={blocks}
        dialogues={dialogues}
        sopItems={sopItems}
        sopPositions={sopPositions}
        incidentNarrative={incidentNarrative}
      />
    </>
  );
}
