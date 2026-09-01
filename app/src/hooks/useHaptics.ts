import { useMemo } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * App-wide haptic vocabulary.
 *
 * Intent-named rather than intensity-named (`select` not `light`) so call
 * sites stay readable and the physical feel can be retuned in one place.
 *
 * Restraint is the whole game: buzzing on every touch trains people to ignore
 * the feedback, so this fires on state the user *changed*, never on plain
 * navigation or scrolling.
 *
 * Every call is fire-and-forget. The promises are deliberately swallowed —
 * a device without a motor, or with system haptics disabled, must never turn
 * a button press into an unhandled rejection.
 */
export interface HapticFeedback {
  /** Picking one option among several: chips, palettes, theme modes. */
  select: () => void;
  /** Flipping something on or off; the "on" edge is given more weight. */
  toggle: (on: boolean) => void;
  /** A committing press: search, swap, primary actions. */
  press: () => void;
  /** An operation finished cleanly. */
  success: () => void;
  /** An operation failed. */
  error: () => void;
}

const noop = () => {};

function run(fn: () => Promise<void>) {
  return () => {
    void fn().catch(() => {});
  };
}

export function useHaptics(): HapticFeedback {
  return useMemo<HapticFeedback>(() => {
    // Web has no haptics API; calling through would throw on every press.
    if (Platform.OS === 'web') {
      return { select: noop, toggle: noop, press: noop, success: noop, error: noop };
    }

    return {
      select: run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
      toggle: (on: boolean) =>
        void Haptics.impactAsync(
          on ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
        ).catch(() => {}),
      press: run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
      success: run(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      ),
      error: run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
    };
  }, []);
}
