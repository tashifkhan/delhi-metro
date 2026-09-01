import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { duration as md3Duration, easing } from '../theme/motion';

interface Props {
  children: ReactNode;
  /** Stagger index; each step delays the reveal by `STEP_MS`. */
  index?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * Replay whenever the screen regains focus. On by default — screens that
   * live inside a tab navigator mount once and never unmount, so a
   * mount-only animation would play a single time in the app's whole life.
   */
  replayOnFocus?: boolean;
}

const STEP_MS = 65;
const RISE = 24;

/**
 * Fades content in with an upward drift.
 *
 * Staggering sections gives a screen a reading order — the eye follows the
 * arrival instead of meeting everything at once.
 */
export function Reveal({ children, index = 0, style, replayOnFocus = true }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const isFocused = useIsFocused();
  const active = replayOnFocus ? isFocused : true;

  useEffect(() => {
    if (!active) {
      // Reset while off-screen so the next focus animates from the start
      // rather than snapping in already-complete.
      progress.setValue(0);
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: md3Duration.medium4,
      delay: index * STEP_MS,
      // Decelerate: content arrives and settles rather than easing out again.
      easing: easing.emphasizedDecelerate,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, index, active]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [RISE, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
