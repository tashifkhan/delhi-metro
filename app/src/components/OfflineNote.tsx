import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { spacing, radius, emphasis } from '../theme';

/**
 * Shown above a catalog that came from storage because the network failed.
 * Live data never renders this, so its absence is the signal that the screen
 * is current.
 */
export function OfflineNote({ message, inset = false }: { message: string; inset?: boolean }) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="text"
      style={[
        styles.note,
        inset && styles.inset,
        {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={14} color={theme.colors.onSurfaceVariant} />
      <Text
        variant="labelMedium"
        style={[emphasis.medium, styles.text, { color: theme.colors.onSurfaceVariant }]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Lists have no page padding of their own, so the note keeps the same
  // inset the cards below it use.
  inset: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
  },
  text: {
    flex: 1,
  },
});
