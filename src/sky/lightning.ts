/**
 * Lightning in heavy rain, on a schedule every visitor works out alike
 * from the wall clock: nothing is sent, and everyone in the room sees the
 * same flash and hears the same thunder (each after their own delay).
 *
 * Time is cut into one-second slots, and a hash of each slot decides
 * whether it holds a strike, when in the second it falls, and how far off
 * it is. Steady rain (Rain, 0.7) brings one every half a minute or so; a
 * typhoon, one every nine seconds or so. Lighter rain brings none.
 */

/** How long a flash lasts, flickers and all, in ms. */
export const FLASH_MS = 600;
const SLOT_MS = 1000;
const SPEED_OF_SOUND = 343;

function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** 0 below steady rain, 1 in a typhoon's downpour. */
export function stormStrength(rain: number): number {
  const t = Math.min(1, Math.max(0, (rain - 0.6) / 0.4));
  return t * t * (3 - 2 * t);
}

export interface Strike {
  /** The slot it fell in: a strike's identity, the same on every client. */
  id: number;
  /** When it flashed, in ms since 1970. */
  at: number;
  /** How far off it struck, in metres: 400 m to 2.5 km. */
  distance: number;
  /** Seconds from the flash to its thunder. */
  thunderDelay: number;
}

/** The strike flashing at `ms`, if one is. */
export function strikeAt(ms: number, rain: number): Strike | null {
  const s = stormStrength(rain);
  if (s <= 0) return null;
  const chance = 0.015 + 0.1 * s;
  const slot = Math.floor(ms / SLOT_MS);
  // This slot's strike, or the last slot's still flickering.
  for (const id of [slot, slot - 1]) {
    if (hash(id) >= chance) continue;
    const at = id * SLOT_MS + hash(id + 0.31) * (SLOT_MS - 100);
    if (ms < at || ms >= at + FLASH_MS) continue;
    const distance = 400 + hash(id + 0.67) * 2100;
    return { id, at, distance, thunderDelay: distance / SPEED_OF_SOUND };
  }
  return null;
}

/** How bright a flash is `sinceMs` after it starts, 0 to 1, nearer
 *  strikes brighter: a first bolt, then a second, weaker one a beat later,
 *  the way lightning restrikes down the same channel. */
export function flashLevel(sinceMs: number, distance: number): number {
  if (sinceMs < 0 || sinceMs >= FLASH_MS) return 0;
  const t = sinceMs / 1000;
  const first = Math.exp(-t * 16);
  const second = t > 0.13 ? 0.75 * Math.exp(-(t - 0.13) * 11) : 0;
  return Math.max(first, second) * (1.25 - distance / 2500);
}
