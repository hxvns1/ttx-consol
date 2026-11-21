# Security Specification & Payload-First TDD — Konsol Audio TTX

## 1. Data Invariants
1. **Admin RBAC & PII Isolation (`/admins/{adminId}`)**:
   - Primary Admin (`rxihvn@gmail.com`) is bootstrapped via `isBootstrappedAdmin()` requiring verified Google email (`email_verified == true`).
   - Additional Admins are registered under `/admins/{lowercaseEmail}`.
   - Non-admin verified users may ONLY `get` their own exact email document (`adminId == request.auth.token.email.lower()`) to check their own role; they can NEVER `list` `/admins` or read other admins' emails.
   - Only verified Admins can `list`, `create`, `update` (note only), or `delete` `/admins/{adminId}`. The primary admin (`rxihvn@gmail.com`) can never be deleted.
2. **Published Shared TTX Scenario (`/sharedWorkspaces/default`)**:
   - Single-document `get` on `/sharedWorkspaces/default` and scoped `get`/`list` (`where('workspaceId', '==', 'default')`) on `audios` and `chunks` are publicly readable so any User on any device automatically receives Admin's published scenario and audio files.
   - All `create`, `update`, and `delete` operations on `/sharedWorkspaces/default`, `audios`, and `chunks` are strictly restricted to verified Admins (`isAdmin()`). Deleting `/sharedWorkspaces/default` is always denied.
3. **Strict Ownership Isolation (`/users/{userId}`)**: Every document under `/users/{userId}` and its subcollections (`workspaces`, `audios`, `chunks`, `savestates`, `savestateAudios`) may ONLY be read or written by the authenticated user whose verified `request.auth.uid == userId` and `ownerId == request.auth.uid`.
4. **Master Gate Relational Integrity**:
   - Shared audio chunks require both parent `sharedWorkspaces/default` (`sharedWorkspaceExists`) and atomic parent audio metadata (`sharedAudioExistsAfter`).
   - Private user subcollections enforce `userProfileExists`, `isWorkspaceOwner`, `audioExistsAfterOwned`, and `savestateAudioExistsAfterOwned`.
5. **Strict Schema, Boundaries & Temporal Integrity**: Every create enforces `keys().hasAll(...)` and `keys().hasOnly(...)`; every update enforces `isValid[Entity]()` and action-scoped `affectedKeys().hasOnly(...)`. `createdAt == request.time` on create and immutable on update; `updatedAt == request.time` on create/update.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)

1. **Identity Spoofing on Workspace Create**: User A (`uid-a`) creates `/users/uid-a/workspaces/default` with `ownerId: "uid-b"`.
2. **Cross-Tenant Read**: User B (`uid-b`) attempts `get` on `/users/uid-a/workspaces/default`.
3. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to write `/sharedWorkspaces/default` or `/users/uid-a`.
4. **Non-Admin Write to Shared Workspace**: Verified non-admin Google user attempts `update` on `/sharedWorkspaces/default` or `create` on `/sharedWorkspaces/default/audios/dlg-01`.
5. **Non-Admin Enumeration of Admin Emails (PII Leak)**: Verified non-admin user attempts `list` on `/admins` or `get` on `/admins/other-admin@example.com`.
6. **Primary Admin Deletion Attempt**: Secondary Admin attempts `delete` on `/admins/rxihvn@gmail.com`.
7. **Shadow Field Injection (Create/Update)**: Admin updates `/sharedWorkspaces/default` or `/admins/facilitator@example.com` with ghost field `superRole: true`.
8. **ID & Email Key Poisoning**: Admin creates `/admins/not-an-email` or `/sharedWorkspaces/alternate`.
9. **Timestamp Spoofing & Immutable Field Tampering**: Admin updates `/sharedWorkspaces/default/audios/dlg-01` attempting to alter `createdAt` or `dialogueId`, or creates with client-forged `createdAt`.
10. **Value Poisoning on Whitelisted Key**: Admin updates `incidentNarrative.body` on `/sharedWorkspaces/default` with a 15,000-character string (exceeding `<= 8000`) or invalid `scenarioMeta`.
11. **Orphaned Shared Audio Chunk Write (Atomicity Bypass)**: Admin creates `/sharedWorkspaces/default/audios/dlg-nonexistent/chunks/chunk_0` without an existing or atomically created parent `audios/dlg-nonexistent` document.
12. **Unscoped List Query**: Client queries `collection(db, "sharedWorkspaces/default/audios")` without matching `workspaceId == 'default'` or queries another user's private audios without `ownerId == request.auth.uid`.
