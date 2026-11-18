import React, { useMemo, useState } from 'react';
import { CopyPlus, Disc3, Play, Sparkles } from 'lucide-react';
import { HERO_STUDIO_IMAGE, STUDIO_TRACK_LIBRARY } from '../data/catalog';
import { formatDuration, PlaylistTrack, PublicPlaylist } from '../types/sonora';

interface DiscoverViewProps {
  publicPlaylists: PublicPlaylist[];
  selectedPlaylist: PublicPlaylist | null;
  selectedTracks: PlaylistTrack[];
  loadingTracks: boolean;
  activeTrackId?: string;
  isPlaying: boolean;
  searchQuery: string;
  onSelectPlaylist: (playlist: PublicPlaylist) => void;
  onPlayPlaylist: (playlist: PublicPlaylist, trackIndex?: number) => void;
  onForkToCollab: (playlist: PublicPlaylist) => void;
  onSeedStarterCatalog: () => Promise<void>;
  onPlayQuickTrack: (track: Omit<PlaylistTrack, 'addedBy' | 'order' | 'createdAtMs'>) => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  publicPlaylists,
  selectedPlaylist,
  selectedTracks,
  loadingTracks,
  activeTrackId,
  isPlaying,
  searchQuery,
  onSelectPlaylist,
  onPlayPlaylist,
  onForkToCollab,
  onSeedStarterCatalog,
  onPlayQuickTrack,
}) => {
  const [genreFilter, setGenreFilter] = useState<string>('All');
  const [seeding, setSeeding] = useState(false);

  const genres = useMemo(() => {
    const set = new Set<string>(['All']);
    publicPlaylists.forEach((p) => {
      if (p.genre) set.add(p.genre);
    });
    return Array.from(set);
  }, [publicPlaylists]);

  const filteredPlaylists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return publicPlaylists.filter((p) => {
      const matchesGenre = genreFilter === 'All' || p.genre === genreFilter;
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q) ||
        p.genre.toLowerCase().includes(q);
      return matchesGenre && matchesSearch;
    });
  }, [publicPlaylists, genreFilter, searchQuery]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onSeedStarterCatalog();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-10 pb-8">
      {/* Featured Acoustic Studio Banner */}
      <section className="relative rounded-xl overflow-hidden border border-white/10 bg-[#131720] min-h-[240px] flex items-end">
        <img
          src={HERO_STUDIO_IMAGE}
          alt="Sonora studio room"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0D12]/95 via-[#0B0D12]/75 to-[#0B0D12]/25" />
        <div className="relative z-10 p-6 lg:p-8 max-w-2xl space-y-3">
          <p className="text-xs font-medium text-[#E5A93C]">
            Curated Public Catalog · Web Audio Engine
          </p>
          <h2 className="font-display text-2xl lg:text-3xl font-bold text-[#F4F4F6] text-balance">
            High-resolution Web Audio sessions ready for shared listening.
          </h2>
          <p className="text-sm text-[#8E95A5] leading-relaxed">
            Stream any public playlist immediately or fork it into a synchronized collaborative room to invite teammates across Web and Android.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            {publicPlaylists.length > 0 ? (
              <button
                onClick={() => onPlayPlaylist(publicPlaylists[0], 0)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#E5A93C] text-[#0B0D12] text-sm font-semibold rounded-lg hover:bg-[#ebb758] transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4" />
                Play Featured Session
              </button>
            ) : (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#E5A93C] text-[#0B0D12] text-sm font-semibold rounded-lg hover:bg-[#ebb758] transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                {seeding ? 'Publishing Catalog...' : 'Publish Starter Catalog'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Public Playlists Grid */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#F4F4F6]">
              Public Playlists
            </h3>
            <p className="text-xs text-[#8E95A5] mt-0.5">
              Synced from the shared publicPlaylists collection
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#131720] border border-white/8 rounded-lg overflow-x-auto">
            {genres.map((g) => (
              <button
                key={g}
                onClick={() => setGenreFilter(g)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  genreFilter === g
                    ? 'bg-[#1D2330] text-[#F4F4F6]'
                    : 'text-[#8E95A5] hover:text-[#F4F4F6]'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {filteredPlaylists.length === 0 ? (
          <div className="bg-[#131720] border border-white/8 rounded-xl p-10 text-center space-y-3">
            <Disc3 className="w-8 h-8 text-[#8E95A5] mx-auto" />
            <p className="text-sm font-medium text-[#F4F4F6]">
              No public playlists match your filter yet
            </p>
            <p className="text-xs text-[#8E95A5] max-w-md mx-auto">
              Publish the curated starter catalog or create a new public playlist from the top bar.
            </p>
            {publicPlaylists.length === 0 && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#E5A93C] text-[#0B0D12] text-xs font-semibold rounded-lg hover:bg-[#ebb758] transition-colors"
              >
                {seeding ? 'Publishing...' : 'Publish Starter Catalog'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {filteredPlaylists.map((playlist) => {
              const isSelected = selectedPlaylist?.id === playlist.id;
              return (
                <div
                  key={playlist.id}
                  onClick={() => onSelectPlaylist(playlist)}
                  className={`group cursor-pointer bg-[#131720] border rounded-xl p-4 transition-colors ${
                    isSelected
                      ? 'border-[#E5A93C]/70'
                      : 'border-white/8 hover:border-white/20'
                  }`}
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-[#1B202C] mb-3.5">
                    <img
                      src={playlist.coverUrl}
                      alt={playlist.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayPlaylist(playlist, 0);
                      }}
                      aria-label={`Play ${playlist.title}`}
                      className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-[#E5A93C] text-[#0B0D12] flex items-center justify-center shadow-lg opacity-95 hover:bg-[#ebb758] transition-transform hover:scale-105"
                    >
                      <Play className="w-4 h-4 ml-0.5" />
                    </button>
                  </div>

                  <h4 className="text-sm font-semibold text-[#F4F4F6] truncate">
                    {playlist.title}
                  </h4>
                  <p className="text-xs text-[#8E95A5] mt-1 truncate">
                    {playlist.genre} · {playlist.trackCount} tracks · {playlist.ownerName}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Selected Public Playlist Detail & Queue */}
      {selectedPlaylist && (
        <section className="bg-[#131720] border border-white/10 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/8">
            <div className="flex items-center gap-4 min-w-0">
              <img
                src={selectedPlaylist.coverUrl}
                alt={selectedPlaylist.title}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-lg object-cover border border-white/10 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs text-[#E5A93C] font-medium">
                  {selectedPlaylist.genre} · Curated by {selectedPlaylist.ownerName}
                </p>
                <h3 className="font-display text-xl font-bold text-[#F4F4F6] truncate">
                  {selectedPlaylist.title}
                </h3>
                {selectedPlaylist.description && (
                  <p className="text-xs text-[#8E95A5] mt-1 line-clamp-1">
                    {selectedPlaylist.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => onForkToCollab(selectedPlaylist)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#1B202C] border border-white/10 text-[#F4F4F6] text-xs font-semibold rounded-lg hover:bg-[#232A3A] transition-colors whitespace-nowrap shrink-0"
              >
                <CopyPlus className="w-4 h-4 text-[#E5A93C]" />
                Fork to Collaborative
              </button>
              <button
                onClick={() => onPlayPlaylist(selectedPlaylist, 0)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#E5A93C] text-[#0B0D12] text-xs font-semibold rounded-lg hover:bg-[#ebb758] transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4" />
                Play Session
              </button>
            </div>
          </div>

          {loadingTracks ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-11 rounded-lg bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : selectedTracks.length === 0 ? (
            <p className="text-sm text-[#8E95A5] py-4">
              This playlist currently has no tracks queued.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {selectedTracks.map((trk, idx) => {
                const isCurrent = trk.id === activeTrackId;
                return (
                  <button
                    key={trk.id}
                    onClick={() => onPlayPlaylist(selectedPlaylist, idx)}
                    className={`w-full flex items-center justify-between gap-4 px-3 py-2.5 text-left rounded-lg transition-colors ${
                      isCurrent ? 'bg-[#E5A93C]/10' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
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
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <span className="hidden sm:inline font-mono-tabular text-xs text-[#8E95A5]">
                        {trk.bpm} BPM
                      </span>
                      <span className="font-mono-tabular text-xs text-[#8E95A5] w-12 text-right">
                        {formatDuration(trk.durationSec)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Quick Audition Studio Library */}
      <section className="space-y-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-[#F4F4F6]">
            Studio Synth Library
          </h3>
          <p className="text-xs text-[#8E95A5] mt-0.5">
            Instant Web Audio compositions ready for solo playback or room queueing
          </p>
        </div>

        <div className="bg-[#131720] border border-white/8 rounded-xl divide-y divide-white/[0.06]">
          {STUDIO_TRACK_LIBRARY.map((trk, idx) => {
            const isCurrent = trk.id === activeTrackId;
            return (
              <div
                key={trk.id}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="font-mono-tabular text-xs text-[#8E95A5] w-5 text-right shrink-0">
                    {idx + 1}
                  </span>
                  <img
                    src={trk.coverUrl}
                    alt={trk.title}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-md object-cover border border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${isCurrent ? 'text-[#E5A93C]' : 'text-[#F4F4F6]'}`}>
                      {trk.title}
                    </p>
                    <p className="text-xs text-[#8E95A5] truncate">
                      {trk.artist} · {trk.genre}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="hidden md:inline font-mono-tabular text-xs text-[#8E95A5]">
                    {trk.bpm} BPM
                  </span>
                  <span className="font-mono-tabular text-xs text-[#8E95A5] w-11 text-right">
                    {formatDuration(trk.durationSec)}
                  </span>
                  <button
                    onClick={() => onPlayQuickTrack(trk)}
                    className="px-3 py-1.5 bg-[#1B202C] hover:bg-[#E5A93C] hover:text-[#0B0D12] text-[#F4F4F6] text-xs font-medium rounded-md transition-colors whitespace-nowrap"
                  >
                    {isCurrent && isPlaying ? 'Playing' : 'Play'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
