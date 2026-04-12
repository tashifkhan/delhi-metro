import { StyleSheet, View } from 'react-native';
import { Surface, Text, useTheme, type MD3Theme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { FirstLastTrainResponse } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme';

interface Props {
  data: FirstLastTrainResponse;
}

function TrainRow({ label, time, icon, iconBg, theme }: {
  label: string;
  time: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  theme: MD3Theme;
}) {
  return (
    <View style={styles.trainRow}>
      <View style={[styles.trainIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={theme.colors.primary} />
      </View>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, flex: 1 }}>
        {label}
      </Text>
      <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
        {time}
      </Text>
    </View>
  );
}

export function FirstLastTrainCard({ data }: Props) {
  const theme = useTheme();
  const { isDark } = useAppTheme();

  const firstTime = data.first_train?.endstation_from_first_train_estimated_time ?? '—';
  const lastTime = data.last_train?.endstation_from_last_train_estimated_time ?? '—';
  const iconBg = isDark ? theme.colors.elevation.level5 : theme.colors.primaryContainer;

  return (
    <Surface style={styles.container} elevation={1}>
      <View style={styles.headerRow}>
        <Ionicons name="train-outline" size={18} color={theme.colors.primary} />
        <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
          Train Timings
        </Text>
      </View>
      <TrainRow label="First Train" time={firstTime} icon="sunny-outline" iconBg={iconBg} theme={theme} />
      <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
      <TrainRow label="Last Train" time={lastTime} icon="moon-outline" iconBg={iconBg} theme={theme} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    padding: spacing.base,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  trainIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    marginLeft: 48,
    opacity: 0.3,
  },
});
