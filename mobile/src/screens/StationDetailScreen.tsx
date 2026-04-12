import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Chip, Divider, Surface, Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useStationDetailQuery } from '../hooks';
import { LineBadge } from '../components/LineBadge';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { useAppTheme } from '../theme/ThemeContext';
import type { HomeStackParamList } from '../navigation/types';
import { spacing } from '../theme';

type Route = RouteProp<HomeStackParamList, 'StationDetail'>;

function Section({
  title,
  icon,
  count,
  children,
  defaultExpanded = true,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const theme = useTheme();
  const { isDark } = useAppTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Surface style={styles.section} elevation={1}>
      <Pressable style={styles.sectionHeader} onPress={() => setExpanded(!expanded)}>
        <View style={[styles.sectionIconCircle, { backgroundColor: isDark ? theme.colors.elevation.level5 : theme.colors.primaryContainer }]}>
          <Ionicons name={icon} size={16} color={theme.colors.primary} />
        </View>
        <Text variant="titleSmall" style={{ flex: 1, color: theme.colors.onSurface, fontWeight: '700' }}>
          {title}
        </Text>
        {count !== undefined && (
          <View style={[styles.countBadge, { backgroundColor: theme.colors.primaryContainer }]}>
            <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}>
              {count}
            </Text>
          </View>
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.colors.outline}
        />
      </Pressable>
      {expanded && (
        <>
          <Divider style={{ opacity: 0.2, marginHorizontal: spacing.base }} />
          <View style={styles.sectionContent}>{children}</View>
        </>
      )}
    </Surface>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string | null | undefined; icon?: keyof typeof Ionicons.glyphMap }) {
  const theme = useTheme();
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      {icon && <Ionicons name={icon} size={14} color={theme.colors.outline} style={{ marginTop: 2 }} />}
      <Text variant="bodySmall" style={{ color: theme.colors.outline, width: 90 }}>{label}</Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurface, flex: 1, textAlign: 'right', fontWeight: '500' }}>
        {value}
      </Text>
    </View>
  );
}

function getPlatformDirection(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'station_name' in value &&
    typeof (value as { station_name?: unknown }).station_name === 'string'
  ) {
    return (value as { station_name: string }).station_name;
  }
  return null;
}

function getLiftStatusMeta(status: unknown): { label: string; isWorking: boolean } | null {
  if (status === null || status === undefined || status === '') return null;
  if (typeof status === 'boolean') {
    return { label: status ? 'Working' : 'Not working', isWorking: status };
  }
  const label = String(status).trim();
  if (!label) return null;
  return {
    label,
    isWorking: ['working', 'operational', 'active', 'true', '1'].includes(label.toLowerCase()),
  };
}

export function StationDetailScreen() {
  const route = useRoute<Route>();
  const { stationCode } = route.params;
  const theme = useTheme();
  const { semantic, isDark } = useAppTheme();
  const { data: station, isLoading, isError, refetch } = useStationDetailQuery(stationCode);

  if (isLoading) return <LoadingState message="Loading station details..." />;
  if (isError) return <ErrorState message="Could not load station details" onRetry={refetch} />;
  if (!station) return <ErrorState message="Station not found" />;

  const lineColor = station.metro_lines?.[0]?.primary_color_code ?? theme.colors.primary;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      {/* Hero header */}
      <Surface
        style={[
          styles.heroCard,
          { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.primaryContainer },
        ]}
        elevation={0}
      >
        <View style={styles.heroTop}>
          <View style={[styles.codeBox, { backgroundColor: isDark ? theme.colors.elevation.level5 : 'rgba(255,255,255,0.8)' }]}>
            <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {station.station_code}
            </Text>
          </View>
          <View style={styles.heroInfo}>
            <Text
              variant="headlineSmall"
              style={{ color: isDark ? theme.colors.onSurface : theme.colors.onPrimaryContainer, fontWeight: '800' }}
              numberOfLines={2}
            >
              {station.station_name}
            </Text>
            {station.station_commercial_name && (
              <Text variant="bodySmall" style={{ color: isDark ? theme.colors.onSurfaceVariant : theme.colors.onPrimaryContainer, opacity: 0.7 }}>
                {station.station_commercial_name}
              </Text>
            )}
          </View>
        </View>

        {/* Tags row */}
        <View style={styles.tagsRow}>
          {station.station_type && (
            <Chip
              compact
              mode="flat"
              icon={() => <Ionicons name="business-outline" size={12} color={isDark ? theme.colors.onSurface : theme.colors.onPrimaryContainer} />}
              style={{ backgroundColor: isDark ? theme.colors.elevation.level5 : 'rgba(255,255,255,0.7)' }}
              textStyle={{ color: isDark ? theme.colors.onSurface : theme.colors.onPrimaryContainer, fontWeight: '600', fontSize: 12 }}
            >
              {station.station_type}
            </Chip>
          )}
          {station.interchange && (
            <Chip
              compact
              mode="flat"
              icon={() => <Ionicons name="git-compare" size={12} color={semantic.interchange} />}
              style={{ backgroundColor: semantic.warningContainer }}
              textStyle={{ color: semantic.interchange, fontWeight: '600', fontSize: 12 }}
            >
              Interchange
            </Chip>
          )}
        </View>

        {/* Line badges inline */}
        {station.metro_lines.length > 0 && (
          <View style={styles.lineBadgesRow}>
            {station.metro_lines.map((line) => (
              <LineBadge key={line.id} name={line.name} color={line.primary_color_code} />
            ))}
          </View>
        )}
      </Surface>

      {/* Contact & Location */}
      <Section title="Station Info" icon="information-circle-outline">
        <InfoRow label="Mobile" value={station.mobile} icon="call-outline" />
        <InfoRow label="Landline" value={station.landline} icon="call-outline" />
        {station.latitude && station.longitude && (
          <InfoRow
            label="Location"
            value={`${station.latitude.toFixed(5)}, ${station.longitude.toFixed(5)}`}
            icon="location-outline"
          />
        )}
        {station.station_description && (
          <View style={styles.descriptionBox}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 18 }}>
              {station.station_description}
            </Text>
          </View>
        )}
      </Section>

      {/* Platforms */}
      {station.platforms.length > 0 && (
        <Section title="Platforms" icon="layers-outline" count={station.platforms.length}>
          {station.platforms.map((platform, i) => (
            <View key={i} style={[styles.itemCard, { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.surfaceVariant }]}>
              <View style={styles.itemCardHeader}>
                <View style={[styles.itemCardIcon, { backgroundColor: isDark ? theme.colors.elevation.level4 : theme.colors.primaryContainer }]}>
                  <Ionicons name="train-outline" size={14} color={lineColor} />
                </View>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                  {platform.platform_name}
                </Text>
              </View>
              {getPlatformDirection(platform.train_towards) && (
                <View style={styles.itemCardMeta}>
                  <Ionicons name="arrow-forward-outline" size={12} color={theme.colors.outline} />
                  <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    Towards {getPlatformDirection(platform.train_towards)}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </Section>
      )}

      {/* Gates */}
      {station.gates.length > 0 && (
        <Section title="Gates" icon="enter-outline" count={station.gates.length} defaultExpanded={false}>
          {station.gates.map((gate, i) => (
            <View key={i} style={[styles.itemCard, { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.surfaceVariant }]}>
              <View style={styles.itemCardHeader}>
                <View style={[styles.itemCardIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Ionicons name="enter-outline" size={14} color={theme.colors.primary} />
                </View>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '600', flex: 1 }}>
                  {gate.gate_name}
                </Text>
                {gate.divyang_friendly && (
                  <View style={[styles.accessBadge, { backgroundColor: semantic.successContainer }]}>
                    <Ionicons name="accessibility" size={12} color={semantic.success} />
                  </View>
                )}
              </View>
              {gate.location && (
                <View style={styles.itemCardMeta}>
                  <Ionicons name="navigate-outline" size={12} color={theme.colors.outline} />
                  <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    {gate.location}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </Section>
      )}

      {/* Lifts */}
      {station.lifts.length > 0 && (
        <Section title="Lifts" icon="arrow-up-outline" count={station.lifts.length} defaultExpanded={false}>
          {station.lifts.map((lift, i) => {
            const liftStatus = getLiftStatusMeta(lift.status);
            return (
              <View key={i} style={[styles.itemCard, { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.surfaceVariant }]}>
                <View style={styles.itemCardHeader}>
                  <View style={[styles.itemCardIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Ionicons name="arrow-up-outline" size={14} color={theme.colors.primary} />
                  </View>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '600', flex: 1 }}>
                    {lift.name || lift.lift_type || 'Lift'}
                  </Text>
                  {liftStatus && (
                    <View style={[styles.statusBadge, { backgroundColor: liftStatus.isWorking ? semantic.successContainer : theme.colors.errorContainer }]}>
                      <View style={[styles.statusDot, { backgroundColor: liftStatus.isWorking ? semantic.success : theme.colors.error }]} />
                      <Text variant="labelSmall" style={{ color: liftStatus.isWorking ? semantic.success : theme.colors.error, fontWeight: '600' }}>
                        {liftStatus.label}
                      </Text>
                    </View>
                  )}
                </View>
                {lift.description_location && (
                  <View style={styles.itemCardMeta}>
                    <Ionicons name="navigate-outline" size={12} color={theme.colors.outline} />
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                      {lift.description_location}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </Section>
      )}

      {/* Facilities */}
      {station.station_facility.length > 0 && (
        <Section title="Facilities" icon="grid-outline" count={station.station_facility.length}>
          <View style={styles.facilityGrid}>
            {station.station_facility.map((f, i) => (
              <Chip
                key={i}
                compact
                mode="flat"
                icon={() => <Ionicons name="checkmark-circle" size={14} color={semantic.success} />}
                style={{ backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.surfaceVariant }}
                textStyle={{ color: theme.colors.onSurface, fontSize: 12 }}
              >
                {f.name}
              </Chip>
            ))}
          </View>
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  // Hero
  heroCard: {
    borderRadius: 28,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  codeBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInfo: {
    flex: 1,
    gap: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  lineBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // Sections
  section: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    gap: spacing.sm,
  },
  sectionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  sectionContent: {
    padding: spacing.base,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  descriptionBox: {
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.06)',
  },
  // Item cards (platforms, gates, lifts)
  itemCard: {
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  itemCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemCardIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 36,
  },
  accessBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Facilities
  facilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
