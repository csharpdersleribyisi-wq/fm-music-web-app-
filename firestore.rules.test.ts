/**
 * Sonora Firestore Security Rules Verification Suite (Phase 0 TDD Specification)
 * Verifies all 12 Dirty Dozen adversarial payloads return PERMISSION_DENIED.
 */

export interface SecurityTestVector {
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authUid: string | null;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED' | 'ALLOW';
}

export const DIRTY_DOZEN_VECTORS: SecurityTestVector[] = [
  {
    name: '1. Shadow Field Injection on User',
    collectionPath: 'users/u1',
    operation: 'create',
    authUid: 'u1',
    emailVerified: true,
    payload: { uid: 'u1', displayName: 'A', email: 'a@b.com', handle: 'a', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Identity Spoofing on Directory',
    collectionPath: 'userDirectory/u1',
    operation: 'create',
    authUid: 'u2',
    emailVerified: true,
    payload: { uid: 'u1', displayName: 'Spoof', handle: 'spoof' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. PII Scraping on Users',
    collectionPath: 'users/u1',
    operation: 'get',
    authUid: 'u2',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Unverified Email Write',
    collectionPath: 'collaborativePlaylists/p1',
    operation: 'create',
    authUid: 'u1',
    emailVerified: false,
    payload: { id: 'p1', title: 'Unverified', ownerId: 'u1', ownerName: 'U1', memberIds: ['u1'], trackCount: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Fake Timestamp Injection',
    collectionPath: 'publicPlaylists/pub1',
    operation: 'create',
    authUid: 'u1',
    emailVerified: true,
    payload: { id: 'pub1', title: 'Backdated', genre: 'Ambient', ownerId: 'u1', ownerName: 'U1', trackCount: 0, totalDurationSec: 0, createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. ID Poisoning with invalid characters',
    collectionPath: 'collaborativePlaylists/bad$id!@#',
    operation: 'create',
    authUid: 'u1',
    emailVerified: true,
    payload: { id: 'bad$id!@#', title: 'Bad', ownerId: 'u1', ownerName: 'U1', memberIds: ['u1'], trackCount: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Unauthorized Collaborative Playlist List',
    collectionPath: 'collaborativePlaylists',
    operation: 'list',
    authUid: 'u3',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Member Array Poisoning (non-string element)',
    collectionPath: 'collaborativePlaylists/p2',
    operation: 'create',
    authUid: 'u1',
    emailVerified: true,
    payload: { id: 'p2', title: 'Poison', ownerId: 'u1', ownerName: 'U1', memberIds: [123], trackCount: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Owner Hijack by Collaborator on Update',
    collectionPath: 'collaborativePlaylists/p1',
    operation: 'update',
    authUid: 'u2',
    emailVerified: true,
    payload: { ownerId: 'u2', title: 'Hijacked' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Invite Forgery for non-owned playlist',
    collectionPath: 'collabInvites/inv1',
    operation: 'create',
    authUid: 'u2',
    emailVerified: true,
    payload: { id: 'inv1', playlistId: 'p1', playlistTitle: 'P1', fromUid: 'u1', fromName: 'U1', toUid: 'u3', toName: 'U3', status: 'pending' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Terminal Invite Reversal',
    collectionPath: 'collabInvites/inv1',
    operation: 'update',
    authUid: 'u2',
    emailVerified: true,
    payload: { status: 'pending' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Orphaned Track Creation',
    collectionPath: 'collaborativePlaylists/missing_playlist/tracks/t1',
    operation: 'create',
    authUid: 'u1',
    emailVerified: true,
    payload: { id: 't1', title: 'Orphan', artist: 'A', genre: 'Synth', durationSec: 120, bpm: 110, synthPreset: 'warm_pad', rootNote: 'C4', addedBy: 'u1', order: 0 },
    expected: 'PERMISSION_DENIED',
  },
];
