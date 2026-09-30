import { btn, h, shell, title } from '../dom';
import type { Settings, SettingsModel, UiScale } from '../types';
import type { Ctx, ScreenInst } from './common';

let uid = 0;

type Emit = () => void;

function slider(label: string, get: () => number, set: (v: number) => void, emit: Emit): HTMLElement {
  const id = 'ks-s' + ++uid;
  const out = h('output', { class: 'slider-out', for: id });
  const input = h('input', { id, type: 'range', min: '0', max: '100', step: '5', class: 'slider' });
  const sync = () => {
    const v = Math.round(get() * 100);
    input.value = String(v);
    input.style.setProperty('--v', v + '%');
    input.setAttribute('aria-valuetext', v + ' percent');
    out.textContent = String(v);
  };
  input.addEventListener('input', () => { set(Number(input.value) / 100); sync(); emit(); });
  sync();
  return h('div', { class: 'set-row' }, h('label', { for: id, class: 'set-label' }, label), h('span', { class: 'slider-wrap' }, input, out));
}

function toggle(label: string, get: () => boolean, set: (v: boolean) => void, emit: Emit, note?: string): HTMLElement {
  const b = h('button', { type: 'button', role: 'switch', class: 'switch', 'aria-label': label });
  const txt = h('span', { class: 'switch-t' });
  b.append(h('span', { class: 'switch-track' }, h('span', { class: 'switch-knob' })), txt);
  const sync = () => { const v = get(); b.setAttribute('aria-checked', String(v)); txt.textContent = v ? 'On' : 'Off'; };
  b.addEventListener('click', () => { set(!get()); sync(); emit(); });
  sync();
  return h('div', { class: 'set-row' + (note ? ' has-note' : '') }, h('span', { class: 'set-label' }, label), b, note ? h('p', { class: 'set-note' }, note) : null);
}

function segmented<T extends string | number>(label: string, opts: { v: T; t: string }[], get: () => T, set: (v: T) => void, emit: Emit): HTMLElement {
  const group = h('span', { class: 'seg', role: 'radiogroup', 'aria-label': label });
  const btns = opts.map(o => {
    const b = h('button', { type: 'button', role: 'radio', class: 'seg-b' }, o.t);
    b.addEventListener('click', () => { set(o.v); sync(); emit(); });
    group.append(b);
    return b;
  });
  const sync = () => btns.forEach((b, i) => b.setAttribute('aria-checked', String(opts[i].v === get())));
  sync();
  return h('div', { class: 'set-row' }, h('span', { class: 'set-label' }, label), group);
}

export const ASSIST_LINE = 'Hatch faster after lost runs. Never locks anything.';

export function settingsScreen(m: SettingsModel, ctx: Ctx): ScreenInst {
  const el = shell('settings', 'Settings');
  const s: Settings = { ...m.settings };
  const emit = () => { ctx.applySettings({ ...s }); m.onChange({ ...s }); };

  const sound = h('section', { class: 'set-sec', 'aria-label': 'Sound' }, h('h2', null, 'Sound'),
    slider('Master', () => s.master, v => { s.master = v; }, emit),
    slider('Music', () => s.music, v => { s.music = v; }, emit),
    slider('Effects', () => s.sfx, v => { s.sfx = v; }, emit),
    toggle('Mute all', () => s.muted, v => { s.muted = v; }, emit));
  const screen = h('section', { class: 'set-sec', 'aria-label': 'Screen' }, h('h2', null, 'Screen'),
    slider('Screen shake', () => s.shake, v => { s.shake = v; }, emit),
    toggle('Reduce flashes', () => s.reduceFlashes, v => { s.reduceFlashes = v; }, emit),
    segmented('Team colours', [{ v: 'default', t: 'Default' }, { v: 'orange', t: 'Orange' }, { v: 'highContrast', t: 'Bold' }], () => s.colorMode, v => { s.colorMode = v; }, emit),
    segmented<UiScale>('UI size', [{ v: 1, t: '100%' }, { v: 1.25, t: '125%' }, { v: 1.5, t: '150%' }], () => s.uiScale, v => { s.uiScale = v; }, emit));
  const controls = h('section', { class: 'set-sec', 'aria-label': 'Controls' }, h('h2', null, 'Controls'),
    segmented('Throw button', [{ v: 'hold', t: 'Hold' }, { v: 'toggle', t: 'Toggle' }], () => s.fireMode, v => { s.fireMode = v; }, emit),
    toggle('Aim assist', () => s.aimAssist, v => { s.aimAssist = v; }, emit),
    toggle('Show hints', () => s.showHints, v => { s.showHints = v; }, emit));
  const help = h('section', { class: 'set-sec', 'aria-label': 'Assist' }, h('h2', null, 'Assist'),
    toggle('Assist mode', () => s.assist, v => { s.assist = v; }, emit, ASSIST_LINE));

  // Destructive, so it is a small footer link behind a confirmation, never a section control.
  const reset = btn('Reset progress', () => ctx.confirm({
    text: 'Reset all progress?', detail: 'Unlocks, Codex and Crown Levels are erased. Settings stay.',
    yes: 'Reset progress', no: 'Keep progress', onYes: m.onResetProgress, danger: true,
  }), { kind: 'link', size: 'sm', cls: 'reset-link' });
  const back = btn('Done', m.onBack, { kind: 'gold', size: 'md', verb: 'back' });
  el.append(h('div', { class: 'card settings-card tilt-l' },
    title('Settings', 'card-title'),
    h('div', { class: 'set-grid' }, h('div', { class: 'set-col' }, sound, screen), h('div', { class: 'set-col' }, controls, help)),
    h('div', { class: 'foot-row' }, reset, back)));
  (el.querySelector('.slider') as HTMLElement | null)?.setAttribute('data-autofocus', '');
  return { el, back: m.onBack };
}
