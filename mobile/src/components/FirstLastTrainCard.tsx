import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FirstLastTrainResponse } from '../types';
import { colors, spacing, typography } from '../theme';

interface Props {
  data: FirstLastTrainResponse;
}

function TrainRow({ label, time, icon }: { label: string; time: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.trainRow}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={styles.trainInfo}>
        <Text style={styles.trainLabel}>{label}</Text>
        <Text style={styles.trainTime}>{time}</Text>
      </View>
    </View>
  );
}

export function FirstLastTrainCard({ data }: Props) {
  const firstTime = data.first_train?.endstation_from_first_train_estimated_time ?? '—';
  const lastTime = data.last_train?.endstation_from_last_train_estimated_time ?? '—';

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Train Timings</Text>
      <TrainRow label="First Train" time={firstTime} icon="sunny-outline" />
      <View style={styles.divider} />
      <TrainRow label="Last Train" time={lastTime} icon="moon-outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  heading: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  trainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  trainInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trainLabel: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  trainTime: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: 32,
  },
});
