#!/usr/bin/env node
// Contact reel for the one human listening pass: every shipped SFX id in manifest order, each variant
// played once with 0.35 s of silence after it (0.9 s between ids), plus a text index with timestamps.
//   node tools/assets/audio-reel.mjs   ->  .cache/audio/contact-reel.wav + contact-reel.txt (not shipped)
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { SR, decode, probe } from './audio-lib.mjs';
import { SOUNDS } from '../../src/audio/manifest.ts';

const chunks = [], index = [];
let t = 0;
const silence = (s) => { const z = new Float32Array(Math.round(s * SR)); chunks.push(z); t += z.length / SR; };
for (const [id, def] of Object.entries(SOUNDS)) {
  def.files.forEach((f, i) => {
    const x = decode(`public/${f}`);
    index.push(`${t.toFixed(2).padStart(7)} s  ${id} #${i + 1}  (${f}, ${(probe(`public/${f}`).duration * 1000).toFixed(0)} ms)`);
    chunks.push(x); t += x.length / SR;
    silence(i === def.files.length - 1 ? 0.9 : 0.35);
  });
}
const all = new Float32Array(chunks.reduce((a, c) => a + c.length, 0));
let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
mkdirSync('.cache/audio', { recursive: true });
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', 'pipe:0', '-c:a', 'pcm_s16le', '.cache/audio/contact-reel.wav'], { input: Buffer.from(all.buffer) });
if (r.status !== 0) throw new Error(String(r.stderr));
writeFileSync('.cache/audio/contact-reel.txt', index.join('\n') + '\n');
console.log(`reel: ${(t).toFixed(1)} s, ${index.length} clips -> .cache/audio/contact-reel.wav (index: contact-reel.txt)`);
