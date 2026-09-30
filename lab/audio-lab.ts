// Audio lab: audition every sound id and music state through the real engine, and render objective
// mix checks offline through the same bus/limiter graph (window.__audioLab.renderMix).
//   /lab/audio.html
import { createAudio, MUSIC, SOUNDS, type MusicState, type SoundId } from '../src/audio/index';
import { CLIP_CEILING, Mixer, type MixerStats, type SoundBank } from '../src/audio/mixer';
import { scenario, SCENARIOS, seeded, type ScenarioName } from '../src/audio/scenarios';
import type { MusicId } from '../src/audio/manifest';
import type { World } from '../src/sim/types';

const BASE = import.meta.env.BASE_URL;
const SR = 44100;
const $ = (id: string) => document.getElementById(id)!;

// ---------------------------------------------------------------- live audition
const audio = createAudio();
let unlocking: Promise<void> | null = null;
function ensure(): Promise<void> {
  unlocking ??= (async () => {
    await audio.unlock();
    await Promise.all([audio.preload('core'), audio.preload('music')]);
    status();
  })();
  return unlocking;
}
function status(extra = ''): void {
  const s = audio.state, st = audio.stats;
  $('status').textContent =
    `unlocked=${s.unlocked} core=${s.loaded.core} music=${s.loaded.music} failures=${audio.failures.length}` +
    (st ? `\nplayed=${st.played} merged=${st.merged} interval=${st.interval} capped=${st.capped} stolen=${st.stolen} peakVoices=${st.peakVoices}` : '') +
    (extra ? `\n${extra}` : '');
}

function button(parent: HTMLElement, label: string, small: string, onClick: (b: HTMLButtonElement) => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  if (small) { const s = document.createElement('small'); s.textContent = small; b.append(s); }
  b.onclick = async () => { await ensure(); onClick(b); status(); };
  parent.append(b);
  return b;
}

const musicRow = $('music');
const musicButtons: HTMLButtonElement[] = [];
for (const m of ['none', 'menu', 'battle', 'crown', 'victory', 'defeat'] as MusicState[]) {
  musicButtons.push(button(musicRow, m, '', b => {
    audio.setMusic(m);
    for (const x of musicButtons) x.classList.toggle('on', x === b);
  }));
}

const volRow = $('volumes');
for (const k of ['master', 'music', 'sfx'] as const) {
  const l = document.createElement('label');
  const r = document.createElement('input');
  r.type = 'range'; r.min = '0'; r.max = '1'; r.step = '0.05'; r.value = '1';
  r.oninput = () => audio.setVolumes({ [k]: +r.value });
  l.append(k, r);
  volRow.append(l);
}
const muteLabel = document.createElement('label');
const mute = document.createElement('input');
mute.type = 'checkbox';
mute.onchange = () => audio.setMuted(mute.checked);
muteLabel.append('mute', mute);
volRow.append(muteLabel);

const byFamily = new Map<string, SoundId[]>();
for (const id of Object.keys(SOUNDS) as SoundId[]) {
  const f = SOUNDS[id].family;
  byFamily.set(f, [...(byFamily.get(f) ?? []), id]);
}
for (const [family, ids] of byFamily) {
  const h = document.createElement('h2');
  h.textContent = family;
  const row = document.createElement('div');
  row.className = 'row';
  $('sounds').append(h, row);
  for (const id of ids) button(row, id, `x${SOUNDS[id].files.length}`, () => audio.audition(id));
}

// Live playback of a scenario stream through the engine (hear what renderMix measures).
let playing = 0;
for (const name of SCENARIOS) {
  button($('scenarios'), name, '10 s', () => {
    const sc = scenario(name);
    const id = ++playing;
    const t0 = performance.now();
    let i = 0;
    const tick = () => {
      if (id !== playing) return;
      const t = (performance.now() - t0) / 1000;
      while (i < sc.steps.length && sc.steps[i].t <= t) {
        const s = sc.steps[i++];
        if (s.music) audio.setMusic(s.music);
        audio.onEvents(s.events, s.world as World, sc.local);
      }
      audio.update(1 / 60);
      status(`scenario ${name} t=${t.toFixed(1)} s`);
      if (i < sc.steps.length) requestAnimationFrame(tick);
    };
    tick();
  });
}

// ---------------------------------------------------------------- offline mix check
const bytes = new Map<string, Promise<ArrayBuffer | null>>();
function fetchBytes(file: string): Promise<ArrayBuffer | null> {
  let p = bytes.get(file);
  if (!p) {
    p = fetch(BASE + file).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    bytes.set(file, p);
  }
  return p;
}

/** Decoded once with a 44.1 kHz offline context, then shared by every render (buffers are context-free). */
let decoded: Promise<{ sfx: Map<SoundId, (AudioBuffer | undefined)[]>; music: Map<MusicId, AudioBuffer>; failures: string[] }> | null = null;
function decodeAll() {
  decoded ??= (async () => {
    const dec = new OfflineAudioContext(1, 1, SR);
    const failures: string[] = [];
    const one = async (file: string) => {
      const b = await fetchBytes(file);
      if (!b) { failures.push(file); return undefined; }
      try { return await dec.decodeAudioData(b.slice(0)); } catch { failures.push(file); return undefined; }
    };
    const sfx = new Map<SoundId, (AudioBuffer | undefined)[]>();
    for (const id of Object.keys(SOUNDS) as SoundId[]) sfx.set(id, await Promise.all(SOUNDS[id].files.map(one)));
    const music = new Map<MusicId, AudioBuffer>();
    for (const id of Object.keys(MUSIC) as MusicId[]) { const b = await one(MUSIC[id].file); if (b) music.set(id, b); }
    return { sfx, music, failures };
  })();
  return decoded;
}

type Stem = 'mix' | 'music' | 'sfx' | 'noclip' | `family:${string}`;

async function renderStem(name: ScenarioName, stem: Stem): Promise<{ buf: AudioBuffer; stats: MixerStats }> {
  const d = await decodeAll();
  const sc = scenario(name);
  const off = new OfflineAudioContext(2, Math.round(sc.duration * SR), SR);
  const bank: SoundBank = {
    sfx: id => (stem === 'music' || (stem.startsWith('family:') && stem !== `family:${SOUNDS[id].family}`) ? undefined : d.sfx.get(id)),
    music: id => (stem === 'sfx' || stem.startsWith('family:') ? undefined : d.music.get(id)),
  };
  const mixer = new Mixer(off, bank, { random: seeded(42), softClip: stem !== 'noclip' });
  for (const s of sc.steps) {
    if (s.music) mixer.setMusic(s.music, s.t);
    mixer.onEvents(s.events, s.world, sc.local, s.t);
    mixer.update(s.t);
  }
  return { buf: await off.startRendering(), stats: { ...mixer.stats } };
}

const dB = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const r1 = (x: number) => Math.round(x * 10) / 10;

function measure(buf: AudioBuffer) {
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0, sum = 0, clipped = 0, overCeil = 0, hot = 0;
  for (let i = 0; i < L.length; i++) {
    for (const v of [L[i], R[i]]) {
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v * v;
      if (a >= 0.9999) clipped++;
      if (a > CLIP_CEILING + 1e-4) overCeil++;
      if (a > 0.63) hot++; // above the soft-clip knee: the shaper is bending these
    }
  }
  const n = L.length * 2;
  return { peakDb: r1(dB(peak)), rmsDb: r1(dB(Math.sqrt(sum / n))), clippedFrac: clipped / n, overCeilingFrac: overCeil / n, aboveKneeFrac: hot / n };
}

/** RMS in dB per 400 ms window, 100 ms hop (a rough short-term loudness, unweighted). */
function windows(buf: AudioBuffer): number[] {
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const w = Math.round(0.4 * SR), hop = Math.round(0.1 * SR);
  const out: number[] = [];
  for (let s = 0; s + w <= L.length; s += hop) {
    let sum = 0;
    for (let i = s; i < s + w; i++) sum += L[i] * L[i] + R[i] * R[i];
    out.push(dB(Math.sqrt(sum / (2 * w))));
  }
  return out;
}

const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

async function renderMix(name: ScenarioName = 'heavy', opts: { wav?: boolean; stems?: boolean; families?: boolean } = {}) {
  const t0 = performance.now();
  const mix = await renderStem(name, 'mix');
  const music = await renderStem(name, 'music');
  const sfx = await renderStem(name, 'sfx');
  const noclip = await renderStem(name, 'noclip');
  const wm = windows(music.buf), ws = windows(sfx.buf), wx = windows(mix.buf);
  // Only windows where both stems make sound (silence gives -Infinity).
  const diff = wm.map((m, i) => m - ws[i]).filter(Number.isFinite);
  const d = await decodeAll();
  const result = {
    scenario: name,
    mix: measure(mix.buf),
    compressorOnly: measure(noclip.buf),
    musicStem: measure(music.buf),
    sfxStem: measure(sfx.buf),
    shortTerm: { mixMaxDb: r1(Math.max(...wx)), mixMedianDb: r1(pct(wx, 0.5)) },
    // Music vs SFX per 400 ms window (each stem rendered alone through the same chain).
    musicMinusSfxDb: { median: r1(pct(diff, 0.5)), p10: r1(pct(diff, 0.1)), p90: r1(pct(diff, 0.9)), windowsMusicMore15dbUnder: r1(diff.filter(x => x < -15).length / diff.length) },
    voices: mix.stats,
    decodeFailures: d.failures,
    renderMs: Math.round(performance.now() - t0),
    wav: opts.wav ? wavBase64(mix.buf) : undefined,
    stems: opts.stems ? { music: wavBase64(music.buf), sfx: wavBase64(sfx.buf) } : undefined,
    // Each SFX family rendered alone (same events, same chain): who makes the stream loud.
    families: opts.families ? await familyLevels(name) : undefined,
  };
  $('mix').textContent = JSON.stringify({ ...result, wav: undefined, stems: undefined }, null, 1);
  return result;
}

async function familyLevels(name: ScenarioName) {
  const out: Record<string, { peakDb: number; rmsDb: number; played: number }> = {};
  for (const f of new Set(Object.values(SOUNDS).map(d => d.family))) {
    const r = await renderStem(name, `family:${f}`);
    const m = measure(r.buf);
    out[f] = { peakDb: m.peakDb, rmsDb: m.rmsDb, played: r.stats.played };
  }
  return out;
}

/** 16-bit stereo WAV as base64, so a headless run can hand the render to ffmpeg for LUFS / a listener. */
function wavBase64(buf: AudioBuffer): string {
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, SR, true);
  out.setUint32(28, SR * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    out.setInt16(44 + i * 4, Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), true);
    out.setInt16(46 + i * 4, Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), true);
  }
  const bytesArr = new Uint8Array(out.buffer);
  let s = '';
  for (let i = 0; i < bytesArr.length; i += 0x8000) s += String.fromCharCode(...bytesArr.subarray(i, i + 0x8000));
  return btoa(s);
}

(window as unknown as { __audioLab: unknown }).__audioLab = { renderMix, audio, scenario };
status();
