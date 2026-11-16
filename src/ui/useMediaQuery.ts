import { useSyncExternalStore } from "react";

/** Live CSS media query match — re-renders when the result changes (e.g.
 *  rotating a tablet, docking a keyboard, toggling device emulation). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false
  );
}

/**
 * A headset's own browser (Quest, Pico, Wolvic), used as a flat page rather
 * than in VR. Its controller ray is a fine, hovering pointer, so the media
 * queries below take it for a mouse, but there's usually no keyboard to
 * walk with: it gets the on-screen controls, which the ray can press like
 * a finger. The user agent is the only sign these browsers give.
 */
export function isHeadsetBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /OculusBrowser|\bQuest\b|PicoBrowser|\bPico\b|Wolvic/i.test(navigator.userAgent);
}

/**
 * Whether to show on-screen movement controls (D-pad, jump).
 *
 * `pointer: coarse` alone misses some Android browsers in desktop-site
 * mode and hybrid tablets, so a device whose *every* pointer is coarse
 * and that can't hover also qualifies. A touchscreen laptop with a
 * trackpad reports a fine primary pointer and correctly gets no D-pad.
 * A headset's browser always qualifies (isHeadsetBrowser).
 */
export function useWantsTouchControls(): boolean {
  const coarsePrimary = useMediaQuery("(pointer: coarse)");
  const touchOnly = useMediaQuery("(any-pointer: coarse) and (any-hover: none)");
  return coarsePrimary || touchOnly || isHeadsetBrowser();
}
