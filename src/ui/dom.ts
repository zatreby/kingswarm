// Tiny DOM builder and the shared building blocks every screen uses.
import { MUTATIONS, TAGS } from './catalog';
import { glyphSlot } from './glyphs';
import { mutationIcon, picto, silhouette, tagIcon, traitIcon, type PictoId } from './icons';
import type { MutationId, MutationTag, PortraitSource, TraitView, Verb } from './types';

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> | null | undefined;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v as string;
      else if (k === 'html') el.innerHTML = v as string;
      else if (k === 'text') el.textContent = String(v);
      else if (k === 'style') el.style.cssText = v as string;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'object' ? c : String(c));
  }
  return el;
}

/** Parse trusted internal markup (icons, glyph slots) into a node. */
export function frag(html: string): DocumentFragment {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content;
}

export interface BtnOpts {
  kind?: 'gold' | 'plain' | 'link' | 'danger' | 'ghost';
  size?: 'xl' | 'lg' | 'md' | 'sm';
  icon?: string;
  verb?: Verb;
  autofocus?: boolean;
  disabled?: boolean;
  label?: string;
  sub?: string;
  cls?: string;
}

export function btn(text: string, onClick: (() => void) | undefined, o: BtnOpts = {}): HTMLButtonElement {
  const b = h('button', {
    type: 'button',
    class: `btn btn-${o.kind ?? 'plain'} btn-${o.size ?? 'md'} ${o.cls ?? ''}`,
    'aria-label': o.label,
    'aria-disabled': o.disabled ? 'true' : undefined,
    'data-autofocus': o.autofocus ? '' : undefined,
  });
  if (o.icon) b.append(h('span', { class: 'btn-ic', html: o.icon }));
  const t = h('span', { class: 'btn-t' }, text);
  if (o.sub) t.append(h('small', { class: 'btn-sub' }, o.sub));
  b.append(t);
  if (o.verb) b.append(frag(glyphSlot(o.verb, 'btn-gl')));
  if (onClick && !o.disabled) b.addEventListener('click', () => onClick());
  return b;
}

export function icon(html: string, cls = ''): HTMLSpanElement {
  return h('span', { class: 'ico ' + cls, html, 'aria-hidden': 'true' });
}

export function pic(id: PictoId, cls = '', red = false): HTMLSpanElement {
  return icon(picto(id, red), cls);
}

export function tagChip(tag: MutationTag): HTMLSpanElement {
  return h('span', { class: `chip tag tag-${tag}` }, icon(tagIcon(tag)), TAGS[tag].name);
}

export function traitChip(t: TraitView): HTMLSpanElement {
  return h('span', { class: 'chip trait' }, icon(traitIcon(t.icon)), t.label);
}

/** A Mutation as a compact icon with a hover/focus tooltip (name + sentence). */
export function mutationBadge(id: MutationId, opts: { focusable?: boolean; size?: 'sm' | 'md'; tipSide?: 'up' | 'down' } = {}): HTMLElement {
  const info = MUTATIONS[id];
  const el = h('span', {
    class: `mbadge mbadge-${opts.size ?? 'sm'} tagband-${info.tags[0]}${info.tags.length > 1 ? ' duo' : ''}`,
    tabindex: opts.focusable === false ? undefined : '0',
    role: 'img',
    'aria-label': `${info.name}: ${info.text}`,
  }, icon(mutationIcon(id)));
  el.append(h('span', { class: `tip tip-${opts.tipSide ?? 'up'}`, 'aria-hidden': 'true' }, h('b', null, info.name), h('span', null, info.text)));
  return el;
}

/** A Mutation as a labelled chip (icon + name). */
export function mutationChip(id: MutationId): HTMLElement {
  const info = MUTATIONS[id];
  return h('span', { class: `chip mchip tagband-${info.tags[0]}`, title: info.text }, icon(mutationIcon(id)), info.name);
}

/** Row of life crowns. `breaking` animates the crown at that index cracking and falling. */
export function crowns(lives: number, max: number, breaking = -1): HTMLElement {
  const row = h('span', { class: 'crowns', role: 'img', 'aria-label': `${lives} of ${max} crowns left` });
  for (let i = 0; i < max; i++) {
    const alive = i < lives;
    const cls = i === breaking ? 'crown-life breaking' : alive ? 'crown-life' : 'crown-life lost';
    row.append(h('span', { class: cls, html: i === breaking || !alive ? picto('brokenCrown') + picto('crown') : picto('crown') }));
  }
  return row;
}

/** Mount a caller portrait (canvas mounted as is, bitmap copied, URL as <img>) or a silhouette. */
export function portrait(src: PortraitSource | undefined, cls = '', red = true, alt = ''): HTMLElement {
  const frame = h('span', { class: `portrait ${red ? 'portrait-red' : 'portrait-blue'} ${cls}`, role: alt ? 'img' : undefined, 'aria-label': alt || undefined });
  if (!src) frame.innerHTML = silhouette(red);
  else if (typeof src === 'string') frame.append(h('img', { src, alt: '', draggable: 'false' }));
  else if (src instanceof HTMLCanvasElement) frame.append(src);
  else {
    const c = h('canvas', { width: String(src.width), height: String(src.height) });
    c.getContext('2d')?.drawImage(src, 0, 0);
    frame.append(c);
  }
  return frame;
}

/** Screen shell: dimmed backdrop, dialog semantics, labelled by its title. */
export function shell(id: string, label: string, cls = ''): HTMLElement {
  return h('section', { class: `scr scr-${id} ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': label, 'data-screen': id });
}

export function title(text: string, cls = ''): HTMLElement {
  return h('h1', { class: 'display ' + cls }, text);
}

export function focusables(root: ParentNode): HTMLElement[] {
  const list = root.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"], input:not([disabled]), [role="slider"]');
  const out: HTMLElement[] = [];
  list.forEach(el => {
    if (el.getAttribute('aria-disabled') === 'true' && !el.classList.contains('nav-ok')) return;
    if (el.closest('[inert], .hidden')) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) out.push(el);
  });
  return out;
}
