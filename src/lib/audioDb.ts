import type {
  AudioVaultRecord,
  CommunicationBlock,
  DialogueItem,
  IncidentNarrative,
  PhaseSopPositions,
  ScenarioMeta,
  SopItem,
  StoredAudioRecord,
  WorkspaceSavestate,
} from '../types/ttx';

const DB_NAME = 'ttx_tanjung_api_audio_db';
const DB_VERSION = 2;
const AUDIO_STORE = 'audio_files';
const STATE_STORE = 'app_state';
const SAVESTATE_STORE = 'savestates';
const AUDIO_VAULT_STORE = 'audio_vault';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia pada browser ini.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: 'dialogueId' });
      }
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(SAVESTATE_STORE)) {
        db.createObjectStore(SAVESTATE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(AUDIO_VAULT_STORE)) {
        db.createObjectStore(AUDIO_VAULT_STORE, { keyPath: 'assetId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Gagal membuka penyimpanan lokal.'));
  });
}

export async function saveAudioRecord(record: StoredAudioRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    tx.objectStore(AUDIO_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllAudioRecords(): Promise<StoredAudioRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readonly');
    const request = tx.objectStore(AUDIO_STORE).getAll();
    request.onsuccess = () => resolve((request.result as StoredAudioRecord[]) ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAudioRecord(dialogueId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    tx.objectStore(AUDIO_STORE).delete(dialogueId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllAudioRecords(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    tx.objectStore(AUDIO_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Savestate & Content-Addressed Audio Vault Helpers ---

export async function getAllSavestates(): Promise<WorkspaceSavestate[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAVESTATE_STORE, 'readonly');
    const request = tx.objectStore(SAVESTATE_STORE).getAll();
    request.onsuccess = () => {
      const items = (request.result as WorkspaceSavestate[]) ?? [];
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveSavestateRecord(
  savestate: WorkspaceSavestate,
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAVESTATE_STORE, 'readwrite');
    tx.objectStore(SAVESTATE_STORE).put(savestate);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteSavestateRecord(savestateId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAVESTATE_STORE, 'readwrite');
    tx.objectStore(SAVESTATE_STORE).delete(savestateId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveAudioVaultRecord(
  record: AudioVaultRecord,
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_VAULT_STORE, 'readwrite');
    tx.objectStore(AUDIO_VAULT_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAudioVaultRecord(
  assetId: string,
): Promise<AudioVaultRecord | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_VAULT_STORE, 'readonly');
    const request = tx.objectStore(AUDIO_VAULT_STORE).get(assetId);
    request.onsuccess = () =>
      resolve((request.result as AudioVaultRecord | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function pruneUnreferencedVaultAudios(): Promise<void> {
  const savestates = await getAllSavestates();
  const referenced = new Set<string>();
  for (const state of savestates) {
    if (Array.isArray(state.audioRefs)) {
      for (const ref of state.audioRefs) {
        if (ref.assetId) referenced.add(ref.assetId);
      }
    }
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_VAULT_STORE, 'readwrite');
    const store = tx.objectStore(AUDIO_VAULT_STORE);
    const keysReq = store.getAllKeys();
    keysReq.onsuccess = () => {
      const keys = (keysReq.result as string[]) ?? [];
      for (const key of keys) {
        if (!referenced.has(key)) {
          store.delete(key);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveStateValue<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATE_STORE, 'readwrite');
    tx.objectStore(STATE_STORE).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStateValue<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATE_STORE, 'readonly');
    const request = tx.objectStore(STATE_STORE).get(key);
    request.onsuccess = () => {
      const result = request.result as { key: string; value: T } | undefined;
      resolve(result ? result.value : null);
    };
    request.onerror = () => reject(request.error);
  });
}

interface ExportedAudioPayload {
  dialogueId: string;
  fileName: string;
  mimeType: string;
  size: number;
  duration: number;
  updatedAt: number;
  dataUrl: string;
}

export interface TtxBackupBundle {
  version: number;
  exportedAt: string;
  scenario: string;
  blocks?: CommunicationBlock[];
  dialogues: DialogueItem[];
  sopItems?: SopItem[];
  sopPositions?: PhaseSopPositions;
  incidentNarrative?: IncidentNarrative;
  scenarioMeta?: ScenarioMeta;
  playedIds: string[];
  audios: ExportedAudioPayload[];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Gagal mengonversi audio untuk ekspor.'));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string, fallbackType: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  if (blob.type) return blob;
  return new Blob([blob], { type: fallbackType || 'audio/mpeg' });
}

export async function createBackupBundle(
  blocks: CommunicationBlock[],
  dialogues: DialogueItem[],
  sopItems: SopItem[],
  incidentNarrative: IncidentNarrative,
  playedIds: string[],
  sopPositions?: PhaseSopPositions,
  scenarioMeta?: ScenarioMeta,
): Promise<TtxBackupBundle> {
  const audioRecords = await getAllAudioRecords();
  const audios: ExportedAudioPayload[] = [];

  for (const record of audioRecords) {
    const dataUrl = await blobToDataUrl(record.blob);
    audios.push({
      dialogueId: record.dialogueId,
      fileName: record.fileName,
      mimeType: record.mimeType,
      size: record.size,
      duration: record.duration,
      updatedAt: record.updatedAt,
      dataUrl,
    });
  }

  return {
    version: 5,
    exportedAt: new Date().toISOString(),
    scenario: scenarioMeta
      ? `${scenarioMeta.unit} (${scenarioMeta.callSign})`
      : 'TTX UPBU Kelas III Tanjung Api — Ampana (CLB-412)',
    blocks,
    dialogues,
    sopItems,
    sopPositions,
    incidentNarrative,
    scenarioMeta,
    playedIds,
    audios,
  };
}

export async function restoreBackupBundle(bundle: TtxBackupBundle): Promise<{
  blocks?: CommunicationBlock[];
  dialogues: DialogueItem[];
  sopItems?: SopItem[];
  sopPositions?: PhaseSopPositions;
  incidentNarrative?: IncidentNarrative;
  scenarioMeta?: ScenarioMeta;
  playedIds: string[];
  records: StoredAudioRecord[];
}> {
  if (!bundle || !Array.isArray(bundle.dialogues) || !Array.isArray(bundle.audios)) {
    throw new Error('Format file paket TTX tidak valid.');
  }

  const restoredRecords: StoredAudioRecord[] = [];
  for (const item of bundle.audios) {
    const blob = await dataUrlToBlob(item.dataUrl, item.mimeType);
    const record: StoredAudioRecord = {
      dialogueId: item.dialogueId,
      fileName: item.fileName,
      mimeType: item.mimeType || blob.type || 'audio/mpeg',
      size: item.size || blob.size,
      duration: item.duration || 0,
      blob,
      updatedAt: item.updatedAt || Date.now(),
    };
    await saveAudioRecord(record);
    restoredRecords.push(record);
  }

  if (Array.isArray(bundle.blocks) && bundle.blocks.length > 0) {
    await saveStateValue('blocks', bundle.blocks);
  }
  if (Array.isArray(bundle.sopItems) && bundle.sopItems.length > 0) {
    await saveStateValue('sopItems', bundle.sopItems);
  }
  if (bundle.sopPositions && typeof bundle.sopPositions === 'object') {
    await saveStateValue('sopPositions', bundle.sopPositions);
  }
  if (bundle.incidentNarrative && bundle.incidentNarrative.body) {
    await saveStateValue('incidentNarrative', bundle.incidentNarrative);
  }
  if (bundle.scenarioMeta && typeof bundle.scenarioMeta === 'object') {
    await saveStateValue('scenarioMeta', bundle.scenarioMeta);
  }
  await saveStateValue('dialogues', bundle.dialogues);
  await saveStateValue('playedIds', bundle.playedIds ?? []);

  return {
    blocks:
      Array.isArray(bundle.blocks) && bundle.blocks.length > 0
        ? bundle.blocks
        : undefined,
    dialogues: bundle.dialogues,
    sopItems:
      Array.isArray(bundle.sopItems) && bundle.sopItems.length > 0
        ? bundle.sopItems
        : undefined,
    sopPositions:
      bundle.sopPositions && typeof bundle.sopPositions === 'object'
        ? bundle.sopPositions
        : undefined,
    incidentNarrative:
      bundle.incidentNarrative && bundle.incidentNarrative.body
        ? bundle.incidentNarrative
        : undefined,
    scenarioMeta:
      bundle.scenarioMeta && typeof bundle.scenarioMeta === 'object'
        ? bundle.scenarioMeta
        : undefined,
    playedIds: bundle.playedIds ?? [],
    records: restoredRecords,
  };
}
