// Inline SVG icons drawn from simple shapes. Every icon is a 64x64 viewBox with thick ink outlines,
// flat palette fills and (for living things) big white eyes, matching design/ART.md.
import type { HeroId, MutationId, MutationTag, TraitIcon } from './types';
import type { AbilityIcon } from './catalog';

const INK = '#1B2430';
const BLUE = '#3FA7FF', BLUE_L = '#BFE3FF';
const FIRE = '#FF8A3D', FIRE_L = '#FFC285';
const FROST = '#9FE8FF';
const GOLD = '#FFD166';
const GRASS = '#6FB04A', GREEN_L = '#CFEFA8';
const WOOD = '#6B4526', DIRT = '#C9B27A', CLIFF = '#8A6A45';
const STONE = '#8D97A6', STONE_L = '#C9D1DC', WALL = '#F1E4C4';
const BOMB = '#34404F', VIOLET = '#A98BEF';
// Rival colours follow the colour-blind setting, so they are styled through CSS variables.
const RED_FILL = 'style="fill:var(--red)"';

const svg = (body: string, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g fill="none" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

const n = (v: number) => Math.round(v * 10) / 10;

/** Two big white eyes with dark pupils looking toward (lx, ly) in -1..1. */
function eyes(cx: number, cy: number, r: number, lx = 0.35, ly = 0.1, gap = 1.1): string {
  const d = r * gap;
  const p = r * 0.52;
  const ox = lx * r * 0.42, oy = ly * r * 0.42;
  return `<circle cx="${n(cx - d)}" cy="${n(cy)}" r="${n(r)}" fill="#fff" stroke-width="2"/><circle cx="${n(cx + d)}" cy="${n(cy)}" r="${n(r)}" fill="#fff" stroke-width="2"/>`
    + `<circle cx="${n(cx - d + ox)}" cy="${n(cy + oy)}" r="${n(p)}" fill="${INK}" stroke="none"/><circle cx="${n(cx + d + ox)}" cy="${n(cy + oy)}" r="${n(p)}" fill="${INK}" stroke="none"/>`;
}

/** A critter: a soft dome with eyes. tuft = the rival's pointed tuft (team shape cue). */
function blob(cx: number, cy: number, r: number, fill: string, o: { tuft?: boolean; eyes?: boolean; brows?: boolean; look?: number; red?: boolean } = {}): string {
  const f = o.red ? RED_FILL : `fill="${fill}"`;
  const d = `M${n(cx - r)} ${n(cy + 0.5 * r)} C${n(cx - r)} ${n(cy - 0.45 * r)} ${n(cx - 0.62 * r)} ${n(cy - r)} ${n(cx)} ${n(cy - r)} C${n(cx + 0.62 * r)} ${n(cy - r)} ${n(cx + r)} ${n(cy - 0.45 * r)} ${n(cx + r)} ${n(cy + 0.5 * r)} C${n(cx + r)} ${n(cy + 0.95 * r)} ${n(cx - r)} ${n(cy + 0.95 * r)} ${n(cx - r)} ${n(cy + 0.5 * r)} Z`;
  let s = '';
  if (o.tuft) s += `<path d="M${n(cx - 0.18 * r)} ${n(cy - 0.9 * r)} L${n(cx + 0.1 * r)} ${n(cy - 1.45 * r)} L${n(cx + 0.35 * r)} ${n(cy - 0.85 * r)} Z" ${f}/>`;
  s += `<path d="${d}" ${f}/>`;
  if (o.eyes !== false) s += eyes(cx, cy - 0.05 * r, r * 0.27, o.look ?? 0.35, 0.1);
  if (o.brows) {
    const d2 = r * 0.3;
    s += `<path d="M${n(cx - d2 - r * 0.25)} ${n(cy - 0.42 * r)} L${n(cx - r * 0.06)} ${n(cy - 0.26 * r)} M${n(cx + d2 + r * 0.25)} ${n(cy - 0.42 * r)} L${n(cx + r * 0.06)} ${n(cy - 0.26 * r)}"/>`;
  }
  return s;
}

function star(cx: number, cy: number, ro: number, ri: number, k: number, fill: string, rot = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < k * 2; i++) {
    const a = (rot + (i * 180) / k) * (Math.PI / 180);
    const r = i % 2 ? ri : ro;
    pts.push(n(cx + Math.cos(a) * r) + ',' + n(cy + Math.sin(a) * r));
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}

/** Coloured stroke with an ink edge (draw ink wide, colour narrow). */
const duo = (d: string, c: string, w = 3.5) => `<path d="${d}" stroke-width="${w + 4}"/><path d="${d}" stroke="${c}" stroke-width="${w}"/>`;

const crownPath = (x: number, y: number, s: number) => {
  const p = (a: number, b: number) => `${n(x + a * s)} ${n(y + b * s)}`;
  return `<path d="M${p(-14, 8)} L${p(-16, -8)} L${p(-7, -1)} L${p(0, -12)} L${p(7, -1)} L${p(16, -8)} L${p(14, 8)} Z" fill="${GOLD}"/>`
    + `<circle cx="${n(x)}" cy="${n(y + 2 * s)}" r="${n(2.2 * s)}" fill="${FIRE}" stroke-width="2"/>`;
};

const hutPath = (x: number, y: number, s: number, roof: string, roofRed = false) => {
  const p = (a: number, b: number) => `${n(x + a * s)} ${n(y + b * s)}`;
  const rf = roofRed ? RED_FILL : `fill="${roof}"`;
  return `<path d="M${p(-13, 16)} L${p(-13, -2)} L${p(13, -2)} L${p(13, 16)} Z" fill="${WALL}"/>`
    + `<path d="M${p(-5, 16)} L${p(-5, 5)} Q${p(0, 1)} ${p(5, 5)} L${p(5, 16)} Z" fill="${WOOD}"/>`
    + `<path d="M${p(-18, 0)} L${p(0, -16)} L${p(18, 0)} Z" ${rf}/>`;
};

const heartPath = (fill: string) =>
  `<path d="M32 54 C12 40 7 30 11 21 C15 12 27 11 32 21 C37 11 49 12 53 21 C57 30 52 40 32 54 Z" fill="${fill}"/>`;

const bomb = (cx: number, cy: number, r: number, body = BOMB) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${body}"/>`
  + `<path d="M${n(cx - r * 0.62)} ${n(cy - r * 0.2)} A${n(r * 0.66)} ${n(r * 0.66)} 0 0 1 ${n(cx - r * 0.1)} ${n(cy - r * 0.68)}" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>`
  + `<rect x="${n(cx - r * 0.34)}" y="${n(cy - r * 1.22)}" width="${n(r * 0.68)}" height="${n(r * 0.4)}" rx="1.5" fill="${STONE}"/>`;

function snowflake(cx: number, cy: number, r: number, w = 3): string {
  let s = '';
  for (let i = 0; i < 3; i++) {
    const a = (i * 60 + 90) * (Math.PI / 180);
    const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    const b = r * 0.38;
    let d = `M${n(cx - dx)} ${n(cy - dy)} L${n(cx + dx)} ${n(cy + dy)}`;
    for (const sgn of [1, -1]) {
      const ex = cx + sgn * dx * 0.62, ey = cy + sgn * dy * 0.62;
      const a1 = a + (sgn > 0 ? Math.PI : 0);
      d += ` M${n(ex + Math.cos(a1 + 0.7) * b)} ${n(ey + Math.sin(a1 + 0.7) * b)} L${n(ex)} ${n(ey)} L${n(ex + Math.cos(a1 - 0.7) * b)} ${n(ey + Math.sin(a1 - 0.7) * b)}`;
    }
    s += duo(d, FROST, w);
  }
  return s;
}

function spiral(cx: number, cy: number): string {
  let d = '';
  for (let t = 0; t <= Math.PI * 3.6; t += 0.25) {
    const r = 3 + t * 2.3;
    d += (d ? ' L' : 'M') + n(cx + Math.cos(t) * r) + ' ' + n(cy + Math.sin(t) * r);
  }
  return d;
}

// ---------------------------------------------------------------- Mutations

const MUT: Record<MutationId, () => string> = {
  bombers: () => bomb(30, 38, 18) + eyes(30, 40, 4.6, 0.4) + `<path d="M30 16 C31 9 39 10 43 7"/>` + star(47, 7, 7, 3, 5, FIRE),
  shockwave: () => blob(32, 42, 10, BLUE) + duo('M18 30 Q11 41 18 52', FIRE) + duo('M46 30 Q53 41 46 52', FIRE)
    + duo('M10 24 Q1 41 10 58', FIRE) + duo('M54 24 Q63 41 54 58', FIRE) + star(32, 16, 7, 3, 4, FIRE_L),
  scorch: () => `<ellipse cx="32" cy="53" rx="23" ry="6" fill="${CLIFF}"/>`
    + `<path d="M32 52 C19 52 14 44 16 35 C18 27 25 23 25 11 C33 17 36 22 36 29 C39 26 40 22 40 18 C48 26 51 35 48 42 C46 48 40 52 32 52 Z" fill="${FIRE}"/>`
    + `<path d="M32 50 C26 50 23 46 24 41 C25 36 29 33 30 27 C35 32 39 37 39 42 C39 47 36 50 32 50 Z" fill="${FIRE_L}" stroke-width="2.5"/>`,
  splitters: () => `<path d="M29 52 L29 17 C18 17 10 27 10 40 C10 48 17 52 29 52 Z" fill="${BLUE}" transform="rotate(-8 29 52)"/>`
    + `<path d="M35 52 L35 17 C46 17 54 27 54 40 C54 48 47 52 35 52 Z" fill="${BLUE}" transform="rotate(8 35 52)"/>`
    + `<circle cx="20" cy="33" r="4.4" fill="#fff" stroke-width="2"/><circle cx="21.5" cy="33.5" r="2.2" fill="${INK}" stroke="none"/>`
    + `<circle cx="44" cy="33" r="4.4" fill="#fff" stroke-width="2"/><circle cx="45.5" cy="33.5" r="2.2" fill="${INK}" stroke="none"/>`
    + `<path d="M32 12 L32 5 M24 13 L20 7 M40 13 L44 7"/>`,
  boomtown: () => hutPath(24, 38, 1.05, BLUE) + duo('M44 26 L52 17 L60 26', GRASS) + duo('M44 40 L52 31 L60 40', GRASS),
  militia: () => `<path d="M32 6 L54 13 V30 C54 45 44 53 32 59 C20 53 10 45 10 30 V13 Z" fill="${BLUE_L}"/>`
    + blob(21, 40, 6.5, BLUE, { look: 0 }) + blob(43, 40, 6.5, BLUE, { look: 0 }) + blob(32, 33, 8, BLUE, { look: 0, brows: true }),
  bigLitter: () => blob(32, 19, 8.5, BLUE, { look: 0 }) + blob(22, 33, 8.5, BLUE, { look: -0.4 }) + blob(42, 33, 8.5, BLUE, { look: 0.4 })
    + blob(13, 48, 8.5, BLUE, { look: -0.5 }) + blob(32, 48, 8.5, BLUE, { look: 0.1 }) + blob(51, 48, 8.5, BLUE, { look: 0.5 }),
  brutes: () => blob(28, 36, 21, BLUE, { brows: true, look: 0.4 }) + blob(55, 52, 6, BLUE, { look: -0.6 }),
  leeches: () => heartPath('#FF8FA0') + `<path d="M32 26 V42 M24 34 H40" stroke="#fff" stroke-width="5"/>`
    + `<path d="M43 5 L58 5 L52 19 Z" fill="#fff"/>`,
  frostbite: () => snowflake(32, 32, 25, 4),
  piercers: () => `<g ${RED_FILL}>` + [16, 32, 48].map(x => blob(x, 36, 8, '', { red: true, tuft: true, look: -0.5 })).join('') + `</g>`
    + duo('M4 36 L55 36', STONE_L, 4) + `<path d="M50 27 L62 36 L50 45 Z" fill="${STONE_L}"/>` + `<path d="M4 30 L9 36 L4 42" stroke-width="3"/>`,
  homing: () => `<path d="M12 52 C10 30 26 44 34 28 C38 20 40 20 42 20" stroke-dasharray="5 6"/>`
    + `<circle cx="46" cy="18" r="11" fill="#fff"/><circle cx="46" cy="18" r="4" fill="${INK}" stroke="none"/>`
    + `<path d="M46 3 V9 M46 27 V33 M31 18 H37 M55 18 H61"/>` + blob(13, 54, 7, BLUE, { look: 0.6 }),
  archerHuts: () => hutPath(22, 40, 1.0, BLUE) + duo('M30 26 L55 9', WOOD, 3) + `<path d="M50 6 L60 5 L57 14 Z" fill="${STONE_L}"/>`
    + `<path d="M30 26 L26 22 M30 26 L27 30" stroke-width="3"/>`,
  trample: () => `<ellipse cx="36" cy="54" rx="16" ry="4.5" ${RED_FILL}/>` + `<path d="M28 54 L32 51 M40 51 L44 54" stroke-width="2.5"/>`
    + `<ellipse cx="38" cy="30" rx="11" ry="15" fill="${WOOD}"/>` + `<circle cx="28" cy="11" r="4" fill="${WOOD}"/><circle cx="37" cy="8" r="4.2" fill="${WOOD}"/><circle cx="46" cy="11" r="4" fill="${WOOD}"/>`
    + `<path d="M4 24 H18 M8 33 H22 M4 42 H18"/>`,
  royalGuard: () => `<path d="M32 5 L55 12 V30 C55 45 45 53 32 60 C19 53 9 45 9 30 V12 Z" fill="${STONE_L}"/>`
    + `<path d="M32 12 V53" stroke="${STONE}" stroke-width="3"/>` + crownPath(32, 33, 1.05),
  rapidFire: () => duo('M8 16 L22 32 L8 48', BLUE_L, 5) + duo('M24 16 L38 32 L24 48', BLUE, 5) + duo('M40 16 L54 32 L40 48', '#1F7FD6', 5),
  longArm: () => `<ellipse cx="53" cy="54" rx="9" ry="4" fill="${DIRT}"/><path d="M50 52 L56 56 M56 52 L50 56" stroke-width="2.5"/>`
    + `<path d="M6 56 C14 10 40 6 51 46" stroke-width="3" stroke-dasharray="4 5"/>` + `<path d="M44 42 L52 50 L56 38 Z" fill="${INK}"/>`
    + blob(24, 22, 10, BLUE, { look: 0.8 }) + `<path d="M8 62 H40" stroke-width="3"/><path d="M4 62 L10 58 M4 62 L10 66" stroke-width="3"/>`,
  secondWind: () => `<path d="M14 20 A22 22 0 1 0 32 10" stroke-width="4"/><path d="M26 3 L35 10 L26 16 Z" fill="${INK}"/>`
    + `<g transform="translate(32 34) scale(.58) translate(-32 -32)">${heartPath('#FF8FA0')}</g>` + `<path d="M26 34 H38" stroke="#fff" stroke-width="3.5"/>`,
  chainReaction: () => `<ellipse cx="23" cy="36" rx="6" ry="3.5" transform="rotate(-50 23 36)" stroke-width="3"/><ellipse cx="41" cy="36" rx="6" ry="3.5" transform="rotate(50 41 36)" stroke-width="3"/>`
    + star(12, 48, 11, 5, 7, FIRE) + star(32, 20, 13, 6, 8, FIRE) + star(52, 48, 11, 5, 7, FIRE) + star(32, 20, 5, 2.5, 4, FIRE_L),
  cryoBombs: () => bomb(28, 40, 18, '#2F5D7A') + eyes(28, 42, 4.4, 0.3) + `<path d="M28 18 C29 11 36 12 40 9"/>` + snowflake(48, 11, 10, 2.5),
  conscription: () => blob(15, 42, 11, '', { red: true, tuft: true, look: 0.6 }) + blob(49, 42, 11, BLUE, { look: -0.6 })
    + `<path d="M16 22 Q32 6 46 20"/><path d="M40 21 L48 23 L47 14 Z" fill="${INK}"/>`,
  bloodrage: () => `<path d="M32 58 C15 58 9 47 11 37 C13 27 20 22 20 9 C28 15 31 21 31 27 C35 22 36 17 35 10 C47 19 55 31 53 43 C51 52 43 58 32 58 Z" fill="${FIRE}"/>`
    + eyes(32, 42, 5.2, 0, 0.3) + `<path d="M20 31 L29 36 M44 31 L35 36" stroke-width="4"/>`,
};

// ---------------------------------------------------------------- tags, traits, abilities, pictograms

const TAG: Record<MutationTag, () => string> = {
  boom: () => star(32, 32, 27, 13, 8, FIRE),
  brood: () => `<path d="M32 6 C44 6 53 28 53 39 C53 52 44 59 32 59 C20 59 11 52 11 39 C11 28 20 6 32 6 Z" fill="${GREEN_L}"/>`
    + `<circle cx="24" cy="30" r="4" fill="${GRASS}" stroke="none"/><circle cx="38" cy="42" r="5" fill="${GRASS}" stroke="none"/><circle cx="37" cy="22" r="3" fill="${GRASS}" stroke="none"/>`,
  bite: () => `<path d="M6 12 Q32 30 58 12 V22 Q32 40 6 22 Z" fill="#FF8FA0"/><path d="M14 23 L21 52 L28 28 Z M36 28 L43 52 L50 23 Z" fill="#fff"/>`,
  king: () => crownPath(32, 36, 1.6),
};

const TRAIT: Record<TraitIcon, () => string> = {
  hoard: () => `<path d="M20 22 C10 30 8 54 32 56 C56 54 54 30 44 22 Z" fill="${DIRT}"/><path d="M22 12 L42 12 L37 22 L27 22 Z" fill="${DIRT}"/><path d="M22 23 H42"/>`
    + `<circle cx="32" cy="40" r="7" fill="${GOLD}"/>`,
  slow: () => `<path d="M6 52 H50 C56 52 58 46 52 45 L22 45 C16 45 12 40 12 33 M12 33 L8 22 M12 33 L16 22" fill="#D8C08A"/>`
    + `<circle cx="36" cy="32" r="14" fill="#E9B872"/><path d="M36 32 m0 -3 a3 3 0 1 1 -3 3 a7 7 0 1 1 7 7"/>`,
  fortify: () => `<path d="M16 58 V22 H22 V14 H29 V22 H35 V14 H42 V22 H48 V58 Z" fill="${STONE_L}"/><path d="M27 58 V46 Q32 40 37 46 V58" fill="${WOOD}"/><path d="M22 32 H30 M34 36 H42" stroke="${STONE}" stroke-width="3"/>`,
  patient: () => `<path d="M16 6 H48 M16 58 H48" stroke-width="4.5"/><path d="M19 8 L45 8 L32 32 Z" fill="${BLUE_L}"/><path d="M32 32 L19 56 H45 Z" fill="${DIRT}"/>`,
  flood: () => blob(14, 20, 7, '', { red: true, tuft: true, look: 0.6 }) + blob(30, 20, 7, '', { red: true, tuft: true, look: 0.6 })
    + duo('M4 40 Q12 32 20 40 T36 40 T52 40 T60 38', BLUE, 3.5) + duo('M4 52 Q12 44 20 52 T36 52 T52 52 T60 50', BLUE_L, 3.5) + blob(48, 20, 7, '', { red: true, tuft: true, look: 0.6 }),
  spread: () => `<circle cx="12" cy="50" r="6" fill="${INK}"/>` + duo('M16 46 L50 12', STONE_L) + duo('M18 50 L58 42', STONE_L) + duo('M14 44 L22 8', STONE_L)
    + `<path d="M44 10 L54 8 L52 18 Z M52 36 L60 42 L52 48 Z M15 10 L22 4 L27 12 Z" fill="${INK}"/>`,
  allIn: () => `<path d="M14 8 V60" stroke-width="4"/><path d="M16 10 H52 L42 21 L52 32 H16 Z" ${RED_FILL}/>` + duo('M24 48 H52', STONE_L, 5) + `<path d="M48 40 L60 48 L48 56 Z" fill="${INK}"/>`,
  heavy: () => `<circle cx="32" cy="14" r="7" stroke-width="4"/><path d="M14 56 L20 22 H44 L50 56 Z" fill="${STONE}"/><path d="M24 44 H40" stroke="${STONE_L}" stroke-width="3"/>`,
  feint: () => `<path d="M6 26 C18 18 46 18 58 26 C58 42 46 46 38 38 C35 35 29 35 26 38 C18 46 6 42 6 26 Z" fill="${VIOLET}"/>`
    + `<ellipse cx="20" cy="30" rx="6" ry="4" fill="${INK}"/><ellipse cx="44" cy="30" rx="6" ry="4" fill="${INK}"/>`,
  ambush: () => `<ellipse cx="32" cy="50" rx="24" ry="9" fill="${STONE_L}" stroke-dasharray="4 5"/><path d="M24 46 L40 54 M40 46 L24 54" stroke-width="4"/>`
    + duo('M32 6 V30', VIOLET, 4) + `<path d="M24 26 L32 36 L40 26 Z" fill="${INK}"/>`,
  guard: () => `<path d="M32 5 L55 12 V30 C55 45 45 53 32 60 C19 53 9 45 9 30 V12 Z" fill="${STONE_L}"/>`
    + blob(21, 38, 6, '', { red: true, tuft: true, look: 0 }) + blob(43, 38, 6, '', { red: true, tuft: true, look: 0 }) + blob(32, 30, 7, '', { red: true, tuft: true, look: 0 }),
  storm: () => crownPath(38, 34, 1.3) + `<path d="M4 22 H16 M2 34 H14 M4 46 H16"/>`,
};

const ABILITY: Record<AbilityIcon, () => string> = {
  stomp: () => `<path d="M23 5 H41 V25 H51 L32 44 L13 25 H23 Z" fill="${BLUE_L}"/><ellipse cx="32" cy="53" rx="24" ry="6" fill="${DIRT}"/><path d="M4 40 L10 44 M60 40 L54 44"/>`,
  kingscall: () => `<path d="M6 27 H16 L44 12 V52 L16 37 H6 Z" fill="${DIRT}"/><path d="M50 22 Q56 32 50 42 M56 16 Q64 32 56 48"/>`,
  blink: () => `<circle cx="17" cy="42" r="11" stroke-dasharray="4 5"/>` + `<path d="M44 6 C45 18 47 22 58 24 C47 26 45 30 44 42 C43 30 41 26 30 24 C41 22 43 18 44 6 Z" fill="${FROST}"/>`
    + `<path d="M22 36 Q32 30 36 30" stroke-dasharray="3 4"/>`,
  vortex: () => `<path d="${spiral(32, 32)}" stroke-width="4"/>`,
  turret: () => `<path d="M14 58 L20 44 H44 L50 58 Z" fill="${WOOD}"/><circle cx="32" cy="30" r="15" fill="${GRASS}"/>`
    + `<path d="M17 24 L8 20 L16 32 M47 24 L56 20 L48 32 M26 16 L24 6 L34 15 M40 16 L44 8" fill="${GRASS}"/>` + eyes(32, 31, 4.4, 0.3, 0, 1.2),
  rampart: () => `<path d="M8 58 V26 H16 V32 H26 V26 H38 V32 H48 V26 H56 V58 Z" fill="${STONE_L}"/><path d="M8 44 H56 M24 44 V58 M40 44 V58 M32 32 V44" stroke="${STONE}" stroke-width="2.5"/>`
    + `<path d="M32 4 V20 M24 12 H40" stroke="${GRASS}" stroke-width="5"/>`,
  dash: () => blob(40, 36, 14, BLUE, { look: 0.8 }) + `<path d="M4 26 H20 M2 36 H18 M6 46 H22"/>`,
  recall: () => `<rect x="6" y="22" width="26" height="11" rx="3" fill="${STONE_L}"/><circle cx="38" cy="36" r="15" fill="${STONE_L}"/><circle cx="38" cy="36" r="4" fill="${INK}"/>`
    + `<path d="M48 14 Q54 8 60 12 M44 8 Q48 2 54 2"/>`,
};

const PICTO = {
  hut: (red = false) => svg(hutPath(32, 36, 1.3, BLUE, red)),
  hutNeutral: () => svg(hutPath(32, 36, 1.3, '#D9CFB4')),
  throne: () => svg(`<path d="M10 58 V24 H18 V16 H24 V24 H40 V16 H46 V24 H54 V58 Z" fill="${WALL}"/><path d="M26 58 V44 Q32 36 38 44 V58" fill="${WOOD}"/>` + crownPath(32, 12, 0.6)),
  tower: () => TRAIT.fortify(),
  crown: () => svg(crownPath(32, 36, 1.6)),
  critter: () => svg(blob(32, 36, 22, BLUE)),
  critterRed: () => svg(blob(32, 38, 20, '', { red: true, tuft: true })),
  heart: () => svg(heartPath('#FF8FA0')),
  hourglass: () => svg(TRAIT.patient()),
  alarm: () => svg(`<circle cx="32" cy="36" r="20" fill="${FIRE_L}"/><path d="M32 22 V36 L42 42" stroke-width="4"/><path d="M8 18 L18 8 M56 18 L46 8" stroke-width="5"/><path d="M20 58 L24 52 M44 58 L40 52"/>`),
  lock: () => svg(`<path d="M20 30 V20 A12 12 0 0 1 44 20 V30" stroke-width="5"/><rect x="12" y="28" width="40" height="30" rx="5" fill="${DIRT}"/><circle cx="32" cy="41" r="4" fill="${INK}"/><path d="M32 44 V50" stroke-width="4"/>`),
  reroll: () => svg(`<path d="M50 24 A20 20 0 0 0 14 26" stroke-width="5"/><path d="M8 18 L14 30 L24 22 Z" fill="${INK}"/><path d="M14 40 A20 20 0 0 0 50 38" stroke-width="5"/><path d="M56 46 L50 34 L40 42 Z" fill="${INK}"/>`),
  frenzy: () => svg(duo('M10 38 L22 24 L34 38', GRASS, 5) + duo('M30 38 L42 24 L54 38', GRASS, 5) + `<path d="M22 52 H42"/>`),
  flame: () => svg(`<path d="M32 58 C15 58 9 47 11 37 C13 27 20 22 20 9 C28 15 31 21 31 27 C35 22 36 17 35 10 C47 19 55 31 53 43 C51 52 43 58 32 58 Z" fill="${FIRE}"/><path d="M32 55 C25 55 22 50 23 45 C24 40 28 37 29 31 C34 36 39 41 39 46 C39 51 36 55 32 55 Z" fill="${FIRE_L}" stroke-width="2.5"/>`),
  bolt: () => svg(`<path d="M38 4 L12 36 H30 L24 60 L52 26 H34 Z" fill="${FROST}"/>`),
  pause: () => svg(`<rect x="16" y="12" width="11" height="40" rx="3" fill="#FFF3D6"/><rect x="37" y="12" width="11" height="40" rx="3" fill="#FFF3D6"/>`),
  play: () => svg(`<path d="M20 10 L54 32 L20 54 Z" fill="${INK}" stroke="none"/>`),
  check: () => svg(`<path d="M12 34 L26 48 L52 16" stroke-width="7"/>`),
  cross: () => svg(`<path d="M16 16 L48 48 M48 16 L16 48" stroke-width="7"/>`),
  star: () => svg(star(32, 33, 28, 12, 5, GOLD)),
  sound: () => svg(`<path d="M8 24 H18 L32 12 V52 L18 40 H8 Z" fill="${STONE_L}"/><path d="M40 22 Q46 32 40 42 M46 16 Q56 32 46 48"/>`),
  back: () => svg(`<path d="M40 12 L20 32 L40 52" stroke-width="7"/>`),
  next: () => svg(`<path d="M24 12 L44 32 L24 52" stroke-width="7"/>`),
  question: () => svg(blob(32, 38, 22, '#B7AE98', { eyes: false }) + `<path d="M25 30 Q25 20 32 20 Q40 20 40 28 Q40 33 32 36 V41" stroke-width="4.5"/><circle cx="32" cy="49" r="2.8" fill="${INK}" stroke="none"/>`),
  confetti: () => svg(star(32, 32, 20, 9, 5, GOLD)),
  brokenCrown: () => svg(`<g transform="translate(-3 3) rotate(-9 20 48)"><path d="M9.6 48.8 L6.4 23.2 L20.8 34.4 L32 16.8 L29 26 L34 34 L30 42 L32 48.8 Z" fill="${GOLD}"/></g>`
    + `<g transform="translate(3 5) rotate(10 44 48)"><path d="M32 16.8 L43.2 34.4 L57.6 23.2 L54.4 48.8 L32 48.8 L30 42 L34 34 L29 26 Z" fill="${GOLD}"/></g>`),
  vs: () => svg(`<circle cx="32" cy="32" r="26" fill="${INK}"/>`),
} as const;
export type PictoId = keyof typeof PICTO;

export function mutationIcon(id: MutationId): string { return svg(MUT[id](), 'ic-mut'); }
export function tagIcon(t: MutationTag): string { return svg(TAG[t](), 'ic-tag'); }
export function traitIcon(t: TraitIcon): string { return svg(TRAIT[t](), 'ic-trait'); }
export function abilityIcon(a: AbilityIcon): string { return svg(ABILITY[a](), 'ic-ab'); }
export function picto(id: PictoId, red = false): string {
  if (id === 'hut') return PICTO.hut(red);
  return (PICTO[id] as () => string)();
}

/** Hero pictogram: a King blob with a crown and a per-hero accessory. */
export function heroIcon(id: HeroId, red = false): string {
  const fill = red ? '' : BLUE;
  let acc = '';
  if (id === 'brawler') acc = `<circle cx="10" cy="46" r="7" fill="${WALL}"/><circle cx="54" cy="46" r="7" fill="${WALL}"/>`;
  if (id === 'blink') acc = `<path d="M50 12 C51 18 52 20 58 21 C52 22 51 24 50 30 C49 24 48 22 42 21 C48 20 49 18 50 12 Z" fill="${FROST}"/><path d="M8 40 L4 36 M8 50 H2" />`;
  if (id === 'warden') acc = `<path d="M44 34 L60 38 V48 C60 55 55 59 50 61 C46 59 42 55 42 48 Z" fill="${STONE_L}"/>`;
  const cape = red ? `<path d="M14 56 C10 44 14 36 20 32 H44 C50 36 54 44 50 56 Z" style="fill:var(--red-d)"/>` : `<path d="M14 56 C10 44 14 36 20 32 H44 C50 36 54 44 50 56 Z" fill="#0E2F57"/>`;
  return svg(cape + blob(32, 40, 17, fill, { red, tuft: red, look: 0.2 }) + crownPath(32, 18, 0.72) + acc, 'ic-hero');
}

/** Portrait placeholder: a King bust silhouette. */
export function silhouette(red = true): string {
  const f = red ? 'style="fill:var(--red-d)"' : `fill="#0E2F57"`;
  return `<svg class="ic ic-sil" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g ${f} opacity=".85">`
    + `<path d="M6 64 C6 50 16 42 32 42 C48 42 58 50 58 64 Z"/><circle cx="32" cy="30" r="14"/>`
    + `<path d="M19 18 L18 6 L25 12 L32 3 L39 12 L46 6 L45 18 Z"/></g></svg>`;
}
