import { describe, expect, it } from 'vitest';
import type { SimEvent, World } from '../sim/types';
import { MUSIC, SOUNDS } from './manifest';
import { createAudio, type AudioOptions } from './engine';
import { asCtx, FakeContext, type FakeContextOptions } from './testing';

const WORLD = { phase: 'open', crown: [0, 0] } as unknown as World;
const THROW: SimEvent = { type: 'throw', team: 0, critter: 0, x: 5, y: 5, tx: 9, ty: 5, count: 3 };
const TOTAL_SFX = Object.values(SOUNDS).reduce((n, d) => n + d.files.length, 0);
const tick = () => new Promise(r => setTimeout(r, 0));

function setup(o: FakeContextOptions & { fetchFails?: boolean; noContext?: boolean } = {}) {
  const live = new FakeContext(o);
  const decoder = new FakeContext(o);
  const fetched: string[] = [];
  const opts: AudioOptions = {
    basePath: '/base/',
    createContext: () => { if (o.noContext) throw new Error('no Web Audio'); return asCtx(live); },
    createDecoder: () => { if (o.noContext) throw new Error('no Web Audio'); return asCtx(decoder); },
    fetchBytes: async url => { fetched.push(url); if (o.fetchFails) throw new Error('404'); return new ArrayBuffer(8); },
    random: () => 0.5,
  };
  return { audio: createAudio(opts), live, decoder, fetched };
}

describe('engine lifecycle', () => {
  it('preloads every SFX before the gesture, then plays after unlock', async () => {
    const { audio, live, decoder, fetched } = setup();
    await audio.preload('core');
    expect(audio.state.loaded.core).toBe(true);
    expect(fetched.length).toBe(TOTAL_SFX);
    expect(fetched[0].startsWith('/base/audio/sfx/')).toBe(true);
    expect(decoder.decodes).toBe(TOTAL_SFX); // decoded without the live context (no gesture needed)
    expect(audio.state.unlocked).toBe(false);
    audio.onEvents([THROW], WORLD, 0); // before unlock: ignored, no throw
    await audio.unlock();
    expect(audio.state.unlocked).toBe(true);
    expect(live.state).toBe('running');
    const before = live.voices.length;
    audio.onEvents([THROW], WORLD, 0);
    audio.ui('click');
    expect(live.voices.length).toBe(before + 2);
  });

  it('music: fetches bytes only, decodes the current track and its escalation, evicts the rest', async () => {
    const { audio, live } = setup({ bufferDuration: 50 });
    await audio.preload('music');
    expect(audio.state.loaded.music).toBe(true);
    expect(live.decodes).toBe(0);
    await audio.unlock();
    audio.setMusic('battle');
    await tick();
    expect(live.decodes).toBe(2); // battle + crown
    const loops = () => live.sources.filter(s => s.loop);
    expect(loops().length).toBe(1);
    audio.setMusic('crown'); // already decoded: no new decode, starts right away
    expect(live.decodes).toBe(2);
    expect(loops().length).toBe(2);
    audio.setMusic('menu');
    await tick();
    expect(live.decodes).toBe(3);
    audio.setMusic('battle'); // battle was evicted while in the menu
    await tick();
    expect(live.decodes).toBe(5);
  });

  it('setMusic before unlock starts the music once unlocked and decoded', async () => {
    const { audio, live } = setup({ bufferDuration: 50 });
    audio.setMusic('menu');
    await audio.preload('music');
    await audio.unlock();
    await tick();
    expect(live.sources.filter(s => s.loop && s.startedAt !== null).length).toBe(1);
  });

  it('volumes and mute set before unlock are applied to the graph', async () => {
    const { audio, live } = setup();
    audio.setVolumes({ master: 0.5 });
    audio.setMuted(true);
    await audio.unlock();
    const values = live.gains.map(g => (g.gain as unknown as { valueAt(t: number): number }).valueAt(1));
    expect(values.some(v => Math.abs(v - 0.5) < 1e-3)).toBe(true);
    expect(values.some(v => Math.abs(v) < 1e-3)).toBe(true);
  });
});

describe('fail silent', () => {
  it('no Web Audio at all: every call is a quiet no-op', async () => {
    const { audio } = setup({ noContext: true });
    await expect(audio.unlock()).resolves.toBeUndefined();
    await expect(audio.preload('core')).resolves.toBeUndefined();
    await expect(audio.preload('music')).resolves.toBeUndefined();
    expect(audio.state.unlocked).toBe(false);
    expect(() => {
      audio.onEvents([THROW], WORLD, 0);
      audio.ui('error');
      audio.setMusic('battle');
      audio.setVolumes({ music: 0.3 });
      audio.setMuted(true);
      audio.update(1 / 60);
    }).not.toThrow();
  });

  it('every fetch fails: preload finishes, failures are listed, playing is silent', async () => {
    const { audio, live } = setup({ fetchFails: true });
    await audio.preload('core');
    await audio.preload('music');
    await audio.unlock();
    expect(audio.state.loaded.core).toBe(true);
    expect(audio.failures.length).toBe(TOTAL_SFX + Object.keys(MUSIC).length);
    audio.onEvents([THROW], WORLD, 0);
    audio.setMusic('battle');
    expect(live.voices.length).toBe(0);
    expect(audio.stats!.missing).toBeGreaterThan(0);
  });

  it('every decode fails: same, silent', async () => {
    const { audio, live } = setup({ failDecode: true });
    await audio.preload('core');
    await audio.unlock();
    await audio.preload('music');
    audio.setMusic('battle');
    await tick();
    audio.onEvents([THROW], WORLD, 0);
    expect(live.voices.length).toBe(0);
    expect(live.sources.filter(s => s.loop).length).toBe(0);
  });

  it('a malformed event or world does not escape', async () => {
    const { audio } = setup();
    await audio.preload('core');
    await audio.unlock();
    expect(() => audio.onEvents([{ type: 'nonsense' } as unknown as SimEvent], WORLD, 0)).not.toThrow();
    expect(() => audio.onEvents([THROW], null as unknown as World, 0)).not.toThrow();
  });
});
