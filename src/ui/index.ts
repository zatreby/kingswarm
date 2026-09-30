// Kingswarm UI layer: DOM overlay driven by plain-data view models (see types.ts).
//   const ui = createUi(document.getElementById('ui')!);
//   ui.show({ screen: 'title', ... });  ui.hud.mount(...); ui.hud.update(frame) every rAF.
import './ui.css';
import './hud.css';
import { MUTATIONS } from './catalog';
import { btn, focusables, frag, h } from './dom';
import { pickInDirection, type Rect } from './focus';
import { renderGlyphs } from './glyphs';
import { createHud } from './hud';
import { mutationIcon, picto, type PictoId } from './icons';
import { bootScreen } from './screens/boot';
import { codexScreen } from './screens/codex';
import type { ConfirmOpts, Ctx, ScreenInst } from './screens/common';
import { draftScreen } from './screens/draft';
import { heroPickScreen } from './screens/heroPick';
import { howtoScreen } from './screens/howto';
import { pauseScreen } from './screens/pause';
import { resultScreen } from './screens/result';
import { rivalCardScreen } from './screens/rivalCard';
import { runOverScreen, runWonScreen } from './screens/runEnd';
import { settingsScreen } from './screens/settings';
import { titleScreen } from './screens/title';
import type { Device, MutationId, NavAction, ScreenModel, Settings, Ui, UiScale } from './types';

export * from './types';
export { MUTATIONS, MUTATION_IDS, HEROES, HERO_IDS, TAGS } from './catalog';
export { formatClock, formatElapsed } from './format';

const TOAST_MS = 2400;
/** Below this many reference px of height the screens switch to their compact rhythm. */
const COMPACT_REF_H = 660;
const REF_W = 1280, REF_H = 720, MIN_UNIT = 0.72;
const LEAVE_MS = 140;

type Builder = (m: never, ctx: Ctx) => ScreenInst;
const BUILDERS: Record<Exclude<ScreenModel['screen'], 'none'>, Builder> = {
  boot: bootScreen as Builder,
  title: titleScreen as Builder,
  heroPick: heroPickScreen as Builder,
  rivalCard: rivalCardScreen as Builder,
  pause: pauseScreen as Builder,
  settings: settingsScreen as Builder,
  result: resultScreen as Builder,
  draft: draftScreen as Builder,
  runOver: runOverScreen as Builder,
  runWon: runWonScreen as Builder,
  codex: codexScreen as Builder,
  howto: howtoScreen as Builder,
};

const rectOf = (el: Element): Rect => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };

export function createUi(root: HTMLElement): Ui {
  const html = document.documentElement;
  html.classList.add('ks-ui-root');
  root.classList.add('ks-ui');
  root.dataset.device = 'kbm';
  root.dataset.input = 'pointer';
  root.dataset.flash = 'full';

  const hudLayer = h('div', { class: 'ks-hud-layer' });
  const scrLayer = h('div', { class: 'ks-screens' });
  const toastLayer = h('div', { class: 'ks-toasts', role: 'status', 'aria-live': 'polite' });
  root.append(hudLayer, scrLayer, toastLayer);

  let device: Device = 'kbm';
  let current: ScreenInst | null = null;
  let currentId: ScreenModel['screen'] = 'none';
  let modal: { el: HTMLElement; close: () => void } | null = null;
  let reducedFlashes = false;

  let scale: UiScale = 1;
  const measure = () => {
    const w = root.clientWidth || innerWidth, hgt = root.clientHeight || innerHeight;
    const unit = Math.max(MIN_UNIT, Math.min(w / REF_W, hgt / REF_H)) * scale;
    root.classList.toggle('compact', hgt / unit < COMPACT_REF_H);
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
  ro?.observe(root);
  measure();

  const setInput = (mode: 'nav' | 'pointer') => { if (root.dataset.input !== mode) root.dataset.input = mode; };

  const ctx: Ctx = {
    get device() { return device; },
    confirm: (o: ConfirmOpts) => openConfirm(o),
    applySettings: (s: Settings) => ui.applySettings(s),
  };

  const hud = createHud(hudLayer, () => reducedFlashes);

  function focusDefault(scope: HTMLElement): void {
    const el = scope.querySelector<HTMLElement>('[data-autofocus]') ?? focusables(scope)[0];
    el?.focus({ preventScroll: true });
  }

  function openConfirm(o: ConfirmOpts): void {
    if (!current) return;
    closeConfirm();
    const back = document.activeElement as HTMLElement | null;
    const behind = Array.from(current.el.children) as HTMLElement[];
    behind.forEach(c => c.setAttribute('inert', ''));
    const close = () => { el.remove(); modal = null; behind.forEach(c => c.removeAttribute('inert')); back?.focus({ preventScroll: true }); };
    const el = h('div', { class: 'confirm', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': o.text },
      h('div', { class: 'card confirm-card tilt-r' },
        h('h2', { class: 'confirm-t' }, o.text),
        o.detail ? h('p', { class: 'confirm-d' }, o.detail) : null,
        h('div', { class: 'confirm-row' },
          btn(o.no, close, { kind: 'gold', size: 'md', autofocus: true, verb: 'back' }),
          btn(o.yes, () => { close(); o.onYes(); }, { kind: o.danger ? 'danger' : 'plain', size: 'md' }))));
    current.el.append(el);
    modal = { el, close };
    renderGlyphs(el, device);
    focusDefault(el);
  }
  function closeConfirm(): void { modal?.close(); }

  function show(model: ScreenModel): void {
    if (current && currentId === model.screen && current.update) { (current.update as (m: ScreenModel) => void)(model); return; }
    closeConfirm();
    if (current) {
      const old = current;
      old.destroy?.();
      old.el.setAttribute('inert', '');
      old.el.classList.add('leaving');
      setTimeout(() => old.el.remove(), LEAVE_MS);
    }
    current = null;
    currentId = model.screen;
    root.classList.toggle('has-screen', model.screen !== 'none');
    if (model.screen === 'none') return;
    current = BUILDERS[model.screen](model as never, ctx);
    scrLayer.append(current.el);
    renderGlyphs(current.el, device);
    focusDefault(current.el);
  }

  function scope(): HTMLElement | null { return modal?.el ?? current?.el ?? null; }

  function nav(action: NavAction): void {
    const sc = scope();
    if (!sc) return;
    setInput('nav');
    const active = document.activeElement instanceof HTMLElement && sc.contains(document.activeElement) ? document.activeElement : null;
    if (!modal && current?.nav?.(action, active)) return;
    if (action === 'back') { if (modal) modal.close(); else current?.back?.(); return; }
    if (action === 'accept') {
      if (!active) { focusDefault(sc); return; }
      if (active instanceof HTMLInputElement) return;
      active.click();
      return;
    }
    if (!active) { focusDefault(sc); return; }
    if (active instanceof HTMLInputElement && active.type === 'range' && (action === 'left' || action === 'right')) {
      const step = Number(active.step) || 1;
      const v = Math.max(Number(active.min), Math.min(Number(active.max), Number(active.value) + (action === 'right' ? step : -step)));
      if (String(v) !== active.value) { active.value = String(v); active.dispatchEvent(new Event('input', { bubbles: true })); }
      return;
    }
    const list = focusables(sc);
    const i = pickInDirection(rectOf(active), list.map(rectOf), action, list.indexOf(active));
    if (i >= 0) { list[i].focus({ preventScroll: true }); list[i].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }

  const ARROWS: Record<string, NavAction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  function onKey(e: KeyboardEvent): void {
    if (!current) return;
    if (e.key === 'Tab') { setInput('nav'); return; }
    if (!modal && current.key?.(e)) { e.preventDefault(); setInput('nav'); return; }
    const dir = ARROWS[e.key];
    if (dir) { e.preventDefault(); nav(dir); return; }
    if (e.key === 'Escape') { e.preventDefault(); nav('back'); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      setInput('nav');
      const sc = scope();
      if (sc && !(document.activeElement instanceof HTMLElement && sc.contains(document.activeElement))) { e.preventDefault(); focusDefault(sc); }
    }
  }
  const onPointer = () => setInput('pointer');
  const onGlyphs = (e: Event) => renderGlyphs(e.target as HTMLElement, device);
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onPointer, { passive: true });
  window.addEventListener('pointermove', onPointer, { passive: true });
  root.addEventListener('ks-glyphs', onGlyphs);

  function toast(text: string, iconId?: string): void {
    let art = '';
    if (iconId && iconId in MUTATIONS) art = mutationIcon(iconId as MutationId);
    else if (iconId) { try { art = picto(iconId as PictoId); } catch { art = ''; } }
    const t = h('div', { class: 'toast' }, art ? frag(`<span class="ico toast-ic" aria-hidden="true">${art}</span>`) : null, h('span', null, text));
    toastLayer.append(t);
    while (toastLayer.children.length > 3) toastLayer.firstElementChild?.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 200); }, TOAST_MS);
  }

  const ui: Ui = {
    root,
    show,
    hud,
    toast,
    nav,
    get device() { return device; },
    setDevice(d: Device) {
      if (d === device) return;
      device = d;
      root.dataset.device = d;
      renderGlyphs(root, d);
      current?.onDevice?.(d);
    },
    setScale(s: UiScale) { scale = s; html.style.setProperty('--ui-scale', String(s)); measure(); },
    applySettings(s: Settings) {
      ui.setScale(s.uiScale);
      html.dataset.ksColor = s.colorMode;
      reducedFlashes = s.reduceFlashes;
      root.dataset.flash = s.reduceFlashes ? 'reduced' : 'full';
    },
    destroy() {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('pointermove', onPointer);
      root.removeEventListener('ks-glyphs', onGlyphs);
      ro?.disconnect();
      hud.unmount();
      current?.destroy?.();
      root.replaceChildren();
      root.classList.remove('ks-ui', 'has-screen');
      html.classList.remove('ks-ui-root');
    },
  };
  return ui;
}
