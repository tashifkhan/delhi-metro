import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

interface Props {
  name: string;
  color: string;
  compact?: boolean;
}

export function LineBadge({ name, color, compact }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: color }, compact && styles.compact]}>
      <Text
        variant={compact ? 'labelSmall' : 'labelMedium'}
        style={styles.text}
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
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    color: '#fff',
    fontWeight: '600',
  },
});
