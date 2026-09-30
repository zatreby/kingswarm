// UI lab: every screen against fake data, over a static diorama screenshot.
//   /lab/ui.html?screen=<id>[&device=kbm|gamepad|touch][&scale=1|1.25|1.5][&color=default|orange|highContrast][&chrome=1]
// Screen-specific: boot&loading=1, title&save=0, rivalCard&boss=1, hud&state=early|crown|ot|down, result&outcome=loss,
//   draft&duo=1|&owned=0, codex&tab=rivals|heroes, howto&device=gamepad
import {
  createUi, DEFAULT_SETTINGS, MUTATION_IDS, MUTATIONS, newHudFrame,
  type CodexRivalView, type Device, type HudFrame, type MutationId, type RivalView, type ScreenModel, type Settings, type UiScale,
} from '../src/ui/index';

const q = new URLSearchParams(location.search);
const screen = q.get('screen') ?? 'title';
const log = (...a: unknown[]) => console.log('[ui-lab]', ...a);

const RIVALS: RivalView[] = [
  { id: 'bumble', name: 'Bumble the Meek', title: 'Keeper of the Big Sack', hero: 'brawler', mutations: [],
    traits: [{ icon: 'hoard', label: 'Hoarder' }, { icon: 'slow', label: 'Slow' }],
    question: 'Can you grab his huts before the blob rolls?', flaw: 'Predictable and slow: kite, split-fire, take his huts while he hoards.' },
  { id: 'pip', name: 'Pip the Tinkerer', title: 'Lamplighter of the Towers', hero: 'warden', mutations: ['archerHuts'],
    traits: [{ icon: 'fortify', label: 'Fortifier' }, { icon: 'patient', label: 'Patient' }],
    question: 'Can you crack a fortress that never leaves home?', flaw: 'Never leaves his half early: win the economy, out-range his turret, bait it.' },
  { id: 'brood', name: 'Mother Brood', title: 'Hatcher of a Thousand', hero: 'brawler', mutations: ['splitters', 'bigLitter'],
    traits: [{ icon: 'flood', label: 'Flooder' }, { icon: 'spread', label: 'Spreads thin' }],
    question: 'Can you thin out a flood?', flaw: 'Spread thin: area damage and a held Well beat her; her King is lightly guarded.' },
  { id: 'gorm', name: 'Gorm the Glutton', title: 'Belly of the Hills', hero: 'brawler', mutations: ['brutes'],
    traits: [{ icon: 'allIn', label: 'All-in' }, { icon: 'heavy', label: 'Heavy' }],
    question: 'Can you punish an empty base?', flaw: 'After the wave his base is empty for several seconds: counter-raid.' },
  { id: 'sable', name: 'Queen Sable', title: 'The Shimmering', hero: 'blink', mutations: ['homing', 'frostbite'],
    traits: [{ icon: 'feint', label: 'Feints' }, { icon: 'ambush', label: 'Ambusher' }],
    question: 'Can you dodge the blink and catch her?', flaw: 'Splits her swarm, so each half is weak; dodge the ambush and she is exposed.' },
  { id: 'mora', name: 'King Mora the Crowned', title: 'Keeper of the Crown', hero: 'warden', mutations: ['royalGuard', 'bombers', 'secondWind'], boss: true,
    traits: [{ icon: 'guard', label: 'Guarded' }, { icon: 'storm', label: 'Crown rush' }],
    question: 'Can you break his Guard, twice?', flaw: 'Second Wind is one-time; break the Guard first; two lives of pressure.' },
];
const R = Object.fromEntries(RIVALS.map(r => [r.id, r])) as Record<string, RivalView>;
const LADDER = ['Bumble the Meek', 'Pip the Tinkerer', 'Gorm the Glutton', 'Queen Sable', 'King Mora the Crowned'];
const CL_PERKS = ['Rivals gain a Mutation', 'Elite rematch after a loss', 'Shorter Crown timer', 'Two-phase early rivals', 'Rivals gain a second Mutation', 'Faster rival tells', 'One life only', 'The Crowned King returns'];

let settings: Settings = { ...DEFAULT_SETTINGS };
const ui = createUi(document.getElementById('ui')!);
(window as unknown as { __ui: typeof ui }).__ui = ui;

const device = (q.get('device') as Device | null) ?? 'kbm';
ui.setDevice(device);
if (q.get('scale')) { settings.uiScale = Number(q.get('scale')) as UiScale; }
if (q.get('color')) settings.colorMode = q.get('color') as Settings['colorMode'];
ui.applySettings(settings);

let stopHud: (() => void) | null = null;

function go(id: string): void {
  stopHud?.(); stopHud = null;
  ui.hud.unmount();
  if (id === 'hud') { ui.show({ screen: 'none' }); startHud(); return; }
  ui.show(model(id));
}

function model(id: string): ScreenModel {
  switch (id) {
    case 'boot':
      return { screen: 'boot', progress: 0.62 };
    case 'title':
      return q.get('save') === '0'
        ? { screen: 'title', version: 'v1.0.0-alpha.0', onNewRun: () => go('heroPick'), onCodex: () => go('codex'), onSettings: () => go('settings') }
        : { screen: 'title', version: 'v1.0.0-alpha.0', continueRun: { hero: 'brawler', battle: { index: 3, total: 5 }, lives: 1, maxLives: 2 },
          onContinue: () => go('rivalCard'), onNewRun: () => go('heroPick'), onCodex: () => go('codex'), onSettings: () => go('settings') };
    case 'heroPick':
      return { screen: 'heroPick', selected: 'brawler',
        heroes: [{ id: 'brawler' }, { id: 'blink' }, { id: 'warden', locked: 'Win a run with Blink' }],
        crownLevel: { value: 2, maxByHero: { brawler: 3, blink: 1 }, cap: 8, perks: CL_PERKS },
        onPick: (h, cl) => { log('pick', h, cl); go('rivalCard'); }, onBack: () => go('title') };
    case 'rivalCard':
      return { screen: 'rivalCard', rival: q.get('boss') ? R.mora : R.pip, battle: q.get('boss') ? { index: 5, total: 5, boss: true } : { index: 2, total: 5 },
        lives: 2, maxLives: 2, durationMs: Number(q.get('dur') ?? 3000), onDone: () => go('hud') };
    case 'pause':
      return { screen: 'pause', battle: { index: 2, total: 5 }, rivalName: 'Pip the Tinkerer',
        onResume: () => go('hud'), onRestart: () => go('rivalCard'), onHowTo: () => ui.show({ screen: 'howto', onBack: () => go('pause') }),
        onSettings: () => ui.show(settingsModel(() => go('pause'))), onAbandon: () => go('runOver') };
    case 'settings':
      return settingsModel(() => go('title'));
    case 'result':
      return q.get('outcome') === 'loss'
        ? { screen: 'result', outcome: 'loss', facts: ['Crown held 8.4 of 10 s', 'Their Throne fell to 9%', 'Swarm peak 38'], rivalName: 'Pip the Tinkerer',
          battle: { index: 2, total: 5 }, livesBefore: 2, livesAfter: 1, maxLives: 2, lossNote: 'Lose 2 Crowns and the run ends.',
          onPrimary: () => go('rivalCard'), onMenu: () => go('title') }
        : { screen: 'result', outcome: 'win', facts: ['Throne taken at 1:12', 'Swarm peak 46', '3 huts stolen from Pip'], rivalName: 'Pip the Tinkerer',
          battle: { index: 2, total: 5 }, livesBefore: 2, livesAfter: 2, maxLives: 2, onPrimary: () => go('draft'), onMenu: () => go('title') };
    case 'draft': {
      const options: MutationId[] = q.get('duo') === '0' ? ['bombers', 'splitters', 'frostbite'] : ['bombers', 'cryoBombs', 'longArm'];
      return { screen: 'draft', options, rerolls: Number(q.get('rerolls') ?? 1), owned: q.get('owned') === '0' ? [] : ['frostbite', 'splitters'],
        next: R.brood, nextBattle: { index: 3, total: 5 },
        onPick: (m) => { log('picked', m); ui.toast(`${MUTATIONS[m].name} joins your swarm`, m); go('rivalCard'); },
        onReroll: () => { log('reroll'); ui.show({ ...(model('draft') as Extract<ScreenModel, { screen: 'draft' }>), options: ['scorch', 'militia', 'homing'], rerolls: 0 }); },
        onSkip: () => go('rivalCard') };
    }
    case 'runOver':
      return { screen: 'runOver', hero: 'brawler', build: ['frostbite', 'splitters', 'longArm'], ladder: LADDER, beaten: 2,
        nearMiss: 'Crown held 8.4 of 10 s vs Gorm', unlocks: [
          { kind: 'mutation', label: 'Scorch', detail: 'Now in the draft', mutation: 'scorch' },
          { kind: 'hero', label: 'Blink', detail: 'Fragile, mobile', hero: 'blink' }],
        assistOffer: { onAccept: () => log('assist on') }, onNewRun: () => go('heroPick'), onTitle: () => go('title') };
    case 'runWon':
      return { screen: 'runWon', hero: 'blink', build: ['bombers', 'cryoBombs', 'frostbite', 'rapidFire', 'secondWind'], time: 845, crownLevel: 1,
        unlocks: [{ kind: 'crownLevel', label: 'Crown Level 2', detail: 'Elite rematch after a loss' }, { kind: 'hero', label: 'Warden', detail: 'Slow. Holds ground.', hero: 'warden' },
          { kind: 'mutation', label: 'Chain Reaction', detail: 'A Duo joins the pool', mutation: 'chainReaction' }],
        onNewRun: () => go('heroPick'), onTitle: () => go('title') };
    case 'codex': {
      const found = new Set<MutationId>(['bombers', 'shockwave', 'splitters', 'bigLitter', 'frostbite', 'homing', 'longArm', 'rapidFire', 'trample', 'cryoBombs', 'militia']);
      const picks: Partial<Record<MutationId, number>> = { bombers: 4, frostbite: 3, splitters: 2, longArm: 5, cryoBombs: 1, rapidFire: 2 };
      const rivals: CodexRivalView[] = RIVALS.map((r, i) => ({ rival: r, met: i < 4, beaten: i < 2,
        best: i < 2 ? [{ hero: 'brawler', crownLevel: i === 0 ? 3 : 1, result: 'Won' }, ...(i === 0 ? [{ hero: 'blink' as const, crownLevel: 0, result: 'Won' }] : [])] : i < 4 ? [{ hero: 'brawler', crownLevel: 0, result: 'Lost' }] : [] }));
      return { screen: 'codex', tab: (q.get('tab') as 'mutations' | 'rivals' | 'heroes' | null) ?? 'mutations',
        mutations: MUTATION_IDS.map(id => ({ id, discovered: found.has(id), picks: picks[id] ?? 0 })),
        rivals, heroes: [{ id: 'brawler', unlocked: true, runsWon: 3, bestCrownLevel: 3 }, { id: 'blink', unlocked: true, runsWon: 1, bestCrownLevel: 1 },
          { id: 'warden', unlocked: false, unlockHint: 'Win a run with Blink', runsWon: 0, bestCrownLevel: 0 }],
        onBack: () => go('title') };
    }
    case 'howto':
      return { screen: 'howto', onBack: () => go('pause') };
    default:
      return { screen: 'none' };
  }
}

function settingsModel(back: () => void): ScreenModel {
  return { screen: 'settings', settings, onChange: (s) => { settings = s; log('settings', JSON.stringify(s)); }, onResetProgress: () => ui.toast('Progress reset'), onBack: back };
}

/** Fake battle state driving the HUD every frame. */
function startHud(): void {
  const state = q.get('state') ?? 'crown';
  const W = () => innerWidth, H = () => innerHeight;
  ui.hud.mount({ hero: 'brawler', rival: { name: 'Pip the Tinkerer', hero: 'warden' }, maxLives: 2, lives: 1,
    mutations: ['frostbite', 'splitters', 'cryoBombs'], crownHold: 10,
    onAbility: () => log('ability'), onUltimate: () => log('ultimate'), onDash: () => log('dash'), onRecall: () => log('recall'),
    onPause: () => go('pause') });
  const f: HudFrame = newHudFrame();
  const t0 = performance.now();
  const base = state === 'early' ? 96 : state === 'ot' ? 0 : 24.6;
  let raf = 0;
  const tick = () => {
    const t = (performance.now() - t0) / 1000;
    f.time = Math.max(0, base - t);
    f.overtime = state === 'ot';
    f.crownOpen = state !== 'early';
    f.frenzy = f.crownOpen;
    f.rampage = state === 'crown' ? 1 : -1;
    f.crownBlue = Math.min(1, 0.62 + t * 0.01); f.crownRed = 0.34;
    f.buildingsBlue = 5; f.buildingsRed = 4;
    // Blue King in spike3.png sits at about (0.324, 0.489) of the frame; the rival at (0.634, 0.40).
    f.youX = W() * 0.324; f.youY = H() * 0.47;
    f.rivalX = W() * 0.634; f.rivalY = H() * 0.37;
    f.swarmX = f.youX; f.swarmY = f.youY + H() * 0.05;
    f.swarmWith = 12; f.swarmCap = 30; f.swarmAway = 17;
    f.abilityCd = state === 'early' ? 0 : 3.4; f.abilityCdMax = 8;
    f.ultimateCd = state === 'early' ? 11 : 0; f.ultimateCdMax = 20;
    f.dashCd = 0; f.dashCdMax = 2.2;
    f.recallCd = 0.8; f.recallCdMax = 3;
    f.rivalAbility = 1; f.rivalUltimate = 0.45;
    f.respawn = state === 'down' ? 3.2 - Math.min(3.1, t) : 0;
    ui.hud.update(f);
    raf = requestAnimationFrame(tick);
  };
  tick();
  if (state === 'early') ui.hud.prompt({ text: 'Hold click. Throw your swarm.', verb: 'fire', anchor: 'you' });
  if (state !== 'early') ui.hud.message('The Crown is open!');
  ui.hud.bark({ text: 'My towers never sleep!', x: f.rivalX, y: f.rivalY, team: 1 });
  stopHud = () => cancelAnimationFrame(raf);
}

if (screen === 'boot') {
  ui.show(model('boot'));
  if (!q.get('loading')) setTimeout(() => ui.show({ screen: 'boot', onPlay: () => go('hud') }), 350);
} else go(screen);

// Lab conveniences: screen links (with &chrome=1) and a minimal gamepad poller driving ui.nav.
if (q.get('chrome')) {
  document.body.classList.add('chrome');
  const bar = document.getElementById('labbar')!;
  for (const s of ['boot', 'title', 'heroPick', 'rivalCard', 'hud', 'pause', 'settings', 'result', 'draft', 'runOver', 'runWon', 'codex', 'howto']) {
    const a = document.createElement('a'); a.href = `?screen=${s}&chrome=1`; a.textContent = s; bar.append(a);
  }
}
const prev: boolean[] = [];
function pollPad(): void {
  const pad = navigator.getGamepads?.().find(p => p);
  if (pad) {
    const map: [number, Parameters<typeof ui.nav>[0]][] = [[12, 'up'], [13, 'down'], [14, 'left'], [15, 'right'], [0, 'accept'], [1, 'back']];
    for (const [i, a] of map) {
      const down = !!pad.buttons[i]?.pressed;
      if (down && !prev[i]) { ui.setDevice('gamepad'); ui.nav(a); }
      prev[i] = down;
    }
  }
  requestAnimationFrame(pollPad);
}
pollPad();
addEventListener('keydown', () => { if (ui.device !== 'kbm' && !q.get('device')) ui.setDevice('kbm'); });
