import { useCallback, useRef, type ReactNode } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { TouchableRipple, useTheme } from 'react-native-paper';
import { radius as radii, tint } from '../theme';

interface Props {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  children: ReactNode;
  /** Corner radius; the ripple is clipped to it. Defaults to the card radius. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * Dip slightly while held. Reserve for card-sized targets where this
   * Touchable is the outermost element — on small controls the movement reads
   * as a glitch, and under a `Surface` it shrinks the contents away from a
   * card background that stays put.
   */
  scaleOnPress?: boolean;
  /** Overrides the default 12% on-surface state layer. */
  rippleColor?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'link' | 'tab' | 'checkbox' | 'radio';
  accessibilityState?: { selected?: boolean; disabled?: boolean; expanded?: boolean };
}

const PRESSED_SCALE = 0.97;

/**
 * Tappable surface carrying a Material 3 state layer.
 *
 * Wraps Paper's `TouchableRipple` so every interactive element gets the same
 * ripple, corner clipping and accessibility wiring, plus an optional press
 * scale for large targets. Prefer this over a bare `Pressable`, which gives no
 * visual response to touch at all.
 */
export function Touchable({
  onPress,
  onLongPress,
  disabled,
  children,
  radius = radii.card,
  style,
  scaleOnPress = false,
  rippleColor,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
}: Props) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = useCallback(
    (toValue: number) => {
      if (!scaleOnPress) return;
      Animated.spring(scale, {
        toValue,
        useNativeDriver: true,
        speed: 40,
        bounciness: 0,
      }).start();
    },
    [scale, scaleOnPress],
  );

  const handlePressIn = useCallback(() => animateTo(PRESSED_SCALE), [animateTo]);
  const handlePressOut = useCallback(() => animateTo(1), [animateTo]);

  const content = (
    <TouchableRipple
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || !onPress}
      borderless
      // Scheme colors are `rgb(...)` strings, so the M3 12% pressed state layer
      // has to be composed rather than appended as a hex alpha suffix.
      rippleColor={rippleColor ?? tint(theme.colors.onSurface, 0.12)}
      style={[{ borderRadius: radius }, style]}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: disabled || !onPress, ...accessibilityState }}
    >
      <View>{children}</View>
    </TouchableRipple>
  );

  if (!scaleOnPress) {
    return <View style={[styles.clip, { borderRadius: radius }]}>{content}</View>;
  }

  return (
    <Animated.View
      style={[styles.clip, { borderRadius: radius, transform: [{ scale }] }]}
    >
      {content}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
