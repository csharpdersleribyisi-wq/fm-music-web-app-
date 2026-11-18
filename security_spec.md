# Sonora Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity & PII Isolation**: `users/{userId}` contains sensitive PII (`email`) and may only be read or written by the authenticated owner (`request.auth.uid == userId`) with verified email (`request.auth.token.email_verified == true`). Public discovery lives exclusively in `userDirectory/{userId}` without `email`.
2. **Collaborative Playlist Membership**: A `collaborativePlaylists/{playlistId}` document may only be read, listed, or updated by users whose UID is in `memberIds` (`memberIds.size() <= 50`). Only `ownerId` can delete the playlist or alter `title`, `description`, `coverUrl`, or remove members.
3. **Subcollection Master Gate**: Tracks inside `collaborativePlaylists/{playlistId}/tracks/{trackId}` inherit access synchronously from the parent playlist via `get()` checking `request.auth.uid in parent.memberIds`.
4. **Invite State & Atomicity**: `collabInvites/{inviteId}` can only be created by the playlist owner (`fromUid == request.auth.uid` and verified owner of `playlistId`). Only the recipient (`toUid == request.auth.uid`) can transition `status` from `'pending'` to `'accepted'` or `'declined'`. Terminal states (`'accepted'`, `'declined'`) are immutable. Accepting an invite requires `memberIds` on the target playlist to include the user via an atomic batch (`getAfter()`).
5. **Public Playlists Ownership**: `publicPlaylists/{playlistId}` and its `tracks` subcollection are readable by signed-in users, but mutations are strictly limited to `ownerId == request.auth.uid`.
6. **Temporal Integrity & Field Immutability**: `createdAt` must equal `request.time` on creation and remain immutable on update; `updatedAt` must equal `request.time` on both create and update. `ownerId`, `uid`, `fromUid`, `toUid`, and `id` are immutable after creation.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on User**: `{ uid: "u1", displayName: "A", email: "a@b.com", handle: "a", createdAt: serverTime, updatedAt: serverTime, isAdmin: true }` -> DENIED (`hasOnly` rejects `isAdmin`).
2. **Identity Spoofing on Directory**: User `u2` creates `/userDirectory/u1` with `uid: "u1"` -> DENIED (`userId == request.auth.uid` & `uid == request.auth.uid`).
3. **PII Scraping on Users**: User `u2` calls `get` or `list` on `/users/u1` -> DENIED (owner-only read, no `list`).
4. **Unverified Email Write**: User with `email_verified: false` attempts to create playlist -> DENIED (`email_verified == true` gate).
5. **Fake Timestamp Injection**: Playlist created with `createdAt: "2020-01-01T00:00:00Z"` -> DENIED (`createdAt == request.time`).
6. **ID Poisoning**: Document created at `/collaborativePlaylists/../../bad_id_longer_than_128_chars...` -> DENIED (`isValidId` regex + max length 128).
7. **Unauthorized Playlist Snooping**: User `u3` (not in `memberIds`) queries `/collaborativePlaylists` without `array-contains` on own UID -> DENIED (`allow list` checks `request.auth.uid in resource.data.memberIds`).
8. **Member Array Overflow / Poisoning**: Creating playlist with `memberIds` of 51 elements or non-string first element `[123]` -> DENIED (`memberIds.size() >= 1 && memberIds.size() <= 50 && memberIds[0] is string`).
9. **Owner Hijack on Update**: Collaborator `u2` updates `collaborativePlaylists/p1` changing `ownerId` or `title` -> DENIED (Tiered update: collaborators can only update `playbackState`, `trackCount`, `updatedAt`, or self-leave).
10. **Invite Forgery**: User `u2` creates a `collabInvite` for `p1` owned by `u1` with `fromUid: "u1"` -> DENIED (`fromUid == request.auth.uid` and `get(playlist).ownerId == request.auth.uid`).
11. **Terminal Invite Reversal**: Recipient `u2` attempts to change `collabInvite` from `status: "accepted"` back to `"pending"` -> DENIED (`existing().status == 'pending'`).
12. **Orphaned Track Creation**: User creates track in `/collaborativePlaylists/nonexistent/tracks/t1` -> DENIED (`exists` + `get` Master Gate on parent playlist).
