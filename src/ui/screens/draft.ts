import { MUTATIONS, TAGS } from '../catalog';
import { btn, h, icon, mutationBadge, portrait, shell, traitChip } from '../dom';
import { ordinalBattle, plural, shortName } from '../format';
import { mutationIcon, picto, tagIcon } from '../icons';
import type { DraftModel, MutationId } from '../types';
import type { Ctx, ScreenInst } from './common';

/** Pick flight: the card lifts, then flies into the "Your build" row; onPick fires as it lands. */
const LIFT_MS = 140;
const FLY_MS = 320;
const PICK_MS = LIFT_MS + FLY_MS;
const PICK_MS_REDUCED = 120;
const speech = `<svg viewBox="0 0 64 64" class="ic"><path d="M8 12 H56 V42 H30 L18 54 V42 H8 Z" fill="#FFF3D6" stroke="#1B2430" stroke-width="4" stroke-linejoin="round"/><path d="M26 22 Q26 16 32 16 Q38 16 38 21 Q38 25 32 27 V31" fill="none" stroke="#1B2430" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="37" r="2.5" fill="#1B2430"/></svg>`;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The hook screen: 3 Mutation cards, your build, reroll/skip and a preview of the next rival. */
export function draftScreen(m: DraftModel, _ctx: Ctx): ScreenInst {
  const el = shell('draft', 'Choose a Mutation');
  const cleanups: (() => void)[] = [];
  const timers: number[] = [];
  let picking = false;
  const r = m.next;
  const counters = new Set(m.counters ?? []);

  const ownedRow = h('span', { class: 'owned-row' }, ...m.owned.map(id => mutationBadge(id, { size: 'md' })));
  const ownedNone = m.owned.length ? null : h('span', { class: 'owned-none' }, 'Nothing yet');
  const owned = h('div', { class: 'owned' }, h('span', { class: 'mini-label' }, 'Your build'), ownedRow, ownedNone);

  const pick = (id: MutationId, card: HTMLElement) => {
    if (picking) return;
    picking = true;
    el.classList.add('is-picking');
    card.classList.add('picked');
    if (reducedMotion() || typeof card.animate !== 'function') {
      timers.push(window.setTimeout(() => m.onPick(id), PICK_MS_REDUCED));
      return;
    }
    // Fly to where the new badge will sit: the end of the build row.
    ownedNone?.remove();
    const slot = mutationBadge(id, { size: 'md', focusable: false });
    slot.classList.add('owned-new');
    ownedRow.append(slot);
    const from = card.getBoundingClientRect();
    const to = slot.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const s = Math.max(0.12, to.width / from.width);
    // Per-segment easing: a springy lift, then an accelerating dive into the build row.
    card.animate([
      { transform: 'translateY(-1.4rem) scale(1.035)', offset: 0, easing: 'cubic-bezier(.34,1.56,.64,1)' },
      { transform: 'translateY(-3rem) scale(1.12)', offset: LIFT_MS / PICK_MS, easing: 'cubic-bezier(.45,0,.85,.55)' },
      { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(-8deg)`, opacity: 0.4, offset: 1 },
    ], { duration: PICK_MS, fill: 'forwards' });
    timers.push(window.setTimeout(() => {
      slot.classList.add('landed');
      const burst = h('span', { class: 'gold-burst', 'aria-hidden': 'true' });
      slot.append(burst);
    }, PICK_MS - 40));
    timers.push(window.setTimeout(() => m.onPick(id), PICK_MS + 60));
  };

  const cards = h('div', { class: 'mcards', role: 'list' });
  m.options.forEach((id, i) => {
    const info = MUTATIONS[id];
    const duo = info.tags.length > 1;
    const counter = counters.has(id);
    const slot = h('span', { class: 'mcard-art', 'data-preview-slot': id },
      h('span', { class: 'mcard-plate', 'aria-hidden': 'true' }),
      icon(mutationIcon(id), 'mcard-icon'),
      // Caption bar along the bottom of the art: this option answers the next rival's question.
      counter ? h('span', { class: 'mcard-counter', 'aria-hidden': 'true' },
        portrait(r.portrait, 'counter-portrait', true, '', true), h('span', null, `Good vs ${shortName(r.name)}`)) : null);
    const card = h('button', {
      type: 'button', role: 'listitem',
      class: `mcard tagband-${info.tags[0]}${duo ? ' duo tag2-' + info.tags[1] : ''}${counter ? ' counter' : ''}`,
      style: `--i:${i}`,
      'aria-label': `${info.name}. ${info.tags.map(t => TAGS[t].name).join(' and ')}${duo ? ' Duo' : ''}. ${info.text}${counter ? ` Good against ${r.name}.` : ''}`,
      'data-autofocus': i === 0 ? '' : undefined,
    },
      h('span', { class: 'mcard-band', 'aria-hidden': 'true' },
        ...info.tags.map(t => h('span', { class: 'mcard-tag' }, icon(tagIcon(t)), TAGS[t].name)),
        h('span', { class: 'key key-num' }, String(i + 1))),
      duo ? h('span', { class: 'duo-seal', 'aria-hidden': 'true' }, 'Duo') : null,
      slot,
      h('span', { class: 'mcard-name' }, info.name),
      h('span', { class: 'mcard-text' }, info.text));
    card.addEventListener('click', () => pick(id, card));
    cards.append(card);
    if (m.mountPreview) {
      const c = m.mountPreview(id, slot);
      if (typeof c === 'function') cleanups.push(c);
      if (slot.querySelector('canvas, video, img')) slot.classList.add('has-preview');
    }
  });

  const reroll = btn(m.rerolls > 0 ? 'Reroll' : 'No rerolls', m.rerolls > 0 ? () => { if (!picking) m.onReroll(); } : undefined, {
    kind: 'plain', size: 'md', icon: picto('reroll'), verb: 'reroll', disabled: m.rerolls <= 0, cls: 'reroll-btn',
    label: m.rerolls > 0 ? `Reroll, ${plural(m.rerolls, 'reroll', 'rerolls')} left` : 'No rerolls left',
  });
  if (m.rerolls > 0) reroll.append(h('span', { class: 'count-badge' }, `${m.rerolls} left`));

  const next = h('aside', { class: 'next-strip', 'aria-label': `Next rival: ${r.name}` },
    portrait(r.portrait, 'next-portrait', true),
    h('div', { class: 'next-id' },
      h('span', { class: 'mini-label' }, m.nextBattle ? `Next · ${ordinalBattle(m.nextBattle.index, m.nextBattle.total, m.nextBattle.boss)}` : 'Next'),
      h('b', { class: 'next-name' }, r.name),
      h('span', { class: 'next-traits' }, traitChip(r.traits[0]), traitChip(r.traits[1]))),
    h('p', { class: 'next-q' }, h('span', { class: 'q-mark', html: speech, 'aria-hidden': 'true' }), r.question));

  el.append(
    h('header', { class: 'draft-head' }, h('h1', { class: 'display' }, 'Choose a Mutation'), h('p', { class: 'draft-sub' }, 'It stays for the whole run.')),
    cards,
    h('div', { class: 'draft-foot' }, owned,
      h('div', { class: 'draft-actions' }, reroll, btn('Skip', () => { if (!picking) m.onSkip(); }, { kind: 'link', size: 'sm' })),
      next));

  return {
    el,
    key: (e) => {
      const n = e.key === '1' ? 0 : e.key === '2' ? 1 : e.key === '3' ? 2 : -1;
      if (n >= 0 && n < m.options.length) { pick(m.options[n], cards.children[n] as HTMLElement); return true; }
      if ((e.key === 'r' || e.key === 'R') && m.rerolls > 0 && !picking) { m.onReroll(); return true; }
      return false;
    },
    destroy: () => { cleanups.forEach(c => c()); timers.forEach(t => clearTimeout(t)); },
  };
}
