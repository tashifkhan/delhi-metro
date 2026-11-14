import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Touchable } from './Touchable';
import { SectionHeader } from './SectionHeader';
import { LineGlyph, lineGlyph, lineTitle, terminalName } from './LineGlyph';
import { useNetworkLinesQuery } from '../hooks';
import { useMetroNetwork, NETWORK_NAMES } from '../network';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, shape, emphasis } from '../theme';
import type { RootTabParamList } from '../navigation/types';
import type { MetroLine } from '../types';

const NORMAL_STATUS = 'normal service';
const OUTER = shape.xl;
const INNER = shape.sm;

/**
 * DMRC lists the Dhaula Kuan foot overbridge (LN12) as a line. Nobody rides
 * it, so it neither counts toward "all lines running" nor gets a chip.
 */
function isPassengerLine(line: MetroLine) {
  return !/\bFOB\b/i.test(`${line.line_color} ${line.name}`);
}

function isDisrupted(line: MetroLine) {
  return line.status.trim().toLowerCase() !== NORMAL_STATUS;
}

/** "Yellow Line" to "Yellow": every chip in the block is a line. */
function shortTitle(line: MetroLine): string {
  return lineTitle(line).replace(/\s+line\b/i, '').trim() || lineTitle(line);
}

function PulseDot({ color }: { color: string }) {
  const { animationStyle } = useAppTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (animationStyle === 'none') return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, animationStyle]);

  return <Animated.View style={[styles.pulseDot, { opacity, backgroundColor: color }]} />;
}

/** Corners for a tile in a segmented group: only the outer ones are fully round. */
function corners(first: boolean, last: boolean) {
  return {
    borderTopLeftRadius: first ? OUTER : INNER,
    borderTopRightRadius: first ? OUTER : INNER,
    borderBottomLeftRadius: last ? OUTER : INNER,
    borderBottomRightRadius: last ? OUTER : INNER,
  };
}

/**
 * Line status for the selected network as one grouped block: a summary tile,
 * a row per disrupted line in the warning colours, then every line running
 * normally as a compact chip. All lines stay visible without a sideways
 * scroll, and each one opens its line page.
 */
export function LineStatusCarousel() {
  const theme = useTheme();
  const { semantic, fills } = useAppTheme();
  const { network } = useMetroNetwork();
  const navigation = useNavigation();
  const { data: allLines } = useNetworkLinesQuery();
  const lines = (allLines ?? []).filter(isPassengerLine);

  if (!lines.length) return null;

  const disrupted = lines.filter(isDisrupted);
  const normal = lines.filter((line) => !isDisrupted(line));
  const clear = disrupted.length === 0;

  const openLine = (line: MetroLine) =>
    navigation.getParent<NavigationProp<RootTabParamList>>()?.navigate('LinesTab', {
      screen: 'LineStations',
      params: {
        lineCode: line.line_code,
        lineName: line.name,
        lineColor: line.primary_color_code,
      },
    });

  // Noida runs one line, so "All 1 lines" would read wrong.
  const summary =
    lines.length === 1
      ? `${lineTitle(lines[0])} ${clear ? 'running normally' : 'disrupted'}`
      : clear
        ? `All ${lines.length} lines running normally`
        : `${disrupted.length} of ${lines.length} lines disrupted`;

  const tiles = 1 + disrupted.length + (normal.length > 0 ? 1 : 0);
  let index = 0;
  const next = () => {
    const position = index;
    index += 1;
    return corners(position === 0, position === tiles - 1);
  };

  return (
    <View style={styles.wrapper}>
      <SectionHeader title="Line status" />
      <View style={styles.group}>
        <View style={[styles.summary, { backgroundColor: fills.containerLow }, next()]}>
          <View
            style={[
              styles.summaryIcon,
              { backgroundColor: clear ? semantic.successContainer : semantic.warningContainer },
            ]}
          >
            <Ionicons
              name={clear ? 'checkmark' : 'warning-outline'}
              size={22}
              color={clear ? semantic.onSuccessContainer : semantic.onWarningContainer}
            />
          </View>
          <View style={styles.summaryText}>
            <Text variant="titleMedium" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
              {summary}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {NETWORK_NAMES[network]} service status
            </Text>
          </View>
        </View>

        {disrupted.map((line) => (
          <Touchable
            key={line.id}
            radius={INNER}
            onPress={() => openLine(line)}
            accessibilityLabel={`${lineTitle(line)}, ${line.status}`}
            accessibilityHint="Opens the line"
            style={[{ backgroundColor: semantic.warningContainer }, next()]}
          >
            <View style={styles.disruptedRow}>
              <LineGlyph color={line.primary_color_code} glyph={lineGlyph(line)} size={36} />
              <View style={styles.disruptedText}>
                <Text
                  variant="titleSmall"
                  numberOfLines={1}
                  style={[emphasis.strong, { color: semantic.onWarningContainer }]}
                >
                  {lineTitle(line)}
                </Text>
                <Text variant="bodySmall" numberOfLines={1} style={{ color: semantic.onWarningContainer }}>
                  {terminalName(line.start_station)} to {terminalName(line.end_station)}
                </Text>
              </View>
              <View style={styles.disruptedStatus}>
                <PulseDot color={semantic.warning} />
                <Text
                  variant="labelMedium"
                  numberOfLines={2}
                  style={[emphasis.strong, styles.statusText, { color: semantic.onWarningContainer }]}
                >
                  {line.status}
                </Text>
              </View>
            </View>
          </Touchable>
        ))}

        {normal.length > 0 ? (
          <View style={[styles.chipsTile, { backgroundColor: fills.containerLow }, next()]}>
            {!clear ? (
              <Text variant="labelLarge" style={[styles.chipsLabel, { color: theme.colors.onSurfaceVariant }]}>
                Running normally
              </Text>
            ) : null}
            <View style={styles.chips}>
              {normal.map((line) => (
                <Touchable
                  key={line.id}
                  radius={10}
                  onPress={() => openLine(line)}
                  accessibilityLabel={`${lineTitle(line)}, running normally`}
                  accessibilityHint="Opens the line"
                  style={{ backgroundColor: fills.containerHigh }}
                >
                  <View style={styles.chip}>
                    <LineGlyph color={line.primary_color_code} glyph={lineGlyph(line)} size={22} />
                    <Text variant="labelLarge" numberOfLines={1} style={[emphasis.medium, { color: theme.colors.onSurface }]}>
                      {shortTitle(line)}
                    </Text>
                  </View>
                </Touchable>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  group: {
    gap: 3,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  disruptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  disruptedText: {
    flex: 1,
    gap: 2,
  },
  disruptedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '40%',
  },
  statusText: {
    flexShrink: 1,
    textAlign: 'right',
  },
  chipsTile: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  chipsLabel: {
    paddingHorizontal: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 36,
    paddingLeft: 7,
    paddingRight: spacing.md,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
