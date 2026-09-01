import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Touchable } from './Touchable';
import { spacing, radius, emphasis, overline } from '../theme';

interface Props {
  title: string;
  /** Optional leading glyph. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Trailing tally, e.g. the number of items in the section. */
  count?: number;
  action?: string;
  onAction?: () => void;
  /** Set when the header sits in a full-bleed list rather than a padded parent. */
  inset?: boolean;
}

/**
 * Section label.
 *
 * The glyph is bare rather than sitting in a tinted tile: stacked down a
 * screen those tiles compete with the content they are supposed to introduce.
 * Emphasis comes from tracked capitals instead, which stays quiet at any size.
 */
export function SectionHeader({ title, icon, count, action, onAction, inset = false }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.container, inset && styles.insetContainer]}>
      {icon && (
        <Ionicons name={icon} size={14} color={theme.colors.onSurfaceVariant} />
      )}
      <Text
        variant="labelMedium"
        style={[overline, styles.title, { color: theme.colors.onSurfaceVariant }]}
      >
        {title}
      </Text>
      {count !== undefined && (
        <Text
          variant="labelMedium"
          style={[emphasis.heavy, { color: theme.colors.onSurfaceVariant }]}
        >
          {count}
        </Text>
      )}
      {action && onAction ? (
        <Touchable
          radius={radius.pill}
          onPress={onAction}
          accessibilityLabel={`${action}, ${title}`}
        >
          <View style={styles.action}>
            <Text variant="labelMedium" style={[emphasis.strong, { color: theme.colors.primary }]}>
              {action}
            </Text>
            <Ionicons name="chevron-forward" size={13} color={theme.colors.primary} />
          </View>
        </Touchable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  insetContainer: {
    paddingHorizontal: spacing.base,
  },
  title: {
    flex: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.sm,
  },
});
