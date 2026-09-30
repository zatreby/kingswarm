#!/usr/bin/env node
// Independent re-measurement of everything shipped under public/audio (does not trust the build log).
//   node tools/assets/audio-verify.mjs [--csv]
// Checks codec/channels/rate, onset lead, true peak, tail cleanliness, loudness per family, and byte budgets.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { decode, analyze, loudness, SR } from './audio-lib.mjs';
import { integrated } from './audio-music-probe.mjs';
import { SOUNDS, FAMILY_TARGET } from './audio-plan.mjs';

const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));
let fail = 0;
const bad = (m) => { fail++; console.log(`FAIL ${m}`); };
const dir = 'public/audio/sfx';
const rows = [];
for (const f of readdirSync(dir).sort()) {
  const p = join(dir, f);
  const id = f.replace(/_\d+\.ogg$/, '');
  const pr = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate:format=duration', '-of', 'json', p], { encoding: 'utf8' }));
  const st = pr.streams[0];
  if (st.codec_name !== 'vorbis' || st.channels !== 1 || +st.sample_rate !== SR) bad(`${f} format ${st.codec_name}/${st.channels}/${st.sample_rate}`);
  const x = decode(p);
  const a = analyze(x);
  const l = loudness(p);
  let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v));
  const tailRms = (() => { const n = Math.round(0.004 * SR); let s = 0; for (let i = x.length - n; i < x.length; i++) s += x[i] * x[i]; return db(Math.sqrt(s / n)) - db(pk); })();
  if (a.lead > 0.0065) bad(`${f} leading silence ${(a.lead * 1000).toFixed(1)} ms`);
  if (l.truePeak > -0.9) bad(`${f} true peak ${l.truePeak}`);
  if (tailRms > -18 && x.length / SR > 0.05) bad(`${f} abrupt end (last 4 ms at ${tailRms.toFixed(0)} dB re peak)`);
  const third = Math.floor(x.length / 3), rmsOf = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return db(Math.sqrt(s / (b - a))); };
  rows.push({ tilt: rmsOf(2 * third, 3 * third) - rmsOf(0, third), f, id, family: SOUNDS[id]?.family, dur: +pr.format.duration, bytes: statSync(p).size, M: l.lufsM, tp: l.truePeak, lead: a.lead * 1000, tailRms, pitch: a.pitch, cen: a.centroid, air: a.air, cenA: a.cenA, cenB: a.cenB, f0A: a.f0A, f0B: a.f0B });
}
const fams = {};
for (const r of rows) (fams[r.family] ??= []).push(r);
console.log('family      n  target  mean M   min    max   (momentary-max LUFS after encode)');
for (const [fam, rs] of Object.entries(fams)) {
  const m = rs.map((r) => r.M);
  console.log(`${fam.padEnd(10)} ${String(rs.length).padStart(3)}  ${String(FAMILY_TARGET[fam]).padStart(5)}  ${(m.reduce((a, b) => a + b, 0) / m.length).toFixed(1).padStart(6)} ${Math.min(...m).toFixed(1).padStart(6)} ${Math.max(...m).toFixed(1).padStart(6)}`);
}
const total = rows.reduce((a, r) => a + r.bytes, 0);
console.log(`\nSFX: ${rows.length} files, ${(total / 1024).toFixed(1)} KB (budget 600 KB)`);
if (total > 600 * 1024) bad('SFX over 600 KB');
console.log(`longest ${Math.max(...rows.map((r) => r.dur)).toFixed(2)} s, shortest ${Math.min(...rows.map((r) => r.dur)).toFixed(3)} s, max lead ${Math.max(...rows.map((r) => r.lead)).toFixed(2)} ms, max TP ${Math.max(...rows.map((r) => r.tp)).toFixed(1)} dBTP`);
// tonal flag: pitched AND mid/high centroid, listed so a human can see what is intentionally musical
console.log('\nPitched-and-bright files (pitch > 0.85 and centroid > 500 Hz): intended for stings/chimes/bells/horns only');
for (const r of rows) if (r.pitch > 0.85 && r.cen > 500) console.log(`  ${r.f.padEnd(22)} ${r.id.padEnd(14)} pitch ${r.pitch.toFixed(2)} cen ${r.cen.toFixed(0)} Hz`);
console.log('\nContour evidence on the shipped files (centroid first>last third; f0 first>last third, 0 = unpitched)');
const claims = { rise: ['hatch', 'king_respawn', 'kingscall', 'rampage', 'second_wind', 'victory_sting'], fall: ['critter_die', 'king_down', 'capture_lost', 'defeat_sting'] };
for (const [dir2, ids] of Object.entries(claims)) for (const id of ids) for (const r of rows.filter((q) => q.id === id)) {
  const st = r.f0A && r.f0B ? `${(12 * Math.log2(r.f0B / r.f0A)).toFixed(1)} st` : 'n/a';
  console.log(`  expect ${dir2.padEnd(4)} ${r.f.padEnd(20)} centroid ${r.cenA.toFixed(0).padStart(5)}>${r.cenB.toFixed(0).padEnd(5)} f0 ${r.f0A.toFixed(0).padStart(3)}>${r.f0B.toFixed(0).padEnd(3)} (${st}) level last-third vs first ${r.tilt.toFixed(1)} dB`);
}
console.log('\nMusic');
const mdir = 'public/audio/music';
let mtotal = 0;
for (const f of readdirSync(mdir).sort()) {
  const p = join(mdir, f);
  const pr = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate:format=duration,bit_rate', '-of', 'json', p], { encoding: 'utf8' }));
  const l = integrated(p);
  mtotal += statSync(p).size;
  if (pr.streams[0].channels !== 2) bad(`${f} not stereo`);
  if (l.TP > -1.5) bad(`${f} true peak ${l.TP}`);
  if (Math.abs(l.I - -18) > 0.5) bad(`${f} loudness ${l.I}`);
  console.log(`  ${f.padEnd(12)} ${(statSync(p).size / 1024).toFixed(0).padStart(4)} KB ${(+pr.format.duration).toFixed(2)} s ${Math.round(pr.format.bit_rate / 1000)} kbps I ${l.I} LUFS TP ${l.TP} LRA ${l.LRA}`);
}
console.log(`  total ${(mtotal / 1024).toFixed(1)} KB (budget 2600 KB)`);
if (mtotal > 2600 * 1024) bad('music over 2.6 MB');
if (process.argv.includes('--csv')) for (const r of rows) console.log([r.f, r.family, r.dur, r.bytes, r.M, r.tp, r.lead.toFixed(2), r.pitch.toFixed(2), r.cen.toFixed(0), r.air.toFixed(0)].join(','));
console.log(fail ? `\n${fail} FAILURES` : '\nall checks passed');
process.exit(fail ? 1 : 0);
