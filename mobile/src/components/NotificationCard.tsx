import { StyleSheet, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { PassengerNotification } from '../types';
import { spacing } from '../theme';

interface Props {
  notification: PassengerNotification;
}

export function NotificationCard({ notification }: Props) {
  const theme = useTheme();

  return (
    <Surface style={styles.container} elevation={1}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
        <Ionicons name="megaphone-outline" size={18} color={theme.colors.onPrimaryContainer} />
      </View>
      <View style={styles.content}>
        <Text variant="bodyMedium" numberOfLines={2} style={{ color: theme.colors.onSurface }}>
          {notification.title}
        </Text>
        <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
          {notification.date}
        </Text>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.base,
    gap: spacing.md,
    borderRadius: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
});
