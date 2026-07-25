import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { LineBadge } from './LineBadge';
import { Touchable } from './Touchable';
import { Card } from './Card';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, emphasis, tabular, tint } from '../theme';
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
  const { isDark, semantic, fills } = useAppTheme();

  const primaryLineColor = station.metro_lines?.[0]?.primary_color_code;
  const iconBg = primaryLineColor
    ? tint(primaryLineColor, isDark ? 0.22 : 0.14)
    : theme.colors.primaryContainer;

  return (
    <View style={styles.wrapper}>
      <Card style={styles.card}>
        <Touchable
          radius={radius.card}
          onPress={onPress}
          accessibilityLabel={`${station.station_name}, code ${station.station_code}${
            station.interchange ? ', interchange station' : ''
          }`}
        >
          <View style={styles.container}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <Ionicons
                name={station.interchange ? 'git-compare' : 'train'}
                size={18}
                color={
                  station.interchange
                    ? semantic.interchange
                    : primaryLineColor ?? theme.colors.onSurfaceVariant
                }
              />
            </View>

            <View style={styles.content}>
              <View style={styles.nameRow}>
                <Text
                  variant="titleSmall"
                  style={[emphasis.strong, styles.name, { color: theme.colors.onSurface }]}
                  numberOfLines={1}
                >
                  {station.station_name}
                </Text>
                <View style={[styles.codeBadge, { backgroundColor: fills.inset }]}>
                  <Text
                    variant="labelSmall"
                    style={[emphasis.heavy, tabular, { color: theme.colors.primary }]}
                  >
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
                    <View
                      style={[
                        styles.interchangeTag,
                        { backgroundColor: semantic.interchangeContainer },
                      ]}
                    >
                      <Ionicons
                        name="git-compare"
                        size={10}
                        color={semantic.onInterchangeContainer}
                      />
                      <Text
                        variant="labelSmall"
                        style={[
                          emphasis.strong,
                          styles.interchangeText,
                          { color: semantic.onInterchangeContainer },
                        ]}
                      >
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
        </Touchable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
  },
  card: {
    borderRadius: radius.card,
    overflow: 'hidden',
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
    borderRadius: radius.icon,
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
  name: {
    flex: 1,
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.badge,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  interchangeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  interchangeText: {
    fontSize: 10,
  },
});
