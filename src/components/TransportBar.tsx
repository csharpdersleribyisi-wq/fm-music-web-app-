import React from 'react';
import {
  Pause,
  Play,
  Radio,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { COVER_ASSETS } from '../data/catalog';
import { formatDuration, PlaylistTrack } from '../types/sonora';

interface TransportBarProps {
  currentTrack: PlaylistTrack | null;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  volume: number;
  needsUserGesture: boolean;
  isSyncedRoom: boolean;
  syncRoomTitle?: string;
  lastDriftMs: number | null;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (sec: number) => void;
  onVolumeChange: (vol: number) => void;
  onUnlockAudio: () => void;
  onOpenStudio: () => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  currentTrack,
  isPlaying,
  positionSec,
  durationSec,
  volume,
  needsUserGesture,
  isSyncedRoom,
  syncRoomTitle,
  lastDriftMs,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onUnlockAudio,
  onOpenStudio,
}) => {
  const effectiveDuration = durationSec > 0 ? durationSec : currentTrack?.durationSec ?? 0;

  return (
    <footer className="border-t border-white/10 bg-[#0E1118] px-4 lg:px-6 py-3 shrink-0">
      <div className="max-w-full flex items-center justify-between gap-4">
        {/* Track Identity */}
        <div className="flex items-center gap-3 min-w-0 w-1/4">
          <div className="w-11 h-11 rounded-lg overflow-hidden bg-[#171C28] border border-white/10 shrink-0">
            <img
              src={currentTrack?.coverUrl || COVER_ASSETS[0].url}
              alt={currentTrack?.title || 'Sonora Studio'}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#F4F4F6] truncate">
              {currentTrack ? currentTrack.title : 'Select a track to play'}
            </p>
            <p className="text-xs text-[#8E95A5] truncate">
              {currentTrack
                ? `${currentTrack.artist} · ${currentTrack.bpm} BPM`
                : 'Sonora Web Audio Engine'}
            </p>
          </div>
        </div>

        {/* Transport & Timeline */}
        <div className="flex-1 max-w-xl flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-4">
            <button
              onClick={onPrev}
              disabled={!currentTrack}
              aria-label="Previous track"
              className="p-1.5 text-[#8E95A5] hover:text-[#F4F4F6] disabled:opacity-40 transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {needsUserGesture ? (
              <button
                onClick={onUnlockAudio}
                className="px-4 py-1.5 bg-[#E5A93C] text-[#0B0D12] text-xs font-semibold rounded-lg hover:bg-[#ebb758] transition-colors whitespace-nowrap shrink-0"
              >
                Unlock Audio Sync
              </button>
            ) : (
              <button
                onClick={onTogglePlay}
                disabled={!currentTrack}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-9 h-9 rounded-full bg-[#F4F4F6] text-[#0B0D12] hover:bg-white flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
            )}

            <button
              onClick={onNext}
              disabled={!currentTrack}
              aria-label="Next track"
              className="p-1.5 text-[#8E95A5] hover:text-[#F4F4F6] disabled:opacity-40 transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full flex items-center gap-2.5">
            <span className="font-mono-tabular text-[11px] text-[#8E95A5] w-10 text-right">
              {formatDuration(positionSec)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(1, effectiveDuration)}
              step={0.5}
              value={Math.min(positionSec, effectiveDuration)}
              disabled={!currentTrack}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Playback position"
              className="sonora-slider flex-1"
            />
            <span className="font-mono-tabular text-[11px] text-[#8E95A5] w-10">
              {formatDuration(effectiveDuration)}
            </span>
          </div>
        </div>

        {/* Sync & Output Controls */}
        <div className="hidden md:flex items-center justify-end gap-4 w-1/4">
          {isSyncedRoom && (
            <div className="flex items-center gap-2 text-xs text-[#E5A93C] truncate max-w-[180px]">
              <Radio className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {syncRoomTitle || 'Synced'}
                {lastDriftMs !== null ? ` · ${lastDriftMs}ms` : ''}
              </span>
            </div>
          )}

          <button
            onClick={onOpenStudio}
            title="Open EQ & Studio Rack"
            aria-label="Open EQ and Studio Rack"
            className="p-2 text-[#8E95A5] hover:text-[#F4F4F6] rounded-lg hover:bg-white/[0.04] transition-colors shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 w-28">
            <button
              onClick={() => onVolumeChange(volume > 0 ? 0 : 0.78)}
              aria-label={volume === 0 ? 'Unmute' : 'Mute'}
              className="text-[#8E95A5] hover:text-[#F4F4F6] shrink-0"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="Master volume"
              className="sonora-slider w-full"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
