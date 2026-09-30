// The curated sound palette: which source files make each sound id, how they are processed,
// and the loudness table. Data only; audio-build.mjs turns it into public/audio/**.
//
// Nobody on the team can listen, so every pick was made from names plus measurements
// (tools/assets/audio-measure.mjs, audio-music-probe.mjs). Rules that drove the picks:
//  - Woody/soft/organic. No oscillator beeps: the Kenney "8-Bit jingles" (measured pitch 0.99-1.00,
//    a flat square-wave centroid) and the Kenney "confirmation"/"question" UI tones (pitch 0.95-1.00,
//    synthetic arpeggios) were rejected outright. Pitched material is used only where a melody is the
//    point (stings, chimes, horns) and only from the sampled Pizzicato / Steel / Sax jingles.
//  - Never layer two pitched melodies (would risk a clash nobody can hear). Layers are always one
//    pitched element plus noisy/percussive ones (wood/plank/soft impacts, coin/air noise).
//  - "Rise" and "fall" claims are backed by measured contours (f0 track for melodies, spectral
//    centroid sweep for noise), see the pick comments.
//  - Short and clean: every file is trimmed to its onset (<= 1.5 ms lead) and to a hard maxMs.
//
// Loudness table (see FAMILY_TARGET): sounds are normalised per FAMILY to a momentary-max loudness
// (EBU R128 "M", the loudest 400 ms window, LUFS) plus an optional per-sound offset. Small critter
// sounds sit 7-10 dB under the big ones. Music is -18 LUFS integrated; SFX are transient, so their
// M value is comparable to music short-term loudness, not integrated.

export const ROOT = 'assets-src/audio';

// Source folders (short prefixes used below).
export const DIRS = {
  I: 'kenney/impact/Audio',
  UI: 'kenney/interface/Audio',
  R: 'kenney/rpg-audio/Audio',
  J: 'kenney/jingles/Audio',
  C: 'oga/creature-sfx',
  S: 'oga/rpg-sfx',
  W: 'oga/swishes/swishes',
};

// Pack metadata for licenses/audio.md. `url` is where the file was downloaded from.
export const PACKS = {
  I: { name: 'Kenney Impact Sounds 1.0', author: 'Kenney (kenney.nl)', license: 'CC0 1.0', page: 'https://kenney.nl/assets/impact-sounds', url: 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip', proof: 'License.txt in the zip' },
  UI: { name: 'Kenney Interface Sounds 1.0', author: 'Kenney (kenney.nl)', license: 'CC0 1.0', page: 'https://kenney.nl/assets/interface-sounds', url: 'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip', proof: 'License.txt in the zip' },
  R: { name: 'Kenney RPG Audio 1.0', author: 'Kenney (kenney.nl)', license: 'CC0 1.0', page: 'https://kenney.nl/assets/rpg-audio', url: 'https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip', proof: 'License.txt in the zip' },
  J: { name: 'Kenney Music Jingles 1.0', author: 'Kenney (kenney.nl)', license: 'CC0 1.0', page: 'https://kenney.nl/assets/music-jingles', url: 'https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip', proof: 'License.txt in the zip' },
  C: { name: '80 CC0 creature SFX', author: 'rubberduck (OpenGameArt)', license: 'CC0 1.0', page: 'https://opengameart.org/content/80-cc0-creature-sfx', url: 'https://opengameart.org/sites/default/files/80-CC0-creature-SFX_0.zip', proof: 'CC0 badge on the OGA page, checked 2026-09-30' },
  S: { name: '80 CC0 RPG SFX', author: 'rubberduck (OpenGameArt)', license: 'CC0 1.0', page: 'https://opengameart.org/content/80-cc0-rpg-sfx', url: 'https://opengameart.org/sites/default/files/80-CC0-RPG-SFX_0.zip', proof: 'CC0 badge on the OGA page, checked 2026-09-30' },
  W: { name: 'Swishes Sound Pack', author: 'artisticdude (OpenGameArt)', license: 'CC0 1.0', page: 'https://opengameart.org/content/swishes-sound-pack', url: 'https://opengameart.org/sites/default/files/swishes.zip', proof: 'CC0 badge on the OGA page, checked 2026-09-30' },
};

// Momentary-max LUFS target per family, plus per-sound offset in dB (`lv`) where a sound is
// deliberately quieter/louder than its family. Spread: critter -22 ... sting -12 = 10 dB.
export const FAMILY_TARGET = { critter: -22, ui: -21, king: -15, building: -16, ability: -15, sting: -12 };
// Sample-peak / true-peak ceiling for SFX; gain is capped so nothing exceeds it.
export const SFX_PEAK_CEILING = -1.0;

// Helpers ---------------------------------------------------------------------------------------
// l(src, opts): one layer. src = "<PREFIX>/<file>" (extension added when missing).
//   ss start s in source, t max length s, st semitones (asetrate), hp/lp Hz, db gain, at delay ms
// v(maxMs, ...layers): one variant, hard cap maxMs, 25 ms tail fade. vf(maxMs, fadeMs, ...layers): same with a longer fade.
const l = (src, o = {}) => ({ src, ...o });
const v = (maxMs, ...layers) => ({ maxMs, fade: 25, layers });
const vf = (maxMs, fade, ...layers) => ({ maxMs, fade, layers });

// Sounds ----------------------------------------------------------------------------------------
// family, lv (dB offset from family target), variants. `why` = the evidence for the pick.
// `pk` (optional): dBFS sample-peak target used INSTEAD of loudness for sounds so short (7-60 ms) that a
// 400 ms loudness window says almost nothing about how loud a click is.
export const SOUNDS = {
  // CRITTER (tiny, bright, frequent) ----------------------------------------------------------
  throw: { family: 'critter', lv: 0, why: 'swish-10/12/13: 62-78 ms, noisy (pitch 0.47-0.48), centroid ~600 Hz; swish-2 73 ms low whoosh. Shorter than the 125 ms shot interval so 8/s never overlaps into a wash.', variants: [
    v(90, l('W/swish-10.wav')), v(90, l('W/swish-12.wav')), v(90, l('W/swish-13.wav')), v(90, l('W/swish-2.wav')), v(90, l('W/swish-11.wav')) ] },
  land_soft: { family: 'critter', lv: -2, why: 'grass footstep (75-95 ms, centroid 575-710 Hz) for the rustle + impactSoft_medium (116-145 ms, centroid ~100 Hz, pitched up so it reads small): a plop with no hit.', variants: [
    v(130, l('I/footstep_grass_000'), l('I/impactSoft_medium_000', { st: 4, db: -5 })),
    v(130, l('I/footstep_grass_003'), l('I/impactSoft_medium_002', { st: 5, db: -5 })),
    v(130, l('I/footstep_grass_004'), l('I/impactSoft_medium_004', { st: 3, db: -5 })),
    v(130, l('I/footstep_grass_001', { t: 0.13 }), l('I/impactSoft_medium_001', { st: 4, db: -5 })) ] },
  land_hit: { family: 'critter', lv: 2, why: 'impactWood_medium / impactPlank_medium (150-180 ms, attack <= 8 ms, centroid 135-200 Hz) = woody thock; an impactSoft/Punch layer under it for the plop. Louder than land_soft so hits are legible in the swarm.', variants: [
    v(170, l('I/impactWood_medium_000'), l('I/impactSoft_medium_001', { st: 2, db: -5 })),
    v(170, l('I/impactPlank_medium_000'), l('I/impactWood_light_002', { db: -3 })),
    v(170, l('I/impactWood_medium_003'), l('I/impactPunch_medium_001', { st: 3, db: -8 })),
    v(170, l('I/impactPlank_medium_004'), l('I/impactSoft_medium_003', { st: 2, db: -6 })),
    v(170, l('I/impactWood_medium_004'), l('I/impactPunch_medium_004', { st: 4, db: -8 })) ] },
  critter_die: { family: 'critter', lv: 0, why: 'cute_* squeaks with a FALLING contour (centroid 1785>729, 1144>671, 895>532 Hz for cute_04/09/10; cute_07 1114>851), trimmed to 200 ms, pitched up 3-5 st so they read tiny; creature_misc_02 is a 56 ms bright pop on two of them.', variants: [
    v(200, l('C/cute_07', { st: 3 })), v(210, l('C/cute_10', { st: 4 }), l('S/creature_misc_02', { db: -6 })),
    v(210, l('C/cute_01', { st: 3 })), v(220, l('C/cute_09', { st: 5 }), l('S/creature_misc_02', { db: -7, st: 2 })),
    v(320, l('C/cute_04', { st: 3 })) ] },
  hatch: { family: 'critter', lv: 0, why: 'cute_08/05/02 have a RISING contour (f0 390>630, 464>723, 261>558 Hz) = a bubbly pop-out; cute_08 is the softest (centroid 700 Hz, air 0 %). A wood-light pop under each.', variants: [
    v(240, l('C/cute_08'), l('I/impactWood_light_001', { st: 3, db: -5 })),
    v(250, l('C/cute_05', { st: -2 }), l('I/impactWood_light_003', { st: 3, db: -6 })),
    v(250, l('C/cute_02', { st: 2 }), l('I/impactWood_light_000', { st: 4, db: -5 })) ] },
  bite: { family: 'critter', lv: -4, pk: -10, why: 'impactWood_light (72-82 ms, centroid 300-400 Hz, pitch 0.48-0.67 = a dry tick, not a tone) pitched up to sound tinier; creature_misc_02 pop; tick_002 (21 ms).', variants: [
    v(60, l('I/impactWood_light_000', { st: 4 })), v(60, l('I/impactWood_light_004', { st: 3 })),
    v(60, l('S/creature_misc_02', { st: 3 })), v(50, l('UI/tick_002', { st: -2 })) ] },

  // KING -----------------------------------------------------------------------------------------
  king_hit: { family: 'king', lv: 0, why: 'impactPunch_medium / impactSoft_heavy (centroid 90-260 Hz) = dull thud, plus a short grunt: hurt_04/05 (263-299 ms, centroid 301/489 Hz) or grunt_05, trimmed to 180 ms, 5-6 dB under the thud.', variants: [
    v(240, l('I/impactPunch_medium_001'), l('C/hurt_04', { at: 25, t: 0.18, db: -6 })),
    v(240, l('I/impactSoft_heavy_002', { t: 0.25 }), l('C/grunt_05', { at: 20, t: 0.2, db: -5 })),
    v(240, l('I/impactPunch_medium_003'), l('C/hurt_05', { at: 25, t: 0.18, db: -6 })),
    v(240, l('I/impactPunch_medium_000'), l('C/grunt_01', { at: 20, t: 0.2, db: -6 })) ] },
  king_down: { family: 'king', lv: 2, why: 'A: creature_die_01 (centroid falls 242>50 Hz over 0.69 s = a big deflating groan) + heavy landing thump; B: SAX14 (measured descending sax phrase 420>264 Hz = "wah-wah") + thump. Cartoon, not gory.', variants: [
    vf(1200, 120, l('S/creature_die_01'), l('I/impactSoft_heavy_000', { at: 480, db: -2 })),
    vf(1300, 150, l('J/SAX14', { st: -1, db: -3 }), l('I/impactPunch_heavy_003', { at: 620, db: -1 })) ] },
  king_respawn: { family: 'king', lv: -2, why: 'Pizzicato phrases with a measured RISING f0: PIZZI10 300>405 Hz (0.77 s), PIZZI15 267>405 Hz; plucked strings are soft and woody.', variants: [
    vf(800, 150, l('J/PIZZI10')), vf(800, 150, l('J/PIZZI15')) ] },

  // ABILITY --------------------------------------------------------------------------------------
  explode: { family: 'ability', lv: 1, why: 'low chunky boom = impactSoft_heavy (centroid 70-97 Hz, 0.4-0.47 s) + impactPunch_heavy (centroid 130-150 Hz) + a stones_* crunch for debris.', variants: [
    vf(520, 120, l('I/impactSoft_heavy_000'), l('I/impactPunch_heavy_002', { db: -2 }), l('S/stones_04', { at: 30, db: -8 })),
    vf(560, 120, l('I/impactSoft_heavy_003', { st: -2 }), l('I/impactPunch_heavy_000', { db: -3 }), l('S/stones_01', { at: 25, db: -9 })),
    vf(520, 120, l('I/impactPunch_heavy_004'), l('I/impactSoft_heavy_002', { st: -3, db: -1 }), l('S/stones_03', { at: 40, db: -10, t: 0.3 })) ] },
  dash: { family: 'ability', lv: -3, why: 'swish-4/5/8/9 (88-114 ms, low whoosh, centroid 220-290 Hz): a quick soft swish, lower/longer than the throw set.', variants: [
    v(120, l('W/swish-4.wav')), v(110, l('W/swish-5.wav')), v(120, l('W/swish-8.wav')), v(120, l('W/swish-9.wav')) ] },
  stomp: { family: 'ability', lv: 0, why: 'heavy ground thump: impactSoft_heavy (centroid <100 Hz) + impactPunch_heavy or impactWood_heavy; shorter than explode and with no debris layer.', variants: [
    vf(360, 80, l('I/impactSoft_heavy_004', { st: -2 }), l('I/impactPunch_heavy_003', { db: -3 })),
    vf(340, 80, l('I/impactSoft_heavy_000', { st: -1 }), l('I/impactWood_heavy_002', { db: -4 })),
    vf(360, 80, l('I/impactPunch_heavy_001'), l('I/impactSoft_heavy_003', { st: -2, db: -2 })) ] },
  kingscall: { family: 'ability', lv: 0, why: 'no horn in the packs; the sampled Sax jingles are the closest brass. Measured RISING stepped phrases: SAX02 264>474 Hz (0.81 s), SAX10 294>397 Hz = a rally call.', variants: [
    vf(850, 150, l('J/SAX02')), vf(600, 120, l('J/SAX10')) ] },
  blink: { family: 'ability', lv: -3, why: 'airy noise zips (air 94-100 %, pitch 0.2-0.4, centroid 4-12 kHz): spell_02, blade_01, and a falling minimize_002 into a rising maximize_002 (out then in).', variants: [
    v(280, l('S/spell_02')), v(190, l('S/blade_01')),
    v(340, l('UI/minimize_002', { t: 0.16 }), l('UI/maximize_002', { at: 110, db: -2 })) ] },
  vortex: { family: 'ability', lv: -1, why: 'swirl = long noisy whooshes with slow envelopes: spell_fire_05 (centroid 2.5 kHz, pitch 0.33) and scroll_005; neither tonal. (spell_fire_04 was cut for bytes; its source is very quiet, +14 dB of gain.)', variants: [
    vf(900, 250, l('S/spell_fire_05', { hp: 200 })), vf(900, 250, l('UI/scroll_005', { hp: 200 })) ] },
  rampart: { family: 'ability', lv: -2, why: 'soft shield ring: impactPlate_light / _medium (attack 1 ms, decay 0.26-0.49 s, centroid 470-950 Hz) low-passed at 3 kHz, with a bong_001 or bell_004 under it.', variants: [
    vf(420, 150, l('I/impactPlate_light_000', { lp: 3000 }), l('UI/bong_001', { db: -4 })),
    vf(450, 150, l('I/impactPlate_light_003', { lp: 3000 }), l('I/impactBell_heavy_004', { db: -6 })),
    vf(450, 150, l('I/impactPlate_medium_000', { lp: 3000 })) ] },
  recall: { family: 'ability', lv: -2, why: 'short friendly horn blips (0.345 s Sax jingles): SAX08 296>334 Hz (rise), SAX00 469>315 Hz (fall, "coming back").', variants: [
    v(380, l('J/SAX08')), v(380, l('J/SAX00')) ] },
  no_ammo: { family: 'ability', lv: -5, pk: -8, why: 'dry soft click: click_002/005 (8-11 ms, centroid 252-345 Hz = dull) and a dulled impactWood_light_003. Kenney clicks are peak-limited, so they sit quiet on purpose.', variants: [
    v(40, l('UI/click_002')), v(40, l('UI/click_005')), v(70, l('I/impactWood_light_003', { st: -2, lp: 1500 })) ] },
  rampage: { family: 'ability', lv: 1, why: 'power-up rise: PIZZI02 (clean scale 267>479 Hz, +10.5 st, 0.95 s) and SAX16 (317>474 Hz), each over an open_* air whoosh (attack ramps up over 143-308 ms).', variants: [
    vf(950, 150, l('J/PIZZI02'), l('UI/open_003', { db: -8 })), vf(500, 120, l('J/SAX16'), l('UI/open_002', { db: -8 })) ] },
  second_wind: { family: 'ability', lv: 1, why: 'dramatic whoosh UP: noise sweeps whose centroid and envelope both rise (measured: maximize_005 3.3>7.6 kHz over 0.5 s, maximize_004 3.7>13.3 kHz), each under a quieter rising body (spell_fire_07 438>718 Hz, clothBelt 5.4>7.1 kHz). Cut right at the peak, short fade, so it ends "up".', variants: [
    vf(650, 40, l('UI/maximize_005'), l('S/spell_fire_07', { db: 8 })), vf(560, 40, l('UI/maximize_004'), l('R/clothBelt', { db: 6 })) ] },
  freeze: { family: 'ability', lv: -1, why: 'icy crack: glass_004 (0.52 s, air 100 %, a shatter of noise) with impactGlass_light / heavy tink and a 21 ms glitch_004 for the initial crack.', variants: [
    vf(420, 120, l('UI/glass_004', { t: 0.42 }), l('I/impactGlass_light_002', { db: -5 })),
    vf(320, 100, l('I/impactGlass_heavy_003'), l('UI/glitch_004', { db: -3 })) ] },

  // BUILDING / CAPTURE ---------------------------------------------------------------------------
  turret_place: { family: 'building', lv: 0, why: 'wooden clunk: impactPlank_medium (135-180 Hz) + impactWood_heavy (100-144 Hz); wood_03 (196 ms, centroid 721 Hz) as a lighter body.', variants: [
    v(240, l('I/impactPlank_medium_000'), l('I/impactWood_heavy_003', { db: -3 })),
    v(260, l('I/impactWood_heavy_000'), l('I/impactPlank_medium_003', { db: -2 })),
    v(260, l('S/wood_03'), l('I/impactPlank_medium_002', { db: -3 })) ] },
  turret_shot: { family: 'building', lv: -5, why: 'light thock: wood_05 (157 ms, centroid 1.4 kHz, pitch 0.38), item_wood_02 (centroid 1.7 kHz), wood_02 (103 ms): noisy woody hits, not tones.', variants: [
    v(120, l('S/wood_05', { st: -1 })), v(120, l('S/item_wood_02')), v(100, l('S/wood_02', { st: -2 })) ] },
  arrow_shot: { family: 'building', lv: -5, why: 'light twang = a plucked string (pluck_001/002, 73/98 ms) over a soft swish (swish-10/12/13) for the air; one wood-only variant as a fallback that is guaranteed non-tonal.', variants: [
    v(110, l('UI/pluck_001'), l('W/swish-12.wav', { db: -6 })), v(120, l('UI/pluck_002', { st: -3 }), l('W/swish-10.wav', { db: -6 })),
    v(110, l('S/wood_02', { st: 2 }), l('W/swish-13.wav', { db: -5 })) ] },
  capture: { family: 'building', lv: 1, why: 'wooden clunk (impactPlank/impactWood_heavy) + a short bright sampled jingle: STEEL15 (272>356 Hz rising) and STEEL08 (304>334 Hz rising), with a coin sparkle (noise, unpitched).', variants: [
    vf(900, 200, l('I/impactPlank_medium_002'), l('J/STEEL15', { at: 70, db: -4, t: 0.85 }), l('S/item_coins_02', { at: 60, db: -10 })),
    vf(800, 180, l('I/impactWood_heavy_004'), l('J/STEEL08', { at: 70, db: -3 }), l('R/handleCoins2', { at: 60, db: -8 })) ] },
  capture_lost: { family: 'building', lv: -1, why: 'lower, duller capture: falling Pizzicato phrases (PIZZI09 337>298 Hz, PIZZI11 401>302 Hz) pitched DOWN 3 st and low-passed at 1.6 kHz, over a dull wood thud.', variants: [
    vf(700, 180, l('I/impactWood_heavy_001', { lp: 900 }), l('J/PIZZI09', { at: 60, st: -3, lp: 1600, db: -3 })),
    vf(800, 200, l('I/impactWood_heavy_003', { lp: 900 }), l('J/PIZZI11', { at: 60, st: -3, lp: 1600, db: -3 })) ] },
  crown_tick: { family: 'building', lv: -3, why: 'tension tick: woody knocks pitched DOWN 3-5 st (wood_05, item_wood_02, impactWood_light_002; noisy, pitch 0.27-0.55), short so it can pulse once a second.', variants: [
    v(90, l('S/wood_05', { st: -4 })), v(100, l('S/item_wood_02', { st: -3 })), v(80, l('I/impactWood_light_002', { st: -5 })) ] },
  crown_open: { family: 'building', lv: 1, why: 'a bell: impactBell_heavy_000 / _001 (1.05 / 1.27 s, centroid 350-485 Hz, sampled bell so its tonality is intended).', variants: [
    vf(1000, 350, l('I/impactBell_heavy_000')), vf(1100, 400, l('I/impactBell_heavy_001')) ] },
  overtime: { family: 'building', lv: 0, why: 'alarm that is not harsh: the same soft bell sample struck 3x / 2x (identical pitch, so no clash), low-passed at 3.5 kHz; impactBell_heavy_003 (0.38 s) and _002 (0.43 s).', variants: [
    vf(1000, 250, l('I/impactBell_heavy_003', { lp: 3500 }), l('I/impactBell_heavy_003', { lp: 3500, at: 330, db: -2 }), l('I/impactBell_heavy_003', { lp: 3500, at: 660, db: -4 })),
    vf(800, 250, l('I/impactBell_heavy_002', { lp: 3500 }), l('I/impactBell_heavy_002', { lp: 3500, at: 380, db: -2 })) ] },

  // UI -------------------------------------------------------------------------------------------
  ui_click: { family: 'ui', lv: 0, pk: -4, why: 'click_001/003 (8-15 ms), select_002 (41 ms, centroid 1.25 kHz), wood_01 (wood clack): crisp dry ticks, pitch 0.14-0.63 = not tonal.', variants: [
    v(40, l('UI/click_001')), v(30, l('UI/click_003')), v(60, l('UI/select_002')), v(70, l('S/wood_01', { t: 0.07 })) ] },
  ui_hover: { family: 'ui', lv: -6, pk: -12, why: 'tiny airy ticks: tick_001 (9 ms), tick_002 (21 ms), select_008 (43 ms) low-passed at 8 kHz; 6 dB quieter than a click.', variants: [
    v(30, l('UI/tick_001', { lp: 8000 })), v(40, l('UI/tick_002', { lp: 8000 })), v(60, l('UI/select_008', { lp: 8000, st: -2 })) ] },
  ui_confirm: { family: 'ui', lv: 0, why: 'short RISING pizzicato blips (PIZZI16 317>469 Hz, PIZZI08 300>342 Hz): plucked strings, not the synthetic Kenney confirmation tones (pitch 0.95, rejected).', variants: [
    vf(320, 80, l('J/PIZZI16')), vf(400, 90, l('J/PIZZI08')) ] },
  ui_back: { family: 'ui', lv: -1, why: 'back_002/004 (55-57 ms, centroid 564/785 Hz, pitch 0.61/0.43): soft short bloops; bookClose (198 ms, centroid 656 Hz, pitch 0.55) a soft book shut. back_003 was rejected: raw it measures pitch 0.90 at centroid 1.3 kHz (the others 0.13-0.47) = a beep.', variants: [
    v(70, l('UI/back_002')), v(70, l('UI/back_004')), v(140, l('R/bookClose')) ] },
  ui_pick: { family: 'ui', lv: 1, why: 'a card put down: bookPlace1/2/3 (174-220 ms, noisy: pitch 0.3-0.5, centroid ~1 kHz) with a tiny gem sparkle on one.', variants: [
    v(200, l('R/bookPlace1')), v(220, l('R/bookPlace2')), v(200, l('R/bookPlace3'), l('S/item_gem_02', { at: 25, db: -9 })) ] },
  ui_error: { family: 'ui', lv: 0, why: 'soft "nope": error_004 (104 ms, pitch 0.39), error_008 (140 ms), and a double wood knock (impactWood_medium low-passed at 1.2 kHz, twice). The harsh buzzers (error_001-003) were skipped.', variants: [
    v(130, l('UI/error_004')), v(150, l('UI/error_008')),
    v(320, l('I/impactWood_medium_002', { lp: 1200 }), l('I/impactWood_medium_002', { lp: 1200, at: 120, db: -2 })) ] },

  // STINGS (1 variant each) ------------------------------------------------------------------------
  victory_sting: { family: 'sting', lv: 0, why: 'STEEL10: measured stepped RISE 304>334>371>397 Hz then a held note (0.91 s): a bright "ta-da" that resolves upward.', variants: [ vf(1000, 250, l('J/STEEL10')) ] },
  defeat_sting: { family: 'sting', lv: 0, why: 'STEEL01: measured stepped FALL 479>424>377>337>298>271 Hz (9.9 st over 1.37 s): a sad descending toy-box phrase, same instrument as the victory sting.', variants: [ vf(1400, 350, l('J/STEEL01')) ] },
};

// Music ----------------------------------------------------------------------------------------
// All five tracks are RandomMind's "Medieval" set (one composer, one voice). Emma_MA's Determined
// Pursuit (108 s, 80 bpm, 144.000 beats, LRA 4) was the research pick for the Crown, but it alone costs
// ~1.2 MB and is a different voice, so the crown loop is a beat-cut section of RandomMind's "Battle".
// `loop`: 'native' = the file is already a loop, keep whole; 'beat' = cut an integer number of beats
// from a steady section and crossfade the tail into the true predecessor of the start (sample-tight
// seam); 'none' = one-shot, trimmed and faded.
export const MUSIC = {
  menu: { src: 'music/Loop_The_Old_Tower_Inn.wav', loop: 'native', why: 'RandomMind "The Old Tower Inn": native loop, measured 86.5 bpm and 72.013 beats in 49.951 s (whole number of beats), -17.4 LUFS orig, LRA 3.3 = calm, flat energy.',
    pack: { name: 'Medieval: The Old Tower Inn', author: 'RandomMind (OpenGameArt)', license: 'CC0 1.0', page: 'https://opengameart.org/content/medieval-the-old-tower-inn', url: 'https://opengameart.org/sites/default/files/Loop_The_Old_Tower_Inn.wav' } },
  battle: { src: 'music/Loop_Minstrel_Dance_0.wav', loop: 'native', why: 'RandomMind "Minstrel Dance": native loop, measured 130 bpm (or 65) and exactly 122.000 beats in 56.308 s, LRA 1.8 = steady, lively; -12.5 LUFS orig.',
    pack: { name: 'Medieval: Minstrel Dance', author: 'RandomMind (OpenGameArt)', license: 'CC0 1.0', page: 'https://opengameart.org/content/medieval-minstrel-dance', url: 'https://opengameart.org/sites/default/files/Loop_Minstrel_Dance_0.wav' } },
  crown: { src: 'music/battle_7.mp3', loop: 'beat', beatBpm: 104.95, startSec: 15.0, beats: 88, xfadeSec: 1.0, why: 'RandomMind "Battle": not a loop (intro ramps -16>-13 dB over 15 s, outro decays from 65 s). Steady section 15-65 s used: measured 104.95 bpm, 138.04 beats in the 78.9 s file; 88 beats (50.3 s) cut on the beat grid, tail crossfaded into the true predecessor of the start. Most intense of the RandomMind set (steady -13 dB, no dynamics).',
    pack: { name: 'Medieval: Battle', author: 'RandomMind (OpenGameArt)', license: 'CC0 1.0', page: 'https://opengameart.org/content/medieval-battle', url: 'https://opengameart.org/sites/default/files/battle_7.mp3' } },
  victory: { src: 'music/victory.mp3', loop: 'none', startSec: 0, endSec: 19.0, fadeSec: 2.5, why: 'RandomMind "Victory Theme": full-energy for 30 s (-9..-12 dB per second), trimmed to 19 s with a 2.5 s fade to fit the byte budget.',
    pack: { name: 'Medieval: Victory Theme', author: 'RandomMind (OpenGameArt)', license: 'CC0 1.0', page: 'https://opengameart.org/content/medieval-victory-theme', url: 'https://opengameart.org/sites/default/files/victory.mp3' } },
  defeat: { src: 'music/defeat.mp3', loop: 'none', startSec: 0, endSec: 22.0, fadeSec: 4.0, why: 'RandomMind "Defeat Theme": already fades from 30 s (-9 to -60 dB); trimmed to 22 s with a 4 s fade.',
    pack: { name: 'Medieval: Defeat Theme', author: 'RandomMind (OpenGameArt)', license: 'CC0 1.0', page: 'https://opengameart.org/content/medieval-defeat-theme', url: 'https://opengameart.org/sites/default/files/defeat.mp3' } },
};
export const MUSIC_LUFS = -18;
export const MUSIC_TP = -1.5;
export const MUSIC_Q = 2.5;
export const SFX_Q = 3;

// Runtime meta per sound id, emitted into src/audio/manifest.ts (the engine reads only that file).
//   p   priority 1 droppable / 2 normal / 3 never dropped (used when the voice pool is full)
//   v   maxVoices of this id at once          gap  minIntervalMs between starts of this id
//   pv  pitchVar: random pitch spread in +/- semitones          gain  linear trim on top of the baked-in loudness
// Numbers are game-feel starting points (game-feel.md sec. 4: <= ~8 per family, coalesce spam, 1-2 st variance).
export const META = {
  throw: { p: 2, v: 3, gap: 90, pv: 1.5 },        land_soft: { p: 1, v: 4, gap: 45, pv: 2 },
  land_hit: { p: 2, v: 4, gap: 40, pv: 1.5 },     critter_die: { p: 1, v: 3, gap: 60, pv: 2 },
  hatch: { p: 1, v: 3, gap: 80, pv: 2 },          bite: { p: 1, v: 2, gap: 100, pv: 2.5 },
  king_hit: { p: 2, v: 2, gap: 120, pv: 1 },      king_down: { p: 3, v: 2, gap: 500, pv: 0.5 },
  king_respawn: { p: 3, v: 2, gap: 300, pv: 0.5 },
  explode: { p: 2, v: 3, gap: 60, pv: 1 },        dash: { p: 2, v: 2, gap: 150, pv: 1 },
  stomp: { p: 2, v: 2, gap: 200, pv: 1 },         kingscall: { p: 3, v: 2, gap: 300, pv: 0.5 },
  blink: { p: 2, v: 2, gap: 150, pv: 1 },         vortex: { p: 2, v: 2, gap: 300, pv: 1 },
  rampart: { p: 2, v: 2, gap: 200, pv: 1 },       recall: { p: 2, v: 2, gap: 200, pv: 1 },
  no_ammo: { p: 1, v: 1, gap: 150, pv: 1 },       rampage: { p: 3, v: 2, gap: 400, pv: 0.5 },
  second_wind: { p: 3, v: 2, gap: 400, pv: 0.5 }, freeze: { p: 2, v: 2, gap: 100, pv: 1 },
  turret_place: { p: 2, v: 3, gap: 100, pv: 1 },  turret_shot: { p: 1, v: 3, gap: 80, pv: 1.5 },
  arrow_shot: { p: 1, v: 3, gap: 80, pv: 1.5 },   capture: { p: 3, v: 3, gap: 100, pv: 0.5 },
  capture_lost: { p: 3, v: 3, gap: 100, pv: 0.5 }, crown_tick: { p: 2, v: 1, gap: 250, pv: 0.5 },
  crown_open: { p: 3, v: 1, gap: 1000, pv: 0 },   overtime: { p: 3, v: 1, gap: 1000, pv: 0 },
  ui_click: { p: 2, v: 2, gap: 30, pv: 0.4 },     ui_hover: { p: 1, v: 1, gap: 40, pv: 0.4 },
  ui_confirm: { p: 2, v: 1, gap: 80, pv: 0 },     ui_back: { p: 2, v: 1, gap: 80, pv: 0.3 },
  ui_pick: { p: 2, v: 2, gap: 60, pv: 0.5 },      ui_error: { p: 2, v: 1, gap: 150, pv: 0 },
  victory_sting: { p: 3, v: 1, gap: 1000, pv: 0 }, defeat_sting: { p: 3, v: 1, gap: 1000, pv: 0 },
};
export const MUSIC_META = {
  menu: { loop: true, gain: 1 }, battle: { loop: true, gain: 1 }, crown: { loop: true, gain: 1 },
  victory: { loop: false, gain: 1 }, defeat: { loop: false, gain: 1 },
};
