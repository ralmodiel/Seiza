/**
 * The four seasons, as decoration: a world that asks for them (world.json
 * `sky.seasons`) dresses its outdoors by Japan's calendar, the way Seiza
 * borrows its name: sakura in spring, cicadas in summer, red leaves in
 * autumn, snow in winter. A room can pick one from the edit panel.
 *
 * Only what you see and hear. The sky, its light, and the weather engine
 * still follow the Philippines (src/sky/weather.ts), so a world that
 * simulates sun and wind, like Seizora, never computes energy from snow.
 */
import type { RoomSky } from "../multiplayer/types";

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

/** Japan's seasons by month: March to May is spring, and so on. */
export function seasonOn(date: Date): Season {
  const month = date.getUTCMonth(); // 0 = January; a few hours either side doesn't matter
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

/** The season a room shows: the room's pick if it made one, else the
 *  calendar's in a world with seasons, else none. */
export function activeSeason(worldSeasons: boolean, room: RoomSky | null, date: Date): Season | null {
  const pick = room?.season;
  if (pick === "off") return null;
  if (pick && pick !== "auto") return pick;
  return worldSeasons ? seasonOn(date) : null;
}
