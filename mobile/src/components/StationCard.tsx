import { StyleSheet, View } from 'react-native';
import { Surface, TouchableRipple, Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { LineBadge } from './LineBadge';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme';
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
  const theme = useTheme();
  const { isDark, semantic } = useAppTheme();

  const primaryLineColor = station.metro_lines?.[0]?.primary_color_code ?? theme.colors.primary;

  return (
    <View style={styles.wrapper}>
      <Surface
        style={[
          styles.card,
          { backgroundColor: isDark ? theme.colors.elevation.level2 : theme.colors.surfaceVariant },
        ]}
        elevation={0}
      >
        <TouchableRipple
          onPress={onPress}
          disabled={!onPress}
          rippleColor={theme.colors.primaryContainer}
          borderless
          style={styles.ripple}
        >
          <View style={styles.container}>
            {/* Line color icon */}
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: isDark ? theme.colors.elevation.level4 : theme.colors.primaryContainer },
              ]}
            >
              {station.interchange ? (
                <Ionicons name="git-compare" size={18} color={semantic.interchange} />
              ) : (
                <Ionicons name="train" size={18} color={primaryLineColor} />
              )}
            </View>

            {/* Content */}
            <View style={styles.content}>
              <View style={styles.nameRow}>
                <Text
                  variant="titleSmall"
                  style={{ color: theme.colors.onSurface, fontWeight: '600', flex: 1 }}
                  numberOfLines={1}
                >
                  {station.station_name}
                </Text>
                <View style={[styles.codeBadge, { backgroundColor: isDark ? theme.colors.elevation.level5 : theme.colors.background }]}>
                  <Text variant="labelSmall" style={{ color: theme.colors.primary, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                    {station.station_code}
                  </Text>
                </View>
              </View>

              {!!station.metro_lines?.length && (
                <View style={styles.badgesRow}>
                  {station.metro_lines.map((line) => (
                    <LineBadge
                      key={`${station.station_code}-${line.line_code}`}
                      name={line.line_color}
                      color={line.primary_color_code}
                      compact
                    />
                  ))}
                  {station.interchange && (
                    <View style={[styles.interchangeTag, { backgroundColor: semantic.warningContainer }]}>
                      <Ionicons name="git-compare" size={10} color={semantic.interchange} />
                      <Text variant="labelSmall" style={{ color: semantic.interchange, fontWeight: '600', fontSize: 10 }}>
                        Interchange
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {showChevron && onPress ? (
              <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} />
            ) : null}
          </View>
        </TouchableRipple>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  ripple: {
    borderRadius: 18,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
  interchangeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
});
