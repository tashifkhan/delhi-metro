import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../../theme/ThemeContext';
import { emphasis, spacing } from '../../theme';
import { spring, duration } from '../../theme/motion';

interface Props {
  /** The 96pt visual: the loading indicator, or an icon in a circle. */
  visual: ReactNode;
  title?: string;
  subtitle?: string;
  /** Buttons under the text. */
  actions?: ReactNode;
  /** Fill the screen and paint the page background. */
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared layout for loading, error and empty states, after Patchwork's
 * `LoadingState`: a 96pt visual that springs in, a title, a quieter subtitle
 * capped at 300pt wide, then any actions. Using one layout keeps the three
 * states the same size, so swapping one for another doesn't jump.
 */
export function StateLayout({ visual, title, subtitle, actions, fullScreen = true, style }: Props) {
  const theme = useTheme();
  const { animationStyle } = useAppTheme();
  const still = animationStyle === 'none';
  const scale = useRef(new Animated.Value(still ? 1 : 0.6)).current;
  const opacity = useRef(new Animated.Value(still ? 1 : 0)).current;

  useEffect(() => {
    if (still) return;
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...spring.spatial }),
      Animated.timing(opacity, { toValue: 1, duration: duration.medium2, useNativeDriver: true }),
    ]).start();
  }, [still, scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.container,
        fullScreen ? styles.fullScreen : styles.inline,
        fullScreen ? { backgroundColor: theme.colors.background } : null,
        { opacity },
        style,
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{visual}</Animated.View>
      {title || subtitle ? (
        <View style={styles.text}>
          {title ? (
            <Text
              variant="titleMedium"
              style={[emphasis.strong, styles.center, { color: theme.colors.onSurface }]}
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text
              variant="bodyMedium"
              style={[styles.center, styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.lg,
  },
  fullScreen: {
    flex: 1,
  },
  inline: {
    paddingVertical: spacing['4xl'],
  },
  text: {
    alignItems: 'center',
    gap: 6,
    maxWidth: 300,
  },
  center: {
    textAlign: 'center',
  },
  subtitle: {
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
