import { describe, expect, it } from 'vitest';
import { applyBattleResult, advance, newRun, startBattle } from './run';
import {
  DEFAULT_SETTINGS, PROFILE_VERSION, STORAGE_KEY, defaultProfile, isFirstLaunch, load, markHint,
  memoryStorage, migrate, resetHints, resetProgress, safeStorage, sanitize, save, shouldShowHint,
  telemetryReport, withSavedRun, withSettings,
} from './profile';
import type { StorageLike } from './profile';
import { STARTING_HEROES, STARTING_POOL } from './unlocks';

const throwing: StorageLike = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
};

describe('defaultProfile', () => {
  it('is a first launch with the starting unlocks', () => {
    const p = defaultProfile();
    expect(p.v).toBe(PROFILE_VERSION);
    expect(p.heroes).toEqual(STARTING_HEROES);
    expect(p.mutations).toEqual(STARTING_POOL);
    expect(p.settings).toEqual(DEFAULT_SETTINGS);
    expect(isFirstLaunch(p)).toBe(true);
    expect(p.savedRun).toBeNull();
  });

  it('is plain JSON data', () => {
    const p = defaultProfile();
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });
});

describe('load / save', () => {
  it('round-trips through storage', () => {
    const s = memoryStorage();
    let p = withSettings(defaultProfile(), { music: 0.2, fireMode: 'toggle', uiScale: 1.25 });
    p = markHint(p, 'fire');
    let run = newRun({ hero: 'brawler', seed: 9, profile: p });
    run = advance(applyBattleResult(startBattle(run), { won: true, reason: 'crown', duration: 80, facts: ['x'] }));
    p = withSavedRun(p, run);
    expect(save(s, p)).toBe(true);
    expect(load(s)).toEqual(p);
  });

  it('returns defaults for missing, empty, corrupt or hostile data', () => {
    expect(load(null)).toEqual(defaultProfile());
    expect(load(memoryStorage())).toEqual(defaultProfile());
    for (const text of ['{', 'null', '42', '"hi"', '[]', '{"v":1,"settings":"loud"}']) {
      const s = memoryStorage();
      s.setItem(STORAGE_KEY, text);
      const p = load(s);
      expect(p.heroes, text).toEqual(STARTING_HEROES);
      expect(p.settings, text).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('never throws on a storage that throws', () => {
    expect(load(throwing)).toEqual(defaultProfile());
    expect(save(throwing, defaultProfile())).toBe(false);
  });

  it('safeStorage keeps the session going in memory when storage fails', () => {
    const s = safeStorage(throwing);
    const p = withSettings(defaultProfile(), { muted: true });
    save(s, p);
    expect(s.persistent).toBe(false);
    expect(load(s).settings.muted).toBe(true);
    const none = safeStorage(undefined);
    save(none, p);
    expect(load(none).settings.muted).toBe(true);
  });

  it('safeStorage writes through to a working storage', () => {
    const real = memoryStorage();
    const s = safeStorage(real);
    save(s, withSettings(defaultProfile(), { sfx: 0.1 }));
    expect(s.persistent).toBe(true);
    expect(load(real).settings.sfx).toBe(0.1);
  });
});

describe('sanitize', () => {
  it('keeps valid fields and repairs the rest', () => {
    const p = sanitize({
      v: 1,
      settings: { master: 5, music: 'x', sfx: 0.3, uiScale: 3, colorMode: 'highContrast' },
      heroes: ['blink', 'nope', 'blink'],
      mutations: ['piercers', 'notAMutation', 42],
      crownLevel: { brawler: 3.7, blink: -2, warden: 99 },
      runs: { played: 4, won: 'many' },
      assistBonus: 7,
      codex: { mutations: { piercers: { discovered: true, picks: 2 }, bogus: { discovered: true } }, recipes: ['cryoBombs', 'bombers'], rivals: { pip: { met: true, beaten: true, best: { brawler: 2 } }, vex: {} } },
      ftue: { hints: ['fire', 'fire', 'dance'] },
      savedRun: { v: 1, hero: 'brawler' },
      telemetry: { runs: [{ hero: 'brawler', won: true, seconds: 600 }, { hero: 'ghost' }] },
    });
    expect(p.settings.master).toBe(1);
    expect(p.settings.music).toBe(DEFAULT_SETTINGS.music);
    expect(p.settings.sfx).toBe(0.3);
    expect(p.settings.uiScale).toBe(1);
    expect(p.settings.colorMode).toBe('highContrast');
    expect(p.heroes).toEqual(['brawler', 'blink']);
    expect(p.mutations).toEqual([...STARTING_POOL, 'piercers']);
    expect(p.crownLevel).toEqual({ brawler: 3, blink: 0, warden: 8 });
    expect(p.runs.played).toBe(4);
    expect(p.runs.won).toBe(0);
    expect(p.assistBonus).toBe(0.3);
    expect(p.codex.mutations).toEqual({ piercers: { discovered: true, picks: 2 } });
    expect(p.codex.recipes).toEqual(['cryoBombs']);
    expect(p.codex.rivals).toEqual({ pip: { met: true, beaten: true, best: { brawler: 2 } } });
    expect(p.ftue.hints).toEqual(['fire']);
    expect(p.savedRun).toBeNull();
    expect(p.telemetry.runs).toHaveLength(1);
  });

  it('is idempotent', () => {
    const p = sanitize({ settings: { shake: 0.2 }, runs: { played: 3 } });
    expect(sanitize(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
});

describe('migration', () => {
  it('lifts a v0 profile (no version, old setting names) to the current version', () => {
    const v0 = { settings: { reduceFlash: true, colorBlind: true, hints: false, master: 0.5 }, heroes: ['brawler', 'blink'] };
    const s = memoryStorage();
    s.setItem(STORAGE_KEY, JSON.stringify(v0));
    const p = load(s);
    expect(p.v).toBe(PROFILE_VERSION);
    expect(p.settings.reduceFlashes).toBe(true);
    expect(p.settings.colorMode).toBe('orange');
    expect(p.settings.showHints).toBe(false);
    expect(p.settings.master).toBe(0.5);
    expect(p.heroes).toEqual(['brawler', 'blink']);
  });

  it('leaves current data alone', () => {
    const p = defaultProfile();
    expect(migrate(p)).toEqual(p);
  });
});

describe('hints and helpers', () => {
  it('each hint shows once, respects Show hints, and can be replayed', () => {
    let p = defaultProfile();
    expect(shouldShowHint(p, 'recall')).toBe(true);
    p = markHint(p, 'recall');
    expect(shouldShowHint(p, 'recall')).toBe(false);
    expect(markHint(p, 'recall')).toBe(p);
    expect(shouldShowHint(withSettings(p, { showHints: false }), 'dash')).toBe(false);
    expect(shouldShowHint(resetHints(p), 'recall')).toBe(true);
  });

  it('reset progress keeps the settings', () => {
    const p = withSettings({ ...defaultProfile(), heroes: ['brawler', 'blink'] }, { music: 0 });
    const r = resetProgress(p);
    expect(r.heroes).toEqual(STARTING_HEROES);
    expect(r.settings.music).toBe(0);
  });

  it('telemetry report computes rates without dividing by zero', () => {
    const r = telemetryReport(defaultProfile());
    expect(r).toMatchObject({ runs: 0, runWinRate: 0, avgRunSeconds: 0, battleWinRate: 0, mutations: [] });
  });
});
