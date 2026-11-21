/**
 * Security Rules Verification Specification — Dirty Dozen Payloads
 * Reference spec matching security_spec.md and firestore.rules.
 *
 * Each case below enumerates an adversarial payload that MUST return PERMISSION_DENIED
 * under firestore.rules.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  actor: { uid: string | null; email?: string; email_verified: boolean; isAdmin?: boolean };
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedBy: string;
}

export const DIRTY_DOZEN_SECURITY_TESTS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Workspace Create',
    actor: { uid: 'uid-a', email: 'user-a@example.com', email_verified: true },
    operation: 'create',
    path: 'users/uid-a/workspaces/default',
    payload: {
      ownerId: 'uid-b',
      workspaceId: 'default',
      schemaVersion: 3,
      blocks: [],
      dialogues: [],
      sopItems: [],
      incidentNarrative: { title: 'Test', time: '10:00', body: 'Body', pageNumber: 4 },
      playedIds: [],
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'isValidWorkspace enforces data.ownerId == request.auth.uid && data.ownerId == userId',
  },
  {
    id: 2,
    name: 'Cross-Tenant Workspace Read',
    actor: { uid: 'uid-b', email: 'user-b@example.com', email_verified: true },
    operation: 'get',
    path: 'users/uid-a/workspaces/default',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'isOwner(userId) enforces request.auth.uid == userId',
  },
  {
    id: 3,
    name: 'Unverified Email Admin Spoofing',
    actor: { uid: 'uid-spoof', email: 'rxihvn@gmail.com', email_verified: false },
    operation: 'update',
    path: 'sharedWorkspaces/default',
    payload: { updatedByUid: 'uid-spoof' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'isBootstrappedAdmin() requires isVerified() (request.auth.token.email_verified == true)',
  },
  {
    id: 4,
    name: 'Non-Admin Write to Shared TTX Workspace',
    actor: { uid: 'uid-user', email: 'peserta@example.com', email_verified: true, isAdmin: false },
    operation: 'update',
    path: 'sharedWorkspaces/default',
    payload: { updatedByUid: 'uid-user', blocks: [] },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'allow update on /sharedWorkspaces/default requires isAdmin()',
  },
  {
    id: 5,
    name: 'Non-Admin Enumeration of Admin Registry (PII Leak)',
    actor: { uid: 'uid-user', email: 'peserta@example.com', email_verified: true, isAdmin: false },
    operation: 'list',
    path: 'admins',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'allow list on /admins requires isAdmin()',
  },
  {
    id: 6,
    name: 'Primary Admin Deletion Attempt',
    actor: { uid: 'uid-admin-2', email: 'admin2@example.com', email_verified: true, isAdmin: true },
    operation: 'delete',
    path: 'admins/rxihvn@gmail.com',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: "allow delete on /admins enforces adminId != 'rxihvn@gmail.com' && existing().email != 'rxihvn@gmail.com'",
  },
  {
    id: 7,
    name: 'Shadow Field Injection on Shared Workspace Update',
    actor: { uid: 'uid-admin', email: 'rxihvn@gmail.com', email_verified: true, isAdmin: true },
    operation: 'update',
    path: 'sharedWorkspaces/default',
    payload: { updatedByUid: 'uid-admin', superRole: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().diff(existing()).affectedKeys().hasOnly(...) in every update action',
  },
  {
    id: 8,
    name: 'Invalid Admin Email Key or Alternate Shared Workspace ID',
    actor: { uid: 'uid-admin', email: 'rxihvn@gmail.com', email_verified: true, isAdmin: true },
    operation: 'create',
    path: 'admins/not-a-valid-email',
    payload: { email: 'not-a-valid-email', addedByUid: 'uid-admin', note: '' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'isValidAdminKey enforces lowercase email regex and length bounds',
  },
  {
    id: 9,
    name: 'Immutable Field Tampering on Shared Audio Meta Update',
    actor: { uid: 'uid-admin', email: 'rxihvn@gmail.com', email_verified: true, isAdmin: true },
    operation: 'update',
    path: 'sharedWorkspaces/default/audios/dlg-01',
    payload: { dialogueId: 'dlg-02', createdAt: '2025-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().dialogueId == existing().dialogueId && incoming().createdAt == existing().createdAt',
  },
  {
    id: 10,
    name: 'Value Poisoning on Whitelisted Shared Workspace Field',
    actor: { uid: 'uid-admin', email: 'rxihvn@gmail.com', email_verified: true, isAdmin: true },
    operation: 'update',
    path: 'sharedWorkspaces/default',
    payload: {
      updatedByUid: 'uid-admin',
      incidentNarrative: {
        title: 'Title',
        time: '10:00',
        body: 'x'.repeat(15000),
        pageNumber: 4,
      },
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'isValidSharedWorkspace -> isValidIncidentNarrative enforces n.body.size() <= 8000',
  },
  {
    id: 11,
    name: 'Orphaned Shared Audio Chunk Write (Atomicity Bypass)',
    actor: { uid: 'uid-admin', email: 'rxihvn@gmail.com', email_verified: true, isAdmin: true },
    operation: 'create',
    path: 'sharedWorkspaces/default/audios/dlg-nonexistent/chunks/chunk_0',
    payload: {
      workspaceId: 'default',
      updatedByUid: 'uid-admin',
      dialogueId: 'dlg-nonexistent',
      revision: 'rev-1',
      index: 0,
      data: 'AAAA',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'sharedAudioExistsAfter enforces existsAfter & getAfter on parent shared audio doc',
  },
  {
    id: 12,
    name: 'Unscoped Cross-User List Query',
    actor: { uid: 'uid-b', email: 'user-b@example.com', email_verified: true },
    operation: 'list',
    path: 'users/uid-a/workspaces/default/audios',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'allow list enforces isOwner(userId) && resource.data.ownerId == request.auth.uid',
  },
];
