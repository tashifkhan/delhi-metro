import { useState } from 'react';
import { LayoutAnimation, ScrollView, StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Divider, Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useStationDetailQuery } from '../hooks';
import { LineBadge } from '../components/LineBadge';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { Touchable } from '../components/Touchable';
import { Card } from '../components/Card';
import { useAppTheme } from '../theme/ThemeContext';
import type { HomeStackParamList } from '../navigation/types';
import { spacing, radius, emphasis, tabular } from '../theme';
import { duration } from '../theme/motion';

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
  const { fills } = useAppTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    // Animate the height change itself, so the section grows into place
    // instead of the content snapping in at full size.
    LayoutAnimation.configureNext({
      duration: duration.medium2,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: 'opacity' },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: 'opacity' },
    });
    setExpanded((v) => !v);
  };

  return (
    <Card radius={radius.hero} style={styles.section}>
      <Touchable
        // Square ripple: the header is the top slice of the card, and the
        // parent Surface already clips the rounded corners.
        radius={0}
        haptic="select"
        onPress={handleToggle}
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
      >
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconCircle, { backgroundColor: fills.accentSubtle }]}>
            <Ionicons name={icon} size={16} color={theme.colors.primary} />
          </View>
          <Text
            variant="titleSmall"
            style={[emphasis.heavy, styles.sectionTitle, { color: theme.colors.onSurface }]}
          >
            {title}
          </Text>
          {count !== undefined && (
            <View style={[styles.countBadge, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text
                variant="labelSmall"
                style={[emphasis.heavy, { color: theme.colors.onPrimaryContainer }]}
              >
                {count}
              </Text>
            </View>
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.colors.onSurfaceVariant}
          />
        </View>
      </Touchable>
      {expanded && (
        <>
          <Divider style={{ opacity: 0.3, marginHorizontal: spacing.base }} />
          <View style={styles.sectionContent}>{children}</View>
        </>
      )}
    </Card>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();
  if (!value) return null;

  return (
    <View style={styles.infoRow}>
      {icon && <Ionicons name={icon} size={15} color={theme.colors.onSurfaceVariant} />}
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text
        variant="bodyMedium"
        style={[emphasis.medium, styles.infoValue, { color: theme.colors.onSurface }]}
      >
        {value}
      </Text>
    </View>
  );
}

/** Shared shell for the platform / gate / lift entries. */
function ItemCard({
  icon,
  iconColor,
  title,
  meta,
  metaIcon = 'navigate-outline',
  trailing,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  meta?: string | null;
  metaIcon?: keyof typeof Ionicons.glyphMap;
  trailing?: React.ReactNode;
}) {
  const theme = useTheme();
  const { fills } = useAppTheme();

  return (
    <View style={[styles.itemCard, { backgroundColor: fills.subtleStrong }]}>
      <View style={styles.itemCardHeader}>
        <View style={[styles.itemCardIcon, { backgroundColor: fills.accentSubtle }]}>
          <Ionicons name={icon} size={14} color={iconColor ?? theme.colors.primary} />
        </View>
        <Text
          variant="bodyMedium"
          style={[emphasis.strong, styles.itemCardTitle, { color: theme.colors.onSurface }]}
        >
          {title}
        </Text>
        {trailing}
      </View>
      {meta ? (
        <View style={styles.itemCardMeta}>
          <Ionicons name={metaIcon} size={12} color={theme.colors.onSurfaceVariant} />
          <Text
            variant="bodySmall"
            style={[styles.itemCardMetaText, { color: theme.colors.onSurfaceVariant }]}
          >
            {meta}
          </Text>
        </View>
      ) : null}
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
  const { semantic, fills } = useAppTheme();
  const { data: station, isLoading, isError, refetch } = useStationDetailQuery(stationCode);

  if (isLoading) return <LoadingState message="Loading station details..." />;
  if (isError) return <ErrorState message="Could not load station details" onRetry={refetch} />;
  if (!station) return <ErrorState message="Station not found" />;

  const lineColor = station.metro_lines?.[0]?.primary_color_code ?? theme.colors.primary;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={[styles.heroCard, { backgroundColor: fills.hero }]}>
        <View style={styles.heroTop}>
          <View style={[styles.codeBox, { backgroundColor: fills.onHero }]}>
            <Text
              variant="titleMedium"
              style={[emphasis.heavy, tabular, { color: fills.onHeroText }]}
            >
              {station.station_code}
            </Text>
          </View>
          <View style={styles.heroInfo}>
            <Text
              variant="headlineSmall"
              style={[emphasis.heavy, { color: fills.onHeroText }]}
              numberOfLines={2}
            >
              {station.station_name}
            </Text>
            {station.station_commercial_name && (
              <Text
                variant="bodySmall"
                style={[styles.heroSubtitle, { color: fills.onHeroText }]}
                numberOfLines={2}
              >
                {station.station_commercial_name}
              </Text>
            )}
          </View>
        </View>

        {/* Tags */}
        {(station.station_type || station.interchange) && (
          <View style={styles.tagsRow}>
            {station.station_type && (
              <View style={[styles.tag, { backgroundColor: fills.onHero }]}>
                <Ionicons name="business-outline" size={12} color={fills.onHeroText} />
                <Text
                  variant="labelSmall"
                  style={[emphasis.strong, { color: fills.onHeroText }]}
                >
                  {station.station_type}
                </Text>
              </View>
            )}
            {station.interchange && (
              <View style={[styles.tag, { backgroundColor: semantic.interchangeContainer }]}>
                <Ionicons
                  name="git-compare"
                  size={12}
                  color={semantic.onInterchangeContainer}
                />
                <Text
                  variant="labelSmall"
                  style={[emphasis.strong, { color: semantic.onInterchangeContainer }]}
                >
                  Interchange
                </Text>
              </View>
            )}
          </View>
        )}

        {station.metro_lines.length > 0 && (
          <View style={styles.lineBadgesRow}>
            {station.metro_lines.map((line) => (
              <LineBadge key={line.id} name={line.name} color={line.primary_color_code} />
            ))}
          </View>
        )}
      </View>

      {/* Station info */}
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
          <View style={[styles.descriptionBox, { backgroundColor: fills.subtleStrong }]}>
            <Text
              variant="bodySmall"
              style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
            >
              {station.station_description}
            </Text>
          </View>
        )}
      </Section>

      {/* Platforms */}
      {station.platforms.length > 0 && (
        <Section title="Platforms" icon="layers-outline" count={station.platforms.length}>
          {station.platforms.map((platform, i) => {
            const direction = getPlatformDirection(platform.train_towards);
            return (
              <ItemCard
                key={i}
                icon="train-outline"
                iconColor={lineColor}
                title={platform.platform_name}
                meta={direction ? `Towards ${direction}` : null}
                metaIcon="arrow-forward-outline"
              />
            );
          })}
        </Section>
      )}

      {/* Gates */}
      {station.gates.length > 0 && (
        <Section
          title="Gates"
          icon="enter-outline"
          count={station.gates.length}
          defaultExpanded={false}
        >
          {station.gates.map((gate, i) => (
            <ItemCard
              key={i}
              icon="enter-outline"
              title={gate.gate_name}
              meta={gate.location}
              trailing={
                gate.divyang_friendly ? (
                  <View
                    style={[styles.accessBadge, { backgroundColor: semantic.successContainer }]}
                  >
                    <Ionicons
                      name="accessibility"
                      size={12}
                      color={semantic.onSuccessContainer}
                    />
                  </View>
                ) : undefined
              }
            />
          ))}
        </Section>
      )}

      {/* Lifts */}
      {station.lifts.length > 0 && (
        <Section
          title="Lifts"
          icon="arrow-up-outline"
          count={station.lifts.length}
          defaultExpanded={false}
        >
          {station.lifts.map((lift, i) => {
            const liftStatus = getLiftStatusMeta(lift.status);
            return (
              <ItemCard
                key={i}
                icon="arrow-up-outline"
                title={lift.name || lift.lift_type || 'Lift'}
                meta={lift.description_location}
                trailing={
                  liftStatus ? (
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: liftStatus.isWorking
                            ? semantic.successContainer
                            : theme.colors.errorContainer,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: liftStatus.isWorking
                              ? semantic.onSuccessContainer
                              : theme.colors.onErrorContainer,
                          },
                        ]}
                      />
                      <Text
                        variant="labelSmall"
                        style={[
                          emphasis.strong,
                          {
                            color: liftStatus.isWorking
                              ? semantic.onSuccessContainer
                              : theme.colors.onErrorContainer,
                          },
                        ]}
                      >
                        {liftStatus.label}
                      </Text>
                    </View>
                  ) : undefined
                }
              />
            );
          })}
        </Section>
      )}

      {/* Facilities */}
      {station.station_facility.length > 0 && (
        <Section title="Facilities" icon="grid-outline" count={station.station_facility.length}>
          <View style={styles.facilityGrid}>
            {station.station_facility.map((f, i) => (
              <View key={i} style={[styles.facilityChip, { backgroundColor: fills.subtleStrong }]}>
                <Ionicons name="checkmark-circle" size={14} color={semantic.success} />
                <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>
                  {f.name}
                </Text>
              </View>
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
    borderRadius: radius.hero,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  codeBox: {
    minWidth: 64,
    height: 64,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.icon,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInfo: {
    flex: 1,
    gap: 2,
  },
  heroSubtitle: {
    opacity: 0.75,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  lineBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // Sections
  section: {
    borderRadius: radius.hero,
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
    borderRadius: radius.iconSmall,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    flex: 1,
  },
  countBadge: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  sectionContent: {
    padding: spacing.base,
    gap: spacing.sm,
  },
  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
  },
  descriptionBox: {
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.iconSmall,
  },
  description: {
    lineHeight: 19,
  },
  // Item cards
  itemCard: {
    borderRadius: radius.card,
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
    borderRadius: radius.badge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCardTitle: {
    flex: 1,
  },
  itemCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 28 + spacing.sm,
  },
  itemCardMetaText: {
    flex: 1,
  },
  accessBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
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
  facilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
});
