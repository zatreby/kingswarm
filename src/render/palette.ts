import { Color } from 'three';

// ART.md palette. One place for every colour the renderer uses.
export const PAL = {
  blue: '#3FA7FF', blueDark: '#0E2F57', blueLight: '#BFE3FF',
  red: '#FF5A4F', redDark: '#5E0F0A', redLight: '#FFD0CB',
  /** Colour-blind mode replaces Red with this orange. */
  cbOrange: '#FF9F1C', cbOrangeDark: '#5A2E00', cbOrangeLight: '#FFE0B0',
  neutral: '#D9CFB4',
  gold: '#FFD166', goldDeep: '#A8781A',
  // Grass is ART.md's #6FB04A pulled ~12% toward grey (art review: units must out-saturate the ground).
  grass: '#72A452', grassLight: '#7DAF5C', grassDark: '#67984A', grassEdge: '#557F3F',
  dirt: '#C9B27A', dirtDark: '#B39A62', cliff: '#8A6A45', cliffLight: '#A0805A', cliffDark: '#76583A', cliffBase: '#6B4526', wood: '#6B4526',
  stone: '#8D97A6', wall: '#F1E4C4',
  water: '#2B6F9E', waterDeep: '#1D3F5E', waterLight: '#4F95C2', waterShallow: '#5FB3D6',
  danger: '#FF8A3D', frost: '#9FE8FF', ink: '#1B2430',
  parchment: '#F6EBD0', parchmentShade: '#E4D3A8',
  white: '#FFFFFF',
} as const;

export interface TeamColors { body: string; dark: string; light: string }

export function teamColors(team: 0 | 1, colorBlind: boolean): TeamColors {
  if (team === 0) return { body: PAL.blue, dark: PAL.blueDark, light: PAL.blueLight };
  return colorBlind
    ? { body: PAL.cbOrange, dark: PAL.cbOrangeDark, light: PAL.cbOrangeLight }
    : { body: PAL.red, dark: PAL.redDark, light: PAL.redLight };
}

/** Team colours as reusable Color objects for per-frame code (no string parsing or allocation in the hot path). */
export class TeamPalette {
  readonly body: [Color, Color] = [new Color(), new Color()];
  readonly light: [Color, Color] = [new Color(), new Color()];
  readonly dark: [Color, Color] = [new Color(), new Color()];
  readonly danger = new Color(PAL.danger);
  constructor(colorBlind = false) { this.set(colorBlind); }
  set(colorBlind: boolean): void {
    for (const t of [0, 1] as const) {
      const c = teamColors(t, colorBlind);
      this.body[t].set(c.body); this.light[t].set(c.light); this.dark[t].set(c.dark);
    }
  }
}
