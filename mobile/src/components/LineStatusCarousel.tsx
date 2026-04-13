import { useRef, useEffect } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useMetroLinesQuery } from '../hooks';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme';
import type { MetroLine } from '../types';

const NORMAL_STATUS = 'normal service';

function isDisrupted(line: MetroLine) {
  return line.status.trim().toLowerCase() !== NORMAL_STATUS;
}

function PulseDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, [opacity]);

  return <Animated.View style={[styles.pulseDot, { opacity }]} />;
}

function LineCard({ line }: { line: MetroLine }) {
  const theme = useTheme();
  const disrupted = isDisrupted(line);

  const statusColor = disrupted ? '#B45309' : '#15803D';
  const statusBg   = disrupted ? '#FEF3C7' : '#DCFCE7';
  const statusColorDark = disrupted ? '#FCD34D' : '#4ADE80';
  const statusBgDark    = disrupted ? 'rgba(253,211,77,0.15)' : 'rgba(74,222,128,0.12)';

  const { isDark } = useAppTheme();

  return (
    <Surface style={styles.card} elevation={1}>
      {/* Content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            {line.line_color}
          </Text>
          <View style={[styles.lineCodeBadge, { backgroundColor: line.primary_color_code }]}>
            <Text style={styles.lineCodeText}>{line.line_code}</Text>
          </View>
        </View>
        <Text style={{ color: theme.colors.outline, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
          {line.start_station} – {line.end_station}
        </Text>
        <View style={[styles.statusRow, { marginTop: 6 }]}>
          <View style={[styles.statusPill, { backgroundColor: isDark ? statusBgDark : statusBg }]}>
            <Ionicons
              name={disrupted ? 'warning-outline' : 'checkmark-circle-outline'}
              size={11}
              color={isDark ? statusColorDark : statusColor}
            />
            <Text style={[styles.statusText, { color: isDark ? statusColorDark : statusColor }]} numberOfLines={1}>
              {disrupted ? line.status : 'Normal Service'}
            </Text>
          </View>
          {disrupted && <PulseDot />}
        </View>
      </View>
    </Surface>
  );
}

export function LineStatusCarousel() {
  const theme = useTheme();
  const { isDark } = useAppTheme();
  const { data: lines } = useMetroLinesQuery();

  if (!lines?.length) return null;

  const sorted = [...lines].sort((a, b) => (isDisrupted(a) ? 0 : 1) - (isDisrupted(b) ? 0 : 1));
  const hasDisruptions = lines.some(isDisrupted);

  return (
    <View style={styles.wrapper}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.primaryContainer }]}>
          <Ionicons name="pulse-outline" size={16} color={theme.colors.primary} />
        </View>
        <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
          Line Status
        </Text>
        {hasDisruptions ? (
          <View style={[styles.badge, { backgroundColor: '#FCD34D' }]}>
            <Text style={[styles.badgeText, { color: '#1A0A00' }]}>
              {lines.filter(isDisrupted).length} disrupted
            </Text>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(74,222,128,0.12)' : '#DCFCE7' }]}>
            <Ionicons name="checkmark-circle" size={12} color={isDark ? '#4ADE80' : '#15803D'} />
            <Text style={[styles.badgeText, { color: isDark ? '#4ADE80' : '#15803D' }]}>All clear</Text>
          </View>
        )}
      </View>

      {/* Horizontal carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {sorted.map((line) => (
          <LineCard key={line.id} line={line} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
    paddingTop: spacing.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  // Card mirrors NotificationCard but fixed width
  card: {
    width: 220,
    flexDirection: 'row',
    padding: spacing.base,
    gap: spacing.md,
    borderRadius: 16,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lineCodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lineCodeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FCD34D',
  },
});
