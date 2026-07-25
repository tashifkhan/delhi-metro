import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Touchable } from './Touchable';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, emphasis } from '../theme';

interface Props {
  title: string;
  /** Optional leading glyph, shown in a tinted tile. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Trailing tally, e.g. the number of items in the section. */
  count?: number;
  action?: string;
  onAction?: () => void;
  /** Set when the header sits in a full-bleed list rather than a padded parent. */
  inset?: boolean;
}

export function SectionHeader({
  title,
  icon,
  count,
  action,
  onAction,
  inset = false,
}: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();

  return (
    <View style={[styles.container, inset && styles.insetContainer]}>
      {icon && (
        <View style={[styles.iconWrap, { backgroundColor: fills.accentSubtle }]}>
          <Ionicons name={icon} size={15} color={theme.colors.primary} />
        </View>
      )}
      <Text
        variant="titleMedium"
        style={[emphasis.heavy, styles.title, { color: theme.colors.onSurface }]}
      >
        {title}
      </Text>
      {count !== undefined && (
        <View style={[styles.countBadge, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text
            variant="labelSmall"
            style={[emphasis.heavy, { color: theme.colors.onPrimaryContainer }]}
          >
            {count}
          </Text>
        </View>
      )}
      {action && onAction ? (
        <Touchable
          radius={radius.pill}
          onPress={onAction}
          accessibilityLabel={`${action}, ${title}`}
        >
          <View style={styles.action}>
            <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
              {action}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
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
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.badge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
  },
  countBadge: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
});
