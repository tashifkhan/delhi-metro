import { useRef, useEffect } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { useNetworkLinesQuery } from '../hooks';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, shape, emphasis, overline, onColor } from '../theme';
import type { MetroLine } from '../types';

const NORMAL_STATUS = 'normal service';

function isDisrupted(line: MetroLine) {
  return line.status.trim().toLowerCase() !== NORMAL_STATUS;
}

function PulseDot({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.pulseDot, { opacity, backgroundColor: color }]} />;
}

function LineCard({ line }: { line: MetroLine }) {
  const theme = useTheme();
  const { semantic } = useAppTheme();
  const disrupted = isDisrupted(line);

  // Status colors come from the fixed semantic roles rather than literals, so
  // they stay legible under Material You's wallpaper-derived palettes.
  const statusFg = disrupted ? semantic.onWarningContainer : semantic.onSuccessContainer;
  const statusBg = disrupted ? semantic.warningContainer : semantic.successContainer;

  return (
    <Card style={styles.card}>
      <View style={[styles.lineStrip, { backgroundColor: line.primary_color_code }]} />
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text
            variant="bodyMedium"
            style={[emphasis.heavy, styles.title, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {line.line_color}
          </Text>
          <View style={[styles.lineCodeBadge, { backgroundColor: line.primary_color_code }]}>
            <Text
              style={[styles.lineCodeText, { color: onColor(line.primary_color_code) }]}
            >
              {line.line_code}
            </Text>
          </View>
        </View>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
          numberOfLines={1}
        >
          {line.start_station} – {line.end_station}
        </Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
            <Ionicons
              name={disrupted ? 'warning' : 'checkmark-circle'}
              size={11}
              color={statusFg}
            />
            <Text style={[styles.statusText, { color: statusFg }]} numberOfLines={1}>
              {disrupted ? line.status : 'Normal Service'}
            </Text>
          </View>
          {disrupted && <PulseDot color={semantic.warning} />}
        </View>
      </View>
    </Card>
  );
}

export function LineStatusCarousel() {
  const theme = useTheme();
  const { semantic } = useAppTheme();
  const { data: lines } = useNetworkLinesQuery();

  if (!lines?.length) return null;

  const sorted = [...lines].sort((a, b) => (isDisrupted(a) ? 0 : 1) - (isDisrupted(b) ? 0 : 1));
  const disruptedCount = lines.filter(isDisrupted).length;
  const hasDisruptions = disruptedCount > 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.sectionHeader}>
        <Ionicons name="pulse-outline" size={14} color={theme.colors.onSurfaceVariant} />
        <Text
          variant="labelMedium"
          style={[overline, styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}
        >
          Line Status
        </Text>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: hasDisruptions
                ? semantic.warningContainer
                : semantic.successContainer,
            },
          ]}
        >
          <Ionicons
            name={hasDisruptions ? 'warning' : 'checkmark-circle'}
            size={12}
            color={hasDisruptions ? semantic.onWarningContainer : semantic.onSuccessContainer}
          />
          <Text
            style={[
              styles.badgeText,
              {
                color: hasDisruptions
                  ? semantic.onWarningContainer
                  : semantic.onSuccessContainer,
              },
            ]}
          >
            {hasDisruptions ? `${disruptedCount} disrupted` : 'All clear'}
          </Text>
        </View>
      </View>

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
    gap: spacing.xs,
    paddingTop: spacing.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  sectionTitle: {
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  card: {
    width: 232,
    flexDirection: 'row',
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  lineStrip: {
    width: 5,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
  },
  lineCodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: shape.xs,
  },
  lineCodeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    flexShrink: 1,
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
  },
});
