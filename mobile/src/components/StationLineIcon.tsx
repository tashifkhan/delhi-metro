import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import type { StationLineBadge } from '../types';

interface Props {
  lines?: StationLineBadge[];
  size?: number;
  fallbackColor: string;
}

export function StationLineIcon({ lines, size = 14, fallbackColor }: Props) {
  const theme = useTheme();

  const lineColors = Array.from(
    new Set((lines ?? []).map((line) => line.primary_color_code).filter(Boolean)),
  ).slice(0, 4);

  const dotColors = lineColors.length > 0 ? lineColors : [fallbackColor];
  const isMultiLine = dotColors.length > 1;

  if (!isMultiLine) {
    return (
      <View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: dotColors[0],
            borderColor: theme.colors.outlineVariant,
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
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      {dotColors.map((color) => (
        <View key={color} style={[styles.segment, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderWidth: 1,
  },
  multi: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
  },
  segment: {
    flex: 1,
  },
});
