import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { radius, onColor, emphasis } from '../theme';

interface Props {
  name: string;
  color: string;
  compact?: boolean;
}

export function LineBadge({ name, color, compact }: Props) {
  // Line colors span from near-black to bright yellow, so the label color is
  // derived from the badge rather than fixed to white.
  const textColor = onColor(color);

  return (
    <View style={[styles.badge, { backgroundColor: color }, compact && styles.compact]}>
      <Text
        variant={compact ? 'labelSmall' : 'labelMedium'}
        style={[emphasis.strong, { color: textColor }]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
