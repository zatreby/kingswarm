// The mix: bus graph, voice pool, aggregation of critter spam, ducking and music crossfades.
// Every method takes the time explicitly (never reads ctx.currentTime), so the same code drives a
// live AudioContext, an OfflineAudioContext render in the lab, and a fake context under Vitest.
//
//   voice -> gain -> pan -> critterBus(duck) ┐
//   voice -> gain -> pan -------------------> sfxBus(vol) ┐
//   music -> trackGain -> musicDuck -> musicBus(vol) ------> sum -> compressor -> soft clip -> master(vol) -> mute -> out
import type { SimEvent, Team, World } from '../sim/types';
import { cuesFor, type AggGroup, type Cue } from './mapping';
import { MUSIC, SOUNDS, type MusicId, type SoundId } from './manifest';

// ---- feel numbers (tuned with lab/audio.html renderMix; see the report in the audio stage) ----
/** Bus levels in dB. Music sits under the SFX; the files are -18 LUFS, SFX peaks sit near -1 dBTP. */
const MUSIC_BUS_DB = -10;
const SFX_BUS_DB = -6;
/**
 * The critter family inside the SFX bus. One critter file is quiet (-22 LUFS momentary) but the merged
 * swarm stream still starts ~30 voices a second in a full fight; at 0 dB it was 2 dB LOUDER than the
 * King sounds and buried the music (lab renderMix 'heavy'). ART.md wants critters tiny, Kings heavier.
 */
export const CRITTER_BUS_DB = -8;
/** The rival's sounds, relative to the local player's own. */
const RIVAL_DB = -3;
/** Per-play random level spread (+/- fraction). */
const GAIN_JITTER = 0.1;
/** Pan range for events at the arena edges. */
const PAN_WIDTH = 0.4;
/** Arena width in world units (= ARENA_W in sim/types; a test keeps them equal). */
export const ARENA_WIDTH = 32;
/** Global voice cap, all SFX. */
export const MAX_VOICES = 24;
/** Aggregation window for critter spam, seconds (widened to the sound's own minIntervalMs if larger). */
export const AGG_WINDOW = 0.05;
/** Count scaling of an aggregated voice: per doubling of the merged count, capped. */
const AGG_ST_PER_DOUBLING = 0.35;
const AGG_ST_MAX = 1.2;
const AGG_DB_PER_DOUBLING = 1.2;
const AGG_DB_MAX = 3.5;
/** Ducking under big moments (game-feel.md §4). */
export const DUCK = { musicDb: -5, critterDb: -3, attack: 0.03, hold: 0.35, release: 0.4 } as const;
/** Master bus compressor acting as a gentle limiter. */
const LIMITER = { threshold: -9, knee: 6, ratio: 12, attack: 0.002, release: 0.18 } as const;
/** Safety soft clip after the compressor: linear below KNEE, tanh-saturating toward CEILING (-1 dBFS). */
export const CLIP_CEILING = 0.891;
const CLIP_KNEE = 0.63;
/** Fade used when a voice is stolen, seconds (time constant). */
const STEAL_TAU = 0.008;
/** Crown tension tick: interval shrinks and pitch rises as the holder nears the win. */
const CROWN_TICK = { slow: 1.0, fast: 0.4, stMax: 3 } as const;
/** Seconds of Crown hold that win (= tuning.match.crownHold; a test keeps them equal). */
export const CROWN_HOLD = 10;
/** Extra music level per state (the Crown loop is pushed a little: escalation). */
const MUSIC_STATE_DB: Record<MusicId, number> = { menu: 0, battle: 0, crown: 1.5, victory: 0, defeat: 0 };

export type MusicState = 'none' | MusicId;
interface Fade { out: number; in: number; delay: number }
const DEFAULT_FADE: Fade = { out: 1.2, in: 1.2, delay: 0 };
/**
 * Crossfades by transition. battle>crown is the escalation: the old loop drops fast under the
 * crown_open sting (which also ducks music), the Crown loop punches in after it.
 */
const FADES: Partial<Record<`${MusicState}>${MusicState}`, Fade>> = {
  'menu>battle': { out: 0.8, in: 0.5, delay: 0.2 },
  'battle>crown': { out: 0.5, in: 0.25, delay: 0.35 },
  'crown>battle': { out: 1.5, in: 1.5, delay: 0 },
  'battle>victory': { out: 0.5, in: 0.1, delay: 0.9 },
  'crown>victory': { out: 0.5, in: 0.1, delay: 0.9 },
  'battle>defeat': { out: 0.5, in: 0.1, delay: 1.3 },
  'crown>defeat': { out: 0.5, in: 0.1, delay: 1.3 },
};

/** The part of World the mixer reads (crown tension). */
export type AudioWorldView = Pick<World, 'phase' | 'crown'>;

/** Where decoded audio comes from. Missing entries just stay silent. */
export interface SoundBank {
  /** Decoded variants of a sound, aligned with SOUNDS[id].files (undefined where decoding failed). */
  sfx(id: SoundId): readonly (AudioBuffer | undefined)[] | undefined;
  music(id: MusicId): AudioBuffer | undefined;
}

export type PlayResult = 'played' | 'merged' | 'interval' | 'capped' | 'missing';

export interface MixerStats {
  played: number; merged: number; interval: number; capped: number; missing: number; stolen: number;
  /** Most voices alive at once. */
  peakVoices: number;
  ducks: number;
}

interface Voice {
  id: SoundId;
  src: AudioBufferSourceNode;
  gain: GainNode;
  start: number;
  end: number;
  level: number;
  priority: number;
}

interface Agg { next: number; count: number; best: Cue | null; bestRank: number }

interface Track { id: MusicId; src: AudioBufferSourceNode; gain: GainNode }

export interface MixerOptions {
  random?: () => number;
  /** false removes the safety soft clip (the lab measures what the compressor alone does). */
  softClip?: boolean;
}

const dbToLin = (db: number) => Math.pow(10, db / 20);

/** y = x below the knee, then a tanh bend that never exceeds the ceiling. Odd-symmetric. */
export function softClipCurve(n = 4097): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  const room = CLIP_CEILING - CLIP_KNEE;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= CLIP_KNEE ? a : CLIP_KNEE + room * Math.tanh((a - CLIP_KNEE) / room);
    c[i] = x < 0 ? -y : y;
  }
  return c;
}

export class Mixer {
  readonly stats: MixerStats = { played: 0, merged: 0, interval: 0, capped: 0, missing: 0, stolen: 0, peakVoices: 0, ducks: 0 };
  private readonly rnd: () => number;
  private readonly musicBus: GainNode;
  private readonly musicDuck: GainNode;
  private readonly sfxBus: GainNode;
  private readonly critterBus: GainNode;
  private readonly master: GainNode;
  private readonly mute: GainNode;
  private readonly hasPanner: boolean;
  private readonly voices: Voice[] = [];
  private readonly lastStart = new Map<SoundId, number>();
  private readonly lastVariant = new Map<SoundId, number>();
  private readonly agg = new Map<AggGroup, Agg>();
  private musicState: MusicState = 'none';
  private track: Track | null = null;
  private pendingMusicAt = 0;
  /** Crown hold last seen; null until the first world arrives (the first sighting is a baseline, not a gain). */
  private crownPrev: [number, number] | null = null;
  private crownNext = 0;

  constructor(private readonly ctx: BaseAudioContext, private readonly bank: SoundBank, opts: MixerOptions = {}) {
    this.rnd = opts.random ?? Math.random;
    this.hasPanner = typeof ctx.createStereoPanner === 'function';

    const sum = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = LIMITER.threshold;
    comp.knee.value = LIMITER.knee;
    comp.ratio.value = LIMITER.ratio;
    comp.attack.value = LIMITER.attack;
    comp.release.value = LIMITER.release;
    sum.connect(comp);
    let tail: AudioNode = comp;
    if (opts.softClip !== false) {
      const clip = ctx.createWaveShaper();
      clip.curve = softClipCurve();
      clip.oversample = '2x';
      comp.connect(clip);
      tail = clip;
    }
    this.master = ctx.createGain();
    this.mute = ctx.createGain();
    tail.connect(this.master);
    this.master.connect(this.mute);
    this.mute.connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = dbToLin(MUSIC_BUS_DB);
    this.musicDuck = ctx.createGain();
    this.musicDuck.connect(this.musicBus);
    this.musicBus.connect(sum);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = dbToLin(SFX_BUS_DB);
    this.sfxBus.connect(sum);
    this.critterBus = ctx.createGain();
    this.critterBus.gain.value = dbToLin(CRITTER_BUS_DB);
    this.critterBus.connect(this.sfxBus);
  }

  /** Volumes are 0..1 multipliers on top of the tuned bus levels. */
  setVolumes(v: { master?: number; music?: number; sfx?: number }, now: number): void {
    if (v.master !== undefined) smooth(this.master.gain, clamp01(v.master), now);
    if (v.music !== undefined) smooth(this.musicBus.gain, clamp01(v.music) * dbToLin(MUSIC_BUS_DB), now);
    if (v.sfx !== undefined) smooth(this.sfxBus.gain, clamp01(v.sfx) * dbToLin(SFX_BUS_DB), now);
  }

  setMuted(m: boolean, now: number): void {
    smooth(this.mute.gain, m ? 0 : 1, now);
  }

  /** React to one step's (or one frame's) events. */
  onEvents(events: readonly SimEvent[], world: AudioWorldView, local: Team, now: number): void {
    for (const e of events) {
      for (const cue of cuesFor(e, local)) this.cue(cue, local, now);
    }
    this.crownTension(world, local, now);
  }

  /** Housekeeping: forget finished voices. Envelopes themselves are scheduled on AudioParams. */
  update(now: number): void {
    this.prune(now);
  }

  /** Play one cue: aggregation, ducking, then a voice. */
  cue(c: Cue, local: Team, now: number): PlayResult {
    if (c.duck) this.duck(now);
    if (!c.agg) return this.play(c, local, now, 1);
    let a = this.agg.get(c.agg);
    if (!a) { a = { next: -Infinity, count: 0, best: null, bestRank: -1 }; this.agg.set(c.agg, a); }
    a.count += c.count ?? 1;
    // The merged voice speaks for the most important cue in the window: a hit over a plop, ours over theirs.
    const rank = (c.id === 'land_hit' ? 2 : 0) + (c.team === undefined || c.team === local ? 1 : 0);
    if (rank > a.bestRank || !a.best) { a.best = c; a.bestRank = rank; }
    if (now < a.next) { this.stats.merged++; return 'merged'; }
    const best: Cue = a.best ?? c;
    const pick = best === c ? c : { ...best, x: c.x };
    const n = a.count;
    a.count = 0; a.best = null; a.bestRank = -1;
    a.next = now + Math.max(AGG_WINDOW, SOUNDS[pick.id].minIntervalMs / 1000);
    return this.play(pick, local, now, n);
  }

  /** Start a voice now. `n` = how many things it stands for (count scaling). */
  play(c: Cue, local: Team, now: number, n: number): PlayResult {
    const def = SOUNDS[c.id];
    const all = this.bank.sfx(c.id);
    const variant = def && all ? this.pickVariant(c.id, all) : -1;
    if (variant < 0) { this.stats.missing++; return 'missing'; }
    const buf = all![variant]!;

    const last = this.lastStart.get(c.id);
    if (last !== undefined && now - last < def.minIntervalMs / 1000 - 1e-9) { this.stats.interval++; return 'interval'; }

    this.prune(now);
    let sameId = 0, oldest: Voice | null = null;
    for (const v of this.voices) if (v.id === c.id) { sameId++; if (!oldest || v.start < oldest.start) oldest = v; }
    if (sameId >= def.maxVoices) {
      if (def.priority === 1 || !oldest) { this.stats.capped++; return 'capped'; }
      this.steal(oldest, now);
    }
    if (this.voices.length >= MAX_VOICES) {
      const victim = this.weakest(now);
      if (!victim || victim.priority > def.priority) { this.stats.capped++; return 'capped'; }
      this.steal(victim, now);
    }

    // Scale by how many more things this voice stands for than a lone cue of its kind (a volley of 3 = baseline).
    const ratio = n / (c.count ?? 1);
    const doublings = ratio > 1 ? Math.log2(ratio) : 0;
    const aggSt = Math.min(AGG_ST_MAX, doublings * AGG_ST_PER_DOUBLING);
    const aggDb = Math.min(AGG_DB_MAX, doublings * AGG_DB_PER_DOUBLING);
    const sideDb = c.team !== undefined && c.team !== local ? RIVAL_DB : 0;
    const level = def.gain * dbToLin((c.db ?? 0) + sideDb + aggDb) * (1 + (this.rnd() * 2 - 1) * GAIN_JITTER);
    const st = (c.st ?? 0) + aggSt + (this.rnd() * 2 - 1) * def.pitchVar;
    const rate = Math.pow(2, st / 12);

    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = level;
    src.connect(gain);
    const bus = def.family === 'critter' ? this.critterBus : this.sfxBus;
    if (this.hasPanner && c.x !== undefined) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = panFor(c.x);
      gain.connect(pan);
      pan.connect(bus);
    } else {
      gain.connect(bus);
    }
    src.start(now);
    const v: Voice = { id: c.id, src, gain, start: now, end: now + buf.duration / rate, level, priority: def.priority };
    this.voices.push(v);
    this.lastStart.set(c.id, now);
    this.lastVariant.set(c.id, variant);
    this.stats.played++;
    if (this.voices.length > this.stats.peakVoices) this.stats.peakVoices = this.voices.length;
    return 'played';
  }

  /** Voices alive at `now` (after pruning). */
  activeVoices(now: number): number {
    this.prune(now);
    return this.voices.length;
  }

  /** Music: -5 dB, critter spam: -3 dB, 30 ms attack, hold, 400 ms release (setTarget reaches ~95% in 3 tau). */
  duck(now: number): void {
    this.stats.ducks++;
    envelope(this.musicDuck.gain, 1, dbToLin(DUCK.musicDb), now);
    envelope(this.critterBus.gain, dbToLin(CRITTER_BUS_DB), dbToLin(DUCK.critterDb), now);
  }

  get music(): MusicState { return this.musicState; }

  /** Bus nodes, for tests and the lab's meters. */
  get nodes() {
    return { musicBus: this.musicBus, musicDuck: this.musicDuck, sfxBus: this.sfxBus, critterBus: this.critterBus, master: this.master, mute: this.mute };
  }

  setMusic(state: MusicState, now: number): void {
    if (state === this.musicState) return;
    const fade = FADES[`${this.musicState}>${state}`] ?? DEFAULT_FADE;
    this.musicState = state;
    const old = this.track;
    this.track = null;
    if (old) {
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setTargetAtTime(0, now, fade.out / 4);
      safeStop(old.src, now + fade.out * 1.5);
    }
    this.pendingMusicAt = now + fade.delay;
    this.startMusic(now, fade);
  }

  /** Call when a music buffer finished decoding: starts it if it is the one wanted. */
  musicReady(now: number): void {
    if (!this.track && this.musicState !== 'none') this.startMusic(now, { out: 0, in: 0.8, delay: 0 });
  }

  private startMusic(now: number, fade: Fade): void {
    const id = this.musicState;
    if (id === 'none') return;
    const buf = this.bank.music(id);
    if (!buf) return; // pending: musicReady() starts it
    const def = MUSIC[id];
    const at = Math.max(now, this.pendingMusicAt);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    // The loops are sample-exact whole files (audio-verify.mjs), so the whole buffer is the loop.
    src.loop = def.loop;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(def.gain * dbToLin(MUSIC_STATE_DB[id]), at, Math.max(0.01, fade.in / 3));
    src.connect(gain);
    gain.connect(this.musicDuck);
    src.start(at);
    this.track = { id, src, gain };
  }

  /** Crown tick: derived from World because the sim has no per-second event for it. */
  private crownTension(w: AudioWorldView, local: Team, now: number): void {
    const c = w.crown;
    let holder: Team | -1 = -1;
    const p = this.crownPrev;
    if (p && (w.phase === 'crown' || w.phase === 'overtime')) {
      if (c[0] > p[0] + 1e-9) holder = 0;
      else if (c[1] > p[1] + 1e-9) holder = 1;
    }
    if (p) { p[0] = c[0]; p[1] = c[1]; } else this.crownPrev = [c[0], c[1]];
    if (holder === -1) { this.crownNext = 0; return; }
    if (now < this.crownNext) return;
    const f = Math.min(1, c[holder] / CROWN_HOLD);
    this.play({ id: 'crown_tick', team: holder, st: f * CROWN_TICK.stMax }, local, now, 1);
    this.crownNext = now + CROWN_TICK.slow + (CROWN_TICK.fast - CROWN_TICK.slow) * f;
  }

  private pickVariant(id: SoundId, all: readonly (AudioBuffer | undefined)[]): number {
    const last = this.lastVariant.get(id);
    let options = 0;
    for (let i = 0; i < all.length; i++) if (all[i] && i !== last) options++;
    if (options === 0) return all[last ?? -1] ? last! : -1; // only one variant exists
    let k = Math.floor(this.rnd() * options);
    for (let i = 0; i < all.length; i++) {
      if (!all[i] || i === last) continue;
      if (k-- === 0) return i;
    }
    return -1;
  }

  private prune(now: number): void {
    let j = 0;
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i];
      if (v.end > now) this.voices[j++] = v;
    }
    this.voices.length = j;
  }

  /** Lowest priority first, then the one with the least sound left (level x remaining fraction). */
  private weakest(now: number): Voice | null {
    let best: Voice | null = null, bestScore = Infinity;
    for (const v of this.voices) {
      const left = (v.end - now) / Math.max(1e-6, v.end - v.start);
      const score = v.priority * 10 + v.level * left;
      if (score < bestScore) { bestScore = score; best = v; }
    }
    return best;
  }

  private steal(v: Voice, now: number): void {
    const i = this.voices.indexOf(v);
    if (i >= 0) this.voices.splice(i, 1);
    this.stats.stolen++;
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setTargetAtTime(0, now, STEAL_TAU);
    } catch { /* already gone */ }
    safeStop(v.src, now + STEAL_TAU * 5);
  }
}

/** Duck `p` from its resting level `base` by the factor `by`, then return to `base`. */
function envelope(p: AudioParam, base: number, by: number, now: number): void {
  p.cancelScheduledValues(now);
  p.setTargetAtTime(base * by, now, DUCK.attack / 3);
  p.setTargetAtTime(base, now + DUCK.attack + DUCK.hold, DUCK.release / 3);
}

function smooth(p: AudioParam, v: number, now: number): void {
  p.cancelScheduledValues(now);
  p.setTargetAtTime(v, now, 0.02);
}

function safeStop(src: AudioBufferSourceNode, at: number): void {
  try { src.stop(at); } catch { /* not started or already stopped */ }
}

export function panFor(x: number): number {
  const p = ((x / ARENA_WIDTH) * 2 - 1) * PAN_WIDTH;
  return p > PAN_WIDTH ? PAN_WIDTH : p < -PAN_WIDTH ? -PAN_WIDTH : p;
}

const clamp01 = (v: number) => (v > 1 ? 1 : v < 0 || !(v === v) ? 0 : v);
