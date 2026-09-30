import { btn, h, shell, title } from '../dom';
import { ordinalBattle } from '../format';
import { picto } from '../icons';
import type { PauseModel } from '../types';
import type { Ctx, ScreenInst } from './common';

export function pauseScreen(m: PauseModel, ctx: Ctx): ScreenInst {
  const el = shell('pause', 'Paused');
  const sub = [m.battle ? ordinalBattle(m.battle.index, m.battle.total, m.battle.boss) : '', m.rivalName ? `vs ${m.rivalName}` : ''].filter(Boolean).join(' · ');
  const abandon = () => ctx.confirm({
    text: 'Abandon this run?', detail: 'Your Mutations and ladder progress are lost.',
    yes: 'Abandon run', no: 'Keep playing', onYes: m.onAbandon, danger: true,
  });
  el.append(h('div', { class: 'card pause-card tilt-r' },
    title('Paused', 'card-title'),
    sub ? h('p', { class: 'card-sub' }, sub) : null,
    h('div', { class: 'menu-col' },
      btn('Resume', m.onResume, { kind: 'gold', size: 'lg', autofocus: true, cls: 'btn-block', icon: picto('play'), verb: 'pause' }),
      btn('Restart battle', m.onRestart, { kind: 'plain', cls: 'btn-block' }),
      btn('How to play', m.onHowTo, { kind: 'plain', cls: 'btn-block' }),
      btn('Settings', m.onSettings, { kind: 'plain', cls: 'btn-block' }),
      btn('Abandon run', abandon, { kind: 'danger', cls: 'btn-block' }))));
  return { el, back: m.onResume };
}
