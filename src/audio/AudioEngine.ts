import { EqPresetId, PlaybackState, PlaylistTrack, SynthPresetId } from '../types/sonora';

export interface EqSettings {
  lowDb: number;
  midDb: number;
  highDb: number;
  reverbMix: number;
}

export const EQ_PRESETS: Record<EqPresetId, EqSettings> = {
  flat: { lowDb: 0, midDb: 0, highDb: 0, reverbMix: 0.25 },
  warm: { lowDb: 4, midDb: 1, highDb: -2, reverbMix: 0.32 },
  studio: { lowDb: 1.5, midDb: 2.5, highDb: 3, reverbMix: 0.2 },
  bass: { lowDb: 7, midDb: -1, highDb: 1, reverbMix: 0.22 },
  air: { lowDb: -1.5, midDb: 1, highDb: 6, reverbMix: 0.38 },
};

const NOTE_FREQ_MAP: Record<string, number> = {
  C3: 130.81,
  D3: 146.83,
  Eb3: 155.56,
  F3: 174.61,
  G3: 196.0,
  Ab3: 207.65,
  Bb3: 233.08,
  C4: 261.63,
  D4: 293.66,
  Eb4: 311.13,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
};

// Minor 9th / Ambient chord intervals in semitones
const CHORD_PROGRESSIONS: number[][] = [
  [0, 3, 7, 10, 14],
  [-4, 0, 3, 7, 10],
  [-7, -4, 0, 3, 7],
  [-5, -2, 2, 5, 9],
];

function semitoneToHz(baseHz: number, semitones: number): number {
  return baseHz * Math.pow(2, semitones / 12);
}

export interface EngineSnapshot {
  positionSec: number;
  durationSec: number;
  isPlaying: boolean;
  needsUserGesture: boolean;
  lastDriftMs: number | null;
  contextState: AudioContextState | 'uninitialized';
}

export class SonoraAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lowFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private highFilter: BiquadFilterNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  private currentTrack: PlaylistTrack | null = null;
  private isPlaying = false;
  private anchorPositionSec = 0;
  private anchorAudioTime = 0;
  private playbackRate = 1.0;
  private volume = 0.78;
  private eqSettings: EqSettings = { ...EQ_PRESETS.studio };
  private needsUserGesture = false;
  private lastDriftMs: number | null = null;

  // Deterministic step scheduler state
  private schedulerTimer: number | null = null;
  private lastScheduledStep = -1;
  private activeNodes: Set<AudioNode> = new Set();
  private onTrackEndedCallback: (() => void) | null = null;
  private onStateChangeCallback: ((snap: EngineSnapshot) => void) | null = null;

  // Optional local audio file buffer support
  private customBuffer: AudioBuffer | null = null;
  private customBufferTrackId: string | null = null;
  private customBufferSource: AudioBufferSourceNode | null = null;

  public setCallbacks(
    onStateChange: (snap: EngineSnapshot) => void,
    onTrackEnded: () => void
  ): void {
    this.onStateChangeCallback = onStateChange;
    this.onTrackEndedCallback = onTrackEnded;
  }

  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    this.ctx = ctx;

    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 120;
    low.gain.value = this.eqSettings.lowDb;

    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 0.9;
    mid.gain.value = this.eqSettings.midDb;

    const high = ctx.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = 6500;
    high.gain.value = this.eqSettings.highDb;

    const dry = ctx.createGain();
    dry.gain.value = 1 - this.eqSettings.reverbMix * 0.4;

    const wet = ctx.createGain();
    wet.gain.value = this.eqSettings.reverbMix;

    const convolver = ctx.createConvolver();
    convolver.buffer = this.createImpulseResponse(ctx, 2.4, 2.8);

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.25;

    const master = ctx.createGain();
    master.gain.value = this.volume;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;

    low.connect(mid);
    mid.connect(high);

    high.connect(dry);
    high.connect(convolver);
    convolver.connect(wet);

    dry.connect(compressor);
    wet.connect(compressor);

    compressor.connect(master);
    master.connect(analyser);
    analyser.connect(ctx.destination);

    this.lowFilter = low;
    this.midFilter = mid;
    this.highFilter = high;
    this.dryGain = dry;
    this.wetGain = wet;
    this.convolver = convolver;
    this.compressor = compressor;
    this.masterGain = master;
    this.analyser = analyser;

    return ctx;
  }

  private createImpulseResponse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  public async unlockAudio(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    this.needsUserGesture = ctx.state === 'suspended';
    if (this.isPlaying && !this.needsUserGesture) {
      this.anchorAudioTime = ctx.currentTime;
      this.lastScheduledStep = -1;
      this.startLoop();
    }
    this.emitSnapshot();
  }

  public async loadLocalAudioFile(file: File, trackId: string): Promise<number> {
    const ctx = this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    this.customBuffer = decoded;
    this.customBufferTrackId = trackId;
    return Math.max(10, Math.round(decoded.duration));
  }

  public getPositionSec(): number {
    if (!this.currentTrack) return 0;
    if (!this.isPlaying || !this.ctx || this.ctx.state !== 'running') {
      return Math.min(this.currentTrack.durationSec, Math.max(0, this.anchorPositionSec));
    }
    const elapsed = (this.ctx.currentTime - this.anchorAudioTime) * this.playbackRate;
    return Math.min(this.currentTrack.durationSec, Math.max(0, this.anchorPositionSec + elapsed));
  }

  public setTrack(track: PlaylistTrack | null, positionSec = 0): void {
    const isSameTrack = this.currentTrack?.id === track?.id;
    this.currentTrack = track;
    if (!isSameTrack) {
      this.stopAllVoices();
      this.lastScheduledStep = -1;
    }
    this.anchorPositionSec = Math.max(0, positionSec);
    if (this.ctx) {
      this.anchorAudioTime = this.ctx.currentTime;
    }
    if (this.isPlaying && track) {
      this.restartBufferIfNeeded();
    }
    this.emitSnapshot();
  }

  public async play(fromPositionSec?: number): Promise<void> {
    if (!this.currentTrack) return;
    const ctx = this.ensureContext();
    if (typeof fromPositionSec === 'number') {
      this.anchorPositionSec = Math.max(0, Math.min(this.currentTrack.durationSec, fromPositionSec));
    }
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Autoplay blocked until user clicks Unlock Audio
      }
    }
    this.needsUserGesture = ctx.state === 'suspended';
    this.isPlaying = true;
    this.anchorAudioTime = ctx.currentTime;
    this.lastScheduledStep = -1;

    if (!this.needsUserGesture) {
      this.restartBufferIfNeeded();
      this.startLoop();
    }
    this.emitSnapshot();
  }

  public pause(atPositionSec?: number): void {
    const pos = typeof atPositionSec === 'number' ? atPositionSec : this.getPositionSec();
    this.anchorPositionSec = pos;
    this.isPlaying = false;
    this.stopAllVoices();
    this.stopLoop();
    this.emitSnapshot();
  }

  public seek(positionSec: number): void {
    if (!this.currentTrack) return;
    const clamped = Math.max(0, Math.min(this.currentTrack.durationSec, positionSec));
    this.anchorPositionSec = clamped;
    if (this.ctx) {
      this.anchorAudioTime = this.ctx.currentTime;
    }
    this.stopAllVoices();
    this.lastScheduledStep = -1;
    if (this.isPlaying && this.ctx?.state === 'running') {
      this.restartBufferIfNeeded();
    }
    this.emitSnapshot();
  }

  public setPlaybackRate(rate: number): void {
    const pos = this.getPositionSec();
    this.anchorPositionSec = pos;
    if (this.ctx) {
      this.anchorAudioTime = this.ctx.currentTime;
    }
    this.playbackRate = Math.max(0.5, Math.min(2.0, rate));
    if (this.customBufferSource) {
      this.customBufferSource.playbackRate.value = this.playbackRate;
    }
    this.emitSnapshot();
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  public setEqSettings(settings: Partial<EqSettings>): void {
    this.eqSettings = { ...this.eqSettings, ...settings };
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.lowFilter?.gain.setTargetAtTime(this.eqSettings.lowDb, now, 0.03);
    this.midFilter?.gain.setTargetAtTime(this.eqSettings.midDb, now, 0.03);
    this.highFilter?.gain.setTargetAtTime(this.eqSettings.highDb, now, 0.03);
    if (this.wetGain && this.dryGain) {
      this.wetGain.gain.setTargetAtTime(this.eqSettings.reverbMix, now, 0.03);
      this.dryGain.gain.setTargetAtTime(1 - this.eqSettings.reverbMix * 0.4, now, 0.03);
    }
  }

  public applyEqPreset(preset: EqPresetId): void {
    this.setEqSettings(EQ_PRESETS[preset]);
  }

  /**
   * Synchronizes the local Web Audio transport to a remote Firestore anchor.
   * Uses server-clock-adjusted expected position and a 350ms deadband to prevent audible jitter.
   */
  public async syncToRemoteAnchor(
    remote: PlaybackState,
    track: PlaylistTrack | null,
    serverClockOffsetMs: number
  ): Promise<void> {
    if (!track) return;
    const isDifferentTrack = this.currentTrack?.id !== track.id;
    const rate = remote.playbackRate || 1.0;

    let expectedPos = remote.anchorPositionSec;
    if (remote.isPlaying && remote.anchorTimestampMs > 0) {
      const estimatedServerNowMs = Date.now() + serverClockOffsetMs;
      const elapsedSec = Math.max(0, (estimatedServerNowMs - remote.anchorTimestampMs) / 1000);
      expectedPos = Math.min(track.durationSec, remote.anchorPositionSec + elapsedSec * rate);
    }

    const localPos = this.getPositionSec();
    const driftSec = Math.abs(localPos - expectedPos);
    this.lastDriftMs = Math.round(driftSec * 1000);

    if (isDifferentTrack) {
      this.currentTrack = track;
      this.stopAllVoices();
      this.lastScheduledStep = -1;
    }

    this.playbackRate = rate;

    if (remote.isPlaying) {
      if (!this.isPlaying || isDifferentTrack || driftSec > 0.35) {
        await this.play(expectedPos);
      }
    } else {
      if (this.isPlaying || isDifferentTrack || driftSec > 0.25) {
        this.pause(expectedPos);
      }
    }
    this.emitSnapshot();
  }

  public getFrequencyData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser) return false;
    this.analyser.getByteFrequencyData(target);
    return true;
  }

  public getWaveformData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser) return false;
    this.analyser.getByteTimeDomainData(target);
    return true;
  }

  public getSnapshot(): EngineSnapshot {
    return {
      positionSec: this.getPositionSec(),
      durationSec: this.currentTrack?.durationSec ?? 0,
      isPlaying: this.isPlaying,
      needsUserGesture: this.needsUserGesture,
      lastDriftMs: this.lastDriftMs,
      contextState: this.ctx ? this.ctx.state : 'uninitialized',
    };
  }

  private emitSnapshot(): void {
    this.onStateChangeCallback?.(this.getSnapshot());
  }

  private restartBufferIfNeeded(): void {
    if (this.customBufferSource) {
      try {
        this.customBufferSource.stop();
        this.customBufferSource.disconnect();
      } catch {
        // ignore
      }
      this.customBufferSource = null;
    }
    if (
      this.ctx &&
      this.lowFilter &&
      this.currentTrack &&
      this.customBuffer &&
      this.customBufferTrackId === this.currentTrack.id
    ) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.customBuffer;
      src.playbackRate.value = this.playbackRate;
      src.connect(this.lowFilter);
      const offset = this.anchorPositionSec % this.customBuffer.duration;
      src.start(0, offset);
      this.customBufferSource = src;
    }
  }

  private startLoop(): void {
    if (this.schedulerTimer !== null) return;
    this.tick();
    this.schedulerTimer = window.setInterval(() => this.tick(), 60);
  }

  private stopLoop(): void {
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private stopAllVoices(): void {
    if (this.customBufferSource) {
      try {
        this.customBufferSource.stop();
        this.customBufferSource.disconnect();
      } catch {
        // ignore
      }
      this.customBufferSource = null;
    }
    for (const node of this.activeNodes) {
      try {
        if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
          (node as OscillatorNode).stop();
        }
        node.disconnect();
      } catch {
        // ignore already-stopped nodes
      }
    }
    this.activeNodes.clear();
  }

  private tick(): void {
    if (!this.isPlaying || !this.currentTrack || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.needsUserGesture = true;
      this.emitSnapshot();
      return;
    }
    this.needsUserGesture = false;

    const pos = this.getPositionSec();
    if (pos >= this.currentTrack.durationSec - 0.05) {
      this.pause(0);
      this.onTrackEndedCallback?.();
      return;
    }

    // Skip procedural synthesis when playing a custom decoded local audio buffer
    if (this.customBuffer && this.customBufferTrackId === this.currentTrack.id) {
      this.emitSnapshot();
      return;
    }

    const bpm = this.currentTrack.bpm || 90;
    const stepDurationSec = 60 / bpm / 2; // eighth-note resolution
    const currentStep = Math.floor(pos / stepDurationSec);

    if (currentStep > this.lastScheduledStep) {
      this.lastScheduledStep = currentStep;
      this.triggerStep(currentStep, stepDurationSec / this.playbackRate, this.currentTrack);
    }

    this.emitSnapshot();
  }

  private triggerStep(step: number, stepDur: number, track: PlaylistTrack): void {
    if (!this.ctx || !this.lowFilter) return;
    const now = this.ctx.currentTime;
    const baseHz = NOTE_FREQ_MAP[track.rootNote] ?? 196.0;
    const bar = Math.floor(step / 8);
    const stepInBar = step % 8;
    const chord = CHORD_PROGRESSIONS[bar % CHORD_PROGRESSIONS.length];
    const preset = (track.synthPreset as SynthPresetId) || 'warm_pad';

    // Bar downbeat triggers harmonic foundation
    if (stepInBar === 0) {
      if (preset === 'warm_pad' || preset === 'binaural_drone') {
        chord.slice(0, 4).forEach((semitone, idx) => {
          this.playPadVoice(
            semitoneToHz(baseHz, semitone),
            now,
            stepDur * 7.8,
            preset === 'binaural_drone' ? (idx % 2 === 0 ? -4 : 4) : idx * 2 - 3,
            0.065
          );
        });
      } else if (preset === 'velvet_rhodes' || preset === 'lo_fi_keys') {
        chord.slice(0, 4).forEach((semitone, idx) => {
          this.playKeyVoice(
            semitoneToHz(baseHz, semitone),
            now + idx * 0.025,
            stepDur * 6.5,
            preset === 'lo_fi_keys' ? 0.06 : 0.075,
            preset === 'lo_fi_keys'
          );
        });
      } else if (preset === 'dub_chord') {
        chord.slice(0, 4).forEach((semitone) => {
          this.playDubStab(semitoneToHz(baseHz, semitone + 12), now, stepDur * 2.2, 0.055);
        });
      }
    }

    // Secondary rhythmic accents
    if (preset === 'dub_chord' && (stepInBar === 3 || stepInBar === 6)) {
      chord.slice(1, 4).forEach((semitone) => {
        this.playDubStab(semitoneToHz(baseHz, semitone + 12), now, stepDur * 1.1, 0.03);
      });
    }

    if (preset === 'analog_arp' || preset === 'crystalline_bell') {
      const noteSemitone = chord[step % chord.length] + (stepInBar >= 4 ? 12 : 0);
      if (preset === 'analog_arp') {
        this.playPluckVoice(semitoneToHz(baseHz, noteSemitone + 12), now, stepDur * 1.4, 0.09);
      } else if (step % 2 === 0) {
        this.playBellVoice(semitoneToHz(baseHz, noteSemitone + 12), now, stepDur * 3.5, 0.065);
      }
    }

    // Bass pulse on beats 0, 2, 4, 6 depending on preset
    if (preset === 'sub_pulse' && stepInBar % 2 === 0) {
      const rootSemitone = chord[0] - 12;
      this.playSubVoice(semitoneToHz(baseHz, rootSemitone), now, stepDur * 1.7, 0.16);
    } else if ((preset === 'analog_arp' || preset === 'dub_chord' || preset === 'velvet_rhodes') && (stepInBar === 0 || stepInBar === 4)) {
      this.playSubVoice(semitoneToHz(baseHz, chord[0] - 12), now, stepDur * 3.2, 0.11);
    }

    // Soft studio pulse click/shaker for rhythmic presets
    if (
      (preset === 'sub_pulse' || preset === 'dub_chord' || preset === 'analog_arp' || preset === 'lo_fi_keys') &&
      stepInBar % 2 === 0
    ) {
      this.playSoftPercussion(now, stepInBar === 0 || stepInBar === 4);
    }
  }

  private trackNode(node: AudioNode, stopAtCtxTime: number): void {
    this.activeNodes.add(node);
    const delayMs = Math.max(50, (stopAtCtxTime - (this.ctx?.currentTime ?? 0)) * 1000 + 80);
    window.setTimeout(() => {
      this.activeNodes.delete(node);
    }, delayMs);
  }

  private playPadVoice(freq: number, start: number, dur: number, detuneCents: number, peakGain: number): void {
    if (!this.ctx || !this.lowFilter) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, start);
    osc.detune.setValueAtTime(detuneCents, start);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, start);
    filter.frequency.exponentialRampToValueAtTime(1400, start + dur * 0.45);
    filter.frequency.exponentialRampToValueAtTime(420, start + dur);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + Math.min(0.6, dur * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.lowFilter);

    osc.start(start);
    osc.stop(start + dur + 0.05);
    this.trackNode(osc, start + dur + 0.05);
  }

  private playKeyVoice(freq: number, start: number, dur: number, peakGain: number, warmLoFi: boolean): void {
    if (!this.ctx || !this.lowFilter) return;
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const overtoneGain = this.ctx.createGain();

    osc.type = warmLoFi ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, start);

    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 2, start);
    overtoneGain.gain.setValueAtTime(warmLoFi ? 0.15 : 0.28, start);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, start + Math.min(0.5, dur * 0.4));

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(gain);
    overtone.connect(overtoneGain);
    overtoneGain.connect(gain);
    gain.connect(this.lowFilter);

    osc.start(start);
    overtone.start(start);
    osc.stop(start + dur + 0.05);
    overtone.stop(start + dur + 0.05);
    this.trackNode(osc, start + dur + 0.05);
    this.trackNode(overtone, start + dur + 0.05);
  }

  private playPluckVoice(freq: number, start: number, dur: number, peakGain: number): void {
    if (!this.ctx || !this.lowFilter) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    filter.type = 'lowpass';
    filter.Q.value = 3.2;
    filter.frequency.setValueAtTime(2800, start);
    filter.frequency.exponentialRampToValueAtTime(340, start + dur);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.lowFilter);

    osc.start(start);
    osc.stop(start + dur + 0.04);
    this.trackNode(osc, start + dur + 0.04);
  }

  private playBellVoice(freq: number, start: number, dur: number, peakGain: number): void {
    if (!this.ctx || !this.lowFilter) return;
    const carrier = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, start);

    mod.type = 'sine';
    mod.frequency.setValueAtTime(freq * 2.756, start);
    modGain.gain.setValueAtTime(freq * 0.45, start);
    modGain.gain.exponentialRampToValueAtTime(1, start + dur * 0.6);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(gain);
    gain.connect(this.lowFilter);

    mod.start(start);
    carrier.start(start);
    mod.stop(start + dur + 0.04);
    carrier.stop(start + dur + 0.04);
    this.trackNode(mod, start + dur + 0.04);
    this.trackNode(carrier, start + dur + 0.04);
  }

  private playDubStab(freq: number, start: number, dur: number, peakGain: number): void {
    if (!this.ctx || !this.lowFilter) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, start);

    filter.type = 'bandpass';
    filter.Q.value = 2.4;
    filter.frequency.setValueAtTime(1900, start);
    filter.frequency.exponentialRampToValueAtTime(380, start + dur);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.lowFilter);

    osc.start(start);
    osc.stop(start + dur + 0.04);
    this.trackNode(osc, start + dur + 0.04);
  }

  private playSubVoice(freq: number, start: number, dur: number, peakGain: number): void {
    if (!this.ctx || !this.lowFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(gain);
    gain.connect(this.lowFilter);

    osc.start(start);
    osc.stop(start + dur + 0.04);
    this.trackNode(osc, start + dur + 0.04);
  }

  private playSoftPercussion(start: number, accent: boolean): void {
    if (!this.ctx || !this.lowFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 98 : 1600, start);
    osc.frequency.exponentialRampToValueAtTime(accent ? 38 : 650, start + 0.07);

    gain.gain.setValueAtTime(accent ? 0.14 : 0.018, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (accent ? 0.12 : 0.04));

    osc.connect(gain);
    gain.connect(this.lowFilter);

    osc.start(start);
    osc.stop(start + 0.14);
    this.trackNode(osc, start + 0.14);
  }

  public dispose(): void {
    this.stopLoop();
    this.stopAllVoices();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
