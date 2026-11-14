import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, shape } from '../theme';

interface Props {
  /** Number of placeholder rows. */
  rows?: number;
}

const ROW_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];

/**
 * Placeholder rows shown while station results load.
 *
 * Same segmented tiles as `StationCard`, so the list doesn't change shape
 * when the real rows arrive. Shared by the Search tab and the picker sheet.
 */
export function StationListSkeleton({ rows = 5 }: Props) {
  const { fills } = useAppTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const keys = ROW_KEYS.slice(0, rows);

  return (
    <View style={styles.container} accessibilityLabel="Loading stations" accessibilityRole="progressbar">
      {keys.map((key, index) => {
        const first = index === 0;
        const last = index === keys.length - 1;
        return (
          <View
            key={key}
            style={[
              styles.row,
              {
                backgroundColor: fills.containerLow,
                borderTopLeftRadius: first ? shape.xl : shape.sm,
                borderTopRightRadius: first ? shape.xl : shape.sm,
                borderBottomLeftRadius: last ? shape.xl : shape.sm,
                borderBottomRightRadius: last ? shape.xl : shape.sm,
              },
            ]}
          >
            <Animated.View style={[styles.icon, { opacity, backgroundColor: fills.containerHighest }]} />
            <View style={styles.lines}>
              <Animated.View
                style={[styles.bar, styles.barWide, { opacity, backgroundColor: fills.containerHighest }]}
              />
              <Animated.View
                style={[styles.bar, styles.barNarrow, { opacity, backgroundColor: fills.containerHigh }]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.base,
    gap: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
  },
  lines: {
    flex: 1,
    gap: spacing.sm,
  },
  bar: {
    height: 12,
    borderRadius: 6,
  },
  barWide: {
    width: '62%',
  },
  barNarrow: {
    width: '38%',
    height: 10,
  },
});
