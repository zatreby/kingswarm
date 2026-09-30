import type { PlayerInput } from './types';

/** No buttons, no movement, aiming at the origin. */
export function idleInput(): PlayerInput {
  return {
    moveX: 0, moveY: 0, aimX: 0, aimY: 0,
    fire: false, dash: false, ability: false, ultimate: false, recall: false,
  };
}

/** An idle input with some fields set: `input({ moveX: 1, fire: true })`. */
export function input(over: Partial<PlayerInput> = {}): PlayerInput {
  return { ...idleInput(), ...over };
}

/** Both players idle. */
export function idleInputs(): [PlayerInput, PlayerInput] {
  return [idleInput(), idleInput()];
}
