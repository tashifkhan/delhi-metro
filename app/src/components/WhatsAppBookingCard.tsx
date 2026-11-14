import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Card } from './Card';
import { OperatorMark } from './OperatorMark';
import { Touchable } from './Touchable';
import { useHaptics } from '../hooks/useHaptics';
import { useAppTheme } from '../theme/ThemeContext';
import type { WhatsAppBooking } from '../types';
import { emphasis, radius, shape, spacing } from '../theme';

interface Props {
  bookings: WhatsAppBooking[];
}

/**
 * Opens the operator's WhatsApp chatbot, one entry per operator.
 *
 * A cross-network trip needs a ticket from each operator, so the entries are
 * numbered steps in riding order. The current step gets the filled button and
 * an outline; opening it moves the highlight to the next one. The link only
 * pre-fills Hi, so each entry says the stations have to be picked again.
 */
export function WhatsAppBookingCard({ bookings }: Props) {
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
      <View style={styles.header}>
        <Text variant="titleMedium" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
          {multi ? 'Book tickets' : 'Book a ticket'}
        </Text>
        {multi ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            One ticket per operator, in the order you ride.
          </Text>
        ) : null}
      </View>

      {bookings.map((booking, index) => {
        const isCurrent = !multi || index === current;
        return (
          <Card
            key={booking.network}
            radius={radius.hero}
            tone={isCurrent && multi ? 'default' : 'low'}
            style={[
              styles.entry,
              isCurrent && multi && styles.entryCurrent,
              isCurrent && multi && { borderColor: theme.colors.primary },
            ]}
          >
            <View style={styles.entryHead}>
              <View style={[styles.markTile, { backgroundColor: fills.containerLowest }]}>
                <OperatorMark network={booking.network} size={32} />
              </View>
              <View style={styles.entryText}>
                <Text
                  variant="titleMedium"
                  style={[emphasis.strong, { color: theme.colors.onSurface }]}
                >
                  {booking.label}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {booking.note}
                </Text>
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
                      emphasis.heavy,
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
              <View style={styles.buttonLabel}>
                <Ionicons
                  name="logo-whatsapp"
                  size={20}
                  color={isCurrent ? theme.colors.onPrimary : theme.colors.primary}
                />
                <Text
                  variant="labelLarge"
                  style={[
                    emphasis.strong,
                    { color: isCurrent ? theme.colors.onPrimary : theme.colors.primary },
                  ]}
                >
                  Book on WhatsApp
                </Text>
              </View>
            </Touchable>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: spacing.sm,
  },
  header: {
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  entry: {
    padding: spacing.base,
    gap: spacing.md,
  },
  // The thicker outline eats one point of padding so the content doesn't shift
  // when the highlight moves to the next step.
  entryCurrent: {
    borderWidth: 2,
    padding: spacing.base - 1,
  },
  entryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  markTile: {
    width: 44,
    height: 44,
    borderRadius: shape.lg - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryText: {
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
  buttonLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
  },
});
