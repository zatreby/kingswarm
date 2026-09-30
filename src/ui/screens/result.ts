import { btn, crowns, h, shell } from '../dom';
import { ordinalBattle, plural } from '../format';
import { picto } from '../icons';
import type { ResultModel } from '../types';
import type { Ctx, ScreenInst } from './common';

/** One screen, one focused button. Win: brag facts, Next. Loss: near-miss facts, a crown breaks, Rematch. */
export function resultScreen(m: ResultModel, _ctx: Ctx): ScreenInst {
  const win = m.outcome === 'win';
  const el = shell('result', win ? 'Victory' : 'Defeated', win ? 'is-win' : 'is-loss');
  const [lead, ...rest] = m.facts;

  const head = h('div', { class: 'result-head' },
    win ? h('span', { class: 'rays', 'aria-hidden': 'true' }) : null,
    h('span', { class: 'result-ic', html: win ? picto('crown') : picto('brokenCrown'), 'aria-hidden': 'true' }),
    h('h1', { class: `display result-title ${win ? 'gold' : ''}` }, win ? 'Victory' : 'Defeated'),
    h('p', { class: 'result-sub ribbon' }, `${ordinalBattle(m.battle.index, m.battle.total, m.battle.boss)} · vs ${m.rivalName}`));

  const lostCrown = !win && m.livesAfter < m.livesBefore ? m.livesAfter : -1;
  const facts = h('div', { class: 'card result-card tilt-r' },
    lead ? h('p', { class: 'fact-lead' }, lead) : null,
    rest.length ? h('ul', { class: 'facts' }, ...rest.slice(0, 2).map(f => h('li', null, h('span', { class: 'fact-dot', html: picto('star'), 'aria-hidden': 'true' }), f))) : null,
    win ? null : h('div', { class: 'result-lives' },
      crowns(m.livesAfter, m.maxLives, lostCrown),
      h('b', null, m.livesAfter > 0 ? `${plural(m.livesAfter, 'Crown', 'Crowns')} left` : 'No Crowns left')),
    !win && m.lossNote ? h('p', { class: 'loss-note' }, m.lossNote) : null);

  // Label the reward, not the step: a win leads to the draft.
  const primary = btn(m.primaryLabel ?? (win ? 'Choose a Mutation' : 'Rematch'), m.onPrimary, { kind: 'gold', size: 'lg', autofocus: true, verb: 'accept',
    icon: win ? picto('star') : picto('reroll'), cls: 'btn-primary-result' });
  el.append(head, facts, h('div', { class: 'foot-col' }, primary, btn('Menu', m.onMenu, { kind: 'link', size: 'sm' })));
  return { el, back: m.onMenu };
}
