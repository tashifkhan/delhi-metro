import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';

import { OperatorMark } from './OperatorMark';
import { Touchable } from './Touchable';
import { useHaptics } from '../hooks/useHaptics';
import { useAppTheme } from '../theme/ThemeContext';
import { NETWORK_NAMES } from '../network';
import type { MetroNetwork, WhatsAppBooking } from '../types';
import { emphasis, radius, spacing } from '../theme';

interface Props {
  bookings: WhatsAppBooking[];
  /** "Rajiv Chowk to Noida Sector 52" per operator, shown under its name. */
  routes?: Partial<Record<MetroNetwork, string>>;
}

/**
 * One card per operator, each opening that operator's WhatsApp ticket bot.
 *
 * A cross-network trip needs a ticket from each operator, so the cards are
 * numbered steps in riding order. The current step gets the outline and the
 * filled button; opening it moves both to the next step. The link only
 * pre-fills Hi, so the note under the cards says to pick the stations again.
 */
export function WhatsAppBookingCard({ bookings, routes }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const haptics = useHaptics();
  const [current, setCurrent] = useState(0);

  if (bookings.length === 0) return null;
  const multi = bookings.length > 1;

  const open = (booking: WhatsAppBooking, index: number) => {
    haptics.press();
    Linking.openURL(booking.url)
      .then(() => setCurrent(Math.min(index + 1, bookings.length - 1)))
      .catch(() => haptics.error());
  };

  return (
    <View style={styles.column}>
      {bookings.map((booking, index) => {
        const isCurrent = !multi || index === current;
        const highlighted = multi && isCurrent;
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
              accessibilityLabel={`Book on WhatsApp with ${booking.label}`}
              accessibilityHint={booking.note}
              style={
                isCurrent
                  ? { backgroundColor: theme.colors.primary }
                  : { borderWidth: 1, borderColor: theme.colors.outline }
              }
            >
              <View style={styles.button}>
                <Ionicons
                  name="logo-whatsapp"
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
                  Book on WhatsApp
                </Text>
              </View>
            </Touchable>
          </View>
        );
      })}

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={18} color={theme.colors.onSurfaceVariant} />
        <Text variant="bodySmall" style={[styles.noteText, { color: theme.colors.onSurfaceVariant }]}>
          The chat opens with "Hi". Pick the same stations again inside WhatsApp.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    height: 52,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  noteText: {
    flex: 1,
  },
});
