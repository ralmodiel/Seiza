import { describe, expect, it } from "vitest";
import { activeSeason, seasonOn } from "./seasons";

describe("seasons", () => {
  it("follows Japan's calendar", () => {
    expect(seasonOn(new Date(Date.UTC(2026, 3, 5)))).toBe("spring");
    expect(seasonOn(new Date(Date.UTC(2026, 7, 10)))).toBe("summer");
    expect(seasonOn(new Date(Date.UTC(2026, 10, 16)))).toBe("autumn");
    expect(seasonOn(new Date(Date.UTC(2027, 0, 20)))).toBe("winter");
    expect(seasonOn(new Date(Date.UTC(2026, 11, 1)))).toBe("winter");
  });
  it("is off in a world without seasons, unless the room picks one", () => {
    const date = new Date(Date.UTC(2026, 10, 16));
    expect(activeSeason(false, null, date)).toBeNull();
    expect(activeSeason(false, { mode: "realtime", season: "winter" }, date)).toBe("winter");
    expect(activeSeason(true, null, date)).toBe("autumn");
    expect(activeSeason(true, { mode: "realtime", season: "off" }, date)).toBeNull();
    expect(activeSeason(true, { mode: "realtime", season: "auto" }, date)).toBe("autumn");
  });
});
