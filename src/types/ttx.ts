export type WorkspaceView = 'console' | 'reference' | 'pdf';

export type UserRole = 'admin' | 'user';

export interface AdminEntryRecord {
  email: string;
  note: string;
  addedByUid: string;
  createdAt: number;
  updatedAt: number;
  isPrimary?: boolean;
}

export type PhaseId = 'fase-2' | 'fase-3' | 'fase-4' | 'fase-6';

export type PhaseSopPositions = Record<PhaseId, number>;

export type AudioFilter = 'all' | 'has-audio' | 'missing-audio' | 'unplayed';

export type BlockEntryType = 'dialogue' | 'narrative';

export type GeminiTtsVoice = 'Kore' | 'Charon' | 'Fenrir' | 'Puck' | 'Zephyr';

export interface DialogueItem {
  id: string;
  entryType?: BlockEntryType;
  sequenceNumber: number;
  phaseId: PhaseId;
  blockId: string;
  title?: string;
  sender: string;
  receiver: string;
  transcript: string;
  isEmergencyPriority?: boolean;
  pageNumber: number;
  note?: string;
  isCustom?: boolean;
  ttsVoice?: GeminiTtsVoice;
  ttsStyle?: string;
}

export interface CommunicationBlock {
  id: string;
  phaseId: PhaseId;
  code: string;
  title: string;
  channelType: string;
  description: string;
  pageNumber: number;
}

export interface ScenarioPhase {
  id: PhaseId;
  roman: string;
  title: string;
  shortTitle: string;
  summary: string;
  pageRange: string;
}

export type CloudSyncStatus =
  | 'disconnected'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'error';

export interface StoredAudioRecord {
  dialogueId: string;
  fileName: string;
  mimeType: string;
  size: number;
  duration: number;
  blob: Blob;
  updatedAt: number;
  revision?: string;
}

export interface AudioEntryView {
  dialogueId: string;
  fileName: string;
  mimeType: string;
  size: number;
  duration: number;
  objectUrl: string;
  updatedAt: number;
  revision?: string;
}

export interface EmergencyFactItem {
  label: string;
  value: string;
  isCritical?: boolean;
}

export interface ScenarioMeta {
  unit: string;
  title: string;
  description: string;
  status: string;
  callSign: string;
  aircraft: string;
  route: string;
  etaRunway: string;
  pob: string;
  fuel: string;
}

export interface IncidentNarrative {
  title: string;
  time: string;
  body: string;
  pageNumber: number;
}

export interface SopItem {
  id: string;
  phaseId: PhaseId;
  phaseTitle: string;
  unit: string;
  steps: string[];
  pageNumber: number;
}

export interface TacticalZone {
  name: string;
  distance: string;
  zoneLabel: string;
  zoneLevel: 'hot' | 'warm' | 'cold';
  functionDesc: string;
  responsibleUnit: string;
}

export interface TriageCategory {
  id: 'red' | 'yellow' | 'green' | 'black';
  label: string;
  count: number;
  severity: string;
  actions: string[];
}

export interface SavestateAudioRef {
  dialogueId: string;
  assetId: string;
  fileName: string;
  mimeType: string;
  size: number;
  duration: number;
}

export interface AudioVaultRecord {
  assetId: string;
  fileName: string;
  mimeType: string;
  size: number;
  duration: number;
  blob: Blob;
  createdAt: number;
}

export interface WorkspaceSavestate {
  id: string;
  name: string;
  note: string;
  createdAt: number;
  updatedAt: number;
  blocks: CommunicationBlock[];
  dialogues: DialogueItem[];
  sopItems: SopItem[];
  sopPositions: PhaseSopPositions;
  incidentNarrative: IncidentNarrative;
  scenarioMeta?: ScenarioMeta;
  playedIds: string[];
  audioRefs: SavestateAudioRef[];
  syncedToCloud?: boolean;
}
