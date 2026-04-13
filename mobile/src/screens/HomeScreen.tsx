import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Surface, Text, useTheme } from 'react-native-paper';
import { usePopularRoutesQuery, useNotificationsQuery, useStationPicker, useMetroLinesQuery } from '../hooks';
import type { SelectedStation } from '../hooks/useStationPicker';
import { StationPicker } from '../components/StationPicker';
import { SectionHeader } from '../components/SectionHeader';
import { NotificationCard } from '../components/NotificationCard';
import { useAppTheme } from '../theme/ThemeContext';
import type { HomeStackParamList } from '../navigation/types';
import { spacing } from '../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { semantic, isDark } = useAppTheme();
  const fromPicker = useStationPicker();
  const toPicker = useStationPicker();
  const popularRoutes = usePopularRoutesQuery(5);
  const notifications = useNotificationsQuery();
  const linesQuery = useMetroLinesQuery();
  const disruptedLines = (linesQuery.data ?? []).filter(
    (l) => l.status.trim().toLowerCase() !== 'normal service',
  );
  const [departureOffsetMinutes, setDepartureOffsetMinutes] = useState(0);

  const canSearch = fromPicker.station && toPicker.station;

  const departureTime = useMemo(() => {
    if (departureOffsetMinutes === 0) return undefined;

    const future = new Date(Date.now() + departureOffsetMinutes * 60_000);
    const pad = (value: number) => String(value).padStart(2, '0');
    const ms = String(future.getMilliseconds()).padStart(3, '0');
    return `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}:${pad(future.getSeconds())}.${ms}`;
  }, [departureOffsetMinutes]);

  const handleFindRoute = () => {
    if (!fromPicker.station || !toPicker.station) return;
    navigation.navigate('JourneyResults', {
      fromCode: fromPicker.station.code,
      toCode: toPicker.station.code,
      fromName: fromPicker.station.name,
      toName: toPicker.station.name,
      journeyTime: departureTime,
    });
  };

  const handleSwap = useCallback(() => {
    const temp = fromPicker.station;
    fromPicker.setStation(toPicker.station);
    toPicker.setStation(temp);
  }, [fromPicker, toPicker]);

  const handlePopularRoute = (fromCode: string, toCode: string) => {
    navigation.navigate('JourneyResults', {
      fromCode,
      toCode,
      fromName: fromCode,
      toName: toCode,
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: theme.colors.primaryContainer }]}>
          <Ionicons name="train" size={28} color={theme.colors.onPrimaryContainer} />
        </View>
        <View>
          <Text variant="headlineMedium" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
            Delhi Metro
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Plan your journey
          </Text>
        </View>
      </View>

      {/* Journey Planner Card */}
      <View style={styles.plannerSection}>
        {/* Station inputs with connecting line */}
        <View style={styles.stationsBlock}>
          {/* Vertical connector on the left */}
          <View style={styles.connectorColumn}>
            <View style={[styles.connectorDot, { backgroundColor: semantic.success }]} />
            <View style={[styles.connectorLine, { backgroundColor: theme.colors.outlineVariant, opacity: 0.4 }]} />
            <View style={[styles.connectorDot, { backgroundColor: theme.colors.error }]} />
          </View>

          {/* Input fields */}
          <View style={styles.inputsColumn}>
            <Pressable
              style={[styles.stationInput, { backgroundColor: isDark ? theme.colors.elevation.level2 : theme.colors.surfaceVariant }]}
              onPress={fromPicker.open}
            >
              <Text
                variant="bodyLarge"
                style={{ flex: 1, color: fromPicker.station ? theme.colors.onSurface : theme.colors.outline, fontWeight: fromPicker.station ? '600' : '400' }}
                numberOfLines={1}
              >
                {fromPicker.station?.name ?? 'Where from?'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} />
            </Pressable>

            <Pressable
              style={[styles.stationInput, { backgroundColor: isDark ? theme.colors.elevation.level2 : theme.colors.surfaceVariant }]}
              onPress={toPicker.open}
            >
              <Text
                variant="bodyLarge"
                style={{ flex: 1, color: toPicker.station ? theme.colors.onSurface : theme.colors.outline, fontWeight: toPicker.station ? '600' : '400' }}
                numberOfLines={1}
              >
                {toPicker.station?.name ?? 'Where to?'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} />
            </Pressable>
          </View>

          {/* Swap button on the right */}
          <Pressable
            style={[styles.swapBtn, { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.surfaceVariant }]}
            onPress={handleSwap}
          >
            <Ionicons name="swap-vertical" size={20} color={theme.colors.primary} />
          </Pressable>
        </View>

        {/* Time chips row */}
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={16} color={theme.colors.onSurfaceVariant} />
          <View style={styles.timeChips}>
            {[
              { label: 'Now', value: 0 },
              { label: '+15m', value: 15 },
              { label: '+30m', value: 30 },
              { label: '+1h', value: 60 },
            ].map((option) => {
              const isActive = departureOffsetMinutes === option.value;
              return (
                <Pressable
                  key={option.label}
                  style={[
                    styles.timeChip,
                    {
                      backgroundColor: isActive
                        ? theme.colors.primary
                        : isDark ? theme.colors.elevation.level2 : theme.colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => setDepartureOffsetMinutes(option.value)}
                >
                  <Text
                    variant="labelMedium"
                    style={{
                      color: isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
                      fontWeight: isActive ? '700' : '500',
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Find Route button */}
        <Pressable
          style={[
            styles.findButton,
            {
              backgroundColor: canSearch ? theme.colors.primary : (isDark ? theme.colors.elevation.level2 : theme.colors.surfaceVariant),
            },
          ]}
          onPress={handleFindRoute}
          disabled={!canSearch}
        >
          <Ionicons
            name="navigate"
            size={20}
            color={canSearch ? theme.colors.onPrimary : theme.colors.outline}
          />
          <Text
            variant="titleSmall"
            style={{
              color: canSearch ? theme.colors.onPrimary : theme.colors.outline,
              fontWeight: '700',
            }}
          >
            Find Route
          </Text>
        </Pressable>
      </View>

      {/* Disruption banner — only shown when lines have issues */}
      {disruptedLines.length > 0 && (
        <Pressable
          style={[
            styles.disruptionBanner,
            { backgroundColor: isDark ? theme.colors.elevation.level2 : '#FFF8EC' },
          ]}
          onPress={() => navigation.getParent()?.navigate('AlertsTab' as never)}
        >
          <View style={styles.disruptionLeft}>
            <View style={[styles.disruptionIconWrap, { backgroundColor: isDark ? 'rgba(255,185,70,0.15)' : 'rgba(255,185,70,0.25)' }]}>
              <Ionicons name="warning" size={16} color="#FFB946" />
            </View>
            <View style={styles.disruptionText}>
              <Text variant="labelLarge" style={{ color: isDark ? '#FFB946' : '#7A4F00', fontWeight: '700' }}>
                Service Disruptions
              </Text>
              <View style={styles.disruptionChips}>
                {disruptedLines.map((line) => (
                  <View
                    key={line.id}
                    style={[styles.disruptionChip, { backgroundColor: line.primary_color_code }]}
                  >
                    <Text style={styles.disruptionChipText}>{line.line_code}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={isDark ? '#FFB946' : '#7A4F00'} />
        </Pressable>
      )}

      {/* Popular Routes */}
      {(popularRoutes.data?.length ?? 0) > 0 && (
        <>
          <SectionHeader title="Popular Routes" />
          <View style={styles.popularList}>
            {popularRoutes.data!.map((route) => (
              <Pressable
                key={route.routeKey}
                onPress={() => handlePopularRoute(route.fromStationCode, route.toStationCode)}
              >
                <Surface style={styles.popularCard} elevation={1}>
                  <View style={styles.popularRoute}>
                    <View style={[styles.popularDot, { backgroundColor: semantic.success }]} />
                    <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
                      {route.fromStationCode}
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color={theme.colors.outline} />
                    <View style={[styles.popularDot, { backgroundColor: theme.colors.error }]} />
                    <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
                      {route.toStationCode}
                    </Text>
                  </View>
                  <View style={[styles.hitsBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}>
                      {route.hitCount}x
                    </Text>
                  </View>
                </Surface>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* Recent Notifications */}
      {(notifications.data?.length ?? 0) > 0 && (
        <>
          <SectionHeader title="Recent Alerts" />
          <View style={styles.notifList}>
            {notifications.data!.slice(0, 3).map((notif) => (
              <NotificationCard key={notif.id} notification={notif} />
            ))}
          </View>
        </>
      )}

      <StationPicker
        visible={fromPicker.visible}
        onSelect={fromPicker.select as (s: { code: string; name: string }) => void}
        onClose={fromPicker.close}
        title="Departure Station"
      />
      <StationPicker
        visible={toPicker.visible}
        onSelect={toPicker.select as (s: { code: string; name: string }) => void}
        onClose={toPicker.close}
        title="Destination Station"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    gap: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Planner
  plannerSection: {
    gap: spacing.md,
  },
  stationsBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  connectorColumn: {
    alignItems: 'center',
    gap: 0,
    paddingVertical: 4,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  connectorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connectorLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
  },
  inputsColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  stationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: 16,
    borderRadius: 16,
    gap: spacing.sm,
  },
  swapBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Time
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeChips: {
    flexDirection: 'row',
    gap: spacing.xs,
    flex: 1,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  // Find button
  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: 999,
  },
  // Popular
  popularList: {
    gap: spacing.sm,
  },
  popularCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 16,
  },
  popularRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  popularDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hitsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  notifList: {
    gap: spacing.sm,
  },
  // Disruption banner
  disruptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,185,70,0.3)',
  },
  disruptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  disruptionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disruptionText: {
    gap: spacing.xs,
    flex: 1,
  },
  disruptionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  disruptionChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  disruptionChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
