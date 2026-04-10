import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useStationDetailQuery } from '../hooks';
import { LineBadge } from '../components/LineBadge';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import type { HomeStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';

type Route = RouteProp<HomeStackParamList, 'StationDetail'>;

function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHeader} onPress={() => setExpanded(!expanded)}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {count !== undefined && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textTertiary}
        />
      </Pressable>
      {expanded && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function StationDetailScreen() {
  const route = useRoute<Route>();
  const { stationCode } = route.params;
  const { data: station, isLoading, isError, refetch } = useStationDetailQuery(stationCode);

  if (isLoading) return <LoadingState message="Loading station details..." />;
  if (isError) return <ErrorState message="Could not load station details" onRetry={refetch} />;
  if (!station) return <ErrorState message="Station not found" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.codeCircle}>
            <Text style={styles.codeText}>{station.station_code}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.stationName}>{station.station_name}</Text>
            {station.station_commercial_name && (
              <Text style={styles.commercialName}>{station.station_commercial_name}</Text>
            )}
          </View>
        </View>
        {station.interchange && (
          <View style={styles.interchangeTag}>
            <Ionicons name="git-compare" size={14} color={colors.interchange} />
            <Text style={styles.interchangeText}>Interchange Station</Text>
          </View>
        )}
      </View>

      {/* Metro Lines */}
      {station.metro_lines.length > 0 && (
        <Section title="Metro Lines" icon="train-outline" count={station.metro_lines.length}>
          <View style={styles.badgeRow}>
            {station.metro_lines.map((line) => (
              <LineBadge key={line.id} name={line.name} color={line.primary_color_code} />
            ))}
          </View>
        </Section>
      )}

      {/* Contact & Location */}
      <Section title="Information" icon="information-circle-outline">
        <InfoRow label="Type" value={station.station_type} />
        <InfoRow label="Mobile" value={station.mobile} />
        <InfoRow label="Landline" value={station.landline} />
        {station.latitude && station.longitude && (
          <InfoRow
            label="Coordinates"
            value={`${station.latitude.toFixed(5)}, ${station.longitude.toFixed(5)}`}
          />
        )}
        {station.station_description && (
          <InfoRow label="Description" value={station.station_description} />
        )}
      </Section>

      {/* Platforms */}
      {station.platforms.length > 0 && (
        <Section title="Platforms" icon="layers-outline" count={station.platforms.length}>
          {station.platforms.map((platform, i) => (
            <View key={i} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{platform.platform_name}</Text>
              {platform.train_towards && (
                <Text style={styles.itemSub}>Towards: {platform.train_towards}</Text>
              )}
            </View>
          ))}
        </Section>
      )}

      {/* Gates */}
      {station.gates.length > 0 && (
        <Section title="Gates" icon="enter-outline" count={station.gates.length}>
          {station.gates.map((gate, i) => (
            <View key={i} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <Text style={styles.itemTitle}>{gate.gate_name}</Text>
                {gate.divyang_friendly && (
                  <Ionicons name="accessibility" size={16} color={colors.success} />
                )}
              </View>
              {gate.location && <Text style={styles.itemSub}>{gate.location}</Text>}
            </View>
          ))}
        </Section>
      )}

      {/* Lifts */}
      {station.lifts.length > 0 && (
        <Section title="Lifts" icon="arrow-up-outline" count={station.lifts.length}>
          {station.lifts.map((lift, i) => (
            <View key={i} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{lift.name || lift.lift_type || 'Lift'}</Text>
              {lift.description_location && (
                <Text style={styles.itemSub}>{lift.description_location}</Text>
              )}
              {lift.status && (
                <Text
                  style={[
                    styles.statusText,
                    { color: lift.status.toLowerCase() === 'working' ? colors.success : colors.error },
                  ]}
                >
                  {lift.status}
                </Text>
              )}
            </View>
          ))}
        </Section>
      )}

      {/* Facilities */}
      {station.station_facility.length > 0 && (
        <Section title="Facilities" icon="grid-outline" count={station.station_facility.length}>
          <View style={styles.facilityGrid}>
            {station.station_facility.map((f, i) => (
              <View key={i} style={styles.facilityChip}>
                <Text style={styles.facilityText}>{f.name}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.base,
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  codeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  stationName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  commercialName: {
    fontSize: typography.sizes.caption,
    color: colors.textSecondary,
  },
  interchangeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningLight,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  interchangeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.warning,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    gap: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  countBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  sectionContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    fontSize: typography.sizes.caption,
    color: colors.textTertiary,
  },
  infoValue: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.text,
    textAlign: 'right',
    flex: 1,
    marginLeft: spacing.base,
  },
  itemCard: {
    backgroundColor: colors.borderLight,
    borderRadius: 10,
    padding: spacing.md,
    gap: 3,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  itemSub: {
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
  statusText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  facilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  facilityChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  facilityText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  },
});
