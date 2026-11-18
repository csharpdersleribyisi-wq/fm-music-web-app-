import React, { useEffect, useState } from 'react';
import { Laptop, Play, Save } from 'lucide-react';
import {
  CollaborativePlaylist,
  formatDuration,
  PublicPlaylist,
  UserProfile,
} from '../types/sonora';

interface LibraryViewProps {
  profile: UserProfile | null;
  collabPlaylists: CollaborativePlaylist[];
  publicPlaylists: PublicPlaylist[];
  currentUid: string;
  onUpdateProfile: (displayName: string, handle: string) => Promise<void>;
  onResumeHandoff: () => void;
  onOpenCollabRoom: (playlist: CollaborativePlaylist) => void;
  onOpenPublicPlaylist: (playlist: PublicPlaylist) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  profile,
  collabPlaylists,
  publicPlaylists,
  currentUid,
  onUpdateProfile,
  onResumeHandoff,
  onOpenCollabRoom,
  onOpenPublicPlaylist,
}) => {
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [handle, setHandle] = useState(profile?.handle || '');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setHandle(profile.handle);
    }
  }, [profile]);

  const myPublic = publicPlaylists.filter((p) => p.ownerId === currentUid);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !handle.trim() || saving) return;
    setSaving(true);
    setSavedNotice(null);
    try {
      await onUpdateProfile(displayName.trim(), handle.trim());
      setSavedNotice('Profile synced to users & userDirectory');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-8 pb-8">
      {/* Cross-Device Playback Handoff Card */}
      {profile?.playbackState && profile.playbackState.trackId && profile.playbackState.trackId !== 'none' && (
        <section className="bg-[#131720] border border-white/10 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-[#1B202C] border border-white/10 flex items-center justify-center shrink-0">
              <Laptop className="w-5 h-5 text-[#E5A93C]" />
            </div>
            <div>
              <p className="text-xs font-medium text-[#E5A93C]">
                Cross-Device Session Handoff
              </p>
              <p className="text-sm font-semibold text-[#F4F4F6] mt-0.5">
                Last active at {formatDuration(profile.playbackState.anchorPositionSec)} · {profile.playbackState.playlistType || 'studio'} session
              </p>
              <p className="text-xs text-[#8E95A5] mt-0.5">
                Synced via users/{profile.uid.slice(0, 8)}… playbackState
              </p>
            </div>
          </div>

          <button
            onClick={onResumeHandoff}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#E5A93C] text-[#0B0D12] text-xs font-semibold rounded-lg hover:bg-[#ebb758] transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            Resume Here
          </button>
        </section>
      )}

      {/* Profile & Directory Identity */}
      <form
        onSubmit={handleSave}
        className="bg-[#131720] border border-white/8 rounded-xl p-6 space-y-5"
      >
        <div>
          <h2 className="font-display text-lg font-semibold text-[#F4F4F6]">
            Sonora Profile & Collaborator Handle
          </h2>
          <p className="text-xs text-[#8E95A5] mt-0.5">
            Your email stays isolated in private users/{'{uid}'}; only display name and handle appear in userDirectory
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8E95A5] mb-1.5">Display Name</label>
            <input
              type="text"
              required
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#0B0D12] border border-white/10 rounded-lg text-sm text-[#F4F4F6] focus:outline-none focus:border-[#E5A93C]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8E95A5] mb-1.5">Public Handle</label>
            <input
              type="text"
              required
              maxLength={40}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#0B0D12] border border-white/10 rounded-lg text-sm font-mono-tabular text-[#F4F4F6] focus:outline-none focus:border-[#E5A93C]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/8">
          <span className="text-xs text-[#8E95A5]">
            Account: {profile?.email || 'Verified Google Account'}
          </span>
          <div className="flex items-center gap-3">
            {savedNotice && <span className="text-xs text-[#4ADE80]">{savedNotice}</span>}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B202C] border border-white/10 text-xs font-semibold text-[#F4F4F6] rounded-lg hover:bg-[#232A3A] transition-colors whitespace-nowrap shrink-0"
            >
              <Save className="w-3.5 h-3.5 text-[#E5A93C]" />
              {saving ? 'Saving...' : 'Save Identity'}
            </button>
          </div>
        </div>
      </form>

      {/* Playlists Owned or Joined */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-[#131720] border border-white/8 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-base font-semibold text-[#F4F4F6]">
            Collaborative Rooms ({collabPlaylists.length})
          </h3>
          {collabPlaylists.length === 0 ? (
            <p className="text-xs text-[#8E95A5]">No collaborative rooms joined yet.</p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {collabPlaylists.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onOpenCollabRoom(p)}
                  className="w-full py-2.5 flex items-center justify-between text-left hover:bg-white/[0.02] px-2 rounded-lg transition-colors"
                >
                  <span className="text-sm font-medium text-[#F4F4F6] truncate">{p.title}</span>
                  <span className="text-xs text-[#8E95A5] shrink-0">{p.trackCount} tracks</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="bg-[#131720] border border-white/8 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-base font-semibold text-[#F4F4F6]">
            Your Public Playlists ({myPublic.length})
          </h3>
          {myPublic.length === 0 ? (
            <p className="text-xs text-[#8E95A5]">You have not published any public playlists yet.</p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {myPublic.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onOpenPublicPlaylist(p)}
                  className="w-full py-2.5 flex items-center justify-between text-left hover:bg-white/[0.02] px-2 rounded-lg transition-colors"
                >
                  <span className="text-sm font-medium text-[#F4F4F6] truncate">{p.title}</span>
                  <span className="text-xs text-[#8E95A5] shrink-0">{p.genre}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
