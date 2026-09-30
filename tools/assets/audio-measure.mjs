#!/usr/bin/env node
// Print measurements for candidate files: node tools/assets/audio-measure.mjs <file|dir|glob-ish substring>...
// A directory is walked; files are .ogg/.wav/.mp3. Output is one line per file, sorted by name.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { measure, fmt } from './audio-lib.mjs';

const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).sort().flatMap((n) => walk(join(p, n))) : /\.(ogg|wav|mp3)$/i.test(p) ? [p] : []);
const files = process.argv.slice(2).flatMap(walk);
for (const f of files) {
  try {
    console.log(`${f.replace(/^.*assets-src\/audio\//, '').padEnd(58)} ${fmt(measure(f))}`);
  } catch (e) {
    console.log(`${f} ERROR ${e.message.slice(0, 80)}`);
  }
}
