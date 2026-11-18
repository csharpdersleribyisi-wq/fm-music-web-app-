import React, { useMemo, useRef, useState } from 'react';
import {
  LogOut,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { STUDIO_TRACK_LIBRARY } from '../data/catalog';
import {
  CollaborativePlaylist,
  DirectoryEntry,
  formatDuration,
  PlaylistTrack,
} from '../types/sonora';

interface CollaborativeViewProps {
  currentUid: string;
  playlists: CollaborativePlaylist[];
  selectedPlaylist: CollaborativePlaylist | null;
  tracks: PlaylistTrack[];
  loadingTracks: boolean;
  directory: DirectoryEntry[];
  activeSyncedPlaylistId: string | null;
  isPlaying: boolean;
  activeTrackId?: string;
  lastDriftMs: number | null;
  searchQuery: string;
  onSelectPlaylist: (playlist: CollaborativePlaylist) => void;
  onOpenCreateModal: () => void;
  onJoinSyncRoom: (playlist: CollaborativePlaylist, startIndex?: number) => void;
  onToggleRoomPlay: (playlist: CollaborativePlaylist) => void;
  onAddTrack: (
    playlist: CollaborativePlaylist,
    track: Omit<PlaylistTrack, 'addedBy' | 'order' | 'createdAtMs'>
  ) => Promise<void>;
  onUploadLocalTrack: (playlist: CollaborativePlaylist, file: File) => Promise<void>;
  onRemoveTrack: (playlist: CollaborativePlaylist, trackId: string) => Promise<void>;
  onSendInvite: (playlist: CollaborativePlaylist, recipient: DirectoryEntry) => Promise<void>;
  onLeaveRoom: (playlist: CollaborativePlaylist) => Promise<void>;
  onDeleteRoom: (playlist: CollaborativePlaylist) => Promise<void>;
}

export const CollaborativeView: React.FC<CollaborativeViewProps> = ({
  currentUid,
  playlists,
  selectedPlaylist,
  tracks,
  loadingTracks,
  directory,
  activeSyncedPlaylistId,
  isPlaying,
  activeTrackId,
  lastDriftMs,
  searchQuery,
  onSelectPlaylist,
  onOpenCreateModal,
  onJoinSyncRoom,
  onToggleRoomPlay,
  onAddTrack,
  onUploadLocalTrack,
  onRemoveTrack,
  onSendInvite,
  onLeaveRoom,
  onDeleteRoom,
}) => {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addTrackOpen, setAddTrackOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteStatusMsg, setInviteStatusMsg] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredPlaylists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q)
    );
  }, [playlists, searchQuery]);

  const directoryMap = useMemo(() => {
    const map = new Map<string, DirectoryEntry>();
    directory.forEach((entry) => map.set(entry.uid, entry));
    return map;
  }, [directory]);

  const invitableUsers = useMemo(() => {
    if (!selectedPlaylist) return [];
    const q = inviteSearch.trim().toLowerCase();
    return directory.filter((entry) => {
      if (selectedPlaylist.memberIds.includes(entry.uid)) return false;
      if (!q) return true;
      return (
        entry.displayName.toLowerCase().includes(q) ||
        entry.handle.toLowerCase().includes(q)
      );
    });
  }, [directory, selectedPlaylist, inviteSearch]);

  const isOwner = selectedPlaylist?.ownerId === currentUid;
  const isSyncedHere = selectedPlaylist?.id === activeSyncedPlaylistId;

  const handleInviteUser = async (entry: DirectoryEntry) => {
    if (!selectedPlaylist || busyAction) return;
    setBusyAction(true);
    setInviteStatusMsg(null);
    try {
      await onSendInvite(selectedPlaylist, entry);
      setInviteStatusMsg(`Invitation sent to ${entry.displayName}`);
    } finally {
      setBusyAction(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPlaylist) return;
    setBusyAction(true);
    try {
      await onUploadLocalTrack(selectedPlaylist, file);
    } finally {
      setBusyAction(false);
      e.target.value = '';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-8">
      {/* Left Column: Room Selector */}
      <div className="lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-[#F4F4F6]">
            Your Shared Rooms
          </h2>
          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E5A93C] hover:text-[#ebb758] whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Room
          </button>
        </div>

        {filteredPlaylists.length === 0 ? (
          <div className="bg-[#131720] border border-white/8 rounded-xl p-6 text-center space-y-3">
            <Users className="w-7 h-7 text-[#8E95A5] mx-auto" />
            <p className="text-sm font-medium text-[#F4F4F6]">
              No collaborative rooms yet
            </p>
            <p className="text-xs text-[#8E95A5]">
              Create a room or accept an invitation to listen in lockstep with other Sonora sessions.
            </p>
            <button
              onClick={onOpenCreateModal}
              className="px-4 py-2 bg-[#E5A93C] text-[#0B0D12] text-xs font-semibold rounded-lg hover:bg-[#ebb758] transition-colors"
            >
              Launch First Room
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredPlaylists.map((room) => {
              const isSelected = selectedPlaylist?.id === room.id;
              const roomSynced = activeSyncedPlaylistId === room.id;
              return (
                <button
                  key={room.id}
                  onClick={() => onSelectPlaylist(room)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-center gap-3.5 ${
                    isSelected
                      ? 'bg-[#171C28] border-[#E5A93C]/70'
                      : 'bg-[#131720] border-white/8 hover:border-white/20'
                  }`}
                >
                  <img
                    src={room.coverUrl}
                    alt={room.title}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#F4F4F6] truncate">
                        {room.title}
                      </p>
                      {roomSynced && (
                        <Radio className="w-3.5 h-3.5 text-[#E5A93C] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-[#8E95A5] mt-0.5 truncate">
                      {room.memberIds.length} members · {room.trackCount} tracks
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Active Room Console */}
      <div className="lg:col-span-8">
        {!selectedPlaylist ? (
          <div className="bg-[#131720] border border-white/8 rounded-xl p-12 text-center space-y-3">
            <Radio className="w-8 h-8 text-[#8E95A5] mx-auto" />
            <p className="text-sm font-medium text-[#F4F4F6]">
              Select a collaborative room to sync playback
            </p>
            <p className="text-xs text-[#8E95A5] max-w-md mx-auto">
              Every play, pause, seek, and track change broadcasts via Firestore server-timestamped anchors to all connected sessions.
            </p>
          </div>
        ) : (
          <div className="bg-[#131720] border border-white/8 rounded-xl p-6 space-y-6">
            {/* Room Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-white/8">
              <div className="flex items-center gap-4 min-w-0">
                <img
                  src={selectedPlaylist.coverUrl}
                  alt={selectedPlaylist.title}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-xl object-cover border border-white/10 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#E5A93C]">
                    Collaborative Session · Host: {selectedPlaylist.ownerName}
                  </p>
                  <h2 className="font-display text-2xl font-bold text-[#F4F4F6] truncate mt-0.5">
                    {selectedPlaylist.title}
                  </h2>
                  {selectedPlaylist.description && (
                    <p className="text-xs text-[#8E95A5] mt-1 max-w-xl">
                      {selectedPlaylist.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {isSyncedHere ? (
                  <button
                    onClick={() => onToggleRoomPlay(selectedPlaylist)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#E5A93C] text-[#0B0D12] text-xs font-semibold rounded-lg hover:bg-[#ebb758] transition-colors whitespace-nowrap shrink-0"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlaying ? 'Pause Synced Room' : 'Resume Synced Room'}
                  </button>
                ) : (
                  <button
                    onClick={() => onJoinSyncRoom(selectedPlaylist)}
                    disabled={tracks.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#E5A93C] text-[#0B0D12] text-xs font-semibold rounded-lg hover:bg-[#ebb758] transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Radio className="w-4 h-4" />
                    Join Live Sync
                  </button>
                )}

                {isOwner && (
                  <button
                    onClick={() => setInviteOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1B202C] border border-white/10 text-[#F4F4F6] text-xs font-medium rounded-lg hover:bg-[#232A3A] transition-colors whitespace-nowrap shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[#E5A93C]" />
                    Invite
                  </button>
                )}

                {isOwner ? (
                  <button
                    onClick={() => onDeleteRoom(selectedPlaylist)}
                    title="Delete room"
                    aria-label="Delete room"
                    className="p-2 text-[#8E95A5] hover:text-[#F87171] border border-white/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => onLeaveRoom(selectedPlaylist)}
                    title="Leave room"
                    aria-label="Leave room"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-[#8E95A5] hover:text-[#F87171] border border-white/10 rounded-lg transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Leave
                  </button>
                )}
              </div>
            </div>

            {/* Live Synchronization Telemetry Banner (real sync state only) */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-[#0B0D12] border border-white/8 rounded-lg">
              <div className="flex items-center gap-2.5 text-xs">
                <Radio className={`w-4 h-4 ${isSyncedHere ? 'text-[#E5A93C]' : 'text-[#8E95A5]'}`} />
                <span className="font-medium text-[#F4F4F6]">
                  {isSyncedHere
                    ? `Live Sync Active · Sequence #${selectedPlaylist.playbackState.sequence}`
                    : 'Room Transport Ready'}
                </span>
                {isSyncedHere && lastDriftMs !== null && (
                  <span className="font-mono-tabular text-[#8E95A5]">
                    · Drift {lastDriftMs}ms
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-[#8E95A5]">
                <span>Members:</span>
                <span className="text-[#F4F4F6] truncate max-w-[260px]">
                  {selectedPlaylist.memberIds
                    .map((uid) => directoryMap.get(uid)?.displayName || uid.slice(0, 6))
                    .join(' · ')}
                </span>
              </div>
            </div>

            {/* Invite Collaborator Panel */}
            {inviteOpen && isOwner && (
              <div className="p-4 bg-[#0B0D12] border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#F4F4F6]">
                    Invite from Sonora Directory
                  </h4>
                  <button
                    onClick={() => setInviteOpen(false)}
                    aria-label="Close invite panel"
                    className="text-[#8E95A5] hover:text-[#F4F4F6]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  value={inviteSearch}
                  onChange={(e) => setInviteSearch(e.target.value)}
                  placeholder="Search by display name or handle..."
                  className="w-full px-3 py-2 bg-[#131720] border border-white/10 rounded-lg text-xs text-[#F4F4F6] placeholder-[#8E95A5] focus:outline-none focus:border-[#E5A93C]"
                />

                {inviteStatusMsg && (
                  <p className="text-xs text-[#4ADE80]">{inviteStatusMsg}</p>
                )}

                {invitableUsers.length === 0 ? (
                  <p className="text-xs text-[#8E95A5] py-2">
                    No other Sonora users found in directory yet. When collaborators sign in on Web or Android, they appear here.
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto divide-y divide-white/[0.06]">
                    {invitableUsers.map((entry) => (
                      <div
                        key={entry.uid}
                        className="flex items-center justify-between py-2 gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#F4F4F6] truncate">
                            {entry.displayName}
                          </p>
                          <p className="text-[11px] text-[#8E95A5] truncate">
                            @{entry.handle}
                          </p>
                        </div>
                        <button
                          onClick={() => handleInviteUser(entry)}
                          disabled={busyAction}
                          className="px-3 py-1.5 bg-[#E5A93C] text-[#0B0D12] text-xs font-semibold rounded-md hover:bg-[#ebb758] transition-colors shrink-0"
                        >
                          Send Invite
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Queue Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-base font-semibold text-[#F4F4F6]">
                Synchronized Queue ({tracks.length})
              </h3>
              <div className="flex items-center gap-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busyAction}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1B202C] border border-white/10 text-xs font-medium text-[#F4F4F6] rounded-lg hover:bg-[#232A3A] transition-colors whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5 text-[#E5A93C]" />
                  Load Local Audio
                </button>
                <button
                  onClick={() => setAddTrackOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1B202C] border border-white/10 text-xs font-medium text-[#F4F4F6] rounded-lg hover:bg-[#232A3A] transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5 text-[#E5A93C]" />
                  Add Studio Track
                </button>
              </div>
            </div>

            {/* Add Track Picker */}
            {addTrackOpen && (
              <div className="p-4 bg-[#0B0D12] border border-white/10 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#F4F4F6]">
                    Append Track from Studio Catalog
                  </p>
                  <button
                    onClick={() => setAddTrackOpen(false)}
                    className="text-[#8E95A5] hover:text-[#F4F4F6]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-white/[0.06]">
                  {STUDIO_TRACK_LIBRARY.map((trk) => (
                    <div
                      key={trk.id}
                      className="flex items-center justify-between py-2 gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#F4F4F6] truncate">
                          {trk.title}
                        </p>
                        <p className="text-[11px] text-[#8E95A5] truncate">
                          {trk.artist} · {trk.bpm} BPM · {trk.rootNote}
                        </p>
                      </div>
                      <button
                        onClick={() => onAddTrack(selectedPlaylist, trk)}
                        className="px-3 py-1 bg-[#1D2330] hover:bg-[#E5A93C] hover:text-[#0B0D12] text-xs font-medium text-[#F4F4F6] rounded-md transition-colors shrink-0"
                      >
                        Queue
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Track List */}
            {loadingTracks ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" />
                ))}
              </div>
            ) : tracks.length === 0 ? (
              <div className="py-10 text-center space-y-2 border border-dashed border-white/10 rounded-xl">
                <Music2 className="w-6 h-6 text-[#8E95A5] mx-auto" />
                <p className="text-sm text-[#F4F4F6]">Queue is empty</p>
                <p className="text-xs text-[#8E95A5]">
                  Add a studio synth track or compose a new stem in the Studio Rack.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {tracks.map((trk, idx) => {
                  const isCurrent = trk.id === activeTrackId && isSyncedHere;
                  return (
                    <div
                      key={trk.id}
                      className={`flex items-center justify-between gap-4 px-3 py-2.5 rounded-lg transition-colors ${
                        isCurrent ? 'bg-[#E5A93C]/10' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <button
                        onClick={() => onJoinSyncRoom(selectedPlaylist, idx)}
                        className="flex items-center gap-3.5 min-w-0 flex-1 text-left"
                      >
                        <span className="font-mono-tabular text-xs text-[#8E95A5] w-5 text-right shrink-0">
                          {isCurrent && isPlaying ? '▶' : idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isCurrent ? 'text-[#E5A93C]' : 'text-[#F4F4F6]'}`}>
                            {trk.title}
                          </p>
                          <p className="text-xs text-[#8E95A5] truncate">
                            {trk.artist} · {trk.rootNote} · {trk.synthPreset.replace('_', ' ')}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-4 shrink-0">
                        <span className="hidden sm:inline font-mono-tabular text-xs text-[#8E95A5]">
                          {trk.bpm} BPM
                        </span>
                        <span className="font-mono-tabular text-xs text-[#8E95A5] w-11 text-right">
                          {formatDuration(trk.durationSec)}
                        </span>
                        <button
                          onClick={() => onRemoveTrack(selectedPlaylist, trk.id)}
                          aria-label={`Remove ${trk.title}`}
                          className="p-1.5 text-[#8E95A5] hover:text-[#F87171] rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
