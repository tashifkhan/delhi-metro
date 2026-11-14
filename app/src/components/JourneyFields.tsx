import { useCallback, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Touchable } from './Touchable';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, shape, emphasis, overline } from '../theme';
import { spring } from '../theme/motion';

export interface JourneyEndpoint {
  /** Station name, or null when nothing is picked yet. */
  name: string | null;
  placeholder: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Sits beside the field, outside its touch target, e.g. a details button. */
  trailing?: ReactNode;
}

interface Props {
  from: JourneyEndpoint;
  to: JourneyEndpoint;
  onSwap: () => void;
  swapDisabled?: boolean;
  swapLabel?: string;
}

const FIELD_RADIUS = 22;
const SWAP_SIZE = 52;

/**
 * The stacked from and to fields with a swap button floating over the seam.
 *
 * Home and the results screen both use it, so a journey looks like the same
 * object before and after it is planned.
 */
export function JourneyFields({ from, to, onSwap, swapDisabled, swapLabel }: Props) {
  const theme = useTheme();

  // Half a turn per tap, accumulating, so the icon keeps turning the same way
  // instead of snapping back.
  const spin = useRef(new Animated.Value(0)).current;
  const turns = useRef(0);

  const handleSwap = useCallback(() => {
    onSwap();
    turns.current += 1;
    Animated.spring(spin, {
      toValue: turns.current,
      useNativeDriver: true,
      ...spring.spatial,
    }).start();
  }, [onSwap, spin]);

  return (
    <View>
      <Field kind="from" endpoint={from} />
      <View style={styles.gap} />
      <Field kind="to" endpoint={to} />

      <View style={styles.swapAnchor} pointerEvents="box-none">
        <Touchable
          radius={shape.lg}
          haptic="press"
          disabled={swapDisabled}
          onPress={handleSwap}
          accessibilityLabel={swapLabel ?? 'Swap departure and destination'}
          style={[styles.swap, { backgroundColor: theme.colors.primaryContainer }]}
        >
          <View style={styles.swapInner}>
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: spin.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg'],
                    }),
                  },
                ],
              }}
            >
              <Ionicons
                name="swap-vertical"
                size={22}
                color={theme.colors.onPrimaryContainer}
              />
            </Animated.View>
          </View>
        </Touchable>
      </View>
    </View>
  );
}

function Field({ kind, endpoint }: { kind: 'from' | 'to'; endpoint: JourneyEndpoint }) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const isFrom = kind === 'from';

  return (
    <View style={[styles.field, { backgroundColor: fills.containerLowest }]}>
      <Touchable
        radius={FIELD_RADIUS}
        onPress={endpoint.onPress}
        accessibilityLabel={endpoint.accessibilityLabel}
        accessibilityHint={endpoint.accessibilityHint}
        style={styles.fieldPress}
      >
        <View style={styles.fieldRow}>
          {/* Ring for the start, filled diamond for the end, like a map pin pair. */}
          <View style={styles.markerSlot}>
            {isFrom ? (
              <View style={[styles.ring, { borderColor: theme.colors.primary }]} />
            ) : (
              <View style={[styles.diamond, { backgroundColor: theme.colors.primary }]} />
            )}
          </View>
          <View style={styles.fieldText}>
            <Text
              variant="labelSmall"
              style={[overline, { color: theme.colors.onSurfaceVariant }]}
            >
              {isFrom ? 'From' : 'To'}
            </Text>
            <Text
              variant="titleMedium"
              numberOfLines={1}
              style={[
                emphasis.strong,
                { color: endpoint.name ? theme.colors.onSurface : theme.colors.outline },
              ]}
            >
              {endpoint.name ?? endpoint.placeholder}
            </Text>
          </View>
        </View>
      </Touchable>
      {endpoint.trailing ? <View style={styles.trailing}>{endpoint.trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: {
    height: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: FIELD_RADIUS,
    overflow: 'hidden',
    // Room for the swap button, which floats over the right edge.
    paddingRight: SWAP_SIZE + spacing.md,
  },
  fieldPress: {
    flex: 1,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.base,
    paddingRight: spacing.sm,
    minHeight: 64,
  },
  markerSlot: {
    width: 16,
    alignItems: 'center',
  },
  ring: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
  },
  diamond: {
    width: 11,
    height: 11,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  fieldText: {
    flex: 1,
    gap: 2,
  },
  trailing: {
    marginRight: -spacing.xs,
  },
  swapAnchor: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: spacing.sm,
  },
  swap: {
    width: SWAP_SIZE,
    height: SWAP_SIZE,
    borderRadius: shape.lg,
  },
  swapInner: {
    width: SWAP_SIZE,
    height: SWAP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
