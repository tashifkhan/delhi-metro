import { AppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

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

// Shared across components so nested handlers and rapid taps cannot stack pulses.
let lastFeedbackAt = -Infinity;
let quietUntil = -Infinity;
function emit(ios: () => Promise<void>, android: Haptics.AndroidHaptics, outcome = false) {
  if (Platform.OS === 'web' || (AppState.currentState && AppState.currentState !== 'active')) return;
  const now = Date.now();
  if (now < quietUntil || (!outcome && now - lastFeedbackAt < 80)) return;
  lastFeedbackAt = now;
  if (outcome) quietUntil = now + 400;
  try {
    const result = Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(android)
      : ios();
    void result.catch(() => {});
  } catch {
    // Missing native support must never interrupt an interaction.
  }
}

const feedback: HapticFeedback = {
  navigate: () => emit(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft), Haptics.AndroidHaptics.Segment_Frequent_Tick),
  select: () => emit(() => Haptics.selectionAsync(), Haptics.AndroidHaptics.Segment_Tick),
  toggle: (on) => emit(
    () => on ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) : Haptics.selectionAsync(),
    on ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off,
  ),
  press: () => emit(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), Haptics.AndroidHaptics.Virtual_Key),
  success: () => emit(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), Haptics.AndroidHaptics.Confirm, true),
  warning: () => emit(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), Haptics.AndroidHaptics.Reject, true),
  error: () => emit(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), Haptics.AndroidHaptics.Reject, true),
};

export function useHaptics(): HapticFeedback {
  return feedback;
}
