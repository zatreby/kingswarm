import { MUTATIONS, TAGS } from '../catalog';
import { btn, h, icon, mutationBadge, portrait, shell, tagChip, traitChip } from '../dom';
import { ordinalBattle, plural } from '../format';
import { mutationIcon, picto, tagIcon } from '../icons';
import type { DraftModel, MutationId } from '../types';
import type { Ctx, ScreenInst } from './common';

const PICK_MS = 240;
const speech = `<svg viewBox="0 0 64 64" class="ic"><path d="M8 12 H56 V42 H30 L18 54 V42 H8 Z" fill="#FFF3D6" stroke="#1B2430" stroke-width="4" stroke-linejoin="round"/><path d="M26 22 Q26 16 32 16 Q38 16 38 21 Q38 25 32 27 V31" fill="none" stroke="#1B2430" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="37" r="2.5" fill="#1B2430"/></svg>`;

/** The hook screen: 3 Mutation cards, reroll, skip, your build and a preview of the next rival. */
export function draftScreen(m: DraftModel, _ctx: Ctx): ScreenInst {
  const el = shell('draft', 'Choose a Mutation');
  const cleanups: (() => void)[] = [];
  let picking = false;

  const pick = (id: MutationId, card: HTMLElement) => {
    if (picking) return;
    picking = true;
    el.classList.add('is-picking');
    card.classList.add('picked');
    setTimeout(() => m.onPick(id), PICK_MS);
  };

  const cards = h('div', { class: 'mcards', role: 'list' });
  m.options.forEach((id, i) => {
    const info = MUTATIONS[id];
    const duo = info.tags.length > 1;
    const slot = h('span', { class: 'mcard-art', 'data-preview-slot': id },
      h('span', { class: 'mcard-plate', 'aria-hidden': 'true' }),
      icon(mutationIcon(id), 'mcard-icon'));
    const card = h('button', {
      type: 'button', role: 'listitem',
      class: `mcard tagband-${info.tags[0]}${duo ? ' duo tag2-' + info.tags[1] : ''}`,
      style: `--i:${i}`,
      'aria-label': `${info.name}. ${info.tags.map(t => TAGS[t].name).join(' and ')}${duo ? ' Duo' : ''}. ${info.text}`,
      'data-autofocus': i === 0 ? '' : undefined,
    },
      h('span', { class: 'mcard-band', 'aria-hidden': 'true' },
        ...info.tags.map(t => h('span', { class: 'mcard-tag' }, icon(tagIcon(t)), TAGS[t].name)),
        h('span', { class: 'key key-num' }, String(i + 1))),
      duo ? h('span', { class: 'duo-seal', 'aria-hidden': 'true' }, 'Duo') : null,
      slot,
      h('span', { class: 'mcard-name' }, info.name),
      h('span', { class: 'mcard-text' }, info.text),
      h('span', { class: 'mcard-foot', 'aria-hidden': 'true' }, ...info.tags.map(tagChip)));
    card.addEventListener('click', () => pick(id, card));
    cards.append(card);
    if (m.mountPreview) {
      const c = m.mountPreview(id, slot);
      if (typeof c === 'function') cleanups.push(c);
      if (slot.querySelector('canvas, video, img')) slot.classList.add('has-preview');
    }
  });

  const reroll = btn(m.rerolls > 0 ? 'Reroll' : 'No rerolls', m.rerolls > 0 ? () => { if (!picking) m.onReroll(); } : undefined, {
    kind: 'plain', size: 'md', icon: picto('reroll'), verb: 'reroll', disabled: m.rerolls <= 0,
    label: m.rerolls > 0 ? `Reroll, ${plural(m.rerolls, 'reroll', 'rerolls')} left` : 'No rerolls left',
  });
  if (m.rerolls > 0) reroll.append(h('span', { class: 'count-badge' }, `${m.rerolls} left`));

  const owned = h('div', { class: 'owned' },
    h('span', { class: 'mini-label' }, 'Your build'),
    m.owned.length ? h('span', { class: 'owned-row' }, ...m.owned.map(id => mutationBadge(id, { size: 'md' }))) : h('span', { class: 'owned-none' }, 'Nothing yet'));

  const r = m.next;
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
    h('div', { class: 'draft-actions' }, reroll, btn('Skip', () => { if (!picking) m.onSkip(); }, { kind: 'link', size: 'sm' })),
    h('div', { class: 'draft-foot' }, owned, next));
  el.querySelectorAll('.mcard .key-num').forEach(k => k.setAttribute('aria-hidden', 'true'));

  return {
    el,
    key: (e) => {
      const n = e.key === '1' ? 0 : e.key === '2' ? 1 : e.key === '3' ? 2 : -1;
      if (n >= 0 && n < m.options.length) { pick(m.options[n], cards.children[n] as HTMLElement); return true; }
      if ((e.key === 'r' || e.key === 'R') && m.rerolls > 0 && !picking) { m.onReroll(); return true; }
      return false;
    },
    destroy: () => cleanups.forEach(c => c()),
  };
}
