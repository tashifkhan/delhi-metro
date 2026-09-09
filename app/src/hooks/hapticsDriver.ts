import { AppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { HapticEffect } from './hapticEffects';

/**
 * Android plays the system's own effects rather than a duration we invented.
 * `performAndroidHapticsAsync` forwards to `HapticFeedbackConstants`, so each
 * one is tuned for the device's actuator and matches what the rest of the
 * platform does for the same gesture.
 *
 * `Clock_Tick` carries navigation instead of `Segment_Frequent_Tick`: the
 * frequent tick is specified for scrubbing through many values in quick
 * succession, and its contract lets a device skip it entirely when it cannot
 * vibrate that softly. Opening a screen is deliberate and infrequent, so it
 * should be the lightest effect that is still guaranteed to be felt.
 */
const android: Record<HapticEffect, Haptics.AndroidHaptics> = {
  navigate: Haptics.AndroidHaptics.Clock_Tick,
  select: Haptics.AndroidHaptics.Segment_Tick,
  toggleOff: Haptics.AndroidHaptics.Toggle_Off,
  toggleOn: Haptics.AndroidHaptics.Toggle_On,
  press: Haptics.AndroidHaptics.Virtual_Key,
  longPress: Haptics.AndroidHaptics.Long_Press,
  success: Haptics.AndroidHaptics.Confirm,
  warning: Haptics.AndroidHaptics.Reject,
  error: Haptics.AndroidHaptics.Reject,
};

/**
 * iOS follows Apple's conventions rather than imitating Android: the selection
 * generator owns discrete choices, impacts carry weight, and the notification
 * generator owns outcomes.
 */
const ios: Record<HapticEffect, () => Promise<void>> = {
  navigate: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
  select: () => Haptics.selectionAsync(),
  toggleOff: () => Haptics.selectionAsync(),
  toggleOn: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  press: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  longPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
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
