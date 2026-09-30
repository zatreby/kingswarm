#!/usr/bin/env node
// Build the shipped sound set from assets-src/audio (see audio-plan.mjs) into public/audio/**,
// and regenerate src/audio/manifest.ts and licenses/audio.md from the same plan.
//   node tools/assets/audio-build.mjs [--only id,id] [--sfx] [--music] [--no-docs]
// Usually run through tools/assets/audio-build.sh. Works on disk (.cache/audio/tmp), never /tmp.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, decode, loudness, onsetEnvelope, probe } from './audio-lib.mjs';
import { integrated } from './audio-music-probe.mjs';
import {
  ROOT, DIRS, PACKS, FAMILY_TARGET, SFX_PEAK_CEILING, SOUNDS, MUSIC, MUSIC_LUFS, MUSIC_TP, MUSIC_Q, SFX_Q, META, MUSIC_META,
} from './audio-plan.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(repo);
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const doSfx = args.includes('--sfx') || !args.includes('--music');
const doMusic = args.includes('--music') || !args.includes('--sfx');
const docs = !args.includes('--no-docs') && !only;
const TMP = '.cache/audio/tmp';
const DATE = '2026-09-30';
mkdirSync(TMP, { recursive: true });

const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));
const lin = (d) => 10 ** (d / 20);

function encode(pcm, channels, q, out) {
  mkdirSync(dirname(out), { recursive: true });
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', String(channels), '-i', 'pipe:0',
    '-c:a', 'libvorbis', '-q:a', String(q), '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out],
  { input: Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength), maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`encode failed: ${r.stderr}`);
}
function writeRaw(pcm, name) {
  const f = join(TMP, name);
  writeFileSync(f, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  return f;
}
const LIMIT_DB = 4; // most the soft limiter may take off a peak
// y = c * tanh(x / c) with c solved so the loudest sample lands exactly on the ceiling.
function softLimit(x, ceilLin) {
  const pk = peakOf(x);
  let lo = ceilLin, hi = 1e3;
  for (let i = 0; i < 60; i++) { const c = (lo + hi) / 2; if (c * Math.tanh(pk / c) > ceilLin) hi = c; else lo = c; }
  const c = hi;
  return x.map((v) => c * Math.tanh(v / c));
}
const peakOf = (x) => { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); return p; };

// ---- SFX --------------------------------------------------------------------------------------
const onsetCache = new Map();
function resolveSrc(s) {
  const [k, ...rest] = s.split('/');
  let name = rest.join('/');
  if (!/\.(ogg|wav|mp3)$/i.test(name)) name += '.ogg';
  // Kenney jingles live in per-style subfolders (PIZZI -> "Pizzicato jingles", ...).
  if (k === 'J') {
    const style = { NES: '8-Bit jingles', HIT: 'Hit jingles', PIZZI: 'Pizzicato jingles', SAX: 'Sax jingles', STEEL: 'Steel jingles' }[/^[A-Z]+/.exec(name)[0]];
    name = `${style}/jingles_${name}`;
  }
  return { key: k, name, path: join(ROOT, DIRS[k], name) };
}
// Onset of a source file: first sample above -40 dB re its peak (so leading silence never shifts layer timing).
function onsetSec(path) {
  if (!onsetCache.has(path)) {
    const x = decode(path);
    const thr = peakOf(x) * 0.01;
    let i = 0;
    while (i < x.length && Math.abs(x[i]) < thr) i++;
    onsetCache.set(path, Math.max(0, i / SR - 0.001));
  }
  return onsetCache.get(path);
}
function renderLayer(layer) {
  const src = resolveSrc(layer.src);
  const start = onsetSec(src.path) + (layer.ss ?? 0);
  const f = [`atrim=start=${start.toFixed(5)}${layer.t ? `:duration=${layer.t}` : ''}`, 'asetpts=PTS-STARTPTS'];
  if (layer.st) f.push(`asetrate=${Math.round(SR * 2 ** (layer.st / 12))}`, `aresample=${SR}`);
  f.push(`highpass=f=${layer.hp ?? 25}`);
  if (layer.lp) f.push(`lowpass=f=${layer.lp}`);
  const x = decode(src.path, f.join(','));
  return { x, src, gain: lin(layer.db ?? 0), at: Math.round(((layer.at ?? 0) / 1000) * SR) };
}
function mixVariant(variant) {
  const parts = variant.layers.map(renderLayer);
  const len = Math.max(...parts.map((p) => p.at + p.x.length));
  const mix = new Float32Array(len);
  for (const p of parts) for (let i = 0; i < p.x.length; i++) mix[p.at + i] += p.x[i] * p.gain;
  const pk = peakOf(mix);
  const lead = (() => { const thr = pk * lin(-45); let i = 0; while (i < len && Math.abs(mix[i]) < thr) i++; return i; })();
  const tailEnd = (() => { const thr = pk * lin(-40); let i = len - 1; while (i > 0 && Math.abs(mix[i]) < thr) i--; return i + 1; })();
  const a = Math.max(0, lead - Math.round(0.0015 * SR));
  const capped = Math.min(tailEnd, a + Math.round((variant.maxMs / 1000) * SR));
  const out = mix.slice(a, capped);
  const fadeN = Math.min(Math.round((variant.fade / 1000) * SR), Math.floor(out.length * 0.6));
  for (let i = 0; i < fadeN; i++) out[out.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeN); // raised-cosine fade-out
  const inN = Math.round(0.00025 * SR);
  for (let i = 0; i < inN && i < out.length; i++) out[i] *= i / inN; // 0.25 ms de-click
  return { pcm: out, sources: parts.map((p) => p.src), capped: tailEnd > capped };
}

const report = { sfx: {}, music: {} };
const sfxFiles = {};
function buildSfx() {
  const dir = 'public/audio/sfx';
  if (!only) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [id, def] of Object.entries(SOUNDS)) {
    if (only && !only.includes(id)) continue;
    const target = FAMILY_TARGET[def.family] + def.lv;
    sfxFiles[id] = [];
    def.variants.forEach((variant, n) => {
      const name = `sfx/${id}_${n + 1}.ogg`;
      const out = `public/audio/${name}`;
      const { pcm, sources, capped } = mixVariant(variant);
      const raw = writeRaw(pcm, 'sfx.f32');
      const pre = loudness(raw, '', 1, ['-f', 'f32le', '-ar', String(SR), '-ac', '1']);
      const prePeak = db(peakOf(pcm));
      // Gain to the family target. Thuds and clicks have a high crest factor, so plain gain would hit the
      // peak ceiling first; a tanh soft limiter absorbs up to LIMIT_DB of that (adds a little punch, no clipping).
      let g = def.pk !== undefined ? def.pk - prePeak : target - pre.lufsM;
      const gMax = (def.pk !== undefined ? def.pk : SFX_PEAK_CEILING) - prePeak + LIMIT_DB;
      let ceil = SFX_PEAK_CEILING;
      const attempt = (gain, c) => {
        const scaled = pcm.map((v) => v * lin(gain));
        const lim = Math.max(0, db(peakOf(scaled)) - c);
        encode(lim > 0 ? softLimit(scaled, lin(c)) : scaled, 1, SFX_Q, out);
        return { gain, ceil: c, limitedDb: lim, post: loudness(out) };
      };
      const ok = (r) => r.post.truePeak <= SFX_PEAK_CEILING + 0.05;
      const errOf = (r) => (def.pk !== undefined ? 0 : Math.abs(target - r.post.lufsM));
      let best = null, last = null;
      for (let it = 0; it < 8; it++) {
        g = Math.min(g, gMax);
        last = attempt(g, ceil);
        if (!ok(last)) { ceil -= last.post.truePeak - SFX_PEAK_CEILING + 0.05; g -= 0.1; continue; }
        if (!best || errOf(last) < errOf(best)) best = last;
        if (def.pk !== undefined) break; // peak-normalised: no loudness loop
        const err = target - last.post.lufsM;
        if (Math.abs(err) < 0.35 || (err > 0 && g >= gMax - 0.01)) break;
        g += err;
      }
      if (!best) { best = attempt(g - 3, ceil - 1); last = best; } // never ship a file over the ceiling
      if (last !== best) best = attempt(best.gain, best.ceil); // last encode on disk must be the chosen one
      g = best.gain;
      const post = best.post, limitedDb = best.limitedDb;
      const info = probe(out);
      const rec = { id, file: name, target: def.pk !== undefined ? `peak ${def.pk}` : target, lufsM: post.lufsM, truePeak: post.truePeak, dur: info.duration, bytes: statSync(out).size,
        gainDb: g, limitedDb: +limitedDb.toFixed(1), shortfall: def.pk !== undefined ? 0 : +(target - post.lufsM).toFixed(1), capped, sources: sources.map((s) => `${s.key}/${s.name}`) };
      report.sfx[`${id}_${n + 1}`] = rec;
      sfxFiles[id].push(`audio/${name}`);
      console.log(`${name.padEnd(24)} ${(info.duration * 1000).toFixed(0).padStart(5)} ms ${String(rec.bytes).padStart(6)} B  M ${post.lufsM.toFixed(1).padStart(6)} (${def.pk !== undefined ? `pk ${def.pk}` : `target ${target}`}) TP ${post.truePeak.toFixed(1).padStart(5)} gain ${g.toFixed(1).padStart(5)}${limitedDb > 0.05 ? `  limited ${limitedDb.toFixed(1)} dB` : ''}${rec.shortfall > 1 ? `  SHORT ${rec.shortfall} dB` : ''}${capped ? '  cut at maxMs' : ''}`);
    });
  }
}

// ---- Music ------------------------------------------------------------------------------------
function decodeStereo(path) {
  return decode(path, '', 2); // interleaved
}
const seg = (x, a, b, ch = 2) => x.slice(a * ch, b * ch);

// Refine tempo around a coarse bpm by combing the onset envelope (multiples of 1, 2, 4, 8 beats).
function refineTempo(mono, bpm0, fromSec, toSec) {
  const { env, fps } = onsetEnvelope(mono);
  const at = (t) => { const p = t * fps, i = Math.floor(p), f = p - i; return (env[i] ?? 0) * (1 - f) + (env[i + 1] ?? 0) * f; };
  const i0 = Math.floor(fromSec * fps), i1 = Math.floor(toSec * fps);
  const score = (bpm) => {
    const T = 60 / bpm; let a = 0, c = 0;
    for (const m of [1, 2, 4, 8]) for (let i = i0; i < i1 - m * T * fps - 2; i++) { a += env[i] * at(i / fps + m * T); c++; }
    return a / c;
  };
  let best = [bpm0, -Infinity];
  for (let b = bpm0 - 0.3; b <= bpm0 + 0.3; b += 0.002) { const s = score(b); if (s > best[1]) best = [b, s]; }
  // phase: offset within a beat where onsets pile up
  const T = 60 / best[0]; let bestPhase = [0, -Infinity];
  for (let ph = 0; ph < T; ph += 0.002) {
    let a = 0;
    for (let t = fromSec + ph; t < toSec; t += T) a += at(t);
    if (a > bestPhase[1]) bestPhase = [ph, a];
  }
  return { bpm: best[0], phase: bestPhase[0], fps };
}

// Refine the loop length so the music just before the loop end lines up with the music just before the loop
// start (that is what the crossfade blends). Correlates 8 s of onset envelope at both places for +/-60 ms.
function alignLength(mono, t0, L0) {
  const hop = 64, W = 8 * SR;
  const a = Math.round(t0 * SR);
  const { env: e1, fps } = onsetEnvelope(mono.subarray(a - W, a), 1024, hop);
  let best = [0, -Infinity], second = -Infinity;
  const scores = [];
  for (let lagS = -Math.round(0.06 * SR); lagS <= Math.round(0.06 * SR); lagS += hop) {
    const b = a + L0 + lagS;
    const { env: e2 } = onsetEnvelope(mono.subarray(b - W, b), 1024, hop);
    let sxy = 0, sx = 0, sy = 0;
    for (let i = 0; i < Math.min(e1.length, e2.length); i++) { sxy += e1[i] * e2[i]; sx += e1[i] ** 2; sy += e2[i] ** 2; }
    const c = sxy / Math.sqrt(sx * sy);
    scores.push([lagS, c]);
    if (c > best[1]) best = [lagS, c];
  }
  for (const [l, c] of scores) if (Math.abs(l - best[0]) > 4 * hop) second = Math.max(second, c);
  return { lagSamples: best[0], corr: best[1], runnerUp: second };
}

function seamStats(pcm, ch) {
  const n = pcm.length / ch, w = Math.round(0.02 * SR);
  const rms = (a, b) => { let s = 0; for (let i = a * ch; i < b * ch; i++) s += pcm[i] * pcm[i]; return Math.sqrt(s / ((b - a) * ch)); };
  let jump = 0, dsum = 0, dn = 0;
  for (let c = 0; c < ch; c++) {
    jump = Math.max(jump, Math.abs(pcm[c] - pcm[(n - 1) * ch + c])); // wrap step: last sample -> first
    for (let i = 1; i < 200; i++) { dsum += Math.abs(pcm[i * ch + c] - pcm[(i - 1) * ch + c]); dn++; }
  }
  return { firstRms: db(rms(0, w)), lastRms: db(rms(n - w, n)), wrapJump: jump, typicalStep: dsum / dn, jumpRatio: jump / (dsum / dn) };
}

// The wrap step (last sample -> first) of a loop should look like any other sample step. If it is far
// larger (a loop that was cut off the waveform), slide the first ~10 ms onto the predicted continuation
// of the last two samples with a raised cosine, so there is no click and the rest is untouched.
function declickLoop(pcm) {
  const n = pcm.length / 2, M = Math.round(0.010 * SR);
  const before = seamStats(pcm, 2);
  if (before.jumpRatio < 4) return { pcm, before, applied: false };
  for (let c = 0; c < 2; c++) {
    const d = pcm[(n - 1) * 2 + c] + (pcm[(n - 1) * 2 + c] - pcm[(n - 2) * 2 + c]) - pcm[c];
    for (let i = 0; i < M; i++) pcm[i * 2 + c] += d * (0.5 + 0.5 * Math.cos((Math.PI * i) / M));
  }
  return { pcm, before, applied: true };
}

function buildMusic() {
  const dir = 'public/audio/music';
  mkdirSync(dir, { recursive: true });
  for (const [id, m] of Object.entries(MUSIC)) {
    if (only && !only.includes(id)) continue;
    const src = join(ROOT, m.src);
    const x = decodeStereo(src);
    const n = x.length / 2;
    let pcm, note = '', seamFix = false, seamBefore = null;
    if (m.loop === 'native') {
      pcm = x;
      ({ applied: seamFix, before: seamBefore } = declickLoop(pcm));
    } else if (m.loop === 'none') {
      let a = Math.round((m.startSec ?? 0) * SR);
      while (a < n && Math.abs(x[a * 2]) < 1e-4 && Math.abs(x[a * 2 + 1]) < 1e-4) a++; // skip decoder-delay digital silence
      const b = Math.min(n, a + Math.round((m.endSec - (m.startSec ?? 0)) * SR));
      pcm = seg(x, a, b);
      const fn = Math.round(m.fadeSec * SR);
      for (let i = 0; i < fn; i++) { const w = 0.5 + 0.5 * Math.cos((Math.PI * i) / fn); pcm[(pcm.length / 2 - fn + i) * 2] *= w; pcm[(pcm.length / 2 - fn + i) * 2 + 1] *= w; }
    } else {
      const mono = decode(src);
      const t = refineTempo(mono, m.beatBpm, m.startSec, Math.min(65, n / SR - 10));
      const T = 60 / t.bpm;
      // first beat-aligned point at or after startSec
      const k = Math.ceil((m.startSec - t.phase) / T);
      const t0 = t.phase + k * T;
      const L0 = Math.round(m.beats * T * SR), a = Math.round(t0 * SR), C = Math.round(m.xfadeSec * SR);
      const al = alignLength(mono, t0, L0);
      const L = L0 + al.lagSamples;
      if (a - C < 0 || a + L > n) throw new Error(`${id}: loop window out of range`);
      pcm = seg(x, a, a + L);
      for (let i = 0; i < C; i++) { // equal-power crossfade of the tail into the true predecessor of the start
        const wOut = Math.cos((Math.PI / 2) * (i / C)), wIn = Math.sin((Math.PI / 2) * (i / C));
        for (let c = 0; c < 2; c++) pcm[(L - C + i) * 2 + c] = x[(a + L - C + i) * 2 + c] * wOut + x[(a - C + i) * 2 + c] * wIn;
      }
      note = `tempo ${t.bpm.toFixed(3)} bpm, start ${t0.toFixed(3)} s (beat ${T.toFixed(4)} s, ${m.beats} beats = ${(L0 / SR).toFixed(3)} s; onset alignment moved the end by ${((al.lagSamples / SR) * 1000).toFixed(1)} ms, corr ${al.corr.toFixed(2)} vs runner-up ${al.runnerUp.toFixed(2)}) -> loop ${(L / SR).toFixed(3)} s`;
    }
    // loudness to -18 LUFS integrated
    const raw = writeRaw(pcm, 'music.f32');
    const inArgs = ['-f', 'f32le', '-ar', String(SR), '-ac', '2'];
    const pre = (() => {
      const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...inArgs, '-i', raw, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
      const t = r.stderr.split('Summary:')[1];
      return { I: parseFloat(/I:\s+(-?[\d.]+) LUFS/.exec(t)[1]), TP: parseFloat(/Peak:\s+(-?[\d.]+) dBFS/.exec(t)[1]) };
    })();
    let g = MUSIC_LUFS - pre.I;
    const out = join(dir, `${id}.ogg`);
    let post;
    for (let it = 0; it < 4; it++) {
      const scaled = pcm.map((v) => v * lin(g));
      encode(scaled, 2, MUSIC_Q, out);
      post = integrated(out);
      if (post.TP <= MUSIC_TP + 0.05) { if (Math.abs(post.I - MUSIC_LUFS) < 0.3 || post.TP > MUSIC_TP - 0.3) break; g += MUSIC_LUFS - post.I; continue; }
      g -= post.TP - MUSIC_TP + 0.05;
    }
    const back = decode(out, '', 2);
    const seam = seamStats(back, 2);
    const info = probe(out);
    const rec = { id, file: `audio/music/${id}.ogg`, bytes: statSync(out).size, dur: info.duration, srcSamples: pcm.length / 2, decodedSamples: back.length / 2,
      I: post.I, LRA: post.LRA, TP: post.TP, gainDb: g, loop: m.loop, note, seam, seamRawRatio: seamBefore?.jumpRatio ?? null, seamFix };
    report.music[id] = rec;
    console.log(`music/${id}.ogg ${(rec.bytes / 1024).toFixed(0)} KB ${info.duration.toFixed(2)} s I ${post.I} LUFS TP ${post.TP} LRA ${post.LRA} gain ${g.toFixed(1)} dB samples ${rec.srcSamples}->${rec.decodedSamples}`
      + (seamFix ? `\n    seam de-click applied: raw wrap step was ${seamBefore.jumpRatio.toFixed(1)}x typical` : '')
      + `\n    seam: first20ms ${seam.firstRms.toFixed(1)} last20ms ${seam.lastRms.toFixed(1)} dBFS, wrap step ${seam.wrapJump.toFixed(4)} = ${seam.jumpRatio.toFixed(1)}x typical sample step  ${note}`);
  }
}

// ---- Generated docs ---------------------------------------------------------------------------
function writeManifest() {
  const ids = Object.keys(SOUNDS);
  const lines = [];
  for (const id of ids) {
    const d = SOUNDS[id], m = META[id];
    const files = Object.keys(report.sfx).filter((k) => k.replace(/_\d+$/, '') === id).map((k) => report.sfx[k].file);
    lines.push(`  ${id}: { files: [${files.map((f) => `'audio/${f}'`).join(', ')}], gain: 1, family: '${d.family}', priority: ${m.p}, maxVoices: ${m.v}, minIntervalMs: ${m.gap}, pitchVar: ${m.pv} },`);
  }
  const music = Object.keys(MUSIC).map((id) => `  ${id}: { file: 'audio/music/${id}.ogg', loop: ${MUSIC_META[id].loop}, gain: ${MUSIC_META[id].gain} },`);
  const ts = `// GENERATED by tools/assets/audio-build.mjs from tools/assets/audio-plan.mjs. Edit the plan, not this file.
// Plain data for the audio engine (next stage). Paths are relative to the site base (Vite \`base\`):
// fetch \`\${import.meta.env.BASE_URL}\${file}\`. Files are mono 44.1 kHz OGG Vorbis (SFX) / stereo (music).
//
// Levels are baked into the files: each family was normalised to a momentary-max loudness so small
// critter sounds sit about 6-10 dB under king sounds and stings (FAMILY_LEVELS; thuds are peak-limited, so
// building/ability sounds land 2-4 dB under their targets, see audio-verify.mjs for the achieved numbers).
// \`gain\` is a linear trim ON TOP of that (1 = as built). Music is -18 LUFS integrated, TP < -1.5 dB.
//
// pitchVar is a random pitch spread of +/- that many semitones per play (playbackRate = 2^(x/12)).
// priority: 1 droppable, 2 normal, 3 never dropped when the voice pool is full.
// Pick a random entry of \`files\`, avoiding the last one played for that id.

export type SoundFamily = 'critter' | 'king' | 'building' | 'ability' | 'ui' | 'sting';

export interface SoundDef {
  files: string[];
  gain: number;
  family: SoundFamily;
  priority: 1 | 2 | 3;
  maxVoices: number;
  minIntervalMs: number;
  pitchVar: number;
}

export interface MusicDef {
  file: string;
  loop: boolean;
  gain: number;
}

/** Momentary-max LUFS each family was normalised to (before per-sound offsets), for reference. */
export const FAMILY_LEVELS: Record<SoundFamily, number> = { ${Object.entries(FAMILY_TARGET).map(([k, x]) => `${k}: ${x}`).join(', ')} };

export const SOUNDS = {
${lines.join('\n')}
} satisfies Record<string, SoundDef>;

export type SoundId = keyof typeof SOUNDS;

export const MUSIC = {
${music.join('\n')}
} satisfies Record<string, MusicDef>;

export type MusicId = keyof typeof MUSIC;
`;
  mkdirSync('src/audio', { recursive: true });
  writeFileSync('src/audio/manifest.ts', ts);
}

function writeLicenses() {
  const rows = [];
  for (const rec of Object.values(report.sfx)) {
    for (const s of rec.sources) {
      const [k, ...rest] = s.split('/');
      const p = PACKS[k];
      rows.push(`| public/audio/${rec.file} | ${rest.join('/')} | ${p.name} | ${p.author} | ${p.license} | ${p.url} | ${DATE} |`);
    }
  }
  const music = Object.entries(MUSIC).map(([id, m]) => `| public/audio/music/${id}.ogg | ${m.src.replace('music/', '')} | ${m.pack.name} | ${m.pack.author} | ${m.pack.license} | ${m.pack.url} | ${DATE} |`);
  const packRows = Object.values(PACKS).map((p) => `| ${p.name} | ${p.author} | ${p.license} | ${p.page} | ${p.proof} |`);
  const md = `# Audio licences

Every shipped file under \`public/audio/\` is derived from CC0 1.0 (public domain dedication) material. CC0 needs no
attribution; the credits are kept anyway. Downloaded ${DATE}. Raw sources live in \`assets-src/audio/\` (gitignored) and
are refetched by \`tools/assets/audio-fetch.sh\`; \`tools/assets/audio-build.sh\` rebuilds the files. Each shipped file is a
processed derivative (trimmed, filtered, pitch-shifted, layered, loudness-normalised, re-encoded); layered files list
every source on its own row. This file is regenerated by the build script from \`tools/assets/audio-plan.mjs\`.

Licence checks: Kenney packs ship \`License.txt\` (Creative Commons Zero, CC0) inside the zip; OpenGameArt pages for each
item below showed the CC0 licence badge when fetched on ${DATE}. Kenney's zip URLs contain a version hash, and OpenGameArt
files can be removed: keep the built files in git.

## Packs

| Pack | Author | Licence | Page | Licence evidence |
|---|---|---|---|---|
${packRows.join('\n')}
${Object.values(MUSIC).map((m) => `| ${m.pack.name} | ${m.pack.author} | ${m.pack.license} | ${m.pack.page} | CC0 badge on the OGA page, checked ${DATE} |`).join('\n')}

## Music files

| Shipped file | Source file | Pack | Author | Licence | Source URL | Downloaded |
|---|---|---|---|---|---|---|
${music.join('\n')}

## Sound effect files

| Shipped file | Source file (inside the pack) | Pack | Author | Licence | Source URL (pack download) | Downloaded |
|---|---|---|---|---|---|---|
${rows.join('\n')}
`;
  mkdirSync('licenses', { recursive: true });
  writeFileSync('licenses/audio.md', md);
}

if (doSfx) buildSfx();
if (doMusic) buildMusic();
if (doSfx && doMusic && docs) {
  writeManifest();
  writeLicenses();
}
if (!only) {
  mkdirSync('.cache/audio', { recursive: true });
  writeFileSync('.cache/audio/build-report.json', JSON.stringify(report, null, 1));
  const sum = (dir) => (existsSync(dir) ? readdirSync(dir).reduce((a, f) => a + statSync(join(dir, f)).size, 0) : 0);
  console.log(`\nTOTAL sfx ${(sum('public/audio/sfx') / 1024).toFixed(1)} KB (budget 600), music ${(sum('public/audio/music') / 1024).toFixed(1)} KB (budget 2600), ${readdirSync('public/audio/sfx').length} sfx files`);
}
