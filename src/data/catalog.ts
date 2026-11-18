import { PlaylistTrack, PublicPlaylist, SynthPresetId } from '../types/sonora';

export const COVER_ASSETS = [
  {
    id: 'nocturne',
    label: 'Nocturne Gold',
    url: '/src/assets/images/cover_nocturne_synth_1794974332363.jpg',
  },
  {
    id: 'alpine',
    label: 'Alpine Drift',
    url: '/src/assets/images/cover_alpine_drift_1794974333745.jpg',
  },
  {
    id: 'obsidian',
    label: 'Obsidian Pulse',
    url: '/src/assets/images/cover_obsidian_pulse_1794974334475.jpg',
  },
  {
    id: 'velvet',
    label: 'Velvet Horizon',
    url: '/src/assets/images/cover_velvet_horizon_1794974335133.jpg',
  },
] as const;

export const HERO_STUDIO_IMAGE = '/src/assets/images/sonora_hero_studio_1794974332660.jpg';

export const SYNTH_PRESET_LABELS: Record<SynthPresetId, { name: string; timbre: string }> = {
  warm_pad: { name: 'Warm Analog Pad', timbre: 'Detuned dual sawtooth through warm low-pass filter' },
  analog_arp: { name: 'Poly Arpeggiator', timbre: 'Plucked triangle arpeggio with rhythmic step gate' },
  sub_pulse: { name: 'Sub Pulse Bass', timbre: 'Deep sine-square sub bass with soft percussion pulse' },
  velvet_rhodes: { name: 'Velvet Electric Keys', timbre: 'FM bell tines with warm chorus shimmer' },
  crystalline_bell: { name: 'Crystalline Bell', timbre: 'Harmonic partial chimes in long stereo hall' },
  binaural_drone: { name: 'Binaural Ambient Drone', timbre: 'Slowly evolving fifth intervals with stereo phase' },
  dub_chord: { name: 'Dub Echo Chords', timbre: 'Filtered minor seventh stabs with tape delay tail' },
  lo_fi_keys: { name: 'Tape Felt Keys', timbre: 'Soft saturated chords with subtle analog drift' },
};

export const ROOT_NOTES = ['C3', 'D3', 'Eb3', 'F3', 'G3', 'Ab3', 'Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4', 'A4'] as const;

export const STUDIO_TRACK_LIBRARY: Omit<PlaylistTrack, 'addedBy' | 'order' | 'createdAtMs'>[] = [
  {
    id: 'sonora_trk_nocturne_01',
    title: 'Midnight Console',
    artist: 'Sonora Collective',
    genre: 'Ambient Synth',
    durationSec: 214,
    bpm: 84,
    synthPreset: 'warm_pad',
    rootNote: 'C3',
    coverUrl: COVER_ASSETS[0].url,
  },
  {
    id: 'sonora_trk_nocturne_02',
    title: 'Tungsten Harmonics',
    artist: 'Klara Lindqvist',
    genre: 'Electronic',
    durationSec: 192,
    bpm: 108,
    synthPreset: 'analog_arp',
    rootNote: 'Eb3',
    coverUrl: COVER_ASSETS[0].url,
  },
  {
    id: 'sonora_trk_alpine_01',
    title: 'Basalt Ridge Mist',
    artist: 'Henrik Solberg',
    genre: 'Deep Focus',
    durationSec: 248,
    bpm: 72,
    synthPreset: 'binaural_drone',
    rootNote: 'D3',
    coverUrl: COVER_ASSETS[1].url,
  },
  {
    id: 'sonora_trk_alpine_02',
    title: 'Glacier Rhodes',
    artist: 'Maren Voss',
    genre: 'Neo-Classical',
    durationSec: 186,
    bpm: 92,
    synthPreset: 'velvet_rhodes',
    rootNote: 'F3',
    coverUrl: COVER_ASSETS[1].url,
  },
  {
    id: 'sonora_trk_obsidian_01',
    title: 'Brutalist Courtyard',
    artist: 'Darius Vance',
    genre: 'Minimal Dub',
    durationSec: 226,
    bpm: 118,
    synthPreset: 'dub_chord',
    rootNote: 'G3',
    coverUrl: COVER_ASSETS[2].url,
  },
  {
    id: 'sonora_trk_obsidian_02',
    title: 'Subterranean Clock',
    artist: 'Nadia Okafor',
    genre: 'Electronic',
    durationSec: 204,
    bpm: 122,
    synthPreset: 'sub_pulse',
    rootNote: 'C3',
    coverUrl: COVER_ASSETS[2].url,
  },
  {
    id: 'sonora_trk_velvet_01',
    title: 'Oscilloscope Drift',
    artist: 'Tomasz Kowalski',
    genre: 'Ambient',
    durationSec: 238,
    bpm: 78,
    synthPreset: 'crystalline_bell',
    rootNote: 'Ab3',
    coverUrl: COVER_ASSETS[3].url,
  },
  {
    id: 'sonora_trk_velvet_02',
    title: 'Analog Tape Study IV',
    artist: 'Elena Rostova',
    genre: 'Lo-Fi Study',
    durationSec: 174,
    bpm: 88,
    synthPreset: 'lo_fi_keys',
    rootNote: 'Bb3',
    coverUrl: COVER_ASSETS[3].url,
  },
];

export interface StarterPlaylistSeed {
  playlist: Omit<PublicPlaylist, 'ownerId' | 'ownerName' | 'createdAtMs' | 'updatedAtMs'>;
  tracks: Omit<PlaylistTrack, 'addedBy' | 'createdAtMs'>[];
}

export function buildStarterPublicPlaylists(): StarterPlaylistSeed[] {
  return [
    {
      playlist: {
        id: 'pub_nocturne_sessions',
        title: 'Nocturne Analog Sessions',
        description: 'Warm dual-oscillator pads and measured arpeggios engineered for late-night collaborative listening.',
        genre: 'Ambient Synth',
        coverUrl: COVER_ASSETS[0].url,
        trackCount: 3,
        totalDurationSec: 644,
      },
      tracks: [
        { ...STUDIO_TRACK_LIBRARY[0], order: 0 },
        { ...STUDIO_TRACK_LIBRARY[1], order: 1 },
        { ...STUDIO_TRACK_LIBRARY[6], order: 2 },
      ],
    },
    {
      playlist: {
        id: 'pub_alpine_focus',
        title: 'Alpine Horizon Focus',
        description: 'Binaural fifths and electric felt keys calibrated for uninterrupted deep work across devices.',
        genre: 'Deep Focus',
        coverUrl: COVER_ASSETS[1].url,
        trackCount: 3,
        totalDurationSec: 608,
      },
      tracks: [
        { ...STUDIO_TRACK_LIBRARY[2], order: 0 },
        { ...STUDIO_TRACK_LIBRARY[3], order: 1 },
        { ...STUDIO_TRACK_LIBRARY[7], order: 2 },
      ],
    },
    {
      playlist: {
        id: 'pub_obsidian_pulse',
        title: 'Obsidian Minimal Pulse',
        description: 'Architectural dub chord stabs and tight sub-bass pulses synchronized to sample-accurate BPM.',
        genre: 'Minimal Dub',
        coverUrl: COVER_ASSETS[2].url,
        trackCount: 2,
        totalDurationSec: 430,
      },
      tracks: [
        { ...STUDIO_TRACK_LIBRARY[4], order: 0 },
        { ...STUDIO_TRACK_LIBRARY[5], order: 1 },
      ],
    },
    {
      playlist: {
        id: 'pub_velvet_oscillations',
        title: 'Velvet Oscillations',
        description: 'Pure harmonic partials and tape-saturated Rhodes progressions rendered in real time.',
        genre: 'Electronic',
        coverUrl: COVER_ASSETS[3].url,
        trackCount: 3,
        totalDurationSec: 598,
      },
      tracks: [
        { ...STUDIO_TRACK_LIBRARY[6], order: 0 },
        { ...STUDIO_TRACK_LIBRARY[3], order: 1 },
        { ...STUDIO_TRACK_LIBRARY[0], order: 2 },
      ],
    },
  ];
}
