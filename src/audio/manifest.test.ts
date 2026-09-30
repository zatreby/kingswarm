import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MUSIC, SOUNDS, type SoundFamily } from './manifest';

// Guards the shipped sound set: every manifest path exists and is real OGG Vorbis, nothing is shipped
// that the manifest does not reference, and the byte budgets from the studio brief hold.
const PUBLIC = join(__dirname, '../../public');
const KB = 1024;

const REQUIRED_IDS = [
  'throw', 'land_soft', 'land_hit', 'critter_die', 'hatch', 'bite', 'explode', 'king_hit', 'king_down', 'king_respawn',
  'dash', 'stomp', 'kingscall', 'blink', 'vortex', 'turret_place', 'turret_shot', 'arrow_shot', 'rampart', 'recall',
  'no_ammo', 'capture', 'capture_lost', 'crown_tick', 'crown_open', 'overtime', 'rampage', 'second_wind', 'freeze',
  'ui_click', 'ui_hover', 'ui_confirm', 'ui_back', 'ui_pick', 'ui_error', 'victory_sting', 'defeat_sting',
];
const FAMILIES: SoundFamily[] = ['critter', 'king', 'building', 'ability', 'ui', 'sting'];

const isOggVorbis = (path: string) => {
  const head = readFileSync(path).subarray(0, 64);
  return head.subarray(0, 4).toString('latin1') === 'OggS' && head.includes(Buffer.from('vorbis'));
};

describe('audio manifest', () => {
  it('has every sound id the brief lists', () => {
    for (const id of REQUIRED_IDS) expect(SOUNDS, id).toHaveProperty(id);
  });

  it('has the five music slots', () => {
    expect(Object.keys(MUSIC).sort()).toEqual(['battle', 'crown', 'defeat', 'menu', 'victory']);
    expect(MUSIC.menu.loop && MUSIC.battle.loop && MUSIC.crown.loop).toBe(true);
    expect(MUSIC.victory.loop || MUSIC.defeat.loop).toBe(false);
  });

  it('has sane engine metadata', () => {
    for (const [id, s] of Object.entries(SOUNDS)) {
      expect(FAMILIES, id).toContain(s.family);
      expect(s.maxVoices, id).toBeGreaterThanOrEqual(1);
      expect(s.minIntervalMs, id).toBeGreaterThanOrEqual(0);
      expect(s.pitchVar, id).toBeGreaterThanOrEqual(0);
      expect(s.pitchVar, id).toBeLessThanOrEqual(3);
      expect(s.gain, id).toBeGreaterThan(0);
      expect(s.files.length, id).toBeGreaterThanOrEqual(s.family === 'sting' ? 1 : 2);
      expect(s.files.length, id).toBeLessThanOrEqual(5);
    }
  });

  it('points only at files that exist and are OGG Vorbis', () => {
    const paths = [...Object.values(SOUNDS).flatMap((s) => s.files), ...Object.values(MUSIC).map((m) => m.file)];
    for (const p of paths) {
      const abs = join(PUBLIC, p);
      expect(existsSync(abs), p).toBe(true);
      expect(isOggVorbis(abs), p).toBe(true);
    }
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('ships no orphan audio files', () => {
    const referenced = new Set([...Object.values(SOUNDS).flatMap((s) => s.files), ...Object.values(MUSIC).map((m) => m.file)]);
    for (const dir of ['audio/sfx', 'audio/music']) {
      for (const f of readdirSync(join(PUBLIC, dir))) expect(referenced.has(`${dir}/${f}`), `${dir}/${f}`).toBe(true);
    }
  });

  it('stays inside the byte budgets (SFX 600 KB, music 2.6 MB)', () => {
    const size = (paths: string[]) => paths.reduce((a, p) => a + statSync(join(PUBLIC, p)).size, 0);
    expect(size(Object.values(SOUNDS).flatMap((s) => s.files))).toBeLessThan(600 * KB);
    expect(size(Object.values(MUSIC).map((m) => m.file))).toBeLessThan(2.6 * 1024 * KB);
  });
});
