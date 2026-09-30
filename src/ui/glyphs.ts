// Device glyphs for every verb (onboarding-ux.md section 4). Keyboard keys are HTML keycaps;
// mouse, gamepad and touch glyphs are small inline SVGs or styled shapes. Rendered into
// `[data-verb]` placeholders so ui.setDevice can swap them everywhere at once.
import type { Device, Verb } from './types';

const INK = '#1B2430';

const key = (label: string, wide = false) => `<span class="key${wide ? ' key-wide' : ''}">${label}</span>`;
const or = '<span class="gl-or">/</span>';

function mouse(btn: 'L' | 'R' | 'none'): string {
  const fillL = btn === 'L' ? 'var(--blue)' : '#fff';
  const fillR = btn === 'R' ? 'var(--blue)' : '#fff';
  return `<svg class="gl-mouse" viewBox="0 0 40 56" aria-hidden="true"><g stroke="${INK}" stroke-width="3.5" stroke-linejoin="round">`
    + `<path d="M4 22 V36 A16 16 0 0 0 36 36 V22 Z" fill="#fff"/>`
    + `<path d="M4 22 V18 A16 16 0 0 1 20 3 V22 Z" fill="${fillL}"/><path d="M36 22 V18 A16 16 0 0 0 20 3 V22 Z" fill="${fillR}"/>`
    + `</g></svg>`;
}

const face = (l: 'A' | 'B' | 'X' | 'Y') => `<span class="pad pad-face pad-${l.toLowerCase()}">${l}</span>`;
const shoulder = (l: 'LB' | 'RB' | 'LT' | 'RT') => `<span class="pad pad-${l[1] === 'B' ? 'bumper' : 'trigger'}">${l}</span>`;
const stick = (l: 'L' | 'R') => `<span class="pad pad-stick">${l}</span>`;
const start = () => `<span class="pad pad-start"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7 H19 M5 12 H19 M5 17 H19" stroke="#FFF3D6" stroke-width="3" stroke-linecap="round"/></svg></span>`;

function touch(kind: 'stick' | 'hold' | 'tap' | 'drag'): string {
  const body = kind === 'stick'
    ? `<circle cx="24" cy="24" r="19" fill="rgba(255,255,255,.25)" stroke="#FFF3D6" stroke-width="3"/><circle cx="24" cy="24" r="8" fill="#FFF3D6" stroke="${INK}" stroke-width="2.5"/>`
    : kind === 'hold'
      ? `<circle cx="24" cy="24" r="19" fill="none" stroke="#FFF3D6" stroke-width="3" stroke-dasharray="4 4"/><circle cx="24" cy="24" r="9" fill="#FFF3D6" stroke="${INK}" stroke-width="2.5"/>`
      : kind === 'drag'
        ? `<circle cx="14" cy="30" r="8" fill="#FFF3D6" stroke="${INK}" stroke-width="2.5"/><path d="M22 24 L40 10" stroke="#FFF3D6" stroke-width="3.5" stroke-linecap="round"/><path d="M34 8 L42 8 L41 16" fill="none" stroke="#FFF3D6" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<circle cx="24" cy="24" r="12" fill="#FFF3D6" stroke="${INK}" stroke-width="2.5"/><circle cx="24" cy="24" r="19" fill="none" stroke="#FFF3D6" stroke-width="2.5"/>`;
  return `<svg class="gl-touch" viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;
}

const wasd = () => `<span class="keys-cluster">${key('W')}<span class="keys-row">${key('A')}${key('S')}${key('D')}</span></span>`;

const KBM: Record<Verb, () => string> = {
  move: wasd,
  aim: () => mouse('none'),
  fire: () => mouse('L'),
  recall: () => key('F') + or + mouse('R'),
  dash: () => key('Shift', true),
  ability: () => key('Q'),
  ultimate: () => key('E'),
  pause: () => key('P') + or + key('Esc', true),
  accept: () => key('Enter', true),
  back: () => key('Esc', true),
  reroll: () => key('R'),
};
const PAD: Record<Verb, () => string> = {
  move: () => stick('L'),
  aim: () => stick('R'),
  fire: () => shoulder('RT'),
  recall: () => shoulder('LB'),
  dash: () => face('A'),
  ability: () => face('X'),
  ultimate: () => face('Y'),
  pause: start,
  accept: () => face('A'),
  back: () => face('B'),
  reroll: () => '',
};
const TOUCH: Record<Verb, () => string> = {
  move: () => touch('stick'),
  aim: () => touch('drag'),
  fire: () => touch('hold'),
  recall: () => touch('tap'),
  dash: () => touch('tap'),
  ability: () => touch('tap'),
  ultimate: () => touch('tap'),
  pause: () => touch('tap'),
  accept: () => touch('tap'),
  back: () => touch('tap'),
  reroll: () => touch('tap'),
};

/** Glyph markup for a verb on a device. */
export function glyphHtml(verb: Verb, device: Device): string {
  return (device === 'gamepad' ? PAD : device === 'touch' ? TOUCH : KBM)[verb]();
}

/** Spoken name of the control, for aria-labels and the controls table. */
export function glyphLabel(verb: Verb, device: Device): string {
  const t: Record<Device, Record<Verb, string>> = {
    kbm: { move: 'W A S D or arrow keys', aim: 'Mouse', fire: 'Hold left mouse button', recall: 'F or right mouse button', dash: 'Shift', ability: 'Q', ultimate: 'E', pause: 'P or Escape', accept: 'Enter', back: 'Escape', reroll: 'R' },
    gamepad: { move: 'Left stick', aim: 'Right stick', fire: 'Hold right trigger', recall: 'Left bumper', dash: 'A button', ability: 'X button', ultimate: 'Y button', pause: 'Start', accept: 'A button', back: 'B button', reroll: 'Y button' },
    touch: { move: 'Left thumb stick', aim: 'Drag right thumb', fire: 'Hold right thumb', recall: 'Recall button', dash: 'Dash button', ability: 'Ability button', ultimate: 'Ultimate button', pause: 'Pause button', accept: 'Tap', back: 'Back button', reroll: 'Tap' },
  };
  return t[device][verb];
}

/** A glyph placeholder element's markup; its contents are (re)filled by renderGlyphs. */
export function glyphSlot(verb: Verb, cls = ''): string {
  return `<span class="gl ${cls}" data-verb="${verb}" aria-hidden="true"></span>`;
}

/** Fill every glyph placeholder under root for the device. */
export function renderGlyphs(root: ParentNode, device: Device): void {
  root.querySelectorAll<HTMLElement>('[data-verb]').forEach(el => {
    const v = el.dataset.verb as Verb;
    if (el.dataset.dev === device) return;
    el.dataset.dev = device;
    el.innerHTML = glyphHtml(v, device);
  });
}
