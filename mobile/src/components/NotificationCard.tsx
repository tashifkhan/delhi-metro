import { StyleSheet, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { PassengerNotification } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, emphasis } from '../theme';

interface Props {
  notification: PassengerNotification;
}

export function NotificationCard({ notification }: Props) {
  const theme = useTheme();
  const { isDark } = useAppTheme();

  return (
    <Surface style={styles.container} elevation={isDark ? 2 : 1}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
        <Ionicons name="megaphone-outline" size={18} color={theme.colors.onPrimaryContainer} />
      </View>
      <View style={styles.content}>
        <Text
          variant="bodyMedium"
          numberOfLines={3}
          style={[emphasis.medium, styles.title, { color: theme.colors.onSurface }]}
        >
          {notification.title}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={12} color={theme.colors.onSurfaceVariant} />
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {notification.date}
          </Text>
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.base,
    gap: spacing.md,
    borderRadius: radius.card,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.iconSmall,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
