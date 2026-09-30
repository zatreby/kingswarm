import { HEROES, MUTATIONS } from '../catalog';
import { btn, h, icon, pic } from '../dom';
import { heroIcon, mutationIcon, picto, tagIcon } from '../icons';
import type { Device, MutationId, NavAction, Settings, UnlockView } from '../types';

export interface ConfirmOpts {
  text: string;
  detail?: string;
  yes: string;
  no: string;
  onYes: () => void;
  danger?: boolean;
}

/** What a screen may ask of the UI core. */
export interface Ctx {
  readonly device: Device;
  confirm(o: ConfirmOpts): void;
  applySettings(s: Settings): void;
}

export interface ScreenInst {
  el: HTMLElement;
  /** Esc / gamepad B. */
  back?: () => void;
  /** Screen-specific keys (digits on the draft, any key on the rival card). Return true if handled. */
  key?: (e: KeyboardEvent) => boolean;
  /** Screen-specific navigation override. Return true if handled. */
  nav?: (a: NavAction, focused: HTMLElement | null) => boolean;
  /** Same-screen model refresh without a rebuild (boot progress). */
  update?: (m: never) => void;
  onDevice?: (d: Device) => void;
  destroy?: () => void;
}

/** Compact build row: hero pictogram + Mutation icons, each with name under. */
export function buildRow(build: MutationId[] | null, heroId: keyof typeof HEROES | null): HTMLElement {
  const row = h('ul', { class: 'build-row', 'aria-label': 'Your build' });
  if (heroId) row.append(h('li', { class: 'build-hero' }, icon(heroIcon(heroId), 'build-ic'), h('span', null, HEROES[heroId].name)));
  for (const id of build ?? []) {
    const info = MUTATIONS[id];
    row.append(h('li', { class: `build-mut tagband-${info.tags[0]}`, title: info.text }, icon(mutationIcon(id), 'build-ic'), h('span', null, info.name)));
  }
  return row;
}

/** Unlock cards that flip in with a stagger. */
export function unlockCards(list: UnlockView[]): HTMLElement {
  const wrap = h('ul', { class: 'unlocks', 'aria-label': 'Unlocked this run' });
  list.forEach((u, i) => {
    let art = picto('star');
    if (u.kind === 'mutation' && u.mutation) art = mutationIcon(u.mutation);
    else if (u.kind === 'hero' && u.hero) art = heroIcon(u.hero);
    else if (u.kind === 'crownLevel') art = picto('crown');
    else if (u.kind === 'rival') art = tagIcon('king');
    const kind = { mutation: 'New Mutation', hero: 'New hero', crownLevel: 'Crown Level', rival: 'Rival variant' }[u.kind];
    wrap.append(h('li', { class: `unlock unlock-${u.kind}`, style: `--i:${i}` },
      h('span', { class: 'unlock-kind' }, kind),
      icon(art, 'unlock-ic'),
      h('b', { class: 'unlock-label' }, u.label),
      u.detail ? h('span', { class: 'unlock-detail' }, u.detail) : null));
  });
  if (!list.length) wrap.append(h('li', { class: 'unlock-none' }, 'Nothing new this time.'));
  return wrap;
}

/** Ladder of rivals: beaten pips, the current/lost one, the rest unknown; the last is the boss. */
export function ladder(names: string[], beaten: number, lostAt = -1): HTMLElement {
  const ol = h('ol', { class: 'ladder', 'aria-label': `Ladder: beat ${beaten} of ${names.length}` });
  names.forEach((name, i) => {
    const boss = i === names.length - 1;
    const state = i < beaten ? 'done' : i === lostAt ? 'lost' : 'todo';
    const mark = state === 'done' ? picto('check') : state === 'lost' ? picto('cross') : boss ? picto('crown') : '';
    ol.append(h('li', { class: `pip pip-${state}${boss ? ' pip-boss' : ''}`, 'aria-label': `${name}: ${state === 'done' ? 'beaten' : state === 'lost' ? 'lost here' : 'not reached'}` },
      h('span', { class: 'pip-dot', html: mark || `<span>${i + 1}</span>` }),
      h('span', { class: 'pip-name' }, state === 'todo' && !boss ? '?' : name)));
  });
  return ol;
}

export { btn, h, icon, pic };
