import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Touchable } from './Touchable';
import { useAppTheme } from '../theme/ThemeContext';
import { emphasis, spacing } from '../theme';
import { spring } from '../theme/motion';

export interface PillOption<T extends string> {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
}

interface Props<T extends string> {
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Shorter track for app bars and tight rows. */
  compact?: boolean;
  accessibilityLabel?: string;
}

const INSET = 4;

/**
 * A rounded track with a filled pill that slides to the selected option.
 *
 * No outline, no check mark: the tonal pill alone marks the choice, the way
 * Android's own settings and the Paisa analytics range picker do it. The pill
 * is one moving view, so a swipe or tap shows which way the selection went.
 */
export function PillSegmented<T extends string>({
  options,
  value,
  onChange,
  compact = false,
  accessibilityLabel,
}: Props<T>) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const [width, setWidth] = useState(0);

  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const offset = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.spring(offset, { toValue: index, useNativeDriver: true, ...spring.spatial }).start();
  }, [index, offset]);

  const segment = width > 0 ? (width - INSET * 2) / options.length : 0;
  const height = compact ? 36 : 48;

  return (
    <View
      style={[styles.track, { backgroundColor: fills.containerHigh, height }]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              width: segment,
              backgroundColor: theme.colors.primaryContainer,
              transform: [
                {
                  translateX: offset.interpolate({
                    inputRange: [0, Math.max(1, options.length - 1)],
                    outputRange: [0, segment * Math.max(1, options.length - 1)],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}

      {options.map((option) => {
        const selected = option.value === value;
        const color = selected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant;
        return (
          <View key={option.value} style={styles.slot}>
            <Touchable
              radius={999}
              haptic="select"
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.accessibilityLabel ?? option.label}
            >
              <View style={[styles.option, { height: height - INSET * 2 }]}>
                {option.icon ? <Ionicons name={option.icon} size={compact ? 15 : 17} color={color} /> : null}
                <Text
                  variant={compact ? 'labelMedium' : 'labelLarge'}
                  numberOfLines={1}
                  style={[selected ? emphasis.strong : emphasis.medium, { color }]}
                >
                  {option.label}
                </Text>
              </View>
            </Touchable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: INSET,
  },
  pill: {
    position: 'absolute',
    top: INSET,
    bottom: INSET,
    left: INSET,
    borderRadius: 999,
  },
  slot: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
});
