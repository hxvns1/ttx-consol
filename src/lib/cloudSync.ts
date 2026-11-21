import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  AdminEntryRecord,
  AudioVaultRecord,
  CommunicationBlock,
  DialogueItem,
  IncidentNarrative,
  PhaseSopPositions,
  SavestateAudioRef,
  ScenarioMeta,
  SopItem,
  StoredAudioRecord,
  WorkspaceSavestate,
} from '../types/ttx';
import { DEFAULT_SCENARIO_META } from '../data/scenarioData';
import { db, handleFirestoreError, OperationType } from './firebase';

export const WORKSPACE_ID = 'default';
export const WORKSPACE_SCHEMA_VERSION = 3;

// Volumetric limits synchronized verbatim with firebase-blueprint.json & firestore.rules
export const MAX_DISPLAY_NAME_LEN = 120;
export const MAX_BLOCKS = 100;
export const MAX_DIALOGUES = 500;
export const MAX_SOPS = 200;
export const MAX_PLAYED_IDS = 500;
export const MAX_NARRATIVE_TITLE_LEN = 200;
export const MAX_NARRATIVE_TIME_LEN = 100;
export const MAX_NARRATIVE_BODY_LEN = 8000;
export const MAX_AUDIO_FILE_NAME_LEN = 255;
export const MAX_AUDIO_MIME_LEN = 100;
export const MAX_CLOUD_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_AUDIO_DURATION = 7200;
export const CHUNK_BASE64_LENGTH = 480000; // < 524,288 rule ceiling
export const MAX_AUDIO_CHUNKS = 30;
export const MAX_CHUNKS_PER_BATCH = 4; // <= 12 rule lookups & < 2 MiB per batch
export const SINGLE_BATCH_MAX_CHUNKS = 3; // Atomic 1-round-trip upload for short audios
export const MAX_DELETE_PER_BATCH = 6;
export const PENDING_REVISION_PREFIX = 'pending_';
export const MAX_SAVESTATE_NAME_LEN = 120;
export const MAX_SAVESTATE_NOTE_LEN = 300;
export const MAX_SAVESTATE_AUDIO_REFS = 500;
export const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const concurrency = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < items.length) {
        const currentIndex = cursor;
        cursor += 1;
        await worker(items[currentIndex], currentIndex);
      }
    }),
  );
}

export const DEFAULT_PHASE_SOP_POSITIONS: PhaseSopPositions = {
  'fase-2': 2,
  'fase-3': 3,
  'fase-4': 0,
  'fase-6': 1,
};

export interface WorkspaceStatePayload {
  blocks: CommunicationBlock[];
  dialogues: DialogueItem[];
  sopItems: SopItem[];
  sopPositions?: PhaseSopPositions;
  incidentNarrative: IncidentNarrative;
  scenarioMeta?: ScenarioMeta;
  playedIds: string[];
}

export interface CloudAudioMeta {
  ownerId: string;
  workspaceId: string;
  dialogueId: string;
  fileName: string;
  mimeType: string;
  size: number;
  duration: number;
  chunkCount: number;
  revision: string;
}

export function createAudioRevision(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `rev-${Date.now()}-${rand}`;
}

export function isValidFirestoreId(value: string): boolean {
  return value.length >= 1 && value.length <= 128 && VALID_ID_PATTERN.test(value);
}

function clampString(value: string | undefined, maxLen: number, fallback = ''): string {
  const clean = (value ?? fallback).trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) : clean;
}

function sanitizeBlock(block: CommunicationBlock): CommunicationBlock {
  return {
    id: clampString(block.id, 128, `blk-${Date.now()}`),
    phaseId: block.phaseId,
    code: clampString(block.code, 100, 'Blok'),
    title: clampString(block.title, 250, 'Tanpa Judul'),
    channelType: clampString(block.channelType, 120, 'Komunikasi'),
    description: clampString(block.description, 1000, ''),
    pageNumber: Math.max(1, Math.min(999, Math.round(Number(block.pageNumber) || 1))),
  };
}

function sanitizeDialogue(item: DialogueItem): DialogueItem {
  const clean: DialogueItem = {
    id: clampString(item.id, 128, `dlg-${Date.now()}`),
    sequenceNumber: Math.max(0, Math.round(Number(item.sequenceNumber) || 0)),
    phaseId: item.phaseId,
    blockId: clampString(item.blockId, 128, 'blk-a'),
    sender: clampString(item.sender, 150, ''),
    receiver: clampString(item.receiver, 150, ''),
    transcript: clampString(item.transcript, 5000, ''),
    pageNumber: Math.max(1, Math.min(999, Math.round(Number(item.pageNumber) || 1))),
  };
  if (item.entryType === 'dialogue' || item.entryType === 'narrative') {
    clean.entryType = item.entryType;
  }
  if (item.title && item.title.trim()) {
    clean.title = clampString(item.title, 200);
  }
  if (item.note && item.note.trim()) {
    clean.note = clampString(item.note, 500);
  }
  if (typeof item.isEmergencyPriority === 'boolean') {
    clean.isEmergencyPriority = item.isEmergencyPriority;
  }
  if (typeof item.isCustom === 'boolean') {
    clean.isCustom = item.isCustom;
  }
  if (
    item.ttsVoice === 'Kore' ||
    item.ttsVoice === 'Charon' ||
    item.ttsVoice === 'Fenrir' ||
    item.ttsVoice === 'Puck' ||
    item.ttsVoice === 'Zephyr'
  ) {
    clean.ttsVoice = item.ttsVoice;
  }
  if (item.ttsStyle && item.ttsStyle.trim()) {
    clean.ttsStyle = clampString(item.ttsStyle, 300);
  }
  return clean;
}

function sanitizeSop(item: SopItem): SopItem {
  const steps = Array.isArray(item.steps)
    ? item.steps
        .filter((s) => typeof s === 'string' && s.trim().length > 0)
        .slice(0, 50)
        .map((s) => clampString(s, 1000))
    : [];

  return {
    id: clampString(item.id, 128, `sop-${Date.now()}`),
    phaseId: item.phaseId,
    phaseTitle: clampString(item.phaseTitle, 200, ''),
    unit: clampString(item.unit, 200, 'Unit'),
    steps,
    pageNumber: Math.max(1, Math.min(999, Math.round(Number(item.pageNumber) || 1))),
  };
}

function sanitizeIncidentNarrative(narrative: IncidentNarrative): IncidentNarrative {
  return {
    title: clampString(narrative.title, MAX_NARRATIVE_TITLE_LEN, 'Narasi Kejadian') || 'Narasi Kejadian',
    time: clampString(narrative.time, MAX_NARRATIVE_TIME_LEN, ''),
    body: clampString(narrative.body, MAX_NARRATIVE_BODY_LEN, '-') || '-',
    pageNumber: Math.max(1, Math.min(999, Math.round(Number(narrative.pageNumber) || 1))),
  };
}

function sanitizePlayedIds(ids: string[]): string[] {
  const unique = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.length > 0)));
  return unique.slice(0, MAX_PLAYED_IDS).map((id) => id.slice(0, 128));
}

export function sanitizeSopPositions(
  positions?: Partial<PhaseSopPositions> | null,
): PhaseSopPositions {
  const clampPos = (val: unknown, fallback: number): number => {
    const num = Number(val);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(0, Math.min(100, Math.round(num)));
  };
  return {
    'fase-2': clampPos(positions?.['fase-2'], DEFAULT_PHASE_SOP_POSITIONS['fase-2']),
    'fase-3': clampPos(positions?.['fase-3'], DEFAULT_PHASE_SOP_POSITIONS['fase-3']),
    'fase-4': clampPos(positions?.['fase-4'], DEFAULT_PHASE_SOP_POSITIONS['fase-4']),
    'fase-6': clampPos(positions?.['fase-6'], DEFAULT_PHASE_SOP_POSITIONS['fase-6']),
  };
}

export function sanitizeScenarioMeta(
  meta?: Partial<ScenarioMeta> | null,
): ScenarioMeta {
  return {
    unit:
      clampString(meta?.unit, 250, DEFAULT_SCENARIO_META.unit) ||
      DEFAULT_SCENARIO_META.unit,
    title:
      clampString(meta?.title, 200, DEFAULT_SCENARIO_META.title) ||
      DEFAULT_SCENARIO_META.title,
    description: clampString(
      meta?.description,
      1000,
      DEFAULT_SCENARIO_META.description,
    ),
    status:
      clampString(meta?.status, 80, DEFAULT_SCENARIO_META.status) ||
      DEFAULT_SCENARIO_META.status,
    callSign: clampString(meta?.callSign, 120, DEFAULT_SCENARIO_META.callSign),
    aircraft: clampString(meta?.aircraft, 160, DEFAULT_SCENARIO_META.aircraft),
    route: clampString(meta?.route, 200, DEFAULT_SCENARIO_META.route),
    etaRunway: clampString(
      meta?.etaRunway,
      160,
      DEFAULT_SCENARIO_META.etaRunway,
    ),
    pob: clampString(meta?.pob, 160, DEFAULT_SCENARIO_META.pob),
    fuel: clampString(meta?.fuel, 120, DEFAULT_SCENARIO_META.fuel),
  };
}

function sanitizeWorkspacePayload(payload: WorkspaceStatePayload): WorkspaceStatePayload {
  return {
    blocks: payload.blocks.slice(0, MAX_BLOCKS).map(sanitizeBlock),
    dialogues: payload.dialogues.slice(0, MAX_DIALOGUES).map(sanitizeDialogue),
    sopItems: payload.sopItems.slice(0, MAX_SOPS).map(sanitizeSop),
    sopPositions: sanitizeSopPositions(payload.sopPositions),
    incidentNarrative: sanitizeIncidentNarrative(payload.incidentNarrative),
    scenarioMeta: sanitizeScenarioMeta(payload.scenarioMeta),
    playedIds: sanitizePlayedIds(payload.playedIds),
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file audio untuk sinkronisasi.'));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'audio/mpeg' });
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const displayName = clampString(user.displayName ?? 'Fasilitator TTX', MAX_DISPLAY_NAME_LEN, 'Fasilitator TTX');

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: user.uid,
        displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function ensureCloudWorkspace(
  uid: string,
  localState: WorkspaceStatePayload,
): Promise<{ created: boolean; remoteData?: WorkspaceStatePayload }> {
  const path = `users/${uid}/workspaces/${WORKSPACE_ID}`;
  const ref = doc(db, 'users', uid, 'workspaces', WORKSPACE_ID);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const clean = sanitizeWorkspacePayload(localState);
      await setDoc(ref, {
        ownerId: uid,
        workspaceId: WORKSPACE_ID,
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        blocks: clean.blocks,
        dialogues: clean.dialogues,
        sopItems: clean.sopItems,
        sopPositions: clean.sopPositions,
        incidentNarrative: clean.incidentNarrative,
        scenarioMeta: clean.scenarioMeta,
        playedIds: clean.playedIds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { created: true };
    }

    const data = snap.data();
    return {
      created: false,
      remoteData: {
        blocks: Array.isArray(data.blocks) ? (data.blocks as CommunicationBlock[]) : localState.blocks,
        dialogues: Array.isArray(data.dialogues) ? (data.dialogues as DialogueItem[]) : localState.dialogues,
        sopItems: Array.isArray(data.sopItems) ? (data.sopItems as SopItem[]) : localState.sopItems,
        sopPositions:
          data.sopPositions && typeof data.sopPositions === 'object'
            ? sanitizeSopPositions(data.sopPositions as Partial<PhaseSopPositions>)
            : sanitizeSopPositions(localState.sopPositions),
        incidentNarrative:
          data.incidentNarrative && typeof data.incidentNarrative === 'object'
            ? (data.incidentNarrative as IncidentNarrative)
            : localState.incidentNarrative,
        scenarioMeta:
          data.scenarioMeta && typeof data.scenarioMeta === 'object'
            ? sanitizeScenarioMeta(data.scenarioMeta as Partial<ScenarioMeta>)
            : sanitizeScenarioMeta(localState.scenarioMeta),
        playedIds: Array.isArray(data.playedIds) ? (data.playedIds as string[]) : [],
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function pushWorkspaceUpdate(
  uid: string,
  partial: Partial<WorkspaceStatePayload>,
): Promise<void> {
  const path = `users/${uid}/workspaces/${WORKSPACE_ID}`;
  const ref = doc(db, 'users', uid, 'workspaces', WORKSPACE_ID);

  const updateBody: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (partial.blocks !== undefined) {
    updateBody.blocks = partial.blocks.slice(0, MAX_BLOCKS).map(sanitizeBlock);
  }
  if (partial.dialogues !== undefined) {
    updateBody.dialogues = partial.dialogues.slice(0, MAX_DIALOGUES).map(sanitizeDialogue);
  }
  if (partial.sopItems !== undefined) {
    updateBody.sopItems = partial.sopItems.slice(0, MAX_SOPS).map(sanitizeSop);
  }
  if (partial.sopPositions !== undefined) {
    updateBody.sopPositions = sanitizeSopPositions(partial.sopPositions);
  }
  if (partial.incidentNarrative !== undefined) {
    updateBody.incidentNarrative = sanitizeIncidentNarrative(partial.incidentNarrative);
  }
  if (partial.scenarioMeta !== undefined) {
    updateBody.scenarioMeta = sanitizeScenarioMeta(partial.scenarioMeta);
  }
  if (partial.playedIds !== undefined) {
    updateBody.playedIds = sanitizePlayedIds(partial.playedIds);
  }

  try {
    await updateDoc(ref, updateBody);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeWorkspace(
  uid: string,
  onData: (data: WorkspaceStatePayload) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const path = `users/${uid}/workspaces/${WORKSPACE_ID}`;
  const ref = doc(db, 'users', uid, 'workspaces', WORKSPACE_ID);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      // Skip local latency-compensated echoes so we don't thrash state
      if (snap.metadata.hasPendingWrites) return;
      const data = snap.data();
      if (!Array.isArray(data.blocks) || !Array.isArray(data.dialogues)) return;

      onData({
        blocks: data.blocks as CommunicationBlock[],
        dialogues: data.dialogues as DialogueItem[],
        sopItems: Array.isArray(data.sopItems) ? (data.sopItems as SopItem[]) : [],
        sopPositions:
          data.sopPositions && typeof data.sopPositions === 'object'
            ? sanitizeSopPositions(data.sopPositions as Partial<PhaseSopPositions>)
            : undefined,
        incidentNarrative: data.incidentNarrative as IncidentNarrative,
        scenarioMeta:
          data.scenarioMeta && typeof data.scenarioMeta === 'object'
            ? sanitizeScenarioMeta(data.scenarioMeta as Partial<ScenarioMeta>)
            : undefined,
        playedIds: Array.isArray(data.playedIds) ? (data.playedIds as string[]) : [],
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export function subscribeCloudAudios(
  uid: string,
  onMetas: (metas: CloudAudioMeta[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const path = `users/${uid}/workspaces/${WORKSPACE_ID}/audios`;
  const q = query(
    collection(db, 'users', uid, 'workspaces', WORKSPACE_ID, 'audios'),
    where('ownerId', '==', uid),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      const metas: CloudAudioMeta[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (
          typeof d.dialogueId === 'string' &&
          typeof d.revision === 'string' &&
          typeof d.chunkCount === 'number'
        ) {
          metas.push({
            ownerId: String(d.ownerId),
            workspaceId: String(d.workspaceId),
            dialogueId: d.dialogueId,
            fileName: String(d.fileName ?? 'audio.mp3'),
            mimeType: String(d.mimeType ?? 'audio/mpeg'),
            size: Number(d.size ?? 0),
            duration: Number(d.duration ?? 0),
            chunkCount: Number(d.chunkCount),
            revision: d.revision,
          });
        }
      });
      onMetas(metas);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export async function uploadAudioToCloud(
  uid: string,
  record: StoredAudioRecord,
  revision: string,
): Promise<{ uploaded: boolean; reason?: 'too-large' | 'invalid-id' }> {
  if (!isValidFirestoreId(record.dialogueId)) {
    return { uploaded: false, reason: 'invalid-id' };
  }
  if (record.size <= 0 || record.size > MAX_CLOUD_AUDIO_BYTES) {
    return { uploaded: false, reason: 'too-large' };
  }

  const base64 = await blobToBase64(record.blob);
  const chunks: string[] = [];
  for (let offset = 0; offset < base64.length; offset += CHUNK_BASE64_LENGTH) {
    chunks.push(base64.slice(offset, offset + CHUNK_BASE64_LENGTH));
  }

  if (chunks.length === 0 || chunks.length > MAX_AUDIO_CHUNKS) {
    return { uploaded: false, reason: 'too-large' };
  }

  const metaPath = `users/${uid}/workspaces/${WORKSPACE_ID}/audios/${record.dialogueId}`;
  const metaRef = doc(db, 'users', uid, 'workspaces', WORKSPACE_ID, 'audios', record.dialogueId);

  let existingMetaExists = false;
  const existingChunkIds = new Set<string>();

  try {
    const existingSnap = await getDoc(metaRef);
    if (existingSnap.exists()) {
      existingMetaExists = true;
      const existingChunksSnap = await getDocs(
        query(
          collection(
            db,
            'users',
            uid,
            'workspaces',
            WORKSPACE_ID,
            'audios',
            record.dialogueId,
            'chunks',
          ),
          where('ownerId', '==', uid),
        ),
      );
      existingChunksSnap.forEach((docSnap) => existingChunkIds.add(docSnap.id));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, metaPath);
  }

  const fileName = clampString(record.fileName, MAX_AUDIO_FILE_NAME_LEN, 'audio.mp3') || 'audio.mp3';
  const mimeType = clampString(record.mimeType, MAX_AUDIO_MIME_LEN, 'audio/mpeg') || 'audio/mpeg';
  const duration = Math.max(0, Math.min(MAX_AUDIO_DURATION, Number(record.duration) || 0));

  try {
    if (!existingMetaExists) {
      await setDoc(metaRef, {
        ownerId: uid,
        workspaceId: WORKSPACE_ID,
        dialogueId: record.dialogueId,
        fileName,
        mimeType,
        size: record.size,
        duration,
        chunkCount: chunks.length,
        revision: `${PENDING_REVISION_PREFIX}${revision}`.slice(0, 64),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (let start = 0; start < chunks.length; start += MAX_CHUNKS_PER_BATCH) {
      const batch = writeBatch(db);
      const end = Math.min(chunks.length, start + MAX_CHUNKS_PER_BATCH);
      for (let i = start; i < end; i += 1) {
        const chunkId = `chunk_${i}`;
        const chunkRef = doc(
          db,
          'users',
          uid,
          'workspaces',
          WORKSPACE_ID,
          'audios',
          record.dialogueId,
          'chunks',
          chunkId,
        );
        if (existingChunkIds.has(chunkId)) {
          batch.update(chunkRef, {
            revision,
            data: chunks[i],
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(chunkRef, {
            ownerId: uid,
            workspaceId: WORKSPACE_ID,
            dialogueId: record.dialogueId,
            revision,
            index: i,
            data: chunks[i],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
    }

    await updateDoc(metaRef, {
      fileName,
      mimeType,
      size: record.size,
      duration,
      chunkCount: chunks.length,
      revision,
      updatedAt: serverTimestamp(),
    });

    const staleChunkIds = Array.from(existingChunkIds).filter((chunkId) => {
      const match = /^chunk_(\d+)$/.exec(chunkId);
      if (!match) return true;
      return Number(match[1]) >= chunks.length;
    });

    for (let start = 0; start < staleChunkIds.length; start += MAX_DELETE_PER_BATCH) {
      const batch = writeBatch(db);
      const end = Math.min(staleChunkIds.length, start + MAX_DELETE_PER_BATCH);
      for (let i = start; i < end; i += 1) {
        const staleChunkRef = doc(
          db,
          'users',
          uid,
          'workspaces',
          WORKSPACE_ID,
          'audios',
          record.dialogueId,
          'chunks',
          staleChunkIds[i],
        );
        batch.delete(staleChunkRef);
      }
      await batch.commit();
    }

    return { uploaded: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, metaPath);
  }
}

export async function downloadAudioFromCloud(
  uid: string,
  meta: CloudAudioMeta,
): Promise<StoredAudioRecord | null> {
  const chunksPath = `users/${uid}/workspaces/${WORKSPACE_ID}/audios/${meta.dialogueId}/chunks`;
  const q = query(
    collection(
      db,
      'users',
      uid,
      'workspaces',
      WORKSPACE_ID,
      'audios',
      meta.dialogueId,
      'chunks',
    ),
    where('ownerId', '==', uid),
  );

  try {
    let snap;
    try {
      snap = await getDocsFromServer(q);
    } catch {
      snap = await getDocs(q);
    }
    const matchingChunks: { index: number; data: string }[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.revision === meta.revision && typeof d.index === 'number' && typeof d.data === 'string') {
        matchingChunks.push({ index: d.index, data: d.data });
      }
    });

    if (matchingChunks.length < meta.chunkCount) {
      return null;
    }

    matchingChunks.sort((a, b) => a.index - b.index);
    const fullBase64 = matchingChunks.map((c) => c.data).join('');
    const blob = base64ToBlob(fullBase64, meta.mimeType);

    return {
      dialogueId: meta.dialogueId,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      size: meta.size || blob.size,
      duration: meta.duration,
      blob,
      updatedAt: Date.now(),
      revision: meta.revision,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, chunksPath);
  }
}

export async function deleteAudioFromCloud(
  uid: string,
  dialogueId: string,
): Promise<void> {
  if (!isValidFirestoreId(dialogueId)) return;
  const metaPath = `users/${uid}/workspaces/${WORKSPACE_ID}/audios/${dialogueId}`;
  const metaRef = doc(db, 'users', uid, 'workspaces', WORKSPACE_ID, 'audios', dialogueId);

  try {
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists()) {
      await deleteDoc(metaRef);
    }

    const chunksQuery = query(
      collection(
        db,
        'users',
        uid,
        'workspaces',
        WORKSPACE_ID,
        'audios',
        dialogueId,
        'chunks',
      ),
      where('ownerId', '==', uid),
    );
    const chunksSnap = await getDocs(chunksQuery);
    const chunkRefs = chunksSnap.docs.map((d) => d.ref);
    for (let start = 0; start < chunkRefs.length; start += MAX_DELETE_PER_BATCH) {
      const batch = writeBatch(db);
      const end = Math.min(chunkRefs.length, start + MAX_DELETE_PER_BATCH);
      for (let i = start; i < end; i += 1) {
        batch.delete(chunkRefs[i]);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, metaPath);
  }
}

// --- Savestate & Content-Addressed Audio Vault Cloud Sync ---

export function createSavestateId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `save-${Date.now()}-${rand}`;
}

export function buildVaultAssetId(revision: string): string {
  const clean = revision.replace(/[^a-zA-Z0-9_-]/g, '');
  const base = clean ? `asset-${clean}` : `asset-${Date.now()}`;
  return base.slice(0, 128);
}

function sanitizeSavestateAudioRef(ref: SavestateAudioRef): SavestateAudioRef {
  return {
    dialogueId: clampString(ref.dialogueId, 128, 'dlg'),
    assetId: clampString(ref.assetId, 128, 'asset'),
    fileName: clampString(ref.fileName, MAX_AUDIO_FILE_NAME_LEN, 'audio.mp3') || 'audio.mp3',
    mimeType: clampString(ref.mimeType, MAX_AUDIO_MIME_LEN, 'audio/mpeg') || 'audio/mpeg',
    size: Math.max(1, Math.min(MAX_CLOUD_AUDIO_BYTES, Math.round(Number(ref.size) || 1))),
    duration: Math.max(0, Math.min(MAX_AUDIO_DURATION, Number(ref.duration) || 0)),
  };
}

function timestampToMillis(value: unknown, fallback: number): number {
  if (value && typeof value === 'object' && 'toMillis' in value) {
    const fn = (value as Timestamp).toMillis;
    if (typeof fn === 'function') return fn.call(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

export function subscribeCloudSavestates(
  uid: string,
  onSavestates: (savestates: WorkspaceSavestate[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const path = `users/${uid}/workspaces/${WORKSPACE_ID}/savestates`;
  const q = query(
    collection(db, 'users', uid, 'workspaces', WORKSPACE_ID, 'savestates'),
    where('ownerId', '==', uid),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      const items: WorkspaceSavestate[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (typeof d.savestateId !== 'string' || typeof d.name !== 'string') {
          return;
        }
        const now = Date.now();
        const createdAt = timestampToMillis(d.createdAt, now);
        const updatedAt = timestampToMillis(d.updatedAt, createdAt);
        items.push({
          id: d.savestateId,
          name: d.name,
          note: typeof d.note === 'string' ? d.note : '',
          createdAt,
          updatedAt,
          blocks: Array.isArray(d.blocks) ? (d.blocks as CommunicationBlock[]) : [],
          dialogues: Array.isArray(d.dialogues) ? (d.dialogues as DialogueItem[]) : [],
          sopItems: Array.isArray(d.sopItems) ? (d.sopItems as SopItem[]) : [],
          sopPositions: sanitizeSopPositions(
            d.sopPositions as Partial<PhaseSopPositions> | undefined,
          ),
          incidentNarrative:
            d.incidentNarrative && typeof d.incidentNarrative === 'object'
              ? (d.incidentNarrative as IncidentNarrative)
              : { title: 'Narasi Kejadian', time: '', body: '-', pageNumber: 1 },
          scenarioMeta:
            d.scenarioMeta && typeof d.scenarioMeta === 'object'
              ? sanitizeScenarioMeta(d.scenarioMeta as Partial<ScenarioMeta>)
              : undefined,
          playedIds: Array.isArray(d.playedIds) ? (d.playedIds as string[]) : [],
          audioRefs: Array.isArray(d.audioRefs)
            ? (d.audioRefs as SavestateAudioRef[])
            : [],
          syncedToCloud: true,
        });
      });
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      onSavestates(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export async function fetchExistingSavestateAudioIds(
  uid: string,
): Promise<Set<string>> {
  const path = `users/${uid}/workspaces/${WORKSPACE_ID}/savestateAudios`;
  const q = query(
    collection(db, 'users', uid, 'workspaces', WORKSPACE_ID, 'savestateAudios'),
    where('ownerId', '==', uid),
  );
  try {
    let snap;
    try {
      snap = await getDocsFromServer(q);
    } catch {
      snap = await getDocs(q);
    }
    const ids = new Set<string>();
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const count = Number(d.chunkCount ?? 0);
      if (typeof d.assetId === 'string' && count >= 1 && count <= MAX_CHUNKS_PER_BATCH) {
        ids.add(d.assetId);
      }
    });
    return ids;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function uploadSavestateAudioAssetToCloud(
  uid: string,
  record: AudioVaultRecord,
  knownUploadedAssetIds?: Set<string>,
): Promise<{ uploaded: boolean; skippedExisting?: boolean; reason?: 'too-large' | 'invalid-id' }> {
  if (!isValidFirestoreId(record.assetId)) {
    return { uploaded: false, reason: 'invalid-id' };
  }
  if (record.size <= 0 || record.size > MAX_CLOUD_AUDIO_BYTES) {
    return { uploaded: false, reason: 'too-large' };
  }

  // Fast 0-round-trip skip when caller already fetched existing vault asset IDs
  if (knownUploadedAssetIds?.has(record.assetId)) {
    return { uploaded: true, skippedExisting: true };
  }

  const metaPath = `users/${uid}/workspaces/${WORKSPACE_ID}/savestateAudios/${record.assetId}`;
  const metaRef = doc(
    db,
    'users',
    uid,
    'workspaces',
    WORKSPACE_ID,
    'savestateAudios',
    record.assetId,
  );

  // Deduplication check: immutable asset already uploaded in Cloud Vault
  let existingMetaExists = false;
  const existingChunkIds = new Set<string>();
  try {
    const existingSnap = await getDoc(metaRef);
    if (existingSnap.exists()) {
      existingMetaExists = true;
      const expectedCount = Number(existingSnap.data().chunkCount ?? 0);
      const chunksSnap = await getDocs(
        query(
          collection(
            db,
            'users',
            uid,
            'workspaces',
            WORKSPACE_ID,
            'savestateAudios',
            record.assetId,
            'chunks',
          ),
          where('ownerId', '==', uid),
        ),
      );
      chunksSnap.forEach((docSnap) => existingChunkIds.add(docSnap.id));
      if (expectedCount > 0 && existingChunkIds.size >= expectedCount) {
        knownUploadedAssetIds?.add(record.assetId);
        return { uploaded: true, skippedExisting: true };
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, metaPath);
  }

  const base64 = await blobToBase64(record.blob);
  const chunks: string[] = [];
  for (let offset = 0; offset < base64.length; offset += CHUNK_BASE64_LENGTH) {
    chunks.push(base64.slice(offset, offset + CHUNK_BASE64_LENGTH));
  }

  if (chunks.length === 0 || chunks.length > MAX_AUDIO_CHUNKS) {
    return { uploaded: false, reason: 'too-large' };
  }

  const fileName =
    clampString(record.fileName, MAX_AUDIO_FILE_NAME_LEN, 'audio.mp3') || 'audio.mp3';
  const mimeType =
    clampString(record.mimeType, MAX_AUDIO_MIME_LEN, 'audio/mpeg') || 'audio/mpeg';
  const duration = Math.max(0, Math.min(MAX_AUDIO_DURATION, Number(record.duration) || 0));

  try {
    // Fast path: create meta + all chunks in 1 single atomic writeBatch for short audios (<= 3 chunks)
    if (!existingMetaExists && chunks.length <= SINGLE_BATCH_MAX_CHUNKS) {
      const batch = writeBatch(db);
      batch.set(metaRef, {
        ownerId: uid,
        workspaceId: WORKSPACE_ID,
        assetId: record.assetId,
        fileName,
        mimeType,
        size: record.size,
        duration,
        chunkCount: chunks.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      for (let i = 0; i < chunks.length; i += 1) {
        const chunkRef = doc(
          db,
          'users',
          uid,
          'workspaces',
          WORKSPACE_ID,
          'savestateAudios',
          record.assetId,
          'chunks',
          `chunk_${i}`,
        );
        batch.set(chunkRef, {
          ownerId: uid,
          workspaceId: WORKSPACE_ID,
          assetId: record.assetId,
          index: i,
          data: chunks[i],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      knownUploadedAssetIds?.add(record.assetId);
      return { uploaded: true };
    }

    if (!existingMetaExists) {
      await setDoc(metaRef, {
        ownerId: uid,
        workspaceId: WORKSPACE_ID,
        assetId: record.assetId,
        fileName,
        mimeType,
        size: record.size,
        duration,
        chunkCount: chunks.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const missingIndices: number[] = [];
    for (let i = 0; i < chunks.length; i += 1) {
      if (!existingChunkIds.has(`chunk_${i}`)) {
        missingIndices.push(i);
      }
    }

    for (let start = 0; start < missingIndices.length; start += MAX_CHUNKS_PER_BATCH) {
      const batch = writeBatch(db);
      const end = Math.min(missingIndices.length, start + MAX_CHUNKS_PER_BATCH);
      for (let k = start; k < end; k += 1) {
        const idx = missingIndices[k];
        const chunkRef = doc(
          db,
          'users',
          uid,
          'workspaces',
          WORKSPACE_ID,
          'savestateAudios',
          record.assetId,
          'chunks',
          `chunk_${idx}`,
        );
        batch.set(chunkRef, {
          ownerId: uid,
          workspaceId: WORKSPACE_ID,
          assetId: record.assetId,
          index: idx,
          data: chunks[idx],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    knownUploadedAssetIds?.add(record.assetId);
    return { uploaded: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, metaPath);
  }
}

export async function downloadSavestateAudioAssetFromCloud(
  uid: string,
  audioRef: SavestateAudioRef,
): Promise<AudioVaultRecord | null> {
  if (!isValidFirestoreId(audioRef.assetId)) return null;
  const metaPath = `users/${uid}/workspaces/${WORKSPACE_ID}/savestateAudios/${audioRef.assetId}`;
  const metaRef = doc(
    db,
    'users',
    uid,
    'workspaces',
    WORKSPACE_ID,
    'savestateAudios',
    audioRef.assetId,
  );

  let expectedChunks = 0;
  try {
    const metaSnap = await getDoc(metaRef);
    if (!metaSnap.exists()) return null;
    expectedChunks = Number(metaSnap.data().chunkCount ?? 0);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, metaPath);
  }

  if (expectedChunks <= 0) return null;

  const chunksPath = `${metaPath}/chunks`;
  const chunksQuery = query(
    collection(
      db,
      'users',
      uid,
      'workspaces',
      WORKSPACE_ID,
      'savestateAudios',
      audioRef.assetId,
      'chunks',
    ),
    where('ownerId', '==', uid),
  );

  try {
    const snap = await getDocs(chunksQuery);
    const chunks: { index: number; data: string }[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (typeof d.index === 'number' && typeof d.data === 'string') {
        chunks.push({ index: d.index, data: d.data });
      }
    });
    if (chunks.length < expectedChunks) return null;
    chunks.sort((a, b) => a.index - b.index);
    const fullBase64 = chunks.map((c) => c.data).join('');
    const blob = base64ToBlob(fullBase64, audioRef.mimeType);

    return {
      assetId: audioRef.assetId,
      fileName: audioRef.fileName,
      mimeType: audioRef.mimeType,
      size: audioRef.size || blob.size,
      duration: audioRef.duration,
      blob,
      createdAt: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, chunksPath);
  }
}

export async function saveSavestateToCloud(
  uid: string,
  savestate: WorkspaceSavestate,
): Promise<void> {
  if (!isValidFirestoreId(savestate.id)) return;
  const path = `users/${uid}/workspaces/${WORKSPACE_ID}/savestates/${savestate.id}`;
  const ref = doc(
    db,
    'users',
    uid,
    'workspaces',
    WORKSPACE_ID,
    'savestates',
    savestate.id,
  );

  const clean = sanitizeWorkspacePayload({
    blocks: savestate.blocks,
    dialogues: savestate.dialogues,
    sopItems: savestate.sopItems,
    sopPositions: savestate.sopPositions,
    incidentNarrative: savestate.incidentNarrative,
    scenarioMeta: savestate.scenarioMeta,
    playedIds: savestate.playedIds,
  });

  const cleanName =
    clampString(savestate.name, MAX_SAVESTATE_NAME_LEN, 'Savestate') || 'Savestate';
  const cleanNote = clampString(savestate.note, MAX_SAVESTATE_NOTE_LEN, '');
  const cleanAudioRefs = savestate.audioRefs
    .filter((r) => isValidFirestoreId(r.dialogueId) && isValidFirestoreId(r.assetId))
    .slice(0, MAX_SAVESTATE_AUDIO_REFS)
    .map(sanitizeSavestateAudioRef);

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        name: cleanName,
        note: cleanNote,
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        blocks: clean.blocks,
        dialogues: clean.dialogues,
        sopItems: clean.sopItems,
        sopPositions: clean.sopPositions,
        incidentNarrative: clean.incidentNarrative,
        scenarioMeta: clean.scenarioMeta,
        playedIds: clean.playedIds,
        audioRefs: cleanAudioRefs,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerId: uid,
        workspaceId: WORKSPACE_ID,
        savestateId: savestate.id,
        name: cleanName,
        note: cleanNote,
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        blocks: clean.blocks,
        dialogues: clean.dialogues,
        sopItems: clean.sopItems,
        sopPositions: clean.sopPositions,
        incidentNarrative: clean.incidentNarrative,
        scenarioMeta: clean.scenarioMeta,
        playedIds: clean.playedIds,
        audioRefs: cleanAudioRefs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function renameSavestateInCloud(
  uid: string,
  savestateId: string,
  name: string,
  note: string,
): Promise<void> {
  if (!isValidFirestoreId(savestateId)) return;
  const path = `users/${uid}/workspaces/${WORKSPACE_ID}/savestates/${savestateId}`;
  const ref = doc(
    db,
    'users',
    uid,
    'workspaces',
    WORKSPACE_ID,
    'savestates',
    savestateId,
  );

  const cleanName = clampString(name, MAX_SAVESTATE_NAME_LEN, 'Savestate') || 'Savestate';
  const cleanNote = clampString(note, MAX_SAVESTATE_NOTE_LEN, '');

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) return;
    await updateDoc(ref, {
      name: cleanName,
      note: cleanNote,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSavestateFromCloud(
  uid: string,
  savestateId: string,
): Promise<void> {
  if (!isValidFirestoreId(savestateId)) return;
  const path = `users/${uid}/workspaces/${WORKSPACE_ID}/savestates/${savestateId}`;
  const ref = doc(
    db,
    'users',
    uid,
    'workspaces',
    WORKSPACE_ID,
    'savestates',
    savestateId,
  );

  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Admin RBAC & Shared Published TTX Workspace ---

export const PRIMARY_ADMIN_EMAIL = 'rxihvn@gmail.com';
export const SHARED_WORKSPACE_ID = 'default';
export const MAX_ADMIN_NOTE_LEN = 120;
export const ADMIN_EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export interface SharedWorkspacePayload {
  blocks: CommunicationBlock[];
  dialogues: DialogueItem[];
  sopItems: SopItem[];
  sopPositions: PhaseSopPositions;
  incidentNarrative: IncidentNarrative;
  scenarioMeta: ScenarioMeta;
}

export interface SharedCloudAudioMeta {
  workspaceId: string;
  updatedByUid: string;
  dialogueId: string;
  fileName: string;
  mimeType: string;
  size: number;
  duration: number;
  chunkCount: number;
  revision: string;
}

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidAdminEmail(email: string): boolean {
  const normalized = normalizeAdminEmail(email);
  return (
    normalized.length >= 5 &&
    normalized.length <= 128 &&
    ADMIN_EMAIL_PATTERN.test(normalized)
  );
}

export async function checkUserIsAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.email || !user.emailVerified) return false;
  const normalized = normalizeAdminEmail(user.email);
  if (normalized === PRIMARY_ADMIN_EMAIL) return true;
  if (!isValidAdminEmail(normalized)) return false;

  try {
    const snap = await getDoc(doc(db, 'admins', normalized));
    return snap.exists();
  } catch {
    return false;
  }
}

export function subscribeAdminEntries(
  onEntries: (entries: AdminEntryRecord[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const path = 'admins';
  const ref = collection(db, 'admins');

  return onSnapshot(
    ref,
    (snapshot) => {
      const rows: AdminEntryRecord[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (typeof d.email !== 'string') return;
        const normalized = normalizeAdminEmail(d.email);
        if (normalized === PRIMARY_ADMIN_EMAIL) return;
        const now = Date.now();
        const createdAt = timestampToMillis(d.createdAt, now);
        const updatedAt = timestampToMillis(d.updatedAt, createdAt);
        rows.push({
          email: normalized,
          note: typeof d.note === 'string' ? d.note : '',
          addedByUid: typeof d.addedByUid === 'string' ? d.addedByUid : '',
          createdAt,
          updatedAt,
          isPrimary: false,
        });
      });
      rows.sort((a, b) => a.email.localeCompare(b.email));
      onEntries([
        {
          email: PRIMARY_ADMIN_EMAIL,
          note: 'Admin Utama (Default)',
          addedByUid: 'system',
          createdAt: 0,
          updatedAt: 0,
          isPrimary: true,
        },
        ...rows,
      ]);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export async function addAdminEntry(
  uid: string,
  email: string,
  note: string,
): Promise<void> {
  const normalized = normalizeAdminEmail(email);
  if (!isValidAdminEmail(normalized)) {
    throw new Error('Format alamat email Google tidak valid.');
  }
  if (normalized === PRIMARY_ADMIN_EMAIL) {
    throw new Error('Email ini sudah terdaftar sebagai Admin Utama.');
  }

  const cleanNote = clampString(note, MAX_ADMIN_NOTE_LEN, '');
  const path = `admins/${normalized}`;
  const ref = doc(db, 'admins', normalized);

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        note: cleanNote,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        email: normalized,
        addedByUid: uid,
        note: cleanNote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeAdminEntry(email: string): Promise<void> {
  const normalized = normalizeAdminEmail(email);
  if (normalized === PRIMARY_ADMIN_EMAIL) {
    throw new Error('Admin Utama tidak dapat dihapus.');
  }
  if (!isValidAdminEmail(normalized)) return;

  const path = `admins/${normalized}`;
  const ref = doc(db, 'admins', normalized);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function ensureSharedWorkspace(
  uid: string,
  localState: WorkspaceStatePayload,
): Promise<{
  created: boolean;
  migratedFromLegacyUser?: boolean;
  remoteData?: SharedWorkspacePayload;
  legacyAudiosToMigrate?: CloudAudioMeta[];
}> {
  const path = `sharedWorkspaces/${SHARED_WORKSPACE_ID}`;
  const ref = doc(db, 'sharedWorkspaces', SHARED_WORKSPACE_ID);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        created: false,
        remoteData: {
          blocks: Array.isArray(data.blocks)
            ? (data.blocks as CommunicationBlock[])
            : localState.blocks,
          dialogues: Array.isArray(data.dialogues)
            ? (data.dialogues as DialogueItem[])
            : localState.dialogues,
          sopItems: Array.isArray(data.sopItems)
            ? (data.sopItems as SopItem[])
            : localState.sopItems,
          sopPositions:
            data.sopPositions && typeof data.sopPositions === 'object'
              ? sanitizeSopPositions(data.sopPositions as Partial<PhaseSopPositions>)
              : sanitizeSopPositions(localState.sopPositions),
          incidentNarrative:
            data.incidentNarrative && typeof data.incidentNarrative === 'object'
              ? (data.incidentNarrative as IncidentNarrative)
              : localState.incidentNarrative,
          scenarioMeta:
            data.scenarioMeta && typeof data.scenarioMeta === 'object'
              ? sanitizeScenarioMeta(data.scenarioMeta as Partial<ScenarioMeta>)
              : sanitizeScenarioMeta(localState.scenarioMeta),
        },
      };
    }

    // Seed shared workspace from legacy private workspace if Admin already had Cloud data
    let seedState: WorkspaceStatePayload = localState;
    let migratedFromLegacyUser = false;
    let legacyAudiosToMigrate: CloudAudioMeta[] = [];

    try {
      const legacyRef = doc(db, 'users', uid, 'workspaces', WORKSPACE_ID);
      const legacySnap = await getDoc(legacyRef);
      if (legacySnap.exists()) {
        const d = legacySnap.data();
        seedState = {
          blocks: Array.isArray(d.blocks)
            ? (d.blocks as CommunicationBlock[])
            : localState.blocks,
          dialogues: Array.isArray(d.dialogues)
            ? (d.dialogues as DialogueItem[])
            : localState.dialogues,
          sopItems: Array.isArray(d.sopItems)
            ? (d.sopItems as SopItem[])
            : localState.sopItems,
          sopPositions:
            d.sopPositions && typeof d.sopPositions === 'object'
              ? sanitizeSopPositions(d.sopPositions as Partial<PhaseSopPositions>)
              : sanitizeSopPositions(localState.sopPositions),
          incidentNarrative:
            d.incidentNarrative && typeof d.incidentNarrative === 'object'
              ? (d.incidentNarrative as IncidentNarrative)
              : localState.incidentNarrative,
          scenarioMeta:
            d.scenarioMeta && typeof d.scenarioMeta === 'object'
              ? sanitizeScenarioMeta(d.scenarioMeta as Partial<ScenarioMeta>)
              : sanitizeScenarioMeta(localState.scenarioMeta),
          playedIds: localState.playedIds,
        };
        migratedFromLegacyUser = true;

        const legacyAudiosQuery = query(
          collection(db, 'users', uid, 'workspaces', WORKSPACE_ID, 'audios'),
          where('ownerId', '==', uid),
        );
        const legacyAudiosSnap = await getDocs(legacyAudiosQuery);
        legacyAudiosSnap.forEach((docSnap) => {
          const a = docSnap.data();
          if (
            typeof a.dialogueId === 'string' &&
            typeof a.revision === 'string' &&
            typeof a.chunkCount === 'number'
          ) {
            legacyAudiosToMigrate.push({
              ownerId: String(a.ownerId),
              workspaceId: String(a.workspaceId),
              dialogueId: a.dialogueId,
              fileName: String(a.fileName ?? 'audio.mp3'),
              mimeType: String(a.mimeType ?? 'audio/mpeg'),
              size: Number(a.size ?? 0),
              duration: Number(a.duration ?? 0),
              chunkCount: Number(a.chunkCount),
              revision: a.revision,
            });
          }
        });
      }
    } catch {
      // No legacy workspace or profile yet; seed from local state
    }

    const clean = sanitizeWorkspacePayload(seedState);
    await setDoc(ref, {
      workspaceId: SHARED_WORKSPACE_ID,
      updatedByUid: uid,
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      blocks: clean.blocks,
      dialogues: clean.dialogues,
      sopItems: clean.sopItems,
      sopPositions: clean.sopPositions ?? sanitizeSopPositions(undefined),
      incidentNarrative: clean.incidentNarrative,
      scenarioMeta: clean.scenarioMeta ?? sanitizeScenarioMeta(undefined),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      created: true,
      migratedFromLegacyUser,
      remoteData: {
        blocks: clean.blocks,
        dialogues: clean.dialogues,
        sopItems: clean.sopItems,
        sopPositions: clean.sopPositions ?? sanitizeSopPositions(undefined),
        incidentNarrative: clean.incidentNarrative,
        scenarioMeta: clean.scenarioMeta ?? sanitizeScenarioMeta(undefined),
      },
      legacyAudiosToMigrate,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function pushSharedWorkspaceUpdate(
  uid: string,
  partial: Partial<SharedWorkspacePayload>,
): Promise<void> {
  const path = `sharedWorkspaces/${SHARED_WORKSPACE_ID}`;
  const ref = doc(db, 'sharedWorkspaces', SHARED_WORKSPACE_ID);

  const updateBody: Record<string, unknown> = {
    updatedByUid: uid,
    updatedAt: serverTimestamp(),
  };

  if (partial.blocks !== undefined) {
    updateBody.blocks = partial.blocks.slice(0, MAX_BLOCKS).map(sanitizeBlock);
  }
  if (partial.dialogues !== undefined) {
    updateBody.dialogues = partial.dialogues
      .slice(0, MAX_DIALOGUES)
      .map(sanitizeDialogue);
  }
  if (partial.sopItems !== undefined) {
    updateBody.sopItems = partial.sopItems.slice(0, MAX_SOPS).map(sanitizeSop);
  }
  if (partial.sopPositions !== undefined) {
    updateBody.sopPositions = sanitizeSopPositions(partial.sopPositions);
  }
  if (partial.incidentNarrative !== undefined) {
    updateBody.incidentNarrative = sanitizeIncidentNarrative(
      partial.incidentNarrative,
    );
  }
  if (partial.scenarioMeta !== undefined) {
    updateBody.scenarioMeta = sanitizeScenarioMeta(partial.scenarioMeta);
  }

  try {
    await updateDoc(ref, updateBody);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchSharedWorkspaceFromServer(): Promise<SharedWorkspacePayload | null> {
  const path = `sharedWorkspaces/${SHARED_WORKSPACE_ID}`;
  const ref = doc(db, 'sharedWorkspaces', SHARED_WORKSPACE_ID);

  try {
    let snap;
    try {
      snap = await getDocFromServer(ref);
    } catch {
      snap = await getDoc(ref);
    }
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!Array.isArray(data.blocks) || !Array.isArray(data.dialogues)) return null;

    return {
      blocks: data.blocks as CommunicationBlock[],
      dialogues: data.dialogues as DialogueItem[],
      sopItems: Array.isArray(data.sopItems) ? (data.sopItems as SopItem[]) : [],
      sopPositions: sanitizeSopPositions(
        data.sopPositions as Partial<PhaseSopPositions> | undefined,
      ),
      incidentNarrative:
        data.incidentNarrative && typeof data.incidentNarrative === 'object'
          ? (data.incidentNarrative as IncidentNarrative)
          : { title: 'Narasi Kejadian', time: '', body: '-', pageNumber: 1 },
      scenarioMeta: sanitizeScenarioMeta(
        data.scenarioMeta as Partial<ScenarioMeta> | undefined,
      ),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchSharedAudiosFromServer(): Promise<SharedCloudAudioMeta[]> {
  const path = `sharedWorkspaces/${SHARED_WORKSPACE_ID}/audios`;
  const q = query(
    collection(db, 'sharedWorkspaces', SHARED_WORKSPACE_ID, 'audios'),
    where('workspaceId', '==', SHARED_WORKSPACE_ID),
  );

  try {
    let snapshot;
    try {
      snapshot = await getDocsFromServer(q);
    } catch {
      snapshot = await getDocs(q);
    }
    const metas: SharedCloudAudioMeta[] = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      if (
        typeof d.dialogueId === 'string' &&
        typeof d.revision === 'string' &&
        !d.revision.startsWith(PENDING_REVISION_PREFIX) &&
        typeof d.chunkCount === 'number'
      ) {
        metas.push({
          workspaceId: String(d.workspaceId ?? SHARED_WORKSPACE_ID),
          updatedByUid: String(d.updatedByUid ?? ''),
          dialogueId: d.dialogueId,
          fileName: String(d.fileName ?? 'audio.mp3'),
          mimeType: String(d.mimeType ?? 'audio/mpeg'),
          size: Number(d.size ?? 0),
          duration: Number(d.duration ?? 0),
          chunkCount: Number(d.chunkCount),
          revision: d.revision,
        });
      }
    });
    return metas;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeSharedWorkspace(
  onData: (
    data: SharedWorkspacePayload | null,
    metaInfo: { fromCache: boolean },
  ) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const path = `sharedWorkspaces/${SHARED_WORKSPACE_ID}`;
  const ref = doc(db, 'sharedWorkspaces', SHARED_WORKSPACE_ID);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null, { fromCache: snap.metadata.fromCache });
        return;
      }
      if (snap.metadata.hasPendingWrites) return;
      const data = snap.data();
      if (!Array.isArray(data.blocks) || !Array.isArray(data.dialogues)) return;

      onData(
        {
          blocks: data.blocks as CommunicationBlock[],
          dialogues: data.dialogues as DialogueItem[],
          sopItems: Array.isArray(data.sopItems)
            ? (data.sopItems as SopItem[])
            : [],
          sopPositions: sanitizeSopPositions(
            data.sopPositions as Partial<PhaseSopPositions> | undefined,
          ),
          incidentNarrative:
            data.incidentNarrative && typeof data.incidentNarrative === 'object'
              ? (data.incidentNarrative as IncidentNarrative)
              : { title: 'Narasi Kejadian', time: '', body: '-', pageNumber: 1 },
          scenarioMeta: sanitizeScenarioMeta(
            data.scenarioMeta as Partial<ScenarioMeta> | undefined,
          ),
        },
        { fromCache: snap.metadata.fromCache },
      );
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export function subscribeSharedAudios(
  onMetas: (
    metas: SharedCloudAudioMeta[],
    metaInfo: { fromCache: boolean },
  ) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const path = `sharedWorkspaces/${SHARED_WORKSPACE_ID}/audios`;
  const q = query(
    collection(db, 'sharedWorkspaces', SHARED_WORKSPACE_ID, 'audios'),
    where('workspaceId', '==', SHARED_WORKSPACE_ID),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      const metas: SharedCloudAudioMeta[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (
          typeof d.dialogueId === 'string' &&
          typeof d.revision === 'string' &&
          !d.revision.startsWith(PENDING_REVISION_PREFIX) &&
          typeof d.chunkCount === 'number'
        ) {
          metas.push({
            workspaceId: String(d.workspaceId ?? SHARED_WORKSPACE_ID),
            updatedByUid: String(d.updatedByUid ?? ''),
            dialogueId: d.dialogueId,
            fileName: String(d.fileName ?? 'audio.mp3'),
            mimeType: String(d.mimeType ?? 'audio/mpeg'),
            size: Number(d.size ?? 0),
            duration: Number(d.duration ?? 0),
            chunkCount: Number(d.chunkCount),
            revision: d.revision,
          });
        }
      });
      onMetas(metas, { fromCache: snapshot.metadata.fromCache });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export async function uploadSharedAudioToCloud(
  uid: string,
  record: StoredAudioRecord,
  revision: string,
): Promise<{ uploaded: boolean; skippedExisting?: boolean; reason?: 'too-large' | 'invalid-id' }> {
  if (!isValidFirestoreId(record.dialogueId)) {
    return { uploaded: false, reason: 'invalid-id' };
  }
  if (record.size <= 0 || record.size > MAX_CLOUD_AUDIO_BYTES) {
    return { uploaded: false, reason: 'too-large' };
  }

  const base64 = await blobToBase64(record.blob);
  const chunks: string[] = [];
  for (let offset = 0; offset < base64.length; offset += CHUNK_BASE64_LENGTH) {
    chunks.push(base64.slice(offset, offset + CHUNK_BASE64_LENGTH));
  }

  if (chunks.length === 0 || chunks.length > MAX_AUDIO_CHUNKS) {
    return { uploaded: false, reason: 'too-large' };
  }

  const metaPath = `sharedWorkspaces/${SHARED_WORKSPACE_ID}/audios/${record.dialogueId}`;
  const metaRef = doc(
    db,
    'sharedWorkspaces',
    SHARED_WORKSPACE_ID,
    'audios',
    record.dialogueId,
  );

  let existingMetaExists = false;
  const existingChunkIds = new Set<string>();

  try {
    let existingSnap;
    try {
      existingSnap = await getDocFromServer(metaRef);
    } catch {
      existingSnap = await getDoc(metaRef);
    }
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      if (
        typeof existingData.revision === 'string' &&
        !existingData.revision.startsWith(PENDING_REVISION_PREFIX) &&
        existingData.revision === revision &&
        Number(existingData.chunkCount ?? 0) === chunks.length
      ) {
        return { uploaded: true, skippedExisting: true };
      }
      existingMetaExists = true;
      const chunksQuery = query(
        collection(
          db,
          'sharedWorkspaces',
          SHARED_WORKSPACE_ID,
          'audios',
          record.dialogueId,
          'chunks',
        ),
        where('workspaceId', '==', SHARED_WORKSPACE_ID),
      );
      let chunksSnap;
      try {
        chunksSnap = await getDocsFromServer(chunksQuery);
      } catch {
        chunksSnap = await getDocs(chunksQuery);
      }
      chunksSnap.forEach((docSnap) => existingChunkIds.add(docSnap.id));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, metaPath);
  }

  const fileName =
    clampString(record.fileName, MAX_AUDIO_FILE_NAME_LEN, 'audio.mp3') ||
    'audio.mp3';
  const mimeType =
    clampString(record.mimeType, MAX_AUDIO_MIME_LEN, 'audio/mpeg') ||
    'audio/mpeg';
  const duration = Math.max(
    0,
    Math.min(MAX_AUDIO_DURATION, Number(record.duration) || 0),
  );

  try {
    // Fast path: for new short audios (<= 3 chunks), commit meta + all chunks in 1 single atomic writeBatch!
    if (!existingMetaExists && chunks.length <= SINGLE_BATCH_MAX_CHUNKS) {
      const batch = writeBatch(db);
      batch.set(metaRef, {
        workspaceId: SHARED_WORKSPACE_ID,
        updatedByUid: uid,
        dialogueId: record.dialogueId,
        fileName,
        mimeType,
        size: record.size,
        duration,
        chunkCount: chunks.length,
        revision,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      for (let i = 0; i < chunks.length; i += 1) {
        const chunkRef = doc(
          db,
          'sharedWorkspaces',
          SHARED_WORKSPACE_ID,
          'audios',
          record.dialogueId,
          'chunks',
          `chunk_${i}`,
        );
        batch.set(chunkRef, {
          workspaceId: SHARED_WORKSPACE_ID,
          updatedByUid: uid,
          dialogueId: record.dialogueId,
          revision,
          index: i,
          data: chunks[i],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      return { uploaded: true };
    }

    // 1. Ensure parent meta doc exists BEFORE chunk writes (using pending_ staging revision on create
    //    so listening Users ignore it until every chunk is safely committed).
    if (!existingMetaExists) {
      await setDoc(metaRef, {
        workspaceId: SHARED_WORKSPACE_ID,
        updatedByUid: uid,
        dialogueId: record.dialogueId,
        fileName,
        mimeType,
        size: record.size,
        duration,
        chunkCount: chunks.length,
        revision: `${PENDING_REVISION_PREFIX}${revision}`.slice(0, 64),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 2. Upload chunks in safe batches (<= 4 chunks per batch) well within Firestore's
    //    10 MiB payload ceiling AND 20 rule-lookup batch limit.
    for (let start = 0; start < chunks.length; start += MAX_CHUNKS_PER_BATCH) {
      const batch = writeBatch(db);
      const end = Math.min(chunks.length, start + MAX_CHUNKS_PER_BATCH);
      for (let i = start; i < end; i += 1) {
        const chunkId = `chunk_${i}`;
        const chunkRef = doc(
          db,
          'sharedWorkspaces',
          SHARED_WORKSPACE_ID,
          'audios',
          record.dialogueId,
          'chunks',
          chunkId,
        );
        if (existingChunkIds.has(chunkId)) {
          batch.update(chunkRef, {
            updatedByUid: uid,
            revision,
            data: chunks[i],
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(chunkRef, {
            workspaceId: SHARED_WORKSPACE_ID,
            updatedByUid: uid,
            dialogueId: record.dialogueId,
            revision,
            index: i,
            data: chunks[i],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
    }

    // 3. Publish the final revision atomically now that all chunks are stored
    await updateDoc(metaRef, {
      updatedByUid: uid,
      fileName,
      mimeType,
      size: record.size,
      duration,
      chunkCount: chunks.length,
      revision,
      updatedAt: serverTimestamp(),
    });

    // 4. Prune any stale leftover chunks in safe batches
    const staleChunkIds = Array.from(existingChunkIds).filter((chunkId) => {
      const match = /^chunk_(\d+)$/.exec(chunkId);
      if (!match) return true;
      return Number(match[1]) >= chunks.length;
    });

    for (let start = 0; start < staleChunkIds.length; start += MAX_DELETE_PER_BATCH) {
      const batch = writeBatch(db);
      const end = Math.min(staleChunkIds.length, start + MAX_DELETE_PER_BATCH);
      for (let i = start; i < end; i += 1) {
        const staleChunkRef = doc(
          db,
          'sharedWorkspaces',
          SHARED_WORKSPACE_ID,
          'audios',
          record.dialogueId,
          'chunks',
          staleChunkIds[i],
        );
        batch.delete(staleChunkRef);
      }
      await batch.commit();
    }

    return { uploaded: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, metaPath);
  }
}

export async function downloadSharedAudioFromCloud(
  meta: SharedCloudAudioMeta,
): Promise<StoredAudioRecord | null> {
  const chunksPath = `sharedWorkspaces/${SHARED_WORKSPACE_ID}/audios/${meta.dialogueId}/chunks`;
  const q = query(
    collection(
      db,
      'sharedWorkspaces',
      SHARED_WORKSPACE_ID,
      'audios',
      meta.dialogueId,
      'chunks',
    ),
    where('workspaceId', '==', SHARED_WORKSPACE_ID),
  );

  try {
    let snap;
    try {
      snap = await getDocsFromServer(q);
    } catch {
      snap = await getDocs(q);
    }
    const matchingChunks: { index: number; data: string }[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (
        d.revision === meta.revision &&
        typeof d.index === 'number' &&
        typeof d.data === 'string'
      ) {
        matchingChunks.push({ index: d.index, data: d.data });
      }
    });

    if (matchingChunks.length < meta.chunkCount) {
      return null;
    }

    matchingChunks.sort((a, b) => a.index - b.index);
    const fullBase64 = matchingChunks.map((c) => c.data).join('');
    const blob = base64ToBlob(fullBase64, meta.mimeType);

    return {
      dialogueId: meta.dialogueId,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      size: meta.size || blob.size,
      duration: meta.duration,
      blob,
      updatedAt: Date.now(),
      revision: meta.revision,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, chunksPath);
  }
}

export async function deleteSharedAudioFromCloud(
  dialogueId: string,
): Promise<void> {
  if (!isValidFirestoreId(dialogueId)) return;
  const metaPath = `sharedWorkspaces/${SHARED_WORKSPACE_ID}/audios/${dialogueId}`;
  const metaRef = doc(
    db,
    'sharedWorkspaces',
    SHARED_WORKSPACE_ID,
    'audios',
    dialogueId,
  );

  try {
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists()) {
      await deleteDoc(metaRef);
    }

    const chunksQuery = query(
      collection(
        db,
        'sharedWorkspaces',
        SHARED_WORKSPACE_ID,
        'audios',
        dialogueId,
        'chunks',
      ),
      where('workspaceId', '==', SHARED_WORKSPACE_ID),
    );
    const chunksSnap = await getDocs(chunksQuery);
    const chunkRefs = chunksSnap.docs.map((d) => d.ref);
    for (let start = 0; start < chunkRefs.length; start += MAX_DELETE_PER_BATCH) {
      const batch = writeBatch(db);
      const end = Math.min(chunkRefs.length, start + MAX_DELETE_PER_BATCH);
      for (let i = start; i < end; i += 1) {
        batch.delete(chunkRefs[i]);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, metaPath);
  }
}

