import { WebHaptics, type HapticInput } from 'web-haptics';
import type { HapticEffect } from './hapticEffects';

/**
 * Browsers expose duration, not amplitude. `web-haptics` offers an `intensity`
 * below 1, but it can only fake one by chopping the pulse into on/off slices,
 * which reads as a buzz rather than as a lighter tap. So every effect runs at
 * full intensity and carries its weight in duration alone.
 *
 * Durations stay at or under 16ms per beat. Where `navigator.vibrate` is
 * missing the library falls back to toggling a hidden switch element, which
 * Safari answers with a system tap, and it repeats that toggle every 16ms for
 * as long as a beat lasts. Staying inside one interval keeps a tap feeling
 * like a tap instead of a rattle.
 */
const patterns: Record<HapticEffect, HapticInput> = {
  navigate: [{ duration: 6, intensity: 1 }],
  select: [{ duration: 8, intensity: 1 }],
  toggleOff: [{ duration: 8, intensity: 1 }],
  toggleOn: [{ duration: 10, intensity: 1 }],
  press: [{ duration: 12, intensity: 1 }],
  // Outcomes get a second beat, the only way a browser can say more than
  // "something happened": success rises, warning falls, failure repeats.
  success: [
    { duration: 8, intensity: 1 },
    { delay: 70, duration: 14, intensity: 1 },
  ],
  warning: [
    { duration: 14, intensity: 1 },
    { delay: 90, duration: 10, intensity: 1 },
  ],
  error: [
    { duration: 14, intensity: 1 },
    { delay: 60, duration: 14, intensity: 1 },
  ],
};

let engine: WebHaptics | undefined;

/**
 * Reduced motion is the closest standard signal for "do not make this device
 * move on my behalf", and it is the only one a browser gives us. There is no
 * web equivalent of the system haptics switch that iOS and Android provide.
 */
export function ready(): boolean {
  if (typeof document === 'undefined' || document.visibilityState === 'hidden') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function play(effect: HapticEffect): void {
  try {
    // Constructed on first use: the fallback path appends an element to the
    // body, which should not happen on a page that never asks for feedback.
    engine ??= new WebHaptics({ debug: false, showSwitch: false });
    void engine.trigger(patterns[effect]).catch(() => {});
  } catch {
    // A blocked or unimplemented vibration must never interrupt an action.
  }
}

export function cancel(): void {
  engine?.cancel();
}

// A pattern outliving the tab would land after the user has moved on.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancel();
  });
}
