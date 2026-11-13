import { Linking, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Card } from './Card';
import { Touchable } from './Touchable';
import { useHaptics } from '../hooks/useHaptics';
import type { WhatsAppBooking } from '../types';
import { emphasis, radius, spacing } from '../theme';

interface Props {
  bookings: WhatsAppBooking[];
}

/**
 * Opens the operator's WhatsApp chatbot. The link only pre-fills Hi, so the
 * note says the stations have to be picked again in the chat.
 */
export function WhatsAppBookingCard({ bookings }: Props) {
  const theme = useTheme();
  const haptics = useHaptics();

  if (bookings.length === 0) return null;

  const open = (booking: WhatsAppBooking) => {
    haptics.press();
    Linking.openURL(booking.url).catch(() => haptics.error());
  };

  return (
    <Card radius={radius.hero} style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="logo-whatsapp" size={18} color={theme.colors.primary} />
        <Text
          variant="titleSmall"
          style={[emphasis.heavy, { color: theme.colors.onSurface, flex: 1 }]}
        >
          Book a ticket
        </Text>
      </View>
      {bookings.map((booking) => (
        <View key={booking.network} style={styles.entry}>
          <Touchable
            onPress={() => open(booking)}
            haptic={false}
            accessibilityRole="link"
            accessibilityLabel={`Book on WhatsApp with ${booking.label}`}
            accessibilityHint={booking.note}
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
          >
            <View style={styles.buttonLabel}>
              <Ionicons name="logo-whatsapp" size={18} color={theme.colors.onPrimary} />
              <Text
                variant="labelLarge"
                style={[emphasis.strong, { color: theme.colors.onPrimary }]}
              >
                {bookings.length > 1 ? `Book ${booking.label}` : 'Book on WhatsApp'}
              </Text>
            </View>
          </Touchable>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {booking.note}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.base,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  entry: {
    gap: spacing.xs,
  },
  button: {
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  buttonLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
