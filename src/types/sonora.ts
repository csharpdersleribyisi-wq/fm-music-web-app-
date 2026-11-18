export type EqPresetId = 'flat' | 'warm' | 'studio' | 'bass' | 'air';

export type SynthPresetId =
  | 'warm_pad'
  | 'analog_arp'
  | 'sub_pulse'
  | 'velvet_rhodes'
  | 'crystalline_bell'
  | 'binaural_drone'
  | 'dub_chord'
  | 'lo_fi_keys';

export type PlaylistKind = 'collaborative' | 'public' | 'studio';

export interface PlaybackState {
  trackId: string;
  trackIndex: number;
  isPlaying: boolean;
  anchorPositionSec: number;
  anchorTimestampMs: number;
  playbackRate: number;
  eqPreset?: EqPresetId;
  updatedBy?: string;
  sessionId: string;
  sequence: number;
  playlistId?: string;
  playlistType?: PlaylistKind;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  handle: string;
  eqPreset?: EqPresetId;
  playbackState?: PlaybackState;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface DirectoryEntry {
  uid: string;
  displayName: string;
  handle: string;
  photoURL?: string;
  updatedAtMs: number;
}

export interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  durationSec: number;
  bpm: number;
  synthPreset: SynthPresetId | string;
  rootNote: string;
  coverUrl?: string;
  addedBy: string;
  order: number;
  createdAtMs: number;
}

export interface CollaborativePlaylist {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  ownerId: string;
  ownerName: string;
  memberIds: string[];
  trackCount: number;
  playbackState: PlaybackState;
  createdAtMs: number;
  updatedAtMs: number;
  embeddedTracks?: PlaylistTrack[];
}

export interface PublicPlaylist {
  id: string;
  title: string;
  description?: string;
  genre: string;
  coverUrl?: string;
  ownerId: string;
  ownerName: string;
  trackCount: number;
  totalDurationSec: number;
  createdAtMs: number;
  updatedAtMs: number;
  embeddedTracks?: PlaylistTrack[];
}

export interface CollabInvite {
  id: string;
  playlistId: string;
  playlistTitle: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  toName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAtMs: number;
  updatedAtMs: number;
}

/**
 * Volumetric bounds synchronized directly with firebase-blueprint.json & firestore.rules
 */
export const SCHEMA_LIMITS = {
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  HANDLE_REGEX: /^[a-zA-Z0-9_.-]+$/,
  MAX_ID: 128,
  MAX_DISPLAY_NAME: 80,
  MAX_EMAIL: 160,
  MAX_HANDLE: 40,
  MAX_URL: 500,
  MAX_TITLE: 100,
  MAX_DESCRIPTION: 300,
  MAX_GENRE: 50,
  MAX_SYNTH_PRESET: 60,
  MAX_ROOT_NOTE: 10,
  MAX_MEMBERS: 50,
  MAX_TRACKS: 500,
} as const;

export function sanitizeString(value: string, maxLen: number, fallback = ''): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

export function sanitizeHandle(value: string, uid: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, SCHEMA_LIMITS.MAX_HANDLE);
  if (cleaned.length >= 2) return cleaned;
  return `sonora_${uid.slice(0, 6)}`;
}

export function generateSafeId(prefix = 'id'): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'id';
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${cleanPrefix}_${ts}_${rand}`.slice(0, SCHEMA_LIMITS.MAX_ID);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
