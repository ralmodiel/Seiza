import { describe, expect, it } from "vitest";
import { FLASH_MS, flashLevel, strikeAt } from "./lightning";

/** Strikes in an hour of the given rain. */
function strikes(rain: number): number {
  const seen = new Set<number>();
  const start = Date.UTC(2026, 10, 16);
  for (let ms = start; ms < start + 3_600_000; ms += 100) {
    const strike = strikeAt(ms, rain);
    if (strike) seen.add(strike.id);
  }
  return seen.size;
}

describe("lightning", () => {
  it("never strikes in light rain or overcast", () => {
    expect(strikes(0.05)).toBe(0);
    expect(strikes(0.5)).toBe(0);
  });
  it("strikes now and then in steady rain, and often in a typhoon", () => {
    const rain = strikes(0.7);
    const typhoon = strikes(1);
    expect(rain).toBeGreaterThan(60);
    expect(rain).toBeLessThan(220);
    expect(typhoon).toBeGreaterThan(300);
    expect(typhoon).toBeLessThan(560);
  });
  it("is the same strike for everyone, with thunder after the flash", () => {
    const start = Date.UTC(2026, 10, 16);
    let ms = start;
    while (!strikeAt(ms, 1)) ms += 50;
    const a = strikeAt(ms, 1)!;
    expect(strikeAt(ms + 10, 1)?.id).toBe(a.id);
    expect(a.thunderDelay).toBeGreaterThan(1);
    expect(a.thunderDelay).toBeLessThan(8);
  });
  it("flickers, then is gone", () => {
    expect(flashLevel(0, 400)).toBeGreaterThan(0.9);
    expect(flashLevel(160, 400)).toBeGreaterThan(flashLevel(100, 400));
    expect(flashLevel(FLASH_MS, 400)).toBe(0);
  });
});
