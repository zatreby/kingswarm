// Public API of the game layer: content, arenas, the Conquest run, battle facts, the profile and
// unlocks. Pure logic over plain data: no DOM, timers or audio; randomness only from seeds.
// Import from here, never from the files behind it.
//
// One full run loop (the integrator's shape; `playBattle` is the render/input/bot loop):
//
//   const storage = safeStorage(globalThis.localStorage);        // never throws, memory fallback
//   let profile = load(storage);
//   let run = profile.savedRun ?? newRun({ hero: 'brawler', seed: Date.now() | 0, crownLevel: 0, profile });
//   while (!isOver(run)) {
//     switch (run.phase) {
//       case 'rivalCard': show rival card for currentRival(run); run = startBattle(run); break;
//       case 'battle': {
//         const setup = battleSetup(run, profile);           // MatchConfig + bot id/level + looks
//         const world = createWorld(setup.config);
//         const facts = createFacts();
//         while (world.phase !== 'over') { step(world, inputs); observe(facts, world); }
//         const sum = summarise(facts, world, 0);
//         run = applyBattleResult(run, { won: world.winner === 0, reason: world.winReason!, duration: world.time, facts: sum.lines });
//         profile = recordBattle(profile, run);
//         break;
//       }
//       case 'result': show result (run.history.at(-1), run.lives); run = advance(run); break;
//       case 'draft': show offers(run) with counterReason(currentRival(run).id, id);
//                     run = pick(run, chosen) | reroll(run) | skip(run); break;
//     }
//     profile = withSavedRun(profile, isOver(run) ? null : run); save(storage, profile);
//   }
//   const { profile: after, unlocked } = finishRun(profile, run);  // end screen shows `unlocked`
//   save(storage, after);

export {
  HEROES, HERO_IDS, RIVALS, RIVAL_IDS, MIDDLE_RIVALS, COUNTERS,
  TIMING_FIRST, TIMING_BOSS, battleTiming,
} from './content';
export type {
  RivalId, BotProfileId, LookId, ArenaId, TraitIcon, Trait, AbilityText, HeroUnlock, HeroDef,
  BattleTiming, BarkSituation, RivalDef, Counter,
} from './content';

export { ARENAS, ARENA_RULES, validateArena, tinkerworks, warren, gullet, sablewood, crownhall } from './arenas';

export {
  // constants and Crown Levels
  LADDER_LENGTH, START_LIVES, DRAFT_SIZE, MAX_MUTATIONS, START_REROLLS, MAX_CROWN_LEVEL,
  FIRST_RUN_HANDICAP, CROWN_LEVELS, PHASE_EDGES, crownEffects,
  // the run
  newRun, makeLadder, currentRival, isOver, battleSetup, battleSeed,
  startBattle, applyBattleResult, advance, pick, skip, reroll, canReroll, abandon, offers,
  // draft helpers
  draftOptions, counterReason, isDuo,
} from './run';
export type {
  CrownLevelId, CrownLevelDef, CrownEffects, RunPhase, BattleResult, BattleRecord, DraftRecord,
  RunState, NewRunOptions, BattleSetup, DraftInput,
} from './run';

export { createFacts, observe, summarise, clock } from './facts';
export type { BattleFacts, FactNumbers, FactSummary } from './facts';

export {
  PROFILE_VERSION, STORAGE_KEY, DEFAULT_SETTINGS, HINT_IDS,
  defaultProfile, load, save, memoryStorage, safeStorage, migrate, sanitize, sanitizeRun,
  withSettings, shouldShowHint, markHint, resetHints, isFirstLaunch, withSavedRun, resetProgress,
  telemetryReport,
} from './profile';
export type {
  Profile, Settings, HintId, StorageLike, CodexMutation, CodexRival, MutationStats, RunLog, Telemetry,
} from './profile';

export {
  STARTING_HEROES, STARTING_POOL, UNLOCK_RULES, ASSIST_STEP, ASSIST_MAX,
  applyUnlockRules, recordBattle, finishRun,
} from './unlocks';
export type { UnlockRule, UnlockWhen, UnlockEvent } from './unlocks';
