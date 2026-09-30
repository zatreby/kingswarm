// createAudio: owns the AudioContext lifecycle, loading and decoding, and wraps the Mixer so that
// nothing here can throw into the game. No context, a failed fetch or a bad file = silence, not an error.
import type { SimEvent, Team, World } from '../sim/types';
import { MUSIC, SOUNDS, type MusicId, type SoundId } from './manifest';
import { Mixer, type MixerStats, type MusicState, type SoundBank } from './mixer';

// ---- loading numbers ----
/** Parallel fetch+decode jobs while preloading SFX (keeps the decode memory spike small). */
const LOAD_CONCURRENCY = 6;
/** SFX are 44.1 kHz files; decoding at that rate needs no context and no user gesture. */
const DECODE_RATE = 44100;

export type UiSound = 'click' | 'hover' | 'confirm' | 'back' | 'pick' | 'error';
export type LoadGroup = 'core' | 'music';

export interface AudioEngine {
  unlock(): Promise<void>;
  preload(group: LoadGroup): Promise<void>;
  onEvents(events: readonly SimEvent[], world: World, localTeam: Team): void;
  ui(name: UiSound): void;
  setMusic(state: MusicState): void;
  setVolumes(v: { master?: number; music?: number; sfx?: number }): void;
  setMuted(m: boolean): void;
  update(dt: number): void;
  readonly state: { unlocked: boolean; loaded: { core: boolean; music: boolean } };
}

/** Extra surface for the lab and tests; the game uses AudioEngine. */
export interface AudioEngineDebug extends AudioEngine {
  /** Play one sound id now, centred, as the local side. */
  audition(id: SoundId): void;
  readonly stats: MixerStats | null;
  /** Files that failed to load or decode. */
  readonly failures: readonly string[];
}

export interface AudioOptions {
  /** Prefix for manifest paths; default Vite's BASE_URL. */
  basePath?: string;
  /** Injection points for tests and the lab. */
  createContext?: () => AudioContext;
  /** Decodes before the context exists (no gesture needed). Default: an OfflineAudioContext at 44.1 kHz. */
  createDecoder?: () => BaseAudioContext;
  fetchBytes?: (url: string) => Promise<ArrayBuffer>;
  random?: () => number;
}

export function createAudio(opts: AudioOptions = {}): AudioEngineDebug {
  const base = opts.basePath ?? defaultBase();
  const fetchBytes = opts.fetchBytes ?? defaultFetch;
  const sfxBuffers = new Map<SoundId, (AudioBuffer | undefined)[]>();
  const musicBytes = new Map<MusicId, ArrayBuffer>();
  const musicBuffers = new Map<MusicId, AudioBuffer>();
  const musicDecoding = new Set<MusicId>();
  const failures: string[] = [];
  const state = { unlocked: false, loaded: { core: false, music: false } };
  let ctx: AudioContext | null = null;
  let decoder: BaseAudioContext | null = null;
  let mixer: Mixer | null = null;
  let wantMusic: MusicState = 'none';
  let volumes: { master?: number; music?: number; sfx?: number } = {};
  let muted = false;
  let local: Team = 0;

  const bank: SoundBank = {
    sfx: id => sfxBuffers.get(id),
    music: id => musicBuffers.get(id),
  };

  const now = () => (ctx ? ctx.currentTime : 0);

  function getDecoder(): BaseAudioContext | null {
    if (ctx) return ctx;
    if (decoder) return decoder;
    try {
      decoder = opts.createDecoder ? opts.createDecoder() : new OfflineAudioContext(1, 1, DECODE_RATE);
    } catch { decoder = null; }
    return decoder;
  }

  async function decode(bytes: ArrayBuffer, file: string, useLive: boolean): Promise<AudioBuffer | undefined> {
    const d = useLive && ctx ? ctx : getDecoder();
    if (!d) return undefined;
    try {
      return await d.decodeAudioData(bytes);
    } catch {
      failures.push(file);
      return undefined;
    }
  }

  async function loadSfx(id: SoundId, i: number): Promise<void> {
    const file = SOUNDS[id].files[i];
    const bytes = await fetchBytes(base + file).catch(() => undefined);
    if (!bytes) { failures.push(file); return; }
    const buf = await decode(bytes, file, false);
    let arr = sfxBuffers.get(id);
    if (!arr) { arr = new Array(SOUNDS[id].files.length).fill(undefined); sfxBuffers.set(id, arr); }
    arr[i] = buf;
  }

  async function preloadCore(): Promise<void> {
    const jobs: [SoundId, number][] = [];
    for (const id of Object.keys(SOUNDS) as SoundId[]) SOUNDS[id].files.forEach((_, i) => jobs.push([id, i]));
    await pool(jobs, LOAD_CONCURRENCY, ([id, i]) => loadSfx(id, i));
    // "loaded" means the pass finished; files that failed stay silent (see failures).
    state.loaded.core = true;
  }

  async function preloadMusic(): Promise<void> {
    // Only the compressed bytes (2.3 MB) stay in memory; decoded music is ~20 MB per minute of
    // stereo float, so tracks are decoded on demand and evicted when no longer near (musicKeep).
    await Promise.all((Object.keys(MUSIC) as MusicId[]).map(async id => {
      if (musicBytes.has(id)) return;
      const b = await fetchBytes(base + MUSIC[id].file).catch(() => undefined);
      if (b) musicBytes.set(id, b); else failures.push(MUSIC[id].file);
    }));
    state.loaded.music = true;
    ensureMusic(wantMusic);
  }

  /** Tracks worth holding decoded while in `s`: the current one and the one it escalates to. */
  function musicKeep(s: MusicState): MusicId[] {
    switch (s) {
      case 'battle': return ['battle', 'crown'];
      case 'crown': return ['crown', 'battle'];
      case 'none': return [];
      default: return [s];
    }
  }

  function ensureMusic(s: MusicState): void {
    const keep = musicKeep(s);
    for (const id of [...musicBuffers.keys()]) if (!keep.includes(id)) musicBuffers.delete(id);
    if (!ctx) return; // decode at the live rate once unlocked: music is not pitch-shifted, keep it pristine
    for (const id of keep) {
      if (musicBuffers.has(id) || musicDecoding.has(id)) continue;
      const bytes = musicBytes.get(id);
      if (!bytes) continue;
      musicDecoding.add(id);
      // slice: decodeAudioData detaches its input and the bytes are kept for re-decoding later.
      void decode(bytes.slice(0), MUSIC[id].file, true).then(buf => {
        musicDecoding.delete(id);
        if (!buf || !musicKeep(wantMusic).includes(id)) return;
        musicBuffers.set(id, buf);
        guard(() => mixer?.musicReady(now()));
      });
    }
  }

  function applySettings(): void {
    if (!mixer) return;
    mixer.setVolumes(volumes, now());
    mixer.setMuted(muted, now());
    mixer.setMusic(wantMusic, now());
  }

  const engine: AudioEngineDebug = {
    state,
    failures,
    get stats() { return mixer ? mixer.stats : null; },

    async unlock() {
      try {
        if (!ctx) {
          const make = opts.createContext ?? (() => new AudioContext({ latencyHint: 'interactive' }));
          ctx = make();
          mixer = new Mixer(ctx, bank, { random: opts.random });
          applySettings();
        }
        if (ctx.state !== 'running') await ctx.resume();
        // iOS/Safari only count the context as unlocked once something played inside the gesture.
        const s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        s.connect(ctx.destination);
        s.start(0);
        state.unlocked = ctx.state === 'running';
        ensureMusic(wantMusic);
      } catch {
        state.unlocked = false;
      }
    },

    async preload(group) {
      try {
        if (group === 'core') await preloadCore();
        else await preloadMusic();
      } catch { /* fail silent */ }
    },

    onEvents(events, world, localTeam) {
      local = localTeam;
      if (!mixer || !state.unlocked) return;
      guard(() => mixer!.onEvents(events, world, localTeam, now()));
    },

    ui(name) {
      if (!mixer || !state.unlocked) return;
      guard(() => mixer!.cue({ id: `ui_${name}` }, local, now()));
    },

    audition(id) {
      if (!mixer) return;
      guard(() => mixer!.cue({ id }, local, now()));
    },

    setMusic(s) {
      wantMusic = s;
      guard(() => {
        ensureMusic(s);
        mixer?.setMusic(s, now());
      });
    },

    setVolumes(v) {
      volumes = { ...volumes, ...v };
      guard(() => mixer?.setVolumes(v, now()));
    },

    setMuted(m) {
      muted = m;
      guard(() => mixer?.setMuted(m, now()));
    },

    update() {
      if (!mixer) return;
      guard(() => mixer!.update(now()));
    },
  };
  return engine;
}

function guard(f: () => void): void {
  try { f(); } catch { /* audio must never break the game */ }
}

function defaultBase(): string {
  try {
    return import.meta.env?.BASE_URL ?? '/';
  } catch {
    return '/';
  }
}

async function defaultFetch(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.arrayBuffer();
}

async function pool<T>(items: readonly T[], n: number, job: (t: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const t = items[next++];
      try { await job(t); } catch { /* counted in failures by the job */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}
