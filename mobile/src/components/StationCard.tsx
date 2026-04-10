import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';

interface StationLike {
  station_name: string;
  station_code: string;
  interchange?: boolean;
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
        <Ionicons
          name={station.interchange ? 'git-compare' : 'ellipse'}
          size={station.interchange ? 20 : 10}
          color={station.interchange ? colors.interchange : colors.primary}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {station.station_name}
        </Text>
        <Text style={styles.code}>{station.station_code}</Text>
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
});
