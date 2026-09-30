import { btn, frag, h, shell, title } from '../dom';
import { glyphHtml, glyphLabel } from '../glyphs';
import { picto } from '../icons';
import type { Device, HowToModel, Verb } from '../types';
import type { Ctx, ScreenInst } from './common';

const VERBS: { verb: Verb; name: string; line: string }[] = [
  { verb: 'move', name: 'Move', line: 'Walk your King. Your swarm follows you.' },
  { verb: 'fire', name: 'Throw', line: 'Hold to hurl critters where you aim.' },
  { verb: 'recall', name: 'Recall', line: 'Whistle, and every critter runs back to you.' },
];
// The three core verbs are the tiles above; the table lists everything else once.
const TABLE: { verb: Verb; name: string }[] = [
  { verb: 'aim', name: 'Aim' }, { verb: 'dash', name: 'Dash' }, { verb: 'ability', name: 'Ability' },
  { verb: 'ultimate', name: 'Ultimate' }, { verb: 'pause', name: 'Pause' }, { verb: 'accept', name: 'Confirm' },
];
const DEVICES: { d: Device; t: string }[] = [{ d: 'kbm', t: 'Keyboard & mouse' }, { d: 'gamepad', t: 'Controller' }, { d: 'touch', t: 'Touch' }];

/** Controls reference for a device, glyphs rendered directly (not via device placeholders). */
export function howtoScreen(m: HowToModel, ctx: Ctx): ScreenInst {
  const el = shell('howto', 'How to play');
  let dev: Device = m.device ?? ctx.device;
  const segBtns = new Map<Device, HTMLButtonElement>();
  const seg = h('div', { class: 'seg seg-lg', role: 'radiogroup', 'aria-label': 'Device' });
  DEVICES.forEach(({ d, t }) => {
    const b = h('button', { type: 'button', role: 'radio', class: 'seg-b' }, t);
    b.addEventListener('click', () => { dev = d; render(); });
    segBtns.set(d, b);
    seg.append(b);
  });
  const verbs = h('div', { class: 'verbs' });
  const table = h('dl', { class: 'ctable' });
  const render = () => {
    segBtns.forEach((b, d) => b.setAttribute('aria-checked', String(d === dev)));
    verbs.replaceChildren(...VERBS.map(v => h('div', { class: 'verb card' },
      h('span', { class: 'verb-gl', 'aria-label': glyphLabel(v.verb, dev), role: 'img' }, frag(`<span class="gl">${glyphHtml(v.verb, dev)}</span>`)),
      h('b', { class: 'verb-name' }, v.name), h('span', { class: 'verb-line' }, v.line))));
    table.replaceChildren(...TABLE.flatMap(r => [
      h('dt', null, r.name),
      h('dd', { 'aria-label': glyphLabel(r.verb, dev) }, frag(`<span class="gl" aria-hidden="true">${glyphHtml(r.verb, dev)}</span>`),
        // One rule per table: keycaps and pad buttons speak for themselves; touch glyphs all look alike, so every touch row is named.
        dev === 'touch' ? h('span', { class: 'ct-label', 'aria-hidden': 'true' }, glyphLabel(r.verb, dev)) : null)]));
  };
  render();
  segBtns.get(dev)?.setAttribute('data-autofocus', '');
  el.append(h('div', { class: 'card howto-card tilt-r' },
    title('How to play', 'card-title'),
    seg, verbs, table,
    h('div', { class: 'foot-row' }, btn('Back', m.onBack, { kind: 'gold', size: 'md', verb: 'back', icon: picto('back') }))));
  return {
    el,
    back: m.onBack,
    onDevice: (d) => { if (!m.device) { dev = d; render(); } },
  };
}
