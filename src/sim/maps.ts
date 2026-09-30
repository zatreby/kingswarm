import type { MapDef } from './types';

/** Battle 1 arena: open middle, obstacles on the flanks so every direct building-to-building route stays clear. */
export const meadow: MapDef = {
  id: 'meadow',
  name: 'Meadow',
  half: [
    { kind: 'throne', x: 3.5, y: 14.5 },
    { kind: 'hut', x: 8.5, y: 12 },
    { kind: 'hut', x: 4.5, y: 8.5 },
    { kind: 'hut', x: 12, y: 15.5 },
    { kind: 'hut', x: 12.5, y: 7 },
    { kind: 'hut', x: 8.5, y: 3.8 },
  ],
  obstacles: [
    { x: 2.0, y: 11.0, r: 0.9, look: 'trees' },
    { x: 6.5, y: 16.5, r: 0.6, look: 'rock' },
    { x: 3.5, y: 3.5, r: 0.9, look: 'pond' },
    { x: 13.5, y: 3.0, r: 0.7, look: 'rock' },
  ],
};

export const MAPS: Record<string, MapDef> = { meadow };
