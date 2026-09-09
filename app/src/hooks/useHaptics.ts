import { isOutcome, type HapticEffect } from './hapticEffects';
import { cancel, play, ready } from './hapticsDriver';

/** Feedback grows with intent: navigation, selection, commitment, outcome. */
export interface HapticFeedback {
  navigate: () => void;
  select: () => void;
  toggle: (on: boolean) => void;
  press: () => void;
  success: () => void;
  warning: () => void;
  error: () => void;
}

// Shared across components so nested handlers and rapid taps cannot stack
// pulses. The policy lives above the driver so a platform cannot drift into
// feeling chattier than the others.
let lastFeedbackAt = -Infinity;
let quietUntil = -Infinity;

function emit(effect: HapticEffect) {
  if (!ready()) return;
  const now = Date.now();
  const outcome = isOutcome(effect);
  if (now < quietUntil || (!outcome && now - lastFeedbackAt < 80)) return;
  lastFeedbackAt = now;
  if (outcome) {
    quietUntil = now + 400;
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
  success: () => emit('success'),
  warning: () => emit('warning'),
  error: () => emit('error'),
};

export function useHaptics(): HapticFeedback {
  return feedback;
}
