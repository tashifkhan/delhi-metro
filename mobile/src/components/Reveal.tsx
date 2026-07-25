import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

interface Props {
  children: ReactNode;
  /** Stagger index; each step delays the reveal by `STEP_MS`. */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

const STEP_MS = 55;
const DURATION_MS = 320;
const RISE = 10;

/**
 * Fades content in with a short upward drift.
 *
 * Staggering sections by a few frames gives a screen a reading order — the eye
 * follows the arrival instead of meeting everything at once. Kept small and
 * quick deliberately: this should register as polish, not as a transition the
 * user has to sit through.
 */
export function Reveal({ children, index = 0, style }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      delay: index * STEP_MS,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, index]);

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
