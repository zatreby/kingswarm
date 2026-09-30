// In-battle HUD (onboarding-ux.md section 2). update() runs every animation frame: every field
// goes through a cache slot and the DOM is written only when the visible value changes.
// Anchored elements move with transforms only, so a frame never forces layout.
//
// Layout (director review round 2):
//   top-left   one pill: your building count | your life crowns
//   top-centre ONE row: [blue Crown side] [timer pill] [red Crown side]; state badges and the Crown
//              hang off the pill's lower edge; a single transient message line sits under it.
//   top-right  rival pill (portrait, name, buildings) with the rival's two readiness plates attached, pause.
//   bottom     ability cluster (left; mirrored right on touch), owned Mutations (right).
//   world      swarm badge, hint, barks (kept out of the top band), respawn chip over your Throne.
import { HEROES } from './catalog';
import { BoolSlot, NumSlot, PosSlot, TextSlot } from './diff';
import { crowns, frag, h, icon, mutationBadge, portrait } from './dom';
import { cooldownLabel, formatClock, quantize } from './format';
import { glyphSlot } from './glyphs';
import { abilityIcon, heroIcon, picto } from './icons';
import type { Bark, HintPrompt, Hud, HudFrame, HudStatic } from './types';

const MESSAGE_MS = 2000;
const CROWN_HINT_MS = 3000;
const MESSAGE_QUEUE = 3;
const BARK_MS = 2600;
const BARK_POOL = 4;
const WARN_AT = 30;
const PIE_STEPS = 120;
const BAR_STEPS = 200;
const PIE_C = 2 * Math.PI * 25; // pie circle r=25, stroke 50

// World-anchored bubbles never enter the top HUD band (timer row, badges, message line, the rival
// cluster). Values in rem, matching hud.css.
const TOP_BAND = 12.5;
const BUBBLE_ABOVE = 7;   // bubble bottom sits this far above the anchor
const BUBBLE_BELOW = 4;   // flipped: bubble top sits this far below the anchor
const EDGE = 1.2;

interface CdButton {
  el: HTMLButtonElement;
  arc: SVGCircleElement;
  num: TextSlot;
  q: NumSlot;
  ready: BoolSlot;
}

function cdButton(cls: string, iconHtml: string, label: string, verb: 'ability' | 'ultimate' | 'dash' | 'recall', onClick?: () => void): CdButton {
  const el = h('button', { type: 'button', class: `abtn ${cls}`, tabindex: '-1', 'aria-label': label });
  el.append(frag(`<span class="abtn-ic">${iconHtml}</span>`
    + `<svg class="abtn-cd" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="25" stroke-dasharray="${PIE_C.toFixed(2)}" stroke-dashoffset="${PIE_C.toFixed(2)}"/></svg>`
    + `<span class="abtn-num" aria-hidden="true"></span>`
    + glyphSlot(verb, 'abtn-gl')));
  // Act on press, not release; never steal keyboard focus from the game.
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); onClick?.(); });
  return { el, arc: el.querySelector('circle')!, num: new TextSlot(el.querySelector('.abtn-num')!), q: new NumSlot(), ready: new BoolSlot() };
}

function setCd(b: CdButton, cd: number, max: number, flash: boolean): void {
  const frac = max > 0 ? cd / max : 0;
  if (b.q.changed(quantize(frac, PIE_STEPS))) b.arc.style.strokeDashoffset = String(PIE_C * (1 - b.q.value / PIE_STEPS));
  b.num.set(cooldownLabel(cd));
  const ready = cd <= 0.05;
  if (b.ready.changed(ready)) {
    b.el.classList.toggle('cooling', !ready);
    if (ready && flash) { b.el.classList.remove('pop'); void b.el.offsetWidth; b.el.classList.add('pop'); }
  }
}

/** Move an anchored element by transform; hide it for NaN. Class writes only on visibility flips
 *  (classList.add/remove always dirty the attribute, even when nothing changes). */
function translate(el: HTMLElement, pos: PosSlot, x: number, y: number): void {
  if (!pos.changed(x, y)) return;
  const hidden = pos.px !== pos.px || pos.py !== pos.py;
  if (hidden !== el.classList.contains('off')) el.classList.toggle('off', hidden);
  if (!hidden) el.style.transform = `translate3d(${pos.px}px,${pos.py}px,0)`;
}

/** A speech-style bubble anchored to a world point, kept out of the top band and off the side edges. */
interface Bubble {
  el: HTMLElement;       // zero-size anchor wrapper
  box: HTMLElement;      // the bubble
  pos: PosSlot;
  below: BoolSlot;
  tail: NumSlot;
  estW: number;          // rem
  estH: number;          // rem
}

function bubble(el: HTMLElement, box: HTMLElement): Bubble {
  return { el, box, pos: new PosSlot(), below: new BoolSlot(), tail: new NumSlot(), estW: 20, estH: 4.8 };
}

/** Rough bubble size from its text, in rem (no layout reads): ~0.95rem per character at 1.9rem bold. */
function estimate(b: Bubble, text: string, maxW: number, pad: number): void {
  const one = text.length * 0.95 + pad;
  b.estW = Math.min(maxW, one);
  b.estH = one > maxW ? 7 : 4.8;
}

export function createHud(layer: HTMLElement, reducedFlashes: () => boolean): Hud {
  let root: HTMLElement | null = null;
  let mounted = false;

  // Viewport metrics, refreshed on mount and on resize (never inside update()).
  let rem = 10, vw = 1280;
  const measure = () => {
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
    vw = layer.clientWidth || innerWidth;
    // Force every anchored element to re-place with the new metrics.
    swPos.reset(); hintB.pos.reset(); rspPos.reset();
    for (const b of barks) b.b.pos.reset();
  };

  // Elements and slots (created on mount).
  let hudTc!: HTMLElement;
  let timerPill!: HTMLElement, timerText!: TextSlot;
  const timerS = new NumSlot();
  let cbBlue!: HTMLElement, cbRed!: HTMLElement;
  const qBlue = new NumSlot(), qRed = new NumSlot();
  let bYou!: TextSlot, bRival!: TextSlot;
  let livesWrap!: HTMLElement;
  let badgeFrenzy!: HTMLElement, badgeRampYou!: HTMLElement, badgeRampRival!: HTMLElement, badgeOT!: HTMLElement;
  let msg!: HTMLElement;
  let msgTimer = 0, msgShowing = false;
  const msgQueue: { text: string; ms: number }[] = [];
  let swarm!: HTMLElement, swWith!: TextSlot, swCap!: TextSlot, swAway!: TextSlot, swAwayEl!: HTMLElement;
  const swPos = new PosSlot();
  let hintData: HintPrompt | null = null;
  let hintB: Bubble = bubble(h('div'), h('div'));
  let respawn!: HTMLElement, respawnT!: TextSlot;
  const rspPos = new PosSlot();
  let rivalAb!: { el: HTMLElement; arc: SVGCircleElement; q: NumSlot; ready: BoolSlot }[];
  let btnAbility!: CdButton, btnUlt!: CdButton, btnDash!: CdButton, btnRecall!: CdButton;
  const bWarn = new BoolSlot(), bCrown = new BoolSlot(), bFrenzy = new BoolSlot(), bOT = new BoolSlot(), bRespawn = new BoolSlot();
  const sRampage = new NumSlot(), sRespawn = new NumSlot(), sAway = new NumSlot();
  const barks: { b: Bubble; text: HTMLElement; team: 0 | 1; timer: number; born: number; live: boolean }[] = [];
  let lastYouX = NaN, lastYouY = NaN;
  let crownHold = 10;

  /** Place a bubble: above the anchor unless that would enter the top band, then below it (tail flips up).
   *  x is clamped to the viewport and the tail is shifted so it still points at the anchor. */
  function place(b: Bubble, x: number, y: number): void {
    if (x !== x || y !== y) { translate(b.el, b.pos, NaN, NaN); return; }
    const top = y - (BUBBLE_ABOVE + b.estH) * rem;
    const below = top < TOP_BAND * rem;
    if (b.below.changed(below)) b.box.classList.toggle('below', below);
    const ay = below ? Math.max(y, (TOP_BAND - BUBBLE_BELOW) * rem) : y;
    const half = (b.estW / 2 + EDGE) * rem;
    const ax = Math.min(Math.max(x, half), Math.max(half, vw - half));
    if (b.tail.changed(Math.round(x - ax))) b.box.style.setProperty('--tail-dx', b.tail.value + 'px');
    translate(b.el, b.pos, ax, ay);
  }

  function mount(m: HudStatic): void {
    if (mounted) unmount();
    mounted = true;
    crownHold = m.crownHold;
    const hero = HEROES[m.hero];

    // Top centre: [blue side] [timer] [red side], badges and the Crown under the pill, one message line.
    const timerEl = h('b', { class: 'timer-t' });
    timerText = new TextSlot(timerEl);
    timerPill = h('div', { class: 'pill timer', role: 'timer', 'aria-label': 'Time left' },
      h('span', { class: 'timer-ic', html: picto('hourglass') + picto('alarm'), 'aria-hidden': 'true' }),
      timerEl);

    cbBlue = h('span', { class: 'cb-fill' });
    cbRed = h('span', { class: 'cb-fill' });
    const wingBlue = h('span', { class: 'cb-wing cb-wing-blue', 'aria-hidden': 'true' },
      h('span', { class: 'cb-team', html: picto('critter') }), h('span', { class: 'cb-side cb-blue' }, cbBlue));
    const wingRed = h('span', { class: 'cb-wing cb-wing-red', 'aria-hidden': 'true' },
      h('span', { class: 'cb-side cb-red' }, cbRed), h('span', { class: 'cb-team', html: picto('critterRed') }));

    const badge = (cls: string, art: string, label: string) =>
      h('span', { class: `tc-badge ${cls}`, role: 'img', 'aria-label': label }, icon(art));
    badgeFrenzy = badge('b-frenzy', picto('frenzy'), 'Frenzy: hatching twice as fast');
    badgeRampYou = badge('b-ramp b-ramp-you', picto('flame'), 'You are on Rampage');
    badgeRampRival = badge('b-ramp b-ramp-rival', picto('flame'), 'Rival on Rampage');
    badgeOT = badge('b-ot', picto('bolt'), 'Overtime: next capture wins');
    const crownBadge = h('span', { class: 'tc-crown', role: 'img', 'aria-label': `The Crown is open. Hold it ${crownHold} seconds to win.`, html: picto('crown') });

    msg = h('div', { class: 'pill hud-msg', role: 'status', 'aria-live': 'polite' });
    hudTc = h('div', { class: 'hud-tc' },
      h('div', { class: 'tc-row' }, wingBlue,
        h('div', { class: 'timer-wrap' }, timerPill,
          h('div', { class: 'tc-badges' },
            h('span', { class: 'tc-l' }, badgeRampYou, badgeFrenzy), crownBadge, h('span', { class: 'tc-r' }, badgeRampRival, badgeOT))),
        wingRed),
      msg);

    // Top left: buildings | lives, one pill.
    const bYouEl = h('b', { class: 'bcount' });
    const bRivalEl = h('b', { class: 'bcount' });
    bYou = new TextSlot(bYouEl);
    bRival = new TextSlot(bRivalEl);
    livesWrap = h('span', { class: 'hud-lives' }, crowns(m.lives, m.maxLives));

    // Top right: the rival's readiness plates hang off their pill.
    rivalAb = [0, 1].map(i => {
      const a = HEROES[m.rival.hero].abilities[i];
      const el = h('span', { class: `rab rab-${i ? 'ult' : 'ab'}`, role: 'img', 'aria-label': `Rival ${a.name}${i ? ' (ultimate)' : ''}` });
      el.append(frag(`<span class="rab-ic">${abilityIcon(a.icon)}</span><svg class="rab-cd" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="25" stroke-dasharray="${PIE_C.toFixed(2)}" stroke-dashoffset="0"/></svg>`));
      return { el, arc: el.querySelector('circle')!, q: new NumSlot(), ready: new BoolSlot() };
    });

    const pauseBtn = h('button', { type: 'button', class: 'pause-btn', tabindex: '-1', 'aria-label': 'Pause' });
    pauseBtn.append(frag(picto('pause') + glyphSlot('pause', 'pause-gl')));
    pauseBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); m.onPause?.(); });

    btnUlt = cdButton('abtn-ult', abilityIcon(hero.abilities[1].icon), `${hero.abilities[1].name} (ultimate)`, 'ultimate', m.onUltimate);
    btnAbility = cdButton('abtn-ab', abilityIcon(hero.abilities[0].icon), hero.abilities[0].name, 'ability', m.onAbility);
    btnDash = cdButton('abtn-dash', abilityIcon('dash'), 'Dash', 'dash', m.onDash);
    btnRecall = cdButton('abtn-recall', abilityIcon('recall'), 'Recall', 'recall', m.onRecall);

    const swWithEl = h('b', null), swCapEl = h('span', { class: 'sw-cap' });
    swAwayEl = h('small', { class: 'sw-away' });
    swWith = new TextSlot(swWithEl); swCap = new TextSlot(swCapEl); swAway = new TextSlot(swAwayEl);
    swarm = h('div', { class: 'anchor off' }, h('div', { class: 'swarm-badge', role: 'status', 'aria-label': 'Swarm with you' },
      h('span', { class: 'sw-ic', html: picto('critter'), 'aria-hidden': 'true' }), swWithEl, swCapEl, swAwayEl));

    const hintEl = h('div', { class: 'anchor off' }, h('div', { class: 'hint bubble' }));
    hintB = bubble(hintEl, hintEl.firstElementChild as HTMLElement);

    const rsp = h('b', null);
    respawnT = new TextSlot(rsp);
    respawn = h('div', { class: 'anchor off' }, h('div', { class: 'pill respawn', role: 'status' },
      icon(heroIcon(m.hero), 'respawn-ic'), h('span', null, 'Back in '), rsp));

    barks.length = 0;
    const bubbles = h('div', { class: 'hud-world' }, swarm, respawn, hintEl);
    for (let i = 0; i < BARK_POOL; i++) {
      const text = h('span', { class: 'bark-t' });
      const el = h('div', { class: 'anchor off' }, h('div', { class: 'bark bubble' }, h('span', { class: 'bark-who', 'aria-hidden': 'true' }), text));
      barks.push({ b: bubble(el, el.firstElementChild as HTMLElement), text, team: 1, timer: 0, born: 0, live: false });
      bubbles.append(el);
    }

    root = h('div', { class: 'hud' },
      // World layer first: every edge cluster paints above barks and hints.
      bubbles,
      h('div', { class: 'hud-tl' }, h('div', { class: 'pill hud-you' },
        h('span', { class: 'b-ic', html: picto('hut'), 'aria-hidden': 'true' }), bYouEl, h('span', { class: 'sr' }, ' buildings'),
        h('span', { class: 'hud-sep', 'aria-hidden': 'true' }), livesWrap)),
      hudTc,
      h('div', { class: 'hud-tr' },
        h('div', { class: 'hud-rival-col' },
          h('div', { class: 'pill rival-chip' },
            portrait(m.rival.portrait, 'rc-portrait', true),
            h('span', { class: 'rc-name' }, m.rival.name),
            h('span', { class: 'b-ic', html: picto('hut', true), 'aria-hidden': 'true' }), bRivalEl, h('span', { class: 'sr' }, ' rival buildings')),
          h('div', { class: 'rival-abs' }, ...rivalAb.map(r => r.el))),
        pauseBtn),
      h('div', { class: 'hud-bl' }, btnUlt.el, btnAbility.el, btnDash.el, btnRecall.el),
      h('div', { class: 'hud-br', 'aria-label': 'Your Mutations' }, ...m.mutations.map(id => mutationBadge(id, { size: 'sm' }))));
    layer.append(root);
    root.dispatchEvent(new CustomEvent('ks-glyphs', { bubbles: true }));
    for (const s of [timerS, qBlue, qRed, sRampage, sRespawn, sAway]) s.reset();
    for (const s of [bWarn, bCrown, bFrenzy, bOT, bRespawn]) s.reset();
    msgQueue.length = 0; msgShowing = false;
    measure();
    addEventListener('resize', measure);
  }

  // Messages: one line, one at a time; a short queue so simultaneous events do not overwrite each other.
  function showMsg(text: string, ms: number): void {
    msgShowing = true;
    msg.textContent = text;
    msg.classList.remove('on'); void msg.offsetWidth; msg.classList.add('on');
    clearTimeout(msgTimer);
    msgTimer = window.setTimeout(() => {
      const next = msgQueue.shift();
      if (next) showMsg(next.text, next.ms);
      else { msg.classList.remove('on'); msgShowing = false; }
    }, ms);
  }
  function pushMsg(text: string, ms = MESSAGE_MS): void {
    if (!mounted) return;
    if (msgShowing && msg.textContent === text) return;
    if (msgQueue.some(q => q.text === text)) return;
    if (!msgShowing) { showMsg(text, ms); return; }
    if (msgQueue.length >= MESSAGE_QUEUE) msgQueue.shift();
    msgQueue.push({ text, ms });
  }

  function update(f: HudFrame): void {
    if (!mounted) return;
    const flash = !reducedFlashes();

    // Timer: text changes once per second; warn state flips once.
    if (timerS.changed(Math.ceil(f.time - 1e-6))) timerText.set(formatClock(f.time));
    const warn = f.time <= WARN_AT && f.time > 0 && !f.overtime;
    if (bWarn.changed(warn)) timerPill.classList.toggle('warn', warn);

    // State flips announce themselves once in the message line; the badge stays as the reminder.
    if (bCrown.changed(f.crownOpen)) {
      hudTc.classList.toggle('crown-on', f.crownOpen);
      if (f.crownOpen) pushMsg(`Hold the Crown ${crownHold} s to win`, CROWN_HINT_MS);
    }
    if (f.crownOpen) {
      if (qBlue.changed(quantize(f.crownBlue, BAR_STEPS))) cbBlue.style.transform = `scaleX(${qBlue.value / BAR_STEPS})`;
      if (qRed.changed(quantize(f.crownRed, BAR_STEPS))) cbRed.style.transform = `scaleX(${qRed.value / BAR_STEPS})`;
    }
    if (bFrenzy.changed(f.frenzy)) {
      badgeFrenzy.classList.toggle('on', f.frenzy);
      if (f.frenzy) pushMsg('Frenzy: hatching ×2');
    }
    if (sRampage.changed(f.rampage)) {
      badgeRampYou.classList.toggle('on', f.rampage === 0);
      badgeRampRival.classList.toggle('on', f.rampage === 1);
      if (f.rampage === 0) pushMsg('You are on Rampage!');
      else if (f.rampage === 1) pushMsg('Rival on Rampage!');
    }
    if (bOT.changed(f.overtime)) {
      badgeOT.classList.toggle('on', f.overtime);
      timerPill.classList.toggle('ot', f.overtime);
      if (f.overtime) pushMsg('Overtime: next capture wins', CROWN_HINT_MS);
    }

    bYou.set(String(f.buildingsBlue));
    bRival.set(String(f.buildingsRed));

    // Swarm badge.
    translate(swarm, swPos, f.swarmX, f.swarmY);
    swWith.set(String(f.swarmWith));
    swCap.set('/' + f.swarmCap);
    if (sAway.changed(f.swarmAway)) { swAway.set(f.swarmAway > 0 ? `+${f.swarmAway} away` : ''); swAwayEl.classList.toggle('on', f.swarmAway > 0); }

    setCd(btnAbility, f.abilityCd, f.abilityCdMax, flash);
    setCd(btnUlt, f.ultimateCd, f.ultimateCdMax, flash);
    setCd(btnDash, f.dashCd, f.dashCdMax, flash);
    setCd(btnRecall, f.recallCd, f.recallCdMax, flash);

    for (let i = 0; i < 2; i++) {
      const r = rivalAb[i];
      const v = i === 0 ? f.rivalAbility : f.rivalUltimate;
      if (r.q.changed(quantize(1 - v, PIE_STEPS))) r.arc.style.strokeDashoffset = String(PIE_C * (1 - r.q.value / PIE_STEPS));
      if (r.ready.changed(v >= 1)) r.el.classList.toggle('ready', v >= 1);
    }

    // Respawn chip over your Throne (or top-centre when no Throne position is given).
    const down = f.respawn > 0;
    if (bRespawn.changed(down)) respawn.firstElementChild!.classList.toggle('on', down);
    if (down) {
      if (sRespawn.changed(Math.ceil(f.respawn))) respawnT.set(String(Math.ceil(f.respawn)));
      const tx = f.throneX === f.throneX ? f.throneX : vw / 2;
      const ty = f.throneY === f.throneY ? f.throneY : (TOP_BAND + 6) * rem;
      translate(respawn, rspPos, tx, Math.max(ty, (TOP_BAND + 5) * rem));
    } else translate(respawn, rspPos, NaN, NaN);

    // Anchors that follow Kings.
    if (f.youX === f.youX) { lastYouX = f.youX; lastYouY = f.youY; }
    if (hintData && hintData.anchor === 'you') place(hintB, lastYouX, lastYouY);
    for (let i = 0; i < barks.length; i++) {
      const b = barks[i];
      if (!b.live) continue;
      if (b.team === 0 && f.youX === f.youX) place(b.b, f.youX, f.youY);
      else if (b.team === 1 && f.rivalX === f.rivalX) place(b.b, f.rivalX, f.rivalY);
    }
  }

  function unmount(): void {
    if (!mounted) return;
    mounted = false;
    removeEventListener('resize', measure);
    clearTimeout(msgTimer);
    msgQueue.length = 0; msgShowing = false;
    barks.forEach(b => clearTimeout(b.timer));
    root?.remove();
    root = null;
    hintData = null;
  }

  function prompt(p: HintPrompt | null): void {
    if (!mounted) return;
    hintData = p;
    const box = hintB.box;
    if (!p) { hintB.el.classList.add('off'); box.replaceChildren(); hintB.pos.reset(); return; }
    box.replaceChildren(frag(glyphSlot(p.verb, 'hint-gl')), h('span', { class: 'hint-t' }, p.text));
    // Glyphs fill on the next renderGlyphs pass; do it now for this node.
    hintB.el.dispatchEvent(new CustomEvent('ks-glyphs', { bubbles: true }));
    estimate(hintB, p.text, 40, 8);
    box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
    hintB.pos.reset();
    if (p.anchor === 'point') place(hintB, p.x ?? NaN, p.y ?? NaN);
    else place(hintB, lastYouX, lastYouY);
  }

  function bark(b: Bark): void {
    if (!mounted) return;
    // Reuse a free bubble, or the oldest one.
    let slot = barks.find(x => !x.live);
    if (!slot) slot = barks.reduce((a, x) => (x.born < a.born ? x : a));
    clearTimeout(slot.timer);
    slot.live = true;
    slot.born = performance.now();
    slot.team = b.team;
    slot.text.textContent = b.text;
    estimate(slot.b, b.text, 32, 5.4);
    const box = slot.b.box;
    box.classList.toggle('blue', b.team === 0);
    box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
    slot.b.pos.reset();
    place(slot.b, b.x, b.y);
    const s = slot;
    s.timer = window.setTimeout(() => { s.live = false; s.b.el.classList.add('off'); s.b.pos.reset(); }, BARK_MS);
  }

  function setLives(lives: number): void {
    if (!mounted) return;
    const max = livesWrap.querySelectorAll('.crown-life').length;
    livesWrap.replaceChildren(crowns(lives, max));
  }

  return { mount, update, unmount, prompt, message: (t: string) => pushMsg(t), bark, setLives };
}
