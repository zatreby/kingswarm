// Match arc: Crown hold (win with decay), Crown opening + Frenzy, time-out and overtime.
import { tuning } from '../tuning';
import type { Team, WinReason, World } from '../types';
import { DT } from '../types';
import { buildingsOwned } from '../world';

const M = tuning.match;

export function matchSystem(w: World): void {
  if (w.phase === 'over') return;

  // Hold runs before opening so the Crown counts from the tick after it opens.
  if (w.phase === 'crown' || (w.phase === 'overtime' && crownIsOpen(w))) {
    if (crownHold(w)) return;
  }

  if (w.phase === 'open' && crownIsOpen(w)) {
    w.phase = 'crown';
    w.frenzy = true;
    w.events.push({ type: 'crownOpen' });
  }

  if (w.phase !== 'overtime' && w.time >= w.config.duration) {
    const a = buildingsOwned(w, 0), b = buildingsOwned(w, 1);
    if (a !== b) endMatch(w, a > b ? 0 : 1, 'time');
    else {
      w.phase = 'overtime';
      w.events.push({ type: 'overtime' });
    }
  }
}

function crownIsOpen(w: World): boolean {
  return w.time >= w.config.crownOpensAt;
}

/** Returns true when the hold won the match. */
function crownHold(w: World): boolean {
  let crown = -1;
  for (let i = 0; i < w.buildings.length; i++) if (w.buildings[i].kind === 'crown') { crown = i; break; }
  if (crown < 0) return false;
  const p = w.buildings[crown].presence;
  for (let t = 0; t < 2; t++) {
    const mine = p[t], theirs = p[1 - t];
    if (mine > 0 && theirs === 0) {
      w.crown[t] += DT;
      if (w.crown[t] >= M.crownHold) {
        w.crown[t] = M.crownHold;
        endMatch(w, t as Team, 'crown');
        return true;
      }
    } else if (mine === 0) {
      const v = w.crown[t] - M.crownDecay * DT;
      w.crown[t] = v > 0 ? v : 0;
    }
  }
  return false;
}

/** Ends the match once; later calls in the same tick are ignored. */
export function endMatch(w: World, winner: Team, reason: WinReason): void {
  if (w.phase === 'over') return;
  w.phase = 'over';
  w.winner = winner;
  w.winReason = reason;
  w.events.push({ type: 'matchEnd', winner, reason });
}
