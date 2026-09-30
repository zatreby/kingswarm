// In-battle HUD (onboarding-ux.md section 2). update() runs every animation frame: every field
// goes through a cache slot and the DOM is written only when the visible value changes.
// Anchored elements move with transforms only, so a frame never forces layout.
import { HEROES } from './catalog';
import { BoolSlot, NumSlot, PosSlot, TextSlot } from './diff';
import { crowns, frag, h, icon, mutationBadge, portrait } from './dom';
import { cooldownLabel, formatClock, quantize } from './format';
import { glyphSlot } from './glyphs';
import { abilityIcon, heroIcon, picto } from './icons';
import type { Bark, HintPrompt, Hud, HudFrame, HudStatic } from './types';

const MESSAGE_MS = 2000;
const BARK_MS = 2600;
const BARK_POOL = 4;
const WARN_AT = 30;
const PIE_STEPS = 120;
const BAR_STEPS = 200;
const PIE_C = 2 * Math.PI * 25; // pie circle r=25, stroke 50

interface CdButton {
  el: HTMLButtonElement;
  arc: SVGCircleElement;
  num: TextSlot;
  q: NumSlot;
  ready: BoolSlot;
}

function cdButton(cls: string, iconHtml: string, label: string, verb: 'ability' | 'ultimate' | 'dash' | 'recall', name: string | null, onClick?: () => void): CdButton {
  const el = h('button', { type: 'button', class: `abtn ${cls}`, tabindex: '-1', 'aria-label': label });
  el.append(frag(`<span class="abtn-ic">${iconHtml}</span>`
    + `<svg class="abtn-cd" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="25" stroke-dasharray="${PIE_C.toFixed(2)}" stroke-dashoffset="${PIE_C.toFixed(2)}"/></svg>`
    + `<span class="abtn-num" aria-hidden="true"></span>`
    + glyphSlot(verb, 'abtn-gl')));
  if (name) el.append(h('span', { class: 'abtn-name', 'aria-hidden': 'true' }, name));
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

export function createHud(layer: HTMLElement, reducedFlashes: () => boolean): Hud {
  let root: HTMLElement | null = null;
  let mounted = false;

  // Elements and slots (created on mount).
  let timerPill!: HTMLElement, timerText!: TextSlot, timerS = new NumSlot();
  let crownBar!: HTMLElement, cbBlue!: HTMLElement, cbRed!: HTMLElement;
  const qBlue = new NumSlot(), qRed = new NumSlot();
  let bYou!: TextSlot, bRival!: TextSlot;
  let livesWrap!: HTMLElement;
  let chipFrenzy!: HTMLElement, chipRampage!: HTMLElement, chipRampageT!: TextSlot, chipOT!: HTMLElement;
  let msg!: HTMLElement, msgTimer = 0;
  let swarm!: HTMLElement, swWith!: TextSlot, swCap!: TextSlot, swAway!: TextSlot, swAwayEl!: HTMLElement;
  const swPos = new PosSlot();
  let hint!: HTMLElement, hintData: HintPrompt | null = null;
  const hintPos = new PosSlot();
  let respawn!: HTMLElement, respawnT!: TextSlot;
  let rivalAb!: { el: HTMLElement; arc: SVGCircleElement; q: NumSlot; ready: BoolSlot }[];
  let btnAbility!: CdButton, btnUlt!: CdButton, btnDash!: CdButton, btnRecall!: CdButton;
  const bWarn = new BoolSlot(), bCrown = new BoolSlot(), bFrenzy = new BoolSlot(), bOT = new BoolSlot(), bRespawn = new BoolSlot();
  const sRampage = new NumSlot(), sRespawn = new NumSlot(), sAway = new NumSlot();
  const barks: { el: HTMLElement; text: HTMLElement; team: 0 | 1; pos: PosSlot; timer: number; live: boolean }[] = [];
  let lastYouX = NaN, lastYouY = NaN;
  let crownHold = 10;

  function mount(m: HudStatic): void {
    if (mounted) unmount();
    mounted = true;
    crownHold = m.crownHold;
    const hero = HEROES[m.hero];

    const timerEl = h('b', { class: 'timer-t' });
    timerText = new TextSlot(timerEl);
    timerPill = h('div', { class: 'pill timer', role: 'timer', 'aria-label': 'Time left' },
      h('span', { class: 'timer-ic', html: picto('hourglass') + picto('alarm'), 'aria-hidden': 'true' }),
      timerEl);

    cbBlue = h('span', { class: 'cb-fill' });
    cbRed = h('span', { class: 'cb-fill' });
    crownBar = h('div', { class: 'crownbar', role: 'group', 'aria-label': `Crown hold, ${crownHold} seconds to win` },
      h('span', { class: 'cb-team cb-team-blue', html: picto('critter'), 'aria-hidden': 'true' }),
      h('span', { class: 'cb-side cb-blue' }, cbBlue),
      h('span', { class: 'cb-crown', html: picto('crown'), 'aria-hidden': 'true' }),
      h('span', { class: 'cb-side cb-red' }, cbRed),
      h('span', { class: 'cb-team cb-team-red', html: picto('critterRed'), 'aria-hidden': 'true' }),
      h('span', { class: 'cb-label' }, `Hold the Crown ${crownHold} s`));

    const rampT = h('span', null);
    chipRampageT = new TextSlot(rampT);
    chipFrenzy = h('span', { class: 'pill state-chip chip-frenzy' }, icon(picto('frenzy')), 'Frenzy: hatching ×2');
    chipRampage = h('span', { class: 'pill state-chip chip-rampage' }, icon(picto('flame')), rampT);
    chipOT = h('span', { class: 'pill state-chip chip-ot' }, icon(picto('bolt')), 'Overtime: next capture wins');
    msg = h('div', { class: 'pill hud-msg', role: 'status', 'aria-live': 'polite' });

    const bYouEl = h('b', { class: 'bcount' });
    const bRivalEl = h('b', { class: 'bcount' });
    bYou = new TextSlot(bYouEl);
    bRival = new TextSlot(bRivalEl);
    livesWrap = h('span', { class: 'hud-lives' }, crowns(m.lives, m.maxLives));

    rivalAb = [0, 1].map(i => {
      const a = HEROES[m.rival.hero].abilities[i];
      const el = h('span', { class: 'rab', role: 'img', 'aria-label': `Rival ${a.name}` });
      el.append(frag(`<span class="rab-ic">${abilityIcon(a.icon)}</span><svg class="rab-cd" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="25" stroke-dasharray="${PIE_C.toFixed(2)}" stroke-dashoffset="0"/></svg><span class="rab-ready" aria-hidden="true">!</span>`));
      return { el, arc: el.querySelector('circle')!, q: new NumSlot(), ready: new BoolSlot() };
    });

    const pauseBtn = h('button', { type: 'button', class: 'pause-btn', tabindex: '-1', 'aria-label': 'Pause' });
    pauseBtn.append(frag(picto('pause') + glyphSlot('pause', 'pause-gl')));
    pauseBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); m.onPause?.(); });

    btnUlt = cdButton('abtn-ult', abilityIcon(hero.abilities[1].icon), `${hero.abilities[1].name} (ultimate)`, 'ultimate', hero.abilities[1].name, m.onUltimate);
    btnAbility = cdButton('abtn-ab', abilityIcon(hero.abilities[0].icon), hero.abilities[0].name, 'ability', hero.abilities[0].name, m.onAbility);
    btnDash = cdButton('abtn-dash', abilityIcon('dash'), 'Dash', 'dash', 'Dash', m.onDash);
    btnRecall = cdButton('abtn-recall', abilityIcon('recall'), 'Recall', 'recall', 'Recall', m.onRecall);

    const swWithEl = h('b', null), swCapEl = h('span', { class: 'sw-cap' });
    swAwayEl = h('small', { class: 'sw-away' });
    swWith = new TextSlot(swWithEl); swCap = new TextSlot(swCapEl); swAway = new TextSlot(swAwayEl);
    swarm = h('div', { class: 'anchor off' }, h('div', { class: 'swarm-badge', role: 'status', 'aria-label': 'Swarm with you' },
      h('span', { class: 'sw-ic', html: picto('critter'), 'aria-hidden': 'true' }), swWithEl, swCapEl, swAwayEl));

    hint = h('div', { class: 'anchor off' }, h('div', { class: 'hint' }));

    const rsp = h('b', null);
    respawnT = new TextSlot(rsp);
    respawn = h('div', { class: 'pill respawn' }, icon(heroIcon(m.hero), 'respawn-ic'), h('span', null, 'Your King fell · back in '), rsp);

    barks.length = 0;
    const barkLayer = h('div', { class: 'barks' });
    for (let i = 0; i < BARK_POOL; i++) {
      const text = h('span', { class: 'bark-t' });
      const el = h('div', { class: 'anchor off' }, h('div', { class: 'bark' }, h('span', { class: 'bark-who', 'aria-hidden': 'true' }), text));
      barks.push({ el, text, team: 1, pos: new PosSlot(), timer: 0, live: false });
      barkLayer.append(el);
    }

    root = h('div', { class: 'hud' },
      h('div', { class: 'hud-tl' }, h('div', { class: 'pill hud-you' }, h('span', { class: 'b-ic', html: picto('hut'), 'aria-hidden': 'true' }), bYouEl, h('span', { class: 'sr' }, ' buildings')), livesWrap),
      h('div', { class: 'hud-tc' }, timerPill, crownBar, h('div', { class: 'state-chips' }, chipFrenzy, chipRampage, chipOT), msg),
      h('div', { class: 'hud-tr' },
        h('div', { class: 'hud-rival-col' },
          h('div', { class: 'pill rival-chip' },
            portrait(m.rival.portrait, 'rc-portrait', true),
            h('span', { class: 'rc-name' }, m.rival.name),
            h('span', { class: 'b-ic', html: picto('hut', true), 'aria-hidden': 'true' }), bRivalEl, h('span', { class: 'sr' }, ' buildings')),
          h('div', { class: 'rival-abs' }, ...rivalAb.map(r => r.el))),
        pauseBtn),
      h('div', { class: 'hud-bl' }, btnUlt.el, btnAbility.el, btnDash.el, btnRecall.el),
      h('div', { class: 'hud-br', 'aria-label': 'Your Mutations' }, ...m.mutations.map(id => mutationBadge(id, { size: 'sm' }))),
      respawn, swarm, hint, barkLayer);
    layer.append(root);
    root.dispatchEvent(new CustomEvent('ks-glyphs', { bubbles: true }));
    for (const s of [timerS, qBlue, qRed, sRampage, sRespawn, sAway]) s.reset();
    for (const s of [bWarn, bCrown, bFrenzy, bOT, bRespawn]) s.reset();
    swPos.reset(); hintPos.reset();
  }

  function update(f: HudFrame): void {
    if (!mounted) return;
    const flash = !reducedFlashes();

    // Timer: text changes once per second; warn state flips once.
    if (timerS.changed(Math.ceil(f.time - 1e-6))) timerText.set(formatClock(f.time));
    const warn = f.time <= WARN_AT && f.time > 0 && !f.overtime;
    if (bWarn.changed(warn)) timerPill.classList.toggle('warn', warn);
    if (bOT.changed(f.overtime)) { chipOT.classList.toggle('on', f.overtime); timerPill.classList.toggle('ot', f.overtime); }

    if (bCrown.changed(f.crownOpen)) crownBar.classList.toggle('on', f.crownOpen);
    if (f.crownOpen) {
      if (qBlue.changed(quantize(f.crownBlue, BAR_STEPS))) cbBlue.style.transform = `scaleX(${qBlue.value / BAR_STEPS})`;
      if (qRed.changed(quantize(f.crownRed, BAR_STEPS))) cbRed.style.transform = `scaleX(${qRed.value / BAR_STEPS})`;
    }
    if (bFrenzy.changed(f.frenzy)) chipFrenzy.classList.toggle('on', f.frenzy);
    if (sRampage.changed(f.rampage)) {
      chipRampage.classList.toggle('on', f.rampage !== -1);
      chipRampage.classList.toggle('rival', f.rampage === 1);
      chipRampageT.set(f.rampage === 1 ? 'Rival on Rampage' : f.rampage === 0 ? 'You are on Rampage' : '');
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

    if (bRespawn.changed(f.respawn > 0)) respawn.classList.toggle('on', f.respawn > 0);
    if (f.respawn > 0 && sRespawn.changed(Math.ceil(f.respawn))) respawnT.set(String(Math.ceil(f.respawn)));

    // Anchors that follow Kings.
    if (f.youX === f.youX) { lastYouX = f.youX; lastYouY = f.youY; }
    if (hintData && hintData.anchor === 'you') translate(hint, hintPos, lastYouX, lastYouY);
    for (let i = 0; i < barks.length; i++) {
      const b = barks[i];
      if (!b.live) continue;
      if (b.team === 0 && f.youX === f.youX) translate(b.el, b.pos, f.youX, f.youY);
      else if (b.team === 1 && f.rivalX === f.rivalX) translate(b.el, b.pos, f.rivalX, f.rivalY);
    }
  }

  function unmount(): void {
    if (!mounted) return;
    mounted = false;
    clearTimeout(msgTimer);
    barks.forEach(b => clearTimeout(b.timer));
    root?.remove();
    root = null;
    hintData = null;
  }

  function prompt(p: HintPrompt | null): void {
    if (!mounted) return;
    hintData = p;
    const box = hint.firstElementChild as HTMLElement;
    if (!p) { hint.classList.add('off'); box.replaceChildren(); hintPos.reset(); return; }
    box.replaceChildren(frag(glyphSlot(p.verb, 'hint-gl')), h('span', { class: 'hint-t' }, p.text));
    // Glyphs fill on the next renderGlyphs pass; do it now for this node.
    hint.dispatchEvent(new CustomEvent('ks-glyphs', { bubbles: true }));
    box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
    hintPos.reset();
    if (p.anchor === 'point') translate(hint, hintPos, p.x ?? NaN, p.y ?? NaN);
    else translate(hint, hintPos, lastYouX, lastYouY);
  }

  function message(text: string): void {
    if (!mounted) return;
    msg.textContent = text;
    msg.classList.remove('on'); void msg.offsetWidth; msg.classList.add('on');
    clearTimeout(msgTimer);
    msgTimer = window.setTimeout(() => msg.classList.remove('on'), MESSAGE_MS);
  }

  function bark(b: Bark): void {
    if (!mounted) return;
    // Reuse a free bubble, or the oldest one.
    let slot = barks.find(x => !x.live);
    if (!slot) slot = barks.reduce((a, x) => (x.timer < a.timer ? x : a));
    clearTimeout(slot.timer);
    slot.live = true;
    slot.team = b.team;
    slot.text.textContent = b.text;
    const bubble = slot.el.firstElementChild as HTMLElement;
    bubble.classList.toggle('blue', b.team === 0);
    bubble.classList.remove('in'); void bubble.offsetWidth; bubble.classList.add('in');
    slot.pos.reset();
    translate(slot.el, slot.pos, b.x, b.y);
    const s = slot;
    s.timer = window.setTimeout(() => { s.live = false; s.el.classList.add('off'); s.pos.reset(); }, BARK_MS);
  }

  function setLives(lives: number): void {
    if (!mounted) return;
    const max = livesWrap.querySelectorAll('.crown-life').length;
    livesWrap.replaceChildren(crowns(lives, max));
  }

  return { mount, update, unmount, prompt, message, bark, setLives };
}
