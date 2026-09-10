import { AppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { HapticEffect } from './hapticEffects';

// Prefer the soft system tick, including silence on devices that cannot play it.
const android: Record<HapticEffect, Haptics.AndroidHaptics> = {
  navigate: Haptics.AndroidHaptics.Segment_Frequent_Tick,
  select: Haptics.AndroidHaptics.Segment_Frequent_Tick,
  toggleOff: Haptics.AndroidHaptics.Segment_Frequent_Tick,
  toggleOn: Haptics.AndroidHaptics.Segment_Frequent_Tick,
  press: Haptics.AndroidHaptics.Segment_Frequent_Tick,
  longPress: Haptics.AndroidHaptics.Segment_Frequent_Tick,
  success: Haptics.AndroidHaptics.Segment_Frequent_Tick,
  warning: Haptics.AndroidHaptics.Segment_Frequent_Tick,
  error: Haptics.AndroidHaptics.Segment_Frequent_Tick,
};

// Single soft impacts replace heavy impacts and notification sequences.
const ios: Record<HapticEffect, () => Promise<void>> = {
  navigate: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
  select: () => Haptics.selectionAsync(),
  toggleOff: () => Haptics.selectionAsync(),
  toggleOn: () => Haptics.selectionAsync(),
  press: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
  longPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
  success: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
  warning: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
  error: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
};

/** A backgrounded app must not buzz a pocket over work the user cannot see. */
export function ready(): boolean {
  return !AppState.currentState || AppState.currentState === 'active';
}

export function play(effect: HapticEffect): void {
  try {
    const result = Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(android[effect])
      : ios[effect]();
    void result.catch(() => {});
  } catch {
    // Missing native support must never interrupt an interaction.
  }
}

/** System effects are single shots measured in milliseconds; nothing to stop. */
export function cancel(): void {}
