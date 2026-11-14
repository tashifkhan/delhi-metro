import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Touchable } from './Touchable';
import type { RouteStrategy } from '../types';
import { spacing, radius, emphasis } from '../theme';
import { spring } from '../theme/motion';

interface Props {
  active: RouteStrategy;
  onChange: (strategy: RouteStrategy) => void;
}

const OPTIONS: { value: RouteStrategy; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'least-distance', label: 'Shortest', icon: 'git-commit-outline' },
  { value: 'minimum-interchange', label: 'Fewer changes', icon: 'git-merge-outline' },
];

const HEIGHT = 40;
const BORDER = 1;

/**
 * M3 outlined segmented button.
 *
 * The selected fill is one view that slides between segments instead of a
 * background toggled per segment. The results screen also switches strategy
 * by swipe, so the movement shows which way the gesture went. The selected
 * segment swaps its icon for a check mark, as the M3 spec does.
 */
export function StrategyToggle({ active, onChange }: Props) {
  const theme = useTheme();
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

  const segmentWidth = trackWidth > 0 ? (trackWidth - BORDER * 2) / OPTIONS.length : 0;

  const handleLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  return (
    <View
      style={[styles.container, { borderColor: theme.colors.outline }]}
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
              backgroundColor: theme.colors.secondaryContainer,
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

      {OPTIONS.map((option, index) => {
        const isActive = active === option.value;
        const foreground = isActive
          ? theme.colors.onSecondaryContainer
          : theme.colors.onSurface;

        return (
          <View
            key={option.value}
            style={[
              styles.slot,
              index > 0 && { borderLeftWidth: BORDER, borderLeftColor: theme.colors.outline },
            ]}
          >
            <Touchable
              radius={0}
              haptic="select"
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Route preference: ${option.label}`}
            >
              <View style={styles.option}>
                <Ionicons
                  name={isActive ? 'checkmark' : option.icon}
                  size={18}
                  color={foreground}
                />
                <Text
                  variant="labelLarge"
                  style={[emphasis.strong, { color: foreground }]}
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
    borderRadius: radius.pill,
    borderWidth: BORDER,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  slot: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: HEIGHT - BORDER * 2,
    paddingHorizontal: spacing.md,
  },
});
