import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { useAppTheme } from '../theme/ThemeContext';
import { spring } from '../theme/motion';

interface Props {
  value: boolean;
  /** Omit to render a display-only switch driven by a surrounding row. */
  onValueChange?: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/**
 * Material 3 switch.
 *
 * Paper's `Switch` forwards to the platform control, which renders as a small
 * iOS-style pill and ignores the M3 spec entirely. This draws the real thing:
 * a 52x32 track with a 2dp outline when off, and a thumb that grows from 16dp
 * to 24dp and gains a checkmark as it travels.
 */

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const TRACK_BORDER = 2;
const THUMB_BOX = 24;
const THUMB_OFF_SCALE = 16 / THUMB_BOX;

// Positions are relative to the track's padding box (inside the 2dp border).
const THUMB_OFF_X = 2;
const THUMB_ON_X = 22;

export function Switch({ value, onValueChange, disabled, accessibilityLabel }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    // Color interpolation rules out the native driver, but a switch animates
    // two small views — the JS-driven spring is imperceptible here.
    Animated.spring(progress, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      // Spatial: a thumb that travels should overshoot a touch, like an
      // object with mass coming to rest.
      ...spring.spatial,
    }).start();
  }, [value, progress]);

  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [fills.subtleStrong, theme.colors.primary],
  });

  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.outline, theme.colors.primary],
  });

  const thumbColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.outline, theme.colors.onPrimary],
  });

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [THUMB_OFF_X, THUMB_ON_X],
  });

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [THUMB_OFF_SCALE, 1],
  });

  const track = (
    <Animated.View
      style={[
        styles.track,
        { backgroundColor: trackColor, borderColor },
        disabled && styles.disabled,
      ]}
    >
      <Animated.View style={[styles.thumbBox, { transform: [{ translateX }] }]}>
        <Animated.View
          style={[styles.thumb, { backgroundColor: thumbColor, transform: [{ scale }] }]}
        >
          {/* Fades in with the travel, so the icon never pops. */}
          <Animated.View style={{ opacity: progress }}>
            <Ionicons name="checkmark" size={16} color={theme.colors.onPrimaryContainer} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );

  if (!onValueChange) {
    // Display-only: the parent row owns the gesture and the accessibility role.
    return <View pointerEvents="none">{track}</View>;
  }

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
    >
      {track}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: TRACK_BORDER,
    justifyContent: 'center',
  },
  thumbBox: {
    width: THUMB_BOX,
    height: THUMB_BOX,
  },
  thumb: {
    width: THUMB_BOX,
    height: THUMB_BOX,
    borderRadius: THUMB_BOX / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.38,
  },
});
