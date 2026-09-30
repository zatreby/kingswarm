import { btn, h, shell } from '../dom';
import { formatElapsed } from '../format';
import { picto } from '../icons';
import type { RunOverModel, RunWonModel } from '../types';
import { buildRow, ladder, unlockCards, type Ctx, type ScreenInst } from './common';

export function runOverScreen(m: RunOverModel, _ctx: Ctx): ScreenInst {
  const el = shell('runOver', 'The run ends');
  let assist: HTMLElement | null = null;
  if (m.assistOffer) {
    const offer = m.assistOffer;
    const on = btn('Turn on Assist', () => { offer.onAccept(); assist?.replaceChildren(h('span', null, 'Assist is on. Change it any time in Settings.')); }, { kind: 'plain', size: 'sm' });
    assist = h('p', { class: 'assist-offer' }, h('span', null, 'Tough ladder? Assist hatches faster after each lost run.'), on);
  }
  el.append(
    h('h1', { class: 'display runend-title' }, 'The run ends'),
    h('div', { class: 'card runend-card tilt-l' },
      h('div', { class: 'runend-col' },
        h('h2', { class: 'sec-h' }, 'Your swarm'),
        buildRow(m.build, m.hero),
        h('h2', { class: 'sec-h' }, 'How far you got'),
        ladder(m.ladder, m.beaten, m.beaten)),
      h('div', { class: 'runend-col' },
        h('h2', { class: 'sec-h' }, 'So close'),
        h('p', { class: 'near-miss' }, m.nearMiss),
        h('h2', { class: 'sec-h' }, 'Unlocked'),
        unlockCards(m.unlocks)),
      assist),
    h('div', { class: 'foot-col' },
      btn('New run', m.onNewRun, { kind: 'gold', size: 'lg', autofocus: true, verb: 'accept', icon: picto('reroll') }),
      btn('Title', m.onTitle, { kind: 'link', size: 'sm' })));
  return { el, back: m.onTitle };
}

const CONFETTI = 28;

export function runWonScreen(m: RunWonModel, _ctx: Ctx): ScreenInst {
  const el = shell('runWon', 'The Crown is yours', 'is-win');
  const conf = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  // Deterministic scatter (presentation only): golden-angle spacing looks random without Math.random.
  for (let i = 0; i < CONFETTI; i++) {
    const x = (i * 61.8) % 100, d = (i * 37) % 9, hue = ['var(--gold)', 'var(--blue)', 'var(--red)', 'var(--cream)', '#7CC054'][i % 5];
    conf.append(h('i', { style: `--x:${x.toFixed(1)}%;--d:${d * 90}ms;--c:${hue};--r:${(i * 47) % 360}deg` }));
  }
  el.append(conf,
    h('div', { class: 'result-head' }, h('span', { class: 'rays', 'aria-hidden': 'true' }),
      h('span', { class: 'result-ic', html: picto('crown'), 'aria-hidden': 'true' }),
      h('h1', { class: 'display result-title gold' }, 'The Crown is yours!')),
    h('div', { class: 'card runend-card tilt-r' },
      h('div', { class: 'runend-col' },
        h('h2', { class: 'sec-h' }, 'Your swarm'),
        buildRow(m.build, m.hero),
        h('div', { class: 'run-stats' },
          h('span', { class: 'stat' }, h('small', null, 'Run time'), h('b', null, formatElapsed(m.time))),
          h('span', { class: 'stat' }, h('small', null, 'Crown Level'), h('b', null, m.crownLevel === 0 ? 'Standard' : String(m.crownLevel))))),
      h('div', { class: 'runend-col' },
        h('h2', { class: 'sec-h' }, 'Unlocked'),
        unlockCards(m.unlocks))),
    h('div', { class: 'foot-col' },
      btn('New run', m.onNewRun, { kind: 'gold', size: 'lg', autofocus: true, verb: 'accept', icon: picto('reroll') }),
      btn('Title', m.onTitle, { kind: 'link', size: 'sm' })));
  return { el, back: m.onTitle };
}
