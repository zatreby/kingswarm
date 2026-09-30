import { describe, expect, it } from 'vitest';
import type { SimEvent, Team } from '../sim/types';
import { MUSIC, SOUNDS, type MusicId, type SoundId } from './manifest';
import { AGG_WINDOW, CRITTER_BUS_DB, DUCK, MAX_VOICES, Mixer, panFor, softClipCurve, CLIP_CEILING, type AudioWorldView, type SoundBank } from './mixer';
import { asBuffer, asCtx, FakeBuffer, FakeContext, FakeGain, FakeSource } from './testing';

const noVariance = () => 0.5; // jitter and pitch spread become exactly 0
const db = (lin: number) => 20 * Math.log10(lin);
const WORLD: AudioWorldView = { phase: 'open', crown: [0, 0] };

/** A bank where every variant is its own buffer of `dur` seconds (identity tells variants apart). */
function makeBank(dur = 0.3, musicDur = 60) {
  const sfx = new Map<SoundId, AudioBuffer[]>();
  for (const id of Object.keys(SOUNDS) as SoundId[]) sfx.set(id, SOUNDS[id].files.map(() => asBuffer(new FakeBuffer(dur))));
  const music = new Map<MusicId, AudioBuffer>();
  for (const id of Object.keys(MUSIC) as MusicId[]) music.set(id, asBuffer(new FakeBuffer(musicDur, 44100, 2)));
  const bank: SoundBank = { sfx: id => sfx.get(id), music: id => music.get(id) };
  return { bank, sfx, music };
}

function setup(o: { dur?: number; random?: () => number; noPanner?: boolean } = {}) {
  const ctx = new FakeContext({ noPanner: o.noPanner });
  const { bank, sfx } = makeBank(o.dur);
  const mixer = new Mixer(asCtx(ctx), bank, { random: o.random ?? noVariance });
  return { ctx, mixer, sfx };
}

/** Gain node fed by a voice source. */
const gainOf = (s: FakeSource) => s.outputs[0] as FakeGain;
const voiceSources = (ctx: FakeContext) => ctx.sources.filter(s => !s.loop);

const throwEv = (team: Team, x = 10): SimEvent => ({ type: 'throw', team, critter: 0, x, y: 9, tx: x + 5, ty: 9, count: 3 });
const landEv = (team: Team, hits: number): SimEvent => ({ type: 'land', team, critter: 0, kind: 'critter', x: 16, y: 9, hits, hitHero: false });

describe('voice management', () => {
  it('caps voices per id: a normal-priority sound steals its oldest voice', () => {
    const { ctx, mixer } = setup({ dur: 5 });
    const max = SOUNDS.king_hit.maxVoices;
    for (let i = 0; i < max + 3; i++) expect(mixer.play({ id: 'king_hit' }, 0, i * 0.2, 1)).toBe('played');
    expect(mixer.activeVoices(1.0)).toBe(max);
    // the stolen ones were faded and stopped
    const stopped = voiceSources(ctx).filter(s => s.stoppedAt !== null);
    expect(stopped.length).toBe(3);
  });

  it('caps voices per id: a droppable sound is dropped instead', () => {
    const { mixer } = setup({ dur: 5 });
    const def = SOUNDS.land_soft;
    expect(def.priority).toBe(1);
    const results = Array.from({ length: def.maxVoices + 2 }, (_, i) => mixer.play({ id: 'land_soft' }, 0, i * 0.1, 1));
    expect(results.filter(r => r === 'played').length).toBe(def.maxVoices);
    expect(results.slice(-2)).toEqual(['capped', 'capped']);
  });

  it(`never exceeds the global cap of ${MAX_VOICES}; important sounds steal the weakest`, () => {
    const { mixer } = setup({ dur: 10 });
    const ids = Object.keys(SOUNDS) as SoundId[];
    let t = 0;
    for (let round = 0; round < 4; round++) for (const id of ids) { mixer.play({ id }, 0, t, 1); t += 0.002; }
    expect(mixer.activeVoices(t)).toBe(MAX_VOICES);
    expect(mixer.stats.peakVoices).toBe(MAX_VOICES);
    // pool full of long voices: a priority-3 sound still gets in, a priority-1 sound does not
    t += 2;
    expect(mixer.play({ id: 'king_down' }, 0, t, 1)).toBe('played');
    expect(mixer.play({ id: 'hatch' }, 0, t, 1)).toBe('capped');
    expect(mixer.activeVoices(t)).toBe(MAX_VOICES);
  });

  it('enforces minIntervalMs per id', () => {
    const { mixer } = setup();
    const gap = SOUNDS.king_hit.minIntervalMs / 1000;
    expect(mixer.play({ id: 'king_hit' }, 0, 1, 1)).toBe('played');
    expect(mixer.play({ id: 'king_hit' }, 0, 1 + gap * 0.5, 1)).toBe('interval');
    expect(mixer.play({ id: 'king_hit' }, 0, 1 + gap, 1)).toBe('played');
  });

  it('never plays the same variant twice in a row', () => {
    const { ctx, mixer } = setup({ random: Math.random });
    for (let i = 0; i < 300; i++) mixer.play({ id: 'land_hit' }, 0, i, 1);
    const bufs = voiceSources(ctx).map(s => s.buffer);
    expect(bufs.length).toBe(300);
    for (let i = 1; i < bufs.length; i++) expect(bufs[i]).not.toBe(bufs[i - 1]);
    // and all variants get used
    expect(new Set(bufs).size).toBe(SOUNDS.land_hit.files.length);
  });

  it('a one-variant sound still plays every time', () => {
    const { mixer } = setup();
    expect(mixer.play({ id: 'victory_sting' }, 0, 0, 1)).toBe('played');
    expect(mixer.play({ id: 'victory_sting' }, 0, 5, 1)).toBe('played');
  });

  it('varies pitch within +/- pitchVar and gain within +/-10%', () => {
    const { ctx, mixer } = setup({ random: Math.random });
    for (let i = 0; i < 200; i++) mixer.play({ id: 'throw' }, 0, i, 1);
    const pv = SOUNDS.throw.pitchVar;
    const rates = voiceSources(ctx).map(s => s.playbackRate.value);
    const gains = voiceSources(ctx).map(s => gainOf(s).gain.value);
    for (const r of rates) expect(Math.abs(12 * Math.log2(r))).toBeLessThanOrEqual(pv + 1e-9);
    for (const g of gains) expect(Math.abs(g - 1)).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(Math.max(...rates) - Math.min(...rates)).toBeGreaterThan(0.05);
  });

  it('plays the local side louder than the rival and pans by x', () => {
    const { ctx, mixer } = setup();
    mixer.play({ id: 'dash', team: 0, x: 0 }, 0, 0, 1);
    mixer.play({ id: 'dash', team: 1, x: 32 }, 0, 1, 1);
    const [mine, theirs] = voiceSources(ctx).map(s => gainOf(s).gain.value);
    expect(db(mine) - db(theirs)).toBeCloseTo(3, 5);
    expect(ctx.panners.map(p => p.pan.value)).toEqual([-0.4, 0.4]);
    expect(panFor(16)).toBeCloseTo(0, 9);
    expect(panFor(-100)).toBe(-0.4);
  });
});

describe('aggregation of the swarm gun', () => {
  it('turns 30 throws in one second into one bounded, even stream', () => {
    const { ctx, mixer } = setup();
    for (let i = 0; i < 30; i++) {
      const t = i / 30;
      mixer.onEvents([throwEv((i % 2) as Team)], WORLD, 0, t);
    }
    const starts = voiceSources(ctx).map(s => s.startedAt!);
    const window = Math.max(AGG_WINDOW, SOUNDS.throw.minIntervalMs / 1000);
    expect(starts.length).toBeLessThanOrEqual(Math.ceil(1 / window) + 1);
    expect(starts.length).toBeGreaterThanOrEqual(6); // still reads as a stream, not a trickle
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(AGG_WINDOW - 1e-9);
    expect(mixer.stats.merged).toBe(30 - starts.length);
  });

  it('scales a merged voice up slightly with the count, within limits', () => {
    const { ctx, mixer } = setup();
    mixer.onEvents([throwEv(0)], WORLD, 0, 0);           // alone: count 3 (one volley)
    for (let i = 0; i < 20; i++) mixer.onEvents([throwEv(0)], WORLD, 0, 0.001 * (i + 1)); // merged
    mixer.onEvents([throwEv(0)], WORLD, 0, 1);           // speaks for 21 volleys
    const [a, b] = voiceSources(ctx);
    const dDb = db(gainOf(b).gain.value) - db(gainOf(a).gain.value);
    const dSt = 12 * Math.log2(b.playbackRate.value / a.playbackRate.value);
    expect(dDb).toBeGreaterThan(0.5);
    expect(dDb).toBeLessThanOrEqual(3.5);
    expect(dSt).toBeGreaterThan(0.1);
    expect(dSt).toBeLessThanOrEqual(1.2);
  });

  it('merges landings of both teams: one voice per window, a hit wins over a plop', () => {
    const { ctx, mixer } = setup();
    // 46 landings a second (both teams at full fire rate), for 2 s
    for (let i = 0; i < 92; i++) mixer.onEvents([landEv((i % 2) as Team, i % 5 === 0 ? 1 : 0)], WORLD, 0, i / 46);
    const voices = voiceSources(ctx);
    expect(voices.length).toBeLessThanOrEqual(2 / AGG_WINDOW + 1);
    const starts = voices.map(s => s.startedAt!);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(AGG_WINDOW - 1e-9);
  });

  it('keeps separate families independent (throws do not block landings)', () => {
    const { ctx, mixer } = setup();
    mixer.onEvents([throwEv(0), landEv(1, 1)], WORLD, 0, 0);
    expect(voiceSources(ctx).length).toBe(2);
  });
});

describe('ducking', () => {
  it('ducks music ~5 dB with a 30 ms attack and a 400 ms release on king down', () => {
    const { mixer } = setup();
    const duck = mixer.nodes.musicDuck.gain as unknown as { valueAt(t: number): number };
    const t0 = 2;
    mixer.onEvents([{ type: 'heroDown', team: 1, by: 0, x: 10, y: 5 }], WORLD, 0, t0);
    expect(db(duck.valueAt(t0 - 0.01))).toBeCloseTo(0, 3);
    expect(db(duck.valueAt(t0 + DUCK.attack))).toBeLessThan(DUCK.musicDb + 0.5);
    expect(db(duck.valueAt(t0 + DUCK.attack + DUCK.hold))).toBeCloseTo(DUCK.musicDb, 1);
    expect(db(duck.valueAt(t0 + DUCK.attack + DUCK.hold + DUCK.release))).toBeGreaterThan(-0.5);
    const critters = mixer.nodes.critterBus.gain as unknown as { valueAt(t: number): number };
    expect(db(critters.valueAt(t0 + 0.1)) - db(critters.valueAt(t0 - 0.01))).toBeCloseTo(DUCK.critterDb, 1);
    expect(db(critters.valueAt(t0 + 2))).toBeCloseTo(CRITTER_BUS_DB, 1); // back to its resting level
  });

  it('re-triggering during a duck extends it without a jump', () => {
    const { mixer } = setup();
    const duck = mixer.nodes.musicDuck.gain as unknown as { valueAt(t: number): number };
    mixer.onEvents([{ type: 'crownOpen' }], WORLD, 0, 1);
    const before = duck.valueAt(1.5);
    mixer.onEvents([{ type: 'capture', team: 0, prev: 1, building: 3, kind: 'hut', x: 5, y: 5 }], WORLD, 0, 1.5);
    expect(duck.valueAt(1.5)).toBeCloseTo(before, 6);
    expect(db(duck.valueAt(1.5 + DUCK.attack + DUCK.hold))).toBeCloseTo(DUCK.musicDb, 1);
  });
});

describe('music', () => {
  it('crossfades, and battle -> crown is a quick escalation', () => {
    const { ctx, mixer } = setup();
    mixer.setMusic('battle', 0);
    const battle = ctx.sources.find(s => s.loop)!;
    expect(battle.startedAt).toBeGreaterThanOrEqual(0);
    mixer.setMusic('crown', 30);
    const crown = ctx.sources.filter(s => s.loop)[1];
    expect(battle.stoppedAt).toBeGreaterThan(30);
    expect(battle.stoppedAt).toBeLessThan(31.5);
    expect(crown.startedAt).toBeGreaterThanOrEqual(30);
    expect(crown.startedAt).toBeLessThan(30.5);
    const g = gainOf(crown).gain as unknown as { valueAt(t: number): number };
    const gb = gainOf(battle).gain as unknown as { valueAt(t: number): number };
    expect(db(g.valueAt(31.5))).toBeGreaterThan(db(gb.valueAt(29)) + 1); // crown loop sits a bit hotter
    expect(gb.valueAt(31)).toBeLessThan(0.05);
  });

  it('victory is a one-shot, none stops everything, same state is a no-op', () => {
    const { ctx, mixer } = setup();
    mixer.setMusic('battle', 0);
    mixer.setMusic('battle', 1);
    expect(ctx.sources.filter(s => s.startedAt !== null).length).toBe(1);
    mixer.setMusic('victory', 5);
    const v = ctx.sources[ctx.sources.length - 1];
    expect(v.loop).toBe(false);
    mixer.setMusic('none', 20);
    expect(v.stoppedAt).toBeGreaterThan(20);
  });
});

describe('crown tension tick', () => {
  it('ticks while a side gains Crown hold, faster and higher near the win', () => {
    const { ctx, mixer } = setup();
    const w: AudioWorldView = { phase: 'crown', crown: [0, 0] };
    for (let i = 0; i <= 60 * 9; i++) {
      w.crown = [i / 60, 0];
      mixer.onEvents([], w, 0, i / 60);
    }
    const ticks = voiceSources(ctx);
    expect(ticks.length).toBeGreaterThan(9);
    const gaps = ticks.slice(1).map((s, i) => s.startedAt! - ticks[i].startedAt!);
    expect(gaps[gaps.length - 1]).toBeLessThan(gaps[0]);
    expect(ticks[ticks.length - 1].playbackRate.value).toBeGreaterThan(ticks[0].playbackRate.value);
  });

  it('is silent when nobody gains hold, or before the Crown opens', () => {
    const { ctx, mixer } = setup();
    for (let i = 0; i < 120; i++) mixer.onEvents([], { phase: 'crown', crown: [3, 0] }, 0, i / 60);
    for (let i = 0; i < 120; i++) mixer.onEvents([], { phase: 'open', crown: [i, 0] }, 0, 2 + i / 60);
    expect(voiceSources(ctx).length).toBe(0);
  });
});

describe('graph', () => {
  it('works without a StereoPanner (old Safari)', () => {
    const { ctx, mixer } = setup({ noPanner: true });
    expect(mixer.play({ id: 'dash', x: 3 }, 0, 0, 1)).toBe('played');
    expect(ctx.panners.length).toBe(0);
  });

  it('stays silent for a sound whose files failed to decode', () => {
    const ctx = new FakeContext();
    const bank: SoundBank = { sfx: () => [undefined, undefined], music: () => undefined };
    const mixer = new Mixer(asCtx(ctx), bank);
    expect(mixer.play({ id: 'throw' }, 0, 0, 1)).toBe('missing');
    mixer.setMusic('battle', 0);
    expect(ctx.sources.length).toBe(0);
  });

  it('soft clip curve is linear at low level and never exceeds -1 dBFS', () => {
    const c = softClipCurve();
    const mid = (c.length - 1) / 2;
    expect(c[mid]).toBe(0);
    expect(c[mid + 100] / ((100 / mid))).toBeCloseTo(1, 5);
    for (const v of c) expect(Math.abs(v)).toBeLessThanOrEqual(CLIP_CEILING);
    expect(c[0]).toBeCloseTo(-c[c.length - 1], 9);
  });
});

describe('voice budget under the heavy scenario (both Kings firing non-stop)', () => {
  it('stays inside the global cap with a bounded start rate', async () => {
    const { scenario } = await import('./scenarios');
    const sc = scenario('heavy');
    const ctx = new FakeContext();
    // real-ish lengths: critter sounds are short, so the cap is about starts per second, not overlap
    const { bank, sfx } = makeBank(0.2);
    const idOf = new Map<unknown, SoundId>();
    for (const [id, bufs] of sfx) for (const b of bufs) idOf.set(b, id);
    const mixer = new Mixer(asCtx(ctx), bank, { random: Math.random });
    let events = 0;
    for (const s of sc.steps) { if (s.music) mixer.setMusic(s.music, s.t); mixer.onEvents(s.events, s.world, sc.local, s.t); events += s.events.length; }
    const perSec = mixer.stats.played / sc.duration;
    expect(mixer.stats.peakVoices).toBeLessThanOrEqual(MAX_VOICES);
    expect(perSec).toBeLessThan(60);
    expect(events / sc.duration).toBeGreaterThan(60); // the stream really is heavy
    // every big moment made it through the spam
    const played = new Set(voiceSources(ctx).map(s => idOf.get(s.buffer)));
    for (const id of ['king_down', 'capture', 'capture_lost', 'explode', 'freeze', 'stomp', 'kingscall', 'rampage', 'turret_place'] as const) expect(played, id).toContain(id);
    console.log(`heavy: ${(events / sc.duration).toFixed(0)} events/s -> ${perSec.toFixed(1)} voice starts/s, peak ${mixer.stats.peakVoices} voices`, mixer.stats);
  });
});
