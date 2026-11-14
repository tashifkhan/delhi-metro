import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import type Ionicons from '@expo/vector-icons/Ionicons';
import { Touchable } from './Touchable';
import { spacing, radius, emphasis } from '../theme';

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
 * Section heading.
 *
 * A sentence-case title in the M3 title size with a plain text action on the
 * right. `icon` is still accepted so call sites don't churn, but headings no
 * longer draw it: a glyph on every heading competed with the content below.
 */
export function SectionHeader({ title, count, action, onAction, inset = false }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.container, inset && styles.insetContainer]}>
      <Text
        variant="titleMedium"
        accessibilityRole="header"
        style={[emphasis.strong, styles.title, { color: theme.colors.onSurface }]}
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
            <Text variant="labelLarge" style={[emphasis.strong, { color: theme.colors.primary }]}>
              {action}
            </Text>
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
    paddingHorizontal: spacing.sm,
  },
});
