#!/usr/bin/env node
// Music candidates: loudness, loop-seam and energy-over-time, so tracks can be chosen without listening.
//   node tools/assets/audio-music-probe.mjs <file>...
// Prints integrated LUFS / LRA / true peak, spectral centroid, RMS per 5 s window (dBFS, the "energy
// curve": a flat curve suits a loop, a ramp means a build) and the seam RMS (first vs last 50 ms).
import { spawnSync } from 'node:child_process';
import { decode, analyze, SR, probe } from './audio-lib.mjs';

const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));
const rms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };

export function integrated(file, filter = '') {
  const chain = [filter, 'ebur128=peak=true'].filter(Boolean).join(',');
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', chain, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const t = r.stderr.split('Summary:')[1] ?? '';
  const g = (re) => { const m = re.exec(t); return m ? parseFloat(m[1]) : NaN; };
  return { I: g(/I:\s+(-?[\d.]+) LUFS/), LRA: g(/LRA:\s+(-?[\d.]+) LU/), TP: g(/Peak:\s+(-?[\d.]+) dBFS/) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const f of process.argv.slice(2)) {
    const x = decode(f);
    const l = integrated(f);
    const win = 5 * SR, curve = [];
    for (let s = 0; s + win / 2 < x.length; s += win) curve.push(db(rms(x, s, Math.min(x.length, s + win))).toFixed(0));
    const seam = 0.05 * SR | 0;
    console.log(`${f.replace(/^.*assets-src\/audio\//, '')}\n  dur ${probe(f).duration.toFixed(1)}s I ${l.I} LUFS LRA ${l.LRA} TP ${l.TP} centroid ${analyze(x.subarray(0, 44100 * 20)).centroid.toFixed(0)}Hz` +
      `\n  seam rms first ${db(rms(x, 0, seam)).toFixed(1)} last ${db(rms(x, x.length - seam, x.length)).toFixed(1)} dBFS\n  5s-rms: ${curve.join(' ')}`);
  }
}
