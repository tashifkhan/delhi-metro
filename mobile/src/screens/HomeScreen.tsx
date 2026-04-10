import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePopularRoutesQuery, useNotificationsQuery, useStationPicker } from '../hooks';
import type { SelectedStation } from '../hooks/useStationPicker';
import { StationPicker } from '../components/StationPicker';
import { SwapButton } from '../components/SwapButton';
import { SectionHeader } from '../components/SectionHeader';
import { NotificationCard } from '../components/NotificationCard';
import type { HomeStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const fromPicker = useStationPicker();
  const toPicker = useStationPicker();
  const popularRoutes = usePopularRoutesQuery(5);
  const notifications = useNotificationsQuery();
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
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.base }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="train" size={28} color={colors.white} />
        </View>
        <View>
          <Text style={styles.heroTitle}>Delhi Metro</Text>
          <Text style={styles.heroSubtitle}>Plan your journey</Text>
        </View>
      </View>

      {/* Journey Planner Card */}
      <View style={styles.plannerCard}>
        <Pressable style={styles.stationInput} onPress={fromPicker.open}>
          <Ionicons name="radio-button-on" size={16} color={colors.success} />
          <Text
            style={[styles.stationText, !fromPicker.station && styles.stationPlaceholder]}
            numberOfLines={1}
          >
            {fromPicker.station?.name ?? 'Select departure station'}
          </Text>
        </Pressable>

        <View style={styles.swapRow}>
          <View style={styles.dividerLine} />
          <SwapButton onPress={handleSwap} />
          <View style={styles.dividerLine} />
        </View>

        <Pressable style={styles.stationInput} onPress={toPicker.open}>
          <Ionicons name="location" size={16} color={colors.error} />
          <Text
            style={[styles.stationText, !toPicker.station && styles.stationPlaceholder]}
            numberOfLines={1}
          >
            {toPicker.station?.name ?? 'Select destination station'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.findButton, !canSearch && styles.findButtonDisabled]}
          onPress={handleFindRoute}
          disabled={!canSearch}
        >
          <Ionicons name="navigate" size={18} color={colors.white} />
          <Text style={styles.findButtonText}>Find Route</Text>
        </Pressable>

        <View style={styles.timeOptions}>
          <Text style={styles.timeOptionsLabel}>Departure time</Text>
          <View style={styles.timeOptionsRow}>
            {[
              { label: 'Now', value: 0 },
              { label: '+15m', value: 15 },
              { label: '+30m', value: 30 },
              { label: '+1h', value: 60 },
            ].map((option) => (
              <Pressable
                key={option.label}
                style={[
                  styles.timeChip,
                  departureOffsetMinutes === option.value && styles.timeChipActive,
                ]}
                onPress={() => setDepartureOffsetMinutes(option.value)}
              >
                <Text
                  style={[
                    styles.timeChipText,
                    departureOffsetMinutes === option.value && styles.timeChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Popular Routes */}
      {(popularRoutes.data?.length ?? 0) > 0 && (
        <>
          <SectionHeader title="Popular Routes" />
          <View style={styles.popularList}>
            {popularRoutes.data!.map((route) => (
              <Pressable
                key={route.routeKey}
                style={({ pressed }) => [styles.popularCard, pressed && styles.popularPressed]}
                onPress={() => handlePopularRoute(route.fromStationCode, route.toStationCode)}
              >
                <View style={styles.popularRoute}>
                  <Ionicons name="radio-button-on" size={12} color={colors.success} />
                  <Text style={styles.popularCode}>{route.fromStationCode}</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.textTertiary} />
                  <Ionicons name="location" size={12} color={colors.error} />
                  <Text style={styles.popularCode}>{route.toStationCode}</Text>
                </View>
                <Text style={styles.popularHits}>{route.hitCount}x</Text>
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.base,
    gap: spacing.base,
    paddingBottom: spacing['4xl'],
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  heroSubtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  plannerCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.base,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  stationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 12,
    gap: spacing.sm,
  },
  stationText: {
    flex: 1,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  stationPlaceholder: {
    color: colors.textTertiary,
    fontWeight: typography.weights.regular,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  findButtonDisabled: {
    backgroundColor: colors.textTertiary,
  },
  findButtonText: {
    color: colors.white,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  timeOptions: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  timeOptionsLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  timeOptionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  timeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  timeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  timeChipText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  timeChipTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  popularList: {
    gap: spacing.sm,
  },
  popularCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  popularPressed: {
    backgroundColor: colors.surfacePressed,
  },
  popularRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  popularCode: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  popularHits: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textTertiary,
  },
  notifList: {
    gap: spacing.sm,
  },
});
