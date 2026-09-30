import { HEROES } from '../catalog';
import { btn, crowns, h, shell } from '../dom';
import { ordinalBattle } from '../format';
import { picto } from '../icons';
import type { TitleModel } from '../types';
import type { Ctx, ScreenInst } from './common';

export function logo(): HTMLElement {
  const critters = `<svg class="ic" viewBox="0 0 200 40" aria-hidden="true"><g stroke="#1B2430" stroke-width="3.5" stroke-linejoin="round">`
    + [20, 52, 148, 180].map((x, i) => {
      const r = i === 1 || i === 2 ? 13 : 11, y = 30;
      const tuft = i >= 2;
      const fill = tuft ? 'style="fill:var(--red)"' : 'fill="#3FA7FF"';
      const look = x < 100 ? 3 : -3;
      return (tuft ? `<path d="M${x - 2} ${y - r * 0.9} L${x + 1} ${y - r * 1.5} L${x + 4} ${y - r * 0.85} Z" ${fill}/>` : '')
        + `<path d="M${x - r} ${y + r * 0.4} C${x - r} ${y - r * 0.5} ${x - r * 0.6} ${y - r} ${x} ${y - r} C${x + r * 0.6} ${y - r} ${x + r} ${y - r * 0.5} ${x + r} ${y + r * 0.4} C${x + r} ${y + r * 0.9} ${x - r} ${y + r * 0.9} ${x - r} ${y + r * 0.4} Z" ${fill}/>`
        + `<circle cx="${x - 3.6}" cy="${y - 2}" r="3.3" fill="#fff" stroke-width="1.6"/><circle cx="${x + 3.6}" cy="${y - 2}" r="3.3" fill="#fff" stroke-width="1.6"/>`
        + `<circle cx="${x - 3.6 + look * 0.4}" cy="${y - 1.6}" r="1.7" fill="#1B2430" stroke="none"/><circle cx="${x + 3.6 + look * 0.4}" cy="${y - 1.6}" r="1.7" fill="#1B2430" stroke="none"/>`;
    }).join('') + `</g></svg>`;
  return h('div', { class: 'logo' },
    h('span', { class: 'logo-crown', html: picto('crown') }),
    h('h1', { class: 'display logo-word' }, 'Kingswarm'),
    h('span', { class: 'logo-critters', html: critters }),
    h('p', { class: 'logo-tag' }, 'Your swarm is your gun.'));
}

export function titleScreen(m: TitleModel, _ctx: Ctx): ScreenInst {
  const el = shell('title', 'Kingswarm title');
  const menu = h('nav', { class: 'card title-card tilt-l', 'aria-label': 'Main menu' });
  if (m.continueRun && m.onContinue) {
    const c = m.continueRun;
    const cont = btn('Continue run', m.onContinue, { kind: 'gold', size: 'lg', autofocus: true, cls: 'btn-block', verb: 'accept',
      sub: `${ordinalBattle(c.battle.index, c.battle.total, c.battle.boss)} · ${HEROES[c.hero].name}` });
    cont.querySelector('.btn-sub')?.append(crowns(c.lives, c.maxLives));
    menu.append(cont, btn('New run', m.onNewRun, { kind: 'plain', size: 'lg', cls: 'btn-block' }));
  } else {
    menu.append(btn('New run', m.onNewRun, { kind: 'gold', size: 'lg', autofocus: true, cls: 'btn-block', verb: 'accept' }));
  }
  const versus = btn('Versus', m.onVersus, { kind: 'plain', size: 'sm', disabled: !m.onVersus, cls: 'btn-versus nav-ok',
    label: m.onVersus ? 'Versus' : 'Versus, coming soon' });
  if (!m.onVersus) versus.append(h('span', { class: 'soon' }, 'Soon'));
  menu.append(h('div', { class: 'title-row' },
    versus,
    btn('Codex', m.onCodex, { kind: 'plain', size: 'sm' }),
    btn('Settings', m.onSettings, { kind: 'plain', size: 'sm' })));
  el.append(logo(), menu, h('p', { class: 'version' }, m.version));
  return { el };
}
