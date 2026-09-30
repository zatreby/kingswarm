import { HEROES } from '../catalog';
import { crowns, h, mutationChip, portrait, shell, traitChip } from '../dom';
import { ordinalBattle } from '../format';
import { glyphSlot } from '../glyphs';
import { heroIcon } from '../icons';
import { frag, icon } from '../dom';
import type { RivalCardModel } from '../types';
import type { Ctx, ScreenInst } from './common';

/** Pre-battle card, ~3 s, skippable by any key, click or button. */
export function rivalCardScreen(m: RivalCardModel, _ctx: Ctx): ScreenInst {
  const el = shell('rivalCard', `Next rival: ${m.rival.name}`);
  const dur = m.durationMs ?? 3000;
  let done = false;
  const finish = () => { if (done) return; done = true; clearTimeout(timer); m.onDone(); };
  const r = m.rival;

  const card = h('article', { class: `card rival-card tilt-l${r.boss ? ' boss' : ''}`, style: `--dur:${dur}ms` },
    h('header', { class: 'rival-band' }, h('span', null, ordinalBattle(m.battle.index, m.battle.total, m.battle.boss))),
    h('div', { class: 'rival-body' },
      h('div', { class: 'rival-left' },
        portrait(r.portrait, 'rival-portrait', true, `${r.name} portrait`),
        h('span', { class: 'rival-hero' }, icon(heroIcon(r.hero, true), 'rival-hero-ic'), HEROES[r.hero].name)),
      h('div', { class: 'rival-right' },
        h('h1', { class: 'rival-name' }, r.name),
        h('p', { class: 'rival-title' }, r.title),
        h('div', { class: 'rival-traits' }, traitChip(r.traits[0]), traitChip(r.traits[1])),
        r.mutations.length
          ? h('div', { class: 'rival-muts' }, h('span', { class: 'mini-label' }, 'Mutations'), ...r.mutations.map(mutationChip))
          : h('div', { class: 'rival-muts' }, h('span', { class: 'mini-label' }, 'Mutations'), h('span', { class: 'rival-none' }, 'None yet')))),
    h('footer', { class: 'rival-foot' },
      h('span', { class: 'rival-lives' }, h('span', { class: 'mini-label' }, 'Your crowns'), crowns(m.lives, m.maxLives)),
      h('button', { type: 'button', class: 'rival-skip', 'data-autofocus': '', onclick: finish, 'aria-label': 'Start battle' },
        frag(glyphSlot('accept')), h('span', null, 'Fight!'))),
    h('span', { class: 'rival-timer', 'aria-hidden': 'true' }, h('span', { class: 'rival-timer-fill' })));
  el.append(h('div', { class: 'vs-badge', 'aria-hidden': 'true' }, 'VS'), card);
  el.addEventListener('pointerdown', (e) => { if (e.target === el) finish(); });
  const timer = setTimeout(finish, dur);

  return {
    el,
    back: finish,
    key: (e) => { if (e.key !== 'Tab') { finish(); return true; } return false; },
    nav: (a) => { if (a === 'accept' || a === 'back') { finish(); return true; } return false; },
    destroy: () => { done = true; clearTimeout(timer); },
  };
}
