import { StyleSheet, View } from 'react-native';
import type { StationLineBadge } from '../types';

interface Props {
  lines?: StationLineBadge[];
  size?: number;
  fallbackColor: string;
}

export function StationLineIcon({ lines, size = 14, fallbackColor }: Props) {
  const lineColors = Array.from(
    new Set((lines ?? []).map((line) => line.primary_color_code).filter(Boolean)),
  ).slice(0, 4);

  const colors = lineColors.length > 0 ? lineColors : [fallbackColor];
  const isMultiLine = colors.length > 1;

  if (!isMultiLine) {
    return (
      <View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors[0],
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.multi,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {colors.map((color) => (
        <View key={color} style={[styles.segment, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.12)',
  },
  multi: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.15)',
  },
  segment: {
    flex: 1,
  },
});
