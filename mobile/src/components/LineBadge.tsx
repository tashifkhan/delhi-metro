import { StyleSheet, Text, View } from 'react-native';
import { typography } from '../theme';

interface Props {
  name: string;
  color: string;
  compact?: boolean;
}

export function LineBadge({ name, color, compact }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: color }, compact && styles.compact]}>
      <Text style={[styles.text, compact && styles.compactText]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  text: {
    color: '#fff',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  compactText: {
    fontSize: typography.sizes.xs,
  },
});
