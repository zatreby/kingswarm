// End to end: whole runs through the public API against the real sim, the way the integrator will
// wire it (with the sim's crude harness bot standing in for both the player and the rival AI).
import { describe, expect, it } from 'vitest';
import { createWorld, step } from '../sim';
import { botInputs } from '../sim/testing';
import {
  advance, applyBattleResult, battleSetup, createFacts, currentRival, finishRun, isOver, load,
  memoryStorage, newRun, observe, offers, pick, recordBattle, safeStorage, save, startBattle,
  summarise, withSavedRun,
} from './index';
import type { RunState } from './index';

function playRun(seed: number) {
  const storage = safeStorage(memoryStorage());
  let profile = load(storage);
  let run: RunState = newRun({ hero: 'brawler', seed, profile });
  const log: string[] = [];
  while (!isOver(run)) {
    if (run.phase === 'rivalCard') run = startBattle(run);
    else if (run.phase === 'battle') {
      const setup = battleSetup(run, profile);
      const world = createWorld(setup.config);
      const facts = createFacts();
      while (world.phase !== 'over') { step(world, botInputs(world)); observe(facts, world); }
      const sum = summarise(facts, world, 0);
      log.push(`${setup.rival.id}@${setup.config.map.id}: ${world.winner === 0 ? 'won' : 'lost'} (${world.winReason}) ${sum.lines.join(' | ')}`);
      run = applyBattleResult(run, { won: world.winner === 0, reason: world.winReason!, duration: world.time, facts: sum.lines });
      profile = recordBattle(profile, run);
    } else if (run.phase === 'result') run = advance(run);
    else if (run.phase === 'draft') run = pick(run, offers(run)[0]);
    profile = withSavedRun(profile, isOver(run) ? null : run);
    save(storage, profile);
    // the saved run always reloads to the same state (Continue works at every step)
    if (!isOver(run)) expect(load(storage).savedRun).toEqual(run);
  }
  const done = finishRun(profile, run);
  save(storage, done.profile);
  return { run, profile: load(storage), unlocked: done.unlocked, log };
}

describe('a whole run through the public API', () => {
  it('plays real battles to an end, records them and unlocks something', () => {
    const { run, profile, unlocked, log } = playRun(2024);
    expect(isOver(run)).toBe(true);
    expect(log.length).toBe(run.history.length);
    expect(profile.runs.played).toBe(1);
    expect(profile.savedRun).toBeNull();
    expect(unlocked.length).toBeGreaterThan(0);
    expect(profile.codex.rivals.bumble?.met).toBe(true);
    for (const h of run.history) expect(h.facts.length).toBeGreaterThanOrEqual(2);
    expect(currentRival(run).id).toBe(run.ladder[run.battle]);
  }, 60_000);
});
