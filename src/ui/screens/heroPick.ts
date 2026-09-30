import { HEROES } from '../catalog';
import { btn, h, icon, pic, shell, title } from '../dom';
import { glyphSlot } from '../glyphs';
import { abilityIcon, heroIcon, picto } from '../icons';
import type { HeroId, HeroPickModel } from '../types';
import { frag } from '../dom';
import type { Ctx, ScreenInst } from './common';

export function heroPickScreen(m: HeroPickModel, _ctx: Ctx): ScreenInst {
  const el = shell('heroPick', 'Pick your King');
  let selected: HeroId = m.selected;
  let level = m.crownLevel?.value ?? 0;
  const cards = new Map<HeroId, HTMLButtonElement>();

  const row = h('div', { class: 'hero-row', role: 'radiogroup', 'aria-label': 'Heroes' });
  m.heroes.forEach((hv, i) => {
    const info = HEROES[hv.id];
    const locked = !!hv.locked;
    const card = h('button', {
      type: 'button', class: `card hero-card${locked ? ' locked' : ''}`, role: 'radio', style: `--i:${i}`,
      'aria-checked': 'false', 'aria-disabled': locked ? 'true' : undefined,
      'aria-label': `${hv.name ?? info.name}. ${hv.playstyle ?? info.playstyle}${locked ? ' Locked: ' + hv.locked : ''}`,
    });
    card.classList.add('nav-ok');
    const abil = h('ul', { class: 'hero-abil' });
    info.abilities.forEach((a, k) => abil.append(h('li', null,
      icon(abilityIcon(a.icon), 'hero-abil-ic'),
      h('span', { class: 'hero-abil-t' }, h('b', null, a.name), h('span', null, a.text)),
      frag(glyphSlot(k === 0 ? 'ability' : 'ultimate', 'hero-abil-gl')))));
    card.append(
      h('span', { class: 'hero-art' }, icon(heroIcon(hv.id), 'hero-ic'), locked ? pic('lock', 'hero-lock') : null),
      h('span', { class: 'hero-name' }, hv.name ?? info.name),
      h('span', { class: 'hero-style' }, hv.playstyle ?? info.playstyle),
      locked ? h('span', { class: 'hero-unlock' }, pic('lock'), hv.locked!) : abil,
      h('span', { class: 'hero-check', html: picto('check'), 'aria-hidden': 'true' }));
    // Pointer: first click selects, a click on the selected card starts. Keyboard/gamepad: focus selects, accept starts.
    let viaPointer = false, wasSelected = false;
    card.addEventListener('pointerdown', () => { viaPointer = true; wasSelected = selected === hv.id; });
    card.addEventListener('focus', () => { if (!locked && !viaPointer) select(hv.id); });
    card.addEventListener('click', () => {
      if (locked) return;
      const ptr = viaPointer; viaPointer = false;
      if (ptr && !wasSelected) select(hv.id); else { select(hv.id); start(); }
    });
    cards.set(hv.id, card);
    row.append(card);
  });

  // Crown Level selector (only once unlocked).
  let clEl: HTMLElement | null = null;
  let clVal: HTMLElement | null = null;
  let clPips: HTMLElement | null = null;
  let clPerk: HTMLElement | null = null;
  const clMax = () => m.crownLevel?.maxByHero[selected] ?? 0;
  const renderCl = () => {
    if (!clEl || !m.crownLevel) return;
    level = Math.min(level, clMax());
    clVal!.textContent = level === 0 ? 'Off' : String(level);
    clPips!.replaceChildren();
    for (let i = 1; i <= m.crownLevel.cap; i++) clPips!.append(h('span', { class: `cl-pip${i <= level ? ' on' : ''}${i > clMax() ? ' locked' : ''}` }));
    clPerk!.textContent = level === 0 ? 'The standard ladder.' : (m.crownLevel.perks?.[level - 1] ?? '');
    clEl.setAttribute('aria-valuenow', String(level));
    clEl.setAttribute('aria-valuetext', level === 0 ? 'Off' : `Crown Level ${level}`);
  };
  if (m.crownLevel) {
    clVal = h('b', { class: 'cl-val' });
    clPips = h('span', { class: 'cl-pips', 'aria-hidden': 'true' });
    clPerk = h('span', { class: 'cl-perk' });
    const dec = btn('', () => { level = Math.max(0, level - 1); renderCl(); }, { kind: 'plain', size: 'sm', icon: picto('back'), label: 'Lower Crown Level', cls: 'cl-btn' });
    const inc = btn('', () => { level = Math.min(clMax(), level + 1); renderCl(); }, { kind: 'plain', size: 'sm', icon: picto('next'), label: 'Raise Crown Level', cls: 'cl-btn' });
    clEl = h('div', { class: 'card crown-level tilt-r', role: 'group', 'aria-label': 'Crown Level' },
      pic('crown', 'cl-crown'), h('span', { class: 'cl-label' }, 'Crown Level'), dec, clVal, inc, clPips, clPerk);
  }

  const select = (id: HeroId) => {
    selected = id;
    cards.forEach((c, k) => { c.setAttribute('aria-checked', String(k === id)); c.classList.toggle('selected', k === id); });
    renderCl();
  };
  const start = () => m.onPick(selected, level);

  const startBtn = btn('Start run', start, { kind: 'gold', size: 'lg', verb: 'accept' });
  el.append(
    title('Pick your King'),
    row,
    h('div', { class: 'foot-row' }, btn('Back', m.onBack, { kind: 'link', verb: 'back' }), clEl ?? h('span'), startBtn));
  select(selected);
  cards.get(selected)?.setAttribute('data-autofocus', '');

  return {
    el,
    back: m.onBack,
    key: (e) => {
      if (e.key === 'Enter' && document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('hero-card')) { start(); return true; }
      return false;
    },
  };
}
