import { User } from 'firebase/auth';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { buildStarterPublicPlaylists, COVER_ASSETS } from '../data/catalog';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  CollabInvite,
  CollaborativePlaylist,
  DirectoryEntry,
  EqPresetId,
  PlaybackState,
  PlaylistTrack,
  PublicPlaylist,
  sanitizeHandle,
  sanitizeString,
  SCHEMA_LIMITS,
  UserProfile,
} from '../types/sonora';

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

function normalizePlaybackState(raw: unknown): PlaybackState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    trackId: typeof r.trackId === 'string' ? r.trackId : '',
    trackIndex: typeof r.trackIndex === 'number' ? r.trackIndex : 0,
    isPlaying: Boolean(r.isPlaying),
    anchorPositionSec: typeof r.anchorPositionSec === 'number' ? r.anchorPositionSec : 0,
    anchorTimestampMs: toMillis(r.anchorTimestamp ?? r.updatedAt),
    playbackRate: typeof r.playbackRate === 'number' ? r.playbackRate : 1.0,
    eqPreset: typeof r.eqPreset === 'string' ? (r.eqPreset as EqPresetId) : undefined,
    updatedBy: typeof r.updatedBy === 'string' ? r.updatedBy : undefined,
    sessionId: typeof r.sessionId === 'string' ? r.sessionId : 'unknown',
    sequence: typeof r.sequence === 'number' ? r.sequence : 0,
    playlistId: typeof r.playlistId === 'string' ? r.playlistId : undefined,
    playlistType:
      r.playlistType === 'collaborative' || r.playlistType === 'public' || r.playlistType === 'studio'
        ? r.playlistType
        : undefined,
  };
}

function normalizeTrack(id: string, raw: Record<string, unknown>, idx = 0): PlaylistTrack {
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : id,
    title: typeof raw.title === 'string' ? raw.title : 'Untitled Track',
    artist: typeof raw.artist === 'string' ? raw.artist : 'Sonora Studio',
    genre: typeof raw.genre === 'string' ? raw.genre : 'Ambient',
    durationSec: typeof raw.durationSec === 'number' && raw.durationSec >= 10 ? raw.durationSec : 180,
    bpm: typeof raw.bpm === 'number' && raw.bpm >= 40 ? raw.bpm : 96,
    synthPreset: typeof raw.synthPreset === 'string' ? raw.synthPreset : 'warm_pad',
    rootNote: typeof raw.rootNote === 'string' ? raw.rootNote : 'C3',
    coverUrl: typeof raw.coverUrl === 'string' ? raw.coverUrl : COVER_ASSETS[idx % COVER_ASSETS.length].url,
    addedBy: typeof raw.addedBy === 'string' ? raw.addedBy : 'system',
    order: typeof raw.order === 'number' ? raw.order : idx,
    createdAtMs: toMillis(raw.createdAt),
  };
}

function sanitizePlaybackPayload(ps: PlaybackState, uid: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    trackId: sanitizeString(ps.trackId, SCHEMA_LIMITS.MAX_ID, 'none'),
    trackIndex: Math.max(0, Math.min(500, Math.floor(ps.trackIndex || 0))),
    isPlaying: Boolean(ps.isPlaying),
    anchorPositionSec: Math.max(0, Math.min(86400, Number(ps.anchorPositionSec.toFixed(3)) || 0)),
    playbackRate: Math.max(0.5, Math.min(2.0, Number((ps.playbackRate || 1.0).toFixed(2)))),
    sessionId: sanitizeString(ps.sessionId, SCHEMA_LIMITS.MAX_ID, 'web'),
    sequence: Math.max(0, Math.floor(ps.sequence || 0)),
    updatedBy: sanitizeString(uid, SCHEMA_LIMITS.MAX_ID),
    anchorTimestamp: serverTimestamp(),
  };
  if (ps.eqPreset) payload.eqPreset = ps.eqPreset;
  if (ps.playlistId) payload.playlistId = sanitizeString(ps.playlistId, SCHEMA_LIMITS.MAX_ID);
  if (ps.playlistType) payload.playlistType = ps.playlistType;
  return payload;
}

export async function upsertUserAndDirectory(user: User): Promise<void> {
  const userPath = `users/${user.uid}`;
  const dirPath = `userDirectory/${user.uid}`;
  const displayName = sanitizeString(user.displayName || user.email?.split('@')[0] || 'Sonora Listener', SCHEMA_LIMITS.MAX_DISPLAY_NAME);
  const email = sanitizeString(user.email || `${user.uid}@sonora.local`, SCHEMA_LIMITS.MAX_EMAIL);
  const handle = sanitizeHandle(user.email?.split('@')[0] || displayName, user.uid);
  const photoURL = user.photoURL ? sanitizeString(user.photoURL, SCHEMA_LIMITS.MAX_URL) : '';

  try {
    const existingSnap = await getDoc(doc(db, 'users', user.uid));
    const batch = writeBatch(db);

    if (!existingSnap.exists()) {
      batch.set(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName,
        email,
        photoURL,
        handle,
        eqPreset: 'studio',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(doc(db, 'users', user.uid), {
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    }

    const dirSnap = await getDoc(doc(db, 'userDirectory', user.uid));
    if (!dirSnap.exists()) {
      batch.set(doc(db, 'userDirectory', user.uid), {
        uid: user.uid,
        displayName,
        handle,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(doc(db, 'userDirectory', user.uid), {
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${userPath} + ${dirPath}`);
  }
}

export async function updateUserHandle(uid: string, newHandle: string, displayName: string): Promise<void> {
  const cleanHandle = sanitizeHandle(newHandle, uid);
  const cleanName = sanitizeString(displayName, SCHEMA_LIMITS.MAX_DISPLAY_NAME, 'Sonora Listener');
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', uid), {
      handle: cleanHandle,
      displayName: cleanName,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'userDirectory', uid), {
      handle: cleanHandle,
      displayName: cleanName,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null, serverClockOffsetMs: number) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null, 0);
        return;
      }
      const d = snap.data();
      let offsetMs = 0;
      if (!snap.metadata.hasPendingWrites && d.updatedAt instanceof Timestamp) {
        offsetMs = d.updatedAt.toMillis() - Date.now();
      }
      onData(
        {
          uid: d.uid || uid,
          displayName: d.displayName || 'Sonora Listener',
          email: d.email || '',
          photoURL: d.photoURL || '',
          handle: d.handle || sanitizeHandle('', uid),
          eqPreset: d.eqPreset || 'studio',
          playbackState: d.playbackState ? normalizePlaybackState(d.playbackState) : undefined,
          createdAtMs: toMillis(d.createdAt),
          updatedAtMs: toMillis(d.updatedAt),
        },
        offsetMs
      );
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export function subscribeUserDirectory(onData: (entries: DirectoryEntry[]) => void): Unsubscribe {
  const path = 'userDirectory';
  return onSnapshot(
    collection(db, 'userDirectory'),
    (snap) => {
      const list: DirectoryEntry[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          uid: d.uid || docSnap.id,
          displayName: d.displayName || 'Sonora User',
          handle: d.handle || docSnap.id.slice(0, 8),
          photoURL: d.photoURL || '',
          updatedAtMs: toMillis(d.updatedAt),
        };
      });
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribePublicPlaylists(onData: (playlists: PublicPlaylist[]) => void): Unsubscribe {
  const path = 'publicPlaylists';
  return onSnapshot(
    collection(db, 'publicPlaylists'),
    (snap) => {
      const list: PublicPlaylist[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const embeddedTracks = Array.isArray(d.tracks)
          ? d.tracks.map((t: Record<string, unknown>, i: number) => normalizeTrack(`emb_${i}`, t, i))
          : undefined;
        return {
          id: d.id || docSnap.id,
          title: d.title || 'Untitled Session',
          description: d.description || '',
          genre: d.genre || 'Ambient',
          coverUrl: d.coverUrl || COVER_ASSETS[0].url,
          ownerId: d.ownerId || '',
          ownerName: d.ownerName || 'Sonora Studio',
          trackCount: typeof d.trackCount === 'number' ? d.trackCount : embeddedTracks?.length ?? 0,
          totalDurationSec: typeof d.totalDurationSec === 'number' ? d.totalDurationSec : 0,
          createdAtMs: toMillis(d.createdAt),
          updatedAtMs: toMillis(d.updatedAt),
          embeddedTracks,
        };
      });
      list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeCollaborativePlaylists(
  uid: string,
  onData: (playlists: CollaborativePlaylist[]) => void
): Unsubscribe {
  const path = 'collaborativePlaylists';
  const q = query(collection(db, 'collaborativePlaylists'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list: CollaborativePlaylist[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const embeddedTracks = Array.isArray(d.tracks)
          ? d.tracks.map((t: Record<string, unknown>, i: number) => normalizeTrack(`emb_${i}`, t, i))
          : undefined;
        return {
          id: d.id || docSnap.id,
          title: d.title || 'Collaborative Room',
          description: d.description || '',
          coverUrl: d.coverUrl || COVER_ASSETS[0].url,
          ownerId: d.ownerId || '',
          ownerName: d.ownerName || 'Host',
          memberIds: Array.isArray(d.memberIds) ? d.memberIds : [uid],
          trackCount: typeof d.trackCount === 'number' ? d.trackCount : embeddedTracks?.length ?? 0,
          playbackState: normalizePlaybackState(d.playbackState),
          createdAtMs: toMillis(d.createdAt),
          updatedAtMs: toMillis(d.updatedAt),
          embeddedTracks,
        };
      });
      list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeCollabInvites(
  uid: string,
  onData: (incoming: CollabInvite[], outgoing: CollabInvite[]) => void
): Unsubscribe {
  const path = 'collabInvites';
  const qIn = query(collection(db, 'collabInvites'), where('toUid', '==', uid));
  const qOut = query(collection(db, 'collabInvites'), where('fromUid', '==', uid));

  let incomingList: CollabInvite[] = [];
  let outgoingList: CollabInvite[] = [];

  const mapDoc = (docSnap: { id: string; data: () => Record<string, unknown> }): CollabInvite => {
    const d = docSnap.data();
    return {
      id: (d.id as string) || docSnap.id,
      playlistId: (d.playlistId as string) || '',
      playlistTitle: (d.playlistTitle as string) || 'Collaborative Session',
      fromUid: (d.fromUid as string) || '',
      fromName: (d.fromName as string) || 'Host',
      toUid: (d.toUid as string) || '',
      toName: (d.toName as string) || 'Collaborator',
      status: d.status === 'accepted' || d.status === 'declined' ? d.status : 'pending',
      createdAtMs: toMillis(d.createdAt),
      updatedAtMs: toMillis(d.updatedAt),
    };
  };

  const unsubIn = onSnapshot(
    qIn,
    (snap) => {
      incomingList = snap.docs.map(mapDoc).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(incomingList, outgoingList);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );

  const unsubOut = onSnapshot(
    qOut,
    (snap) => {
      outgoingList = snap.docs.map(mapDoc).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(incomingList, outgoingList);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );

  return () => {
    unsubIn();
    unsubOut();
  };
}

export function subscribePlaylistTracks(
  collectionName: 'collaborativePlaylists' | 'publicPlaylists',
  playlistId: string,
  onData: (tracks: PlaylistTrack[]) => void
): Unsubscribe {
  const path = `${collectionName}/${playlistId}/tracks`;
  const q = query(collection(db, collectionName, playlistId, 'tracks'), orderBy('order', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const tracks = snap.docs.map((docSnap, idx) => normalizeTrack(docSnap.id, docSnap.data(), idx));
      onData(tracks);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function fetchPlaylistTracks(
  collectionName: 'collaborativePlaylists' | 'publicPlaylists',
  playlistId: string
): Promise<PlaylistTrack[]> {
  const path = `${collectionName}/${playlistId}/tracks`;
  try {
    const q = query(collection(db, collectionName, playlistId, 'tracks'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((docSnap, idx) => normalizeTrack(docSnap.id, docSnap.data(), idx));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function seedStarterPublicPlaylists(user: User): Promise<void> {
  const ownerName = sanitizeString(user.displayName || user.email?.split('@')[0] || 'Sonora Studio', SCHEMA_LIMITS.MAX_DISPLAY_NAME);
  const seeds = buildStarterPublicPlaylists();
  try {
    const batch = writeBatch(db);
    for (const seed of seeds) {
      const playlistRef = doc(db, 'publicPlaylists', seed.playlist.id);
      batch.set(playlistRef, {
        id: seed.playlist.id,
        title: sanitizeString(seed.playlist.title, SCHEMA_LIMITS.MAX_TITLE),
        description: sanitizeString(seed.playlist.description || '', SCHEMA_LIMITS.MAX_DESCRIPTION),
        genre: sanitizeString(seed.playlist.genre, SCHEMA_LIMITS.MAX_GENRE),
        coverUrl: sanitizeString(seed.playlist.coverUrl || '', SCHEMA_LIMITS.MAX_URL),
        ownerId: user.uid,
        ownerName,
        trackCount: seed.tracks.length,
        totalDurationSec: seed.playlist.totalDurationSec,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      for (const trk of seed.tracks) {
        const trackRef = doc(db, 'publicPlaylists', seed.playlist.id, 'tracks', trk.id);
        batch.set(trackRef, {
          id: trk.id,
          title: sanitizeString(trk.title, SCHEMA_LIMITS.MAX_TITLE),
          artist: sanitizeString(trk.artist, SCHEMA_LIMITS.MAX_DISPLAY_NAME),
          genre: sanitizeString(trk.genre, SCHEMA_LIMITS.MAX_GENRE),
          durationSec: trk.durationSec,
          bpm: trk.bpm,
          synthPreset: sanitizeString(trk.synthPreset, SCHEMA_LIMITS.MAX_SYNTH_PRESET),
          rootNote: sanitizeString(trk.rootNote, SCHEMA_LIMITS.MAX_ROOT_NOTE),
          coverUrl: sanitizeString(trk.coverUrl || '', SCHEMA_LIMITS.MAX_URL),
          addedBy: user.uid,
          order: trk.order,
          createdAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'publicPlaylists');
  }
}

export async function createCollaborativePlaylist(params: {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  user: User;
  sessionId: string;
  initialTracks?: Omit<PlaylistTrack, 'addedBy' | 'order' | 'createdAtMs'>[];
}): Promise<void> {
  const { id, title, description, coverUrl, user, sessionId, initialTracks = [] } = params;
  const ownerName = sanitizeString(user.displayName || user.email?.split('@')[0] || 'Host', SCHEMA_LIMITS.MAX_DISPLAY_NAME);
  const firstTrack = initialTracks[0];
  const path = `collaborativePlaylists/${id}`;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'collaborativePlaylists', id), {
      id,
      title: sanitizeString(title, SCHEMA_LIMITS.MAX_TITLE, 'Untitled Session'),
      description: sanitizeString(description, SCHEMA_LIMITS.MAX_DESCRIPTION),
      coverUrl: sanitizeString(coverUrl, SCHEMA_LIMITS.MAX_URL, COVER_ASSETS[0].url),
      ownerId: user.uid,
      ownerName,
      memberIds: [user.uid],
      trackCount: initialTracks.length,
      playbackState: sanitizePlaybackPayload(
        {
          trackId: firstTrack?.id || 'none',
          trackIndex: 0,
          isPlaying: false,
          anchorPositionSec: 0,
          anchorTimestampMs: Date.now(),
          playbackRate: 1.0,
          sessionId,
          sequence: 1,
          playlistId: id,
          playlistType: 'collaborative',
        },
        user.uid
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    initialTracks.slice(0, 50).forEach((trk, idx) => {
      const trackId = sanitizeString(trk.id, SCHEMA_LIMITS.MAX_ID).replace(/[^a-zA-Z0-9_-]/g, '_');
      batch.set(doc(db, 'collaborativePlaylists', id, 'tracks', trackId), {
        id: trackId,
        title: sanitizeString(trk.title, SCHEMA_LIMITS.MAX_TITLE),
        artist: sanitizeString(trk.artist, SCHEMA_LIMITS.MAX_DISPLAY_NAME),
        genre: sanitizeString(trk.genre, SCHEMA_LIMITS.MAX_GENRE),
        durationSec: Math.max(10, Math.min(3600, trk.durationSec)),
        bpm: Math.max(40, Math.min(220, trk.bpm)),
        synthPreset: sanitizeString(trk.synthPreset, SCHEMA_LIMITS.MAX_SYNTH_PRESET),
        rootNote: sanitizeString(trk.rootNote, SCHEMA_LIMITS.MAX_ROOT_NOTE),
        coverUrl: sanitizeString(trk.coverUrl || coverUrl, SCHEMA_LIMITS.MAX_URL),
        addedBy: user.uid,
        order: idx,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createPublicPlaylist(params: {
  id: string;
  title: string;
  description: string;
  genre: string;
  coverUrl: string;
  user: User;
  initialTracks: Omit<PlaylistTrack, 'addedBy' | 'order' | 'createdAtMs'>[];
}): Promise<void> {
  const { id, title, description, genre, coverUrl, user, initialTracks } = params;
  const ownerName = sanitizeString(user.displayName || user.email?.split('@')[0] || 'Curator', SCHEMA_LIMITS.MAX_DISPLAY_NAME);
  const totalDurationSec = initialTracks.reduce((sum, t) => sum + t.durationSec, 0);
  const path = `publicPlaylists/${id}`;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'publicPlaylists', id), {
      id,
      title: sanitizeString(title, SCHEMA_LIMITS.MAX_TITLE, 'Public Session'),
      description: sanitizeString(description, SCHEMA_LIMITS.MAX_DESCRIPTION),
      genre: sanitizeString(genre, SCHEMA_LIMITS.MAX_GENRE, 'Ambient'),
      coverUrl: sanitizeString(coverUrl, SCHEMA_LIMITS.MAX_URL, COVER_ASSETS[0].url),
      ownerId: user.uid,
      ownerName,
      trackCount: initialTracks.length,
      totalDurationSec,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    initialTracks.slice(0, 50).forEach((trk, idx) => {
      const trackId = sanitizeString(trk.id, SCHEMA_LIMITS.MAX_ID).replace(/[^a-zA-Z0-9_-]/g, '_');
      batch.set(doc(db, 'publicPlaylists', id, 'tracks', trackId), {
        id: trackId,
        title: sanitizeString(trk.title, SCHEMA_LIMITS.MAX_TITLE),
        artist: sanitizeString(trk.artist, SCHEMA_LIMITS.MAX_DISPLAY_NAME),
        genre: sanitizeString(trk.genre, SCHEMA_LIMITS.MAX_GENRE),
        durationSec: Math.max(10, Math.min(3600, trk.durationSec)),
        bpm: Math.max(40, Math.min(220, trk.bpm)),
        synthPreset: sanitizeString(trk.synthPreset, SCHEMA_LIMITS.MAX_SYNTH_PRESET),
        rootNote: sanitizeString(trk.rootNote, SCHEMA_LIMITS.MAX_ROOT_NOTE),
        coverUrl: sanitizeString(trk.coverUrl || coverUrl, SCHEMA_LIMITS.MAX_URL),
        addedBy: user.uid,
        order: idx,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function addTrackToPlaylist(params: {
  collectionName: 'collaborativePlaylists' | 'publicPlaylists';
  playlistId: string;
  track: Omit<PlaylistTrack, 'addedBy' | 'createdAtMs'>;
  nextTrackCount: number;
  nextTotalDurationSec?: number;
  user: User;
}): Promise<void> {
  const { collectionName, playlistId, track, nextTrackCount, nextTotalDurationSec, user } = params;
  const trackId = sanitizeString(track.id, SCHEMA_LIMITS.MAX_ID).replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${collectionName}/${playlistId}/tracks/${trackId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, collectionName, playlistId, 'tracks', trackId), {
      id: trackId,
      title: sanitizeString(track.title, SCHEMA_LIMITS.MAX_TITLE),
      artist: sanitizeString(track.artist, SCHEMA_LIMITS.MAX_DISPLAY_NAME),
      genre: sanitizeString(track.genre, SCHEMA_LIMITS.MAX_GENRE),
      durationSec: Math.max(10, Math.min(3600, track.durationSec)),
      bpm: Math.max(40, Math.min(220, track.bpm)),
      synthPreset: sanitizeString(track.synthPreset, SCHEMA_LIMITS.MAX_SYNTH_PRESET),
      rootNote: sanitizeString(track.rootNote, SCHEMA_LIMITS.MAX_ROOT_NOTE),
      coverUrl: sanitizeString(track.coverUrl || COVER_ASSETS[0].url, SCHEMA_LIMITS.MAX_URL),
      addedBy: user.uid,
      order: track.order,
      createdAt: serverTimestamp(),
    });
    const parentUpdates: Record<string, unknown> = {
      trackCount: Math.max(0, Math.min(500, nextTrackCount)),
      updatedAt: serverTimestamp(),
    };
    if (collectionName === 'publicPlaylists' && typeof nextTotalDurationSec === 'number') {
      parentUpdates.totalDurationSec = Math.max(0, nextTotalDurationSec);
    }
    batch.update(doc(db, collectionName, playlistId), parentUpdates);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeTrackFromPlaylist(params: {
  collectionName: 'collaborativePlaylists' | 'publicPlaylists';
  playlistId: string;
  trackId: string;
  nextTrackCount: number;
  nextTotalDurationSec?: number;
}): Promise<void> {
  const { collectionName, playlistId, trackId, nextTrackCount, nextTotalDurationSec } = params;
  const path = `${collectionName}/${playlistId}/tracks/${trackId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, collectionName, playlistId, 'tracks', trackId));
    const parentUpdates: Record<string, unknown> = {
      trackCount: Math.max(0, nextTrackCount),
      updatedAt: serverTimestamp(),
    };
    if (collectionName === 'publicPlaylists' && typeof nextTotalDurationSec === 'number') {
      parentUpdates.totalDurationSec = Math.max(0, nextTotalDurationSec);
    }
    batch.update(doc(db, collectionName, playlistId), parentUpdates);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncPlaylistPlaybackState(
  playlistId: string,
  playbackState: PlaybackState,
  uid: string
): Promise<void> {
  const path = `collaborativePlaylists/${playlistId}`;
  try {
    await updateDoc(doc(db, 'collaborativePlaylists', playlistId), {
      playbackState: sanitizePlaybackPayload(playbackState, uid),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncUserPlaybackState(
  uid: string,
  playbackState: PlaybackState,
  eqPreset: EqPresetId
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      eqPreset,
      playbackState: sanitizePlaybackPayload(playbackState, uid),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function sendCollabInvite(
  playlist: CollaborativePlaylist,
  fromUser: User,
  toEntry: DirectoryEntry
): Promise<void> {
  const inviteId = `${playlist.id}_${toEntry.uid}`.slice(0, SCHEMA_LIMITS.MAX_ID);
  const path = `collabInvites/${inviteId}`;
  try {
    await setDoc(doc(db, 'collabInvites', inviteId), {
      id: inviteId,
      playlistId: playlist.id,
      playlistTitle: sanitizeString(playlist.title, SCHEMA_LIMITS.MAX_TITLE),
      fromUid: fromUser.uid,
      fromName: sanitizeString(fromUser.displayName || fromUser.email?.split('@')[0] || 'Host', SCHEMA_LIMITS.MAX_DISPLAY_NAME),
      toUid: toEntry.uid,
      toName: sanitizeString(toEntry.displayName, SCHEMA_LIMITS.MAX_DISPLAY_NAME),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function respondToCollabInvite(invite: CollabInvite, accept: boolean): Promise<void> {
  const path = `collabInvites/${invite.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'collabInvites', invite.id), {
      status: accept ? 'accepted' : 'declined',
      updatedAt: serverTimestamp(),
    });
    if (accept) {
      batch.update(doc(db, 'collaborativePlaylists', invite.playlistId), {
        memberIds: arrayUnion(invite.toUid),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function leaveCollaborativePlaylist(playlistId: string, uid: string): Promise<void> {
  const path = `collaborativePlaylists/${playlistId}`;
  try {
    await updateDoc(doc(db, 'collaborativePlaylists', playlistId), {
      memberIds: arrayRemove(uid),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCollaborativePlaylist(playlistId: string): Promise<void> {
  const path = `collaborativePlaylists/${playlistId}`;
  try {
    await deleteDoc(doc(db, 'collaborativePlaylists', playlistId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
