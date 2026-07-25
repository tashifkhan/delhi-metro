import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius } from '../theme';

interface Props {
  /** Number of placeholder rows. */
  rows?: number;
}

const ROW_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];

/**
 * Placeholder rows shown while station results load.
 *
 * Shared by the search screen and the picker sheet so both wait in the same
 * visual language, and so the row shape only has to track the real
 * `StationCard` layout in one place.
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

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });

  return (
    <View style={styles.container} accessibilityLabel="Loading stations" accessibilityRole="progressbar">
      {ROW_KEYS.slice(0, rows).map((key) => (
        <Animated.View key={key} style={[styles.row, { opacity }]}>
          <View style={[styles.icon, { backgroundColor: fills.subtle }]} />
          <View style={styles.lines}>
            <View style={[styles.bar, styles.barWide, { backgroundColor: fills.subtle }]} />
            <View style={[styles.bar, styles.barNarrow, { backgroundColor: fills.subtle }]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.icon,
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
