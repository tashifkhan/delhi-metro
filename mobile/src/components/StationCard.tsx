import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineBadge } from './LineBadge';
import { StationLineIcon } from './StationLineIcon';
import { colors, spacing, typography } from '../theme';
import type { StationLineBadge } from '../types';

interface StationLike {
  station_name: string;
  station_code: string;
  interchange?: boolean;
  metro_lines?: StationLineBadge[];
}

interface Props {
  station: StationLike;
  onPress?: () => void;
  showChevron?: boolean;
}

export function StationCard({ station, onPress, showChevron = true }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.iconContainer}>
        {station.interchange ? (
          <Ionicons name="git-compare" size={20} color={colors.interchange} />
        ) : (
          <StationLineIcon lines={station.metro_lines} size={12} fallbackColor={colors.primary} />
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {station.station_name}
        </Text>
        <Text style={styles.code}>{station.station_code}</Text>
        {!!station.metro_lines?.length && (
          <View style={styles.badgesRow}>
            {station.metro_lines?.map((line) => (
              <LineBadge
                key={`${station.station_code}-${line.line_code}`}
                name={line.line_color}
                color={line.primary_color_code}
                compact
              />
            ))}
          </View>
        )}
      </View>
      {showChevron && onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  pressed: {
    backgroundColor: colors.surfacePressed,
  },
  iconContainer: {
    width: 24,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  code: {
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
});
