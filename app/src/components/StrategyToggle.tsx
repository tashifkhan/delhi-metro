import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Touchable } from './Touchable';
import type { RouteStrategy } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, shape, emphasis } from '../theme';
import { spring } from '../theme/motion';

interface Props {
  active: RouteStrategy;
  onChange: (strategy: RouteStrategy) => void;
}

const OPTIONS: { value: RouteStrategy; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'least-distance', label: 'Shortest', icon: 'git-commit-outline' },
  { value: 'minimum-interchange', label: 'Fewest Changes', icon: 'swap-horizontal-outline' },
];

const PADDING = 4;

/**
 * Segmented control whose selection indicator travels between options.
 *
 * The indicator is one moving view rather than a background toggled per
 * segment: sliding shows the relationship between the two choices, where a
 * hard swap just blinks. The results screen also changes this by swipe, so the
 * movement doubles as a report of which way the gesture went.
 */
export function StrategyToggle({ active, onChange }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const activeIndex = Math.max(0, OPTIONS.findIndex((o) => o.value === active));
  const offset = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(offset, {
      toValue: activeIndex,
      useNativeDriver: true,
      ...spring.spatial,
    }).start();
  }, [activeIndex, offset]);

  const segmentWidth = trackWidth > 0 ? (trackWidth - PADDING * 2) / OPTIONS.length : 0;

  const handleLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  return (
    <View
      style={[styles.container, { backgroundColor: fills.subtleStrong }]}
      onLayout={handleLayout}
      accessibilityRole="radiogroup"
    >
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: segmentWidth,
              backgroundColor: fills.selected,
              transform: [
                {
                  translateX: offset.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, segmentWidth],
                  }),
                },
              ],
            },
          ]}
        />
      )}

      {OPTIONS.map((option) => {
        const isActive = active === option.value;
        const foreground = isActive ? theme.colors.primary : theme.colors.onSurfaceVariant;

        return (
          <View key={option.value} style={styles.slot}>
            <Touchable
              radius={shape.md}
              haptic="select"
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Route preference: ${option.label}`}
            >
              <View style={styles.option}>
                <Ionicons name={option.icon} size={18} color={foreground} />
                <Text
                  variant="labelLarge"
                  style={[isActive ? emphasis.heavy : emphasis.medium, { color: foreground }]}
                  numberOfLines={1}
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
  container: {
    flexDirection: 'row',
    borderRadius: shape.lg,
    padding: PADDING,
  },
  indicator: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: shape.md,
  },
  slot: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
  },
});
