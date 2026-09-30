// Public API of the AI layer. The game loop, harness and specs import from here.
export * from './types';
export { createBot } from './bot';
export { PROFILES, RIVALS, PROXIES, GOLDEN, MAX_LEVEL, scaleProfile, profileFor } from './profiles';
export { runMatch, matchConfig, leadScore, countLeadChanges } from './match';
export type { MatchSpec, MatchRecord, SideSpec, TellRecord } from './match';
