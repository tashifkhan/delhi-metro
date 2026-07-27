import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import type { ServiceTimes } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, emphasis, tabular } from '../theme';

interface Props {
  data: ServiceTimes | null | undefined;
}

function TrainRow({
  label,
  time,
  icon,
  iconBg,
}: {
  label: string;
  time: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.trainRow}>
      <View style={[styles.trainIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={theme.colors.primary} />
      </View>
      <Text variant="bodyMedium" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Text
        variant="titleMedium"
        style={[emphasis.heavy, tabular, { color: theme.colors.onSurface }]}
      >
        {time}
      </Text>
    </View>
  );
}

export function FirstLastTrainCard({ data }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();

  const firstTime = data?.first?.trim() || '—';
  const lastTime = data?.last?.trim() || '—';

  if (firstTime === '—' && lastTime === '—') {
    return null;
  }

  return (
    <Card radius={radius.hero} style={styles.container}>
      <View style={styles.headerRow}>
        <View style={[styles.headerIcon, { backgroundColor: fills.accentSubtle }]}>
          <Ionicons name="time-outline" size={15} color={theme.colors.primary} />
        </View>
        <Text variant="titleSmall" style={[emphasis.heavy, { color: theme.colors.onSurface }]}>
          Train Timings
        </Text>
      </View>
      <TrainRow
        label="First train"
        time={firstTime}
        icon="sunny-outline"
        iconBg={fills.accentSubtle}
      />
      <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
      <TrainRow
        label="Last train"
        time={lastTime}
        icon="moon-outline"
        iconBg={fills.accentSubtle}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.hero,
    padding: spacing.base,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.badge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  trainIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.iconSmall,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 36 + spacing.md,
    opacity: 0.5,
  },
});
