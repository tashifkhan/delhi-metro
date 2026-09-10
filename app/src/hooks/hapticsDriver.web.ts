import { WebHaptics, type HapticInput } from 'web-haptics';
import type { HapticEffect } from './hapticEffects';

// Short single pulses avoid repeated browser fallback taps. Browsers control
// motor amplitude, so reduce duration rather than simulating it with a buzz.
const patterns: Record<HapticEffect, HapticInput> = {
  navigate: [{ duration: 4, intensity: 1 }],
  select: [{ duration: 4, intensity: 1 }],
  toggleOff: [{ duration: 4, intensity: 1 }],
  toggleOn: [{ duration: 4, intensity: 1 }],
  press: [{ duration: 4, intensity: 1 }],
  longPress: [{ duration: 6, intensity: 1 }],
  success: [{ duration: 6, intensity: 1 }],
  warning: [{ duration: 6, intensity: 1 }],
  error: [{ duration: 6, intensity: 1 }],
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
