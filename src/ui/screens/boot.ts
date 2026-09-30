import { btn, h, pic, shell } from '../dom';
import { picto } from '../icons';
import type { BootModel } from '../types';
import type { Ctx, ScreenInst } from './common';

/** First launch: a quiet loading state, then one big Play button over the live arena. */
export function bootScreen(m: BootModel, _ctx: Ctx): ScreenInst {
  const el = shell('boot', 'Kingswarm');
  let fill: HTMLElement | null = null;
  let bar: HTMLElement | null = null;

  const render = (mm: BootModel) => {
    el.replaceChildren();
    el.classList.toggle('is-ready', !!mm.onPlay);
    if (!mm.onPlay) {
      fill = h('span', { class: 'loadbar-fill' });
      bar = h('span', { class: 'loadbar', role: 'progressbar', 'aria-label': 'Loading', 'aria-valuemin': '0', 'aria-valuemax': '100' }, fill);
      el.append(h('div', { class: 'boot-load' }, pic('crown', 'boot-crown'), bar, h('p', { class: 'boot-t' }, 'Setting up the island…')));
      setProgress(mm.progress ?? 0);
    } else {
      fill = bar = null;
      const play = btn('Play', mm.onPlay, { kind: 'gold', size: 'xl', icon: picto('play'), autofocus: true, cls: 'btn-play', label: 'Play' });
      el.append(h('div', { class: 'boot-ready' }, play, h('p', { class: 'boot-sub' }, 'Mouse, keyboard or controller')));
    }
  };
  const setProgress = (p: number) => {
    if (!fill || !bar) return;
    const v = Math.max(0, Math.min(1, p));
    fill.style.transform = `scaleX(${v})`;
    bar.setAttribute('aria-valuenow', String(Math.round(v * 100)));
  };
  render(m);

  let ready = !!m.onPlay;
  return {
    el,
    update: ((mm: BootModel) => {
      if (!!mm.onPlay !== ready) { ready = !!mm.onPlay; render(mm); if (ready) (el.querySelector('[data-autofocus]') as HTMLElement | null)?.focus({ preventScroll: true }); }
      else if (!ready) setProgress(mm.progress ?? 0);
    }) as ScreenInst['update'],
  };
}
