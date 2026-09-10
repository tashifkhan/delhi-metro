import { isOutcome, type HapticEffect } from './hapticEffects';
import { cancel, play, ready } from './hapticsDriver';

/** Routine taps stay silent; switches, long presses, and outcomes get light feedback. */
export interface HapticFeedback {
  navigate: () => void;
  select: () => void;
  toggle: (on: boolean) => void;
  press: () => void;
  longPress: () => void;
  success: () => void;
  warning: () => void;
  error: () => void;
}

// Shared across components so nested handlers and rapid taps cannot stack
// pulses. The policy lives above the driver so a platform cannot drift into
// feeling chattier than the others.
let lastFeedbackAt = -Infinity;
let quietUntil = -Infinity;

// The user's own switch. On by default, and toggled from the Appearance screen
// via `setHapticsEnabled`, so feedback stays a policy decision and no control
// has to know about the preference.
let enabled = true;

export function setHapticsEnabled(next: boolean) {
  enabled = next;
}

function emit(effect: HapticEffect) {
  // Keep routine interactions silent across every screen and platform.
  if (effect === 'navigate' || effect === 'select' || effect === 'press') return;
  if (!enabled || !ready()) return;
  const now = Date.now();
  const outcome = isOutcome(effect);
  if (now < quietUntil || (!outcome && now - lastFeedbackAt < 250)) return;
  lastFeedbackAt = now;
  if (outcome) {
    quietUntil = now + 600;
    // Clear the tap that triggered the action so its tail cannot blur the
    // first beat of the answer.
    cancel();
  }
  play(effect);
}

const feedback: HapticFeedback = {
  navigate: () => emit('navigate'),
  select: () => emit('select'),
  toggle: (on) => emit(on ? 'toggleOn' : 'toggleOff'),
  press: () => emit('press'),
  longPress: () => emit('longPress'),
  success: () => emit('success'),
  warning: () => emit('warning'),
  error: () => emit('error'),
};

export function useHaptics(): HapticFeedback {
  return feedback;
}
