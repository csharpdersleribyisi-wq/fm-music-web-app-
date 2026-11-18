import React, { useEffect, useRef, useState } from 'react';
import { Play, Plus } from 'lucide-react';
import { EQ_PRESETS, EqSettings, SonoraAudioEngine } from '../audio/AudioEngine';
import { COVER_ASSETS, ROOT_NOTES, SYNTH_PRESET_LABELS } from '../data/catalog';
import {
  CollaborativePlaylist,
  EqPresetId,
  generateSafeId,
  PlaylistTrack,
  PublicPlaylist,
  SynthPresetId,
} from '../types/sonora';

interface StudioRackViewProps {
  engine: SonoraAudioEngine;
  isPlaying: boolean;
  eqPreset: EqPresetId;
  playbackRate: number;
  collabPlaylists: CollaborativePlaylist[];
  publicPlaylists: PublicPlaylist[];
  currentUid: string;
  onSelectEqPreset: (preset: EqPresetId) => void;
  onEqChange: (settings: EqSettings) => void;
  onRateChange: (rate: number) => void;
  onPlayCustomTrack: (track: Omit<PlaylistTrack, 'addedBy' | 'order' | 'createdAtMs'>) => void;
  onSaveTrackToPlaylist: (
    collectionName: 'collaborativePlaylists' | 'publicPlaylists',
    playlistId: string,
    track: Omit<PlaylistTrack, 'addedBy' | 'order' | 'createdAtMs'>
  ) => Promise<void>;
}

export const StudioRackView: React.FC<StudioRackViewProps> = ({
  engine,
  isPlaying,
  eqPreset,
  playbackRate,
  collabPlaylists,
  publicPlaylists,
  currentUid,
  onSelectEqPreset,
  onEqChange,
  onRateChange,
  onPlayCustomTrack,
  onSaveTrackToPlaylist,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [eq, setEq] = useState<EqSettings>({ ...EQ_PRESETS[eqPreset] });

  // Custom Track Composer State
  const [title, setTitle] = useState('Amber Resonance');
  const [artist, setArtist] = useState('Studio Synth');
  const [genre, setGenre] = useState('Ambient Synth');
  const [bpm, setBpm] = useState(96);
  const [durationSec, setDurationSec] = useState(180);
  const [rootNote, setRootNote] = useState<string>('C3');
  const [synthPreset, setSynthPreset] = useState<SynthPresetId>('warm_pad');
  const [targetPlaylistKey, setTargetPlaylistKey] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ownedPublic = publicPlaylists.filter((p) => p.ownerId === currentUid);
  const targetOptions = [
    ...collabPlaylists.map((p) => ({
      key: `collaborativePlaylists:${p.id}`,
      label: `Collab · ${p.title}`,
    })),
    ...ownedPublic.map((p) => ({
      key: `publicPlaylists:${p.id}`,
      label: `Public · ${p.title}`,
    })),
  ];

  useEffect(() => {
    setEq({ ...EQ_PRESETS[eqPreset] });
  }, [eqPreset]);

  useEffect(() => {
    let rafId = 0;
    const freqBuffer = new Uint8Array(128);
    const waveBuffer = new Uint8Array(128);

    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // Grid lines
          ctx.strokeStyle = 'rgba(255,255,255,0.05)';
          ctx.lineWidth = 1;
          for (let y = 1; y <= 3; y++) {
            const yy = (h / 4) * y;
            ctx.beginPath();
            ctx.moveTo(0, yy);
            ctx.lineTo(w, yy);
            ctx.stroke();
          }

          const hasFreq = engine.getFrequencyData(freqBuffer);
          const hasWave = engine.getWaveformData(waveBuffer);

          // Spectrum Bars
          const barCount = 48;
          const barWidth = (w - 16) / barCount;
          for (let i = 0; i < barCount; i++) {
            const val = hasFreq && isPlaying ? freqBuffer[i] / 255 : 0.04;
            const barH = Math.max(3, val * (h - 24));
            ctx.fillStyle = val > 0.55 ? '#E5A93C' : 'rgba(229, 169, 60, 0.45)';
            ctx.fillRect(8 + i * barWidth, h - barH - 8, Math.max(2, barWidth - 3), barH);
          }

          // Oscilloscope overlay
          if (hasWave && isPlaying) {
            ctx.strokeStyle = 'rgba(244, 244, 246, 0.75)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = 0; i < waveBuffer.length; i++) {
              const x = (i / (waveBuffer.length - 1)) * w;
              const y = ((waveBuffer[i] - 128) / 128) * (h * 0.32) + h * 0.42;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }
      }
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [engine, isPlaying]);

  const handleSliderChange = (key: keyof EqSettings, value: number) => {
    const next = { ...eq, [key]: value };
    setEq(next);
    onEqChange(next);
  };

  const buildComposedTrack = (): Omit<PlaylistTrack, 'addedBy' | 'order' | 'createdAtMs'> => ({
    id: generateSafeId('synth'),
    title: title.trim() || 'Untitled Synth Study',
    artist: artist.trim() || 'Sonora Studio',
    genre: genre.trim() || 'Ambient',
    durationSec,
    bpm,
    synthPreset,
    rootNote,
    coverUrl: COVER_ASSETS[0].url,
  });

  const handleSaveToTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenKey = targetPlaylistKey || targetOptions[0]?.key;
    if (!chosenKey || saving) return;
    const [colName, playlistId] = chosenKey.split(':') as ['collaborativePlaylists' | 'publicPlaylists', string];
    setSaving(true);
    setSaveMessage(null);
    try {
      const trk = buildComposedTrack();
      await onSaveTrackToPlaylist(colName, playlistId, trk);
      setSaveMessage(`Saved "${trk.title}" to playlist`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Real-time Spectrum + Parametric EQ Rack */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#131720] border border-white/8 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-[#F4F4F6]">
                Real-Time Spectrum & Oscilloscope
              </h2>
              <p className="text-xs text-[#8E95A5] mt-0.5">
                Live FFT analysis from Web Audio AnalyserNode
              </p>
            </div>
            <span className="font-mono-tabular text-xs text-[#E5A93C]">
              {playbackRate.toFixed(2)}x Rate
            </span>
          </div>

          <div className="bg-[#0B0D12] border border-white/8 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              width={640}
              height={220}
              className="w-full h-[220px] block"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-1 p-1 bg-[#0B0D12] border border-white/8 rounded-lg">
              {(['flat', 'warm', 'studio', 'bass', 'air'] as EqPresetId[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => onSelectEqPreset(preset)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                    eqPreset === preset
                      ? 'bg-[#1D2330] text-[#E5A93C]'
                      : 'text-[#8E95A5] hover:text-[#F4F4F6]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 w-48">
              <span className="text-xs text-[#8E95A5] whitespace-nowrap">Tempo</span>
              <input
                type="range"
                min={0.75}
                max={1.5}
                step={0.05}
                value={playbackRate}
                onChange={(e) => onRateChange(Number(e.target.value))}
                aria-label="Playback rate"
                className="sonora-slider flex-1"
              />
            </div>
          </div>
        </div>

        {/* 3-Band EQ & Reverb Controls */}
        <div className="lg:col-span-5 bg-[#131720] border border-white/8 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="font-display text-base font-semibold text-[#F4F4F6]">
              3-Band Parametric EQ & Space
            </h2>
            <p className="text-xs text-[#8E95A5] mt-0.5">
              BiquadFilter mastering chain with stereo convolver reverb
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#F4F4F6] font-medium">Low Shelf (120 Hz)</span>
                <span className="font-mono-tabular text-[#E5A93C]">
                  {eq.lowDb > 0 ? `+${eq.lowDb.toFixed(1)}` : eq.lowDb.toFixed(1)} dB
                </span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={eq.lowDb}
                onChange={(e) => handleSliderChange('lowDb', Number(e.target.value))}
                className="sonora-slider w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#F4F4F6] font-medium">Mid Peak (1.0 kHz)</span>
                <span className="font-mono-tabular text-[#E5A93C]">
                  {eq.midDb > 0 ? `+${eq.midDb.toFixed(1)}` : eq.midDb.toFixed(1)} dB
                </span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={eq.midDb}
                onChange={(e) => handleSliderChange('midDb', Number(e.target.value))}
                className="sonora-slider w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#F4F4F6] font-medium">High Shelf (6.5 kHz)</span>
                <span className="font-mono-tabular text-[#E5A93C]">
                  {eq.highDb > 0 ? `+${eq.highDb.toFixed(1)}` : eq.highDb.toFixed(1)} dB
                </span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={eq.highDb}
                onChange={(e) => handleSliderChange('highDb', Number(e.target.value))}
                className="sonora-slider w-full"
              />
            </div>

            <div className="space-y-1.5 pt-2 border-t border-white/8">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#F4F4F6] font-medium">Studio Hall Reverb</span>
                <span className="font-mono-tabular text-[#E5A93C]">
                  {Math.round(eq.reverbMix * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={0.85}
                step={0.01}
                value={eq.reverbMix}
                onChange={(e) => handleSliderChange('reverbMix', Number(e.target.value))}
                className="sonora-slider w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Custom Web Audio Track Composer */}
      <form
        onSubmit={handleSaveToTarget}
        className="bg-[#131720] border border-white/8 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#F4F4F6]">
              Web Audio Track Composer
            </h2>
            <p className="text-xs text-[#8E95A5] mt-0.5">
              Audition a procedural synth composition live and save it directly into any collaborative or public playlist
            </p>
          </div>
          <button
            type="button"
            onClick={() => onPlayCustomTrack(buildComposedTrack())}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B202C] border border-white/10 text-xs font-semibold text-[#F4F4F6] rounded-lg hover:bg-[#232A3A] transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 text-[#E5A93C]" />
            Audition Live
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-[#8E95A5] mb-1.5">Track Title</label>
            <input
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#0B0D12] border border-white/10 rounded-lg text-sm text-[#F4F4F6] focus:outline-none focus:border-[#E5A93C]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#8E95A5] mb-1.5">Artist / Composer</label>
            <input
              type="text"
              required
              maxLength={80}
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#0B0D12] border border-white/10 rounded-lg text-sm text-[#F4F4F6] focus:outline-none focus:border-[#E5A93C]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#8E95A5] mb-1.5">Genre</label>
            <input
              type="text"
              required
              maxLength={50}
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#0B0D12] border border-white/10 rounded-lg text-sm text-[#F4F4F6] focus:outline-none focus:border-[#E5A93C]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#8E95A5] mb-1.5">Synth Topology</label>
            <select
              value={synthPreset}
              onChange={(e) => setSynthPreset(e.target.value as SynthPresetId)}
              className="w-full px-3.5 py-2 bg-[#0B0D12] border border-white/10 rounded-lg text-sm text-[#F4F4F6] focus:outline-none focus:border-[#E5A93C]"
            >
              {(Object.keys(SYNTH_PRESET_LABELS) as SynthPresetId[]).map((key) => (
                <option key={key} value={key}>
                  {SYNTH_PRESET_LABELS[key].name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#8E95A5] mb-1.5">Root Key</label>
            <select
              value={rootNote}
              onChange={(e) => setRootNote(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#0B0D12] border border-white/10 rounded-lg text-sm text-[#F4F4F6] focus:outline-none focus:border-[#E5A93C]"
            >
              {ROOT_NOTES.map((note) => (
                <option key={note} value={note}>
                  {note}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#8E95A5] mb-1.5">Tempo (BPM)</label>
              <input
                type="number"
                min={40}
                max={220}
                value={bpm}
                onChange={(e) => setBpm(Math.max(40, Math.min(220, Number(e.target.value))))}
                className="w-full px-3 py-2 bg-[#0B0D12] border border-white/10 rounded-lg text-sm font-mono-tabular text-[#F4F4F6] focus:outline-none focus:border-[#E5A93C]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8E95A5] mb-1.5">Length (sec)</label>
              <input
                type="number"
                min={30}
                max={1200}
                value={durationSec}
                onChange={(e) => setDurationSec(Math.max(30, Math.min(1200, Number(e.target.value))))}
                className="w-full px-3 py-2 bg-[#0B0D12] border border-white/10 rounded-lg text-sm font-mono-tabular text-[#F4F4F6] focus:outline-none focus:border-[#E5A93C]"
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-[#8E95A5]">
          {SYNTH_PRESET_LABELS[synthPreset].timbre}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/8">
          <div className="flex items-center gap-3 flex-1 min-w-[220px] max-w-md">
            <select
              value={targetPlaylistKey || targetOptions[0]?.key || ''}
              onChange={(e) => setTargetPlaylistKey(e.target.value)}
              disabled={targetOptions.length === 0}
              className="w-full px-3.5 py-2 bg-[#0B0D12] border border-white/10 rounded-lg text-xs text-[#F4F4F6] focus:outline-none focus:border-[#E5A93C]"
            >
              {targetOptions.length === 0 ? (
                <option value="">Create a playlist first to save</option>
              ) : (
                targetOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center gap-4">
            {saveMessage && (
              <span className="text-xs text-[#4ADE80]">{saveMessage}</span>
            )}
            <button
              type="submit"
              disabled={targetOptions.length === 0 || saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#E5A93C] text-[#0B0D12] text-xs font-semibold rounded-lg hover:bg-[#ebb758] transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save to Playlist'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
