import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAdaptedStyles } from '../theme/useAdaptedStyles';

import { OperatorMark } from './OperatorMark';
import { Touchable } from './Touchable';
import { useHaptics } from '../hooks/useHaptics';
import { useAppTheme } from '../theme/ThemeContext';
import { NETWORK_NAMES } from '../network';
import { bookingUrl } from '../services/ticketBooking';
import type { MetroNetwork, TicketBooking } from '../types';
import { emphasis, radius, spacing } from '../theme';

interface Props {
  bookings: TicketBooking[];
  /** "Rajiv Chowk to Noida Sector 52" per operator, shown under its name. */
  routes?: Partial<Record<MetroNetwork, string>>;
}

/**
 * One official booking option per operator, in travel order.
 */
export function TicketBookingCards({ bookings, routes }: Props) {
  const styles = useAdaptedStyles(baseStyles);
  const theme = useTheme();
  const { fills } = useAppTheme();
  const haptics = useHaptics();
  const [current, setCurrent] = useState(0);

  if (bookings.length === 0) return null;
  const multi = bookings.length > 1;

  const open = (booking: TicketBooking, index: number) => {
    haptics.press();
    Linking.openURL(bookingUrl(booking, Platform.OS))
      .then(() => setCurrent(Math.min(index + 1, bookings.length - 1)))
      .catch(() => haptics.error());
  };

  return (
    <View style={styles.column}>
      {bookings.map((booking, index) => {
        const isCurrent = !multi || index === current;
        const highlighted = multi && isCurrent;
        const isApp = 'channel' in booking;
        const action = isApp
          ? Platform.OS === 'web' ? 'Open Namo Bharat website' : 'Namo Bharat Connect'
          : 'Book on WhatsApp';
        return (
          <View
            key={booking.network}
            style={[
              styles.card,
              { backgroundColor: highlighted ? fills.container : fills.containerLow },
              highlighted && [styles.cardCurrent, { borderColor: theme.colors.primary }],
            ]}
          >
            <View style={styles.head}>
              <View style={[styles.logo, { backgroundColor: fills.containerLowest }]}>
                <OperatorMark network={booking.network} size={30} />
              </View>
              <View style={styles.headText}>
                <Text variant="titleMedium" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                  {NETWORK_NAMES[booking.network] ?? booking.label}
                </Text>
                {routes?.[booking.network] ? (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {routes[booking.network]}
                  </Text>
                ) : null}
              </View>
              {multi ? (
                <View
                  style={[
                    styles.step,
                    isCurrent
                      ? { backgroundColor: theme.colors.primary }
                      : { borderWidth: 1.5, borderColor: theme.colors.outline },
                  ]}
                  accessibilityLabel={`Step ${index + 1}`}
                >
                  <Text
                    variant="labelLarge"
                    style={[
                      emphasis.strong,
                      { color: isCurrent ? theme.colors.onPrimary : theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
              ) : null}
            </View>

            <Touchable
              onPress={() => open(booking, index)}
              radius={radius.pill}
              haptic={false}
              accessibilityRole="link"
              accessibilityLabel={isApp ? action : `Book on WhatsApp with ${booking.label}`}
              style={
                isCurrent
                  ? { backgroundColor: theme.colors.primary }
                  : { borderWidth: 1, borderColor: theme.colors.outline }
              }
            >
              <View style={styles.button}>
                <Ionicons
                  name={isApp ? 'open-outline' : 'logo-whatsapp'}
                  size={20}
                  color={isCurrent ? theme.colors.onPrimary : theme.colors.primary}
                />
                <Text
                  variant="titleSmall"
                  style={[
                    emphasis.strong,
                    { color: isCurrent ? theme.colors.onPrimary : theme.colors.primary },
                  ]}
                >
                  {action}
                </Text>
              </View>
            </Touchable>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {booking.note}
            </Text>
          </View>
        );
      })}

    </View>
  );
}

const baseStyles = StyleSheet.create({
  column: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: 24,
    padding: spacing.base,
    gap: 14,
    borderWidth: 0,
  },
  // The outline replaces two points of padding so content doesn't shift when
  // the highlight moves to the next step.
  cardCurrent: {
    borderWidth: 2,
    padding: spacing.base - 2,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.sm,
  },
});
