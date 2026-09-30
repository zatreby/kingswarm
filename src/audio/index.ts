// Audio: plain Web Audio, no library. The game uses createAudio() and the AudioEngine interface only.
export { createAudio } from './engine';
export type { AudioEngine, AudioEngineDebug, AudioOptions, LoadGroup, UiSound } from './engine';
export type { MusicState } from './mixer';
export { RULES, cuesFor } from './mapping';
export type { Cue, AggGroup } from './mapping';
export { SOUNDS, MUSIC } from './manifest';
export type { SoundId, MusicId } from './manifest';
