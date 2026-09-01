import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, emphasis } from '../theme';

interface Props {
  message?: string;
}

export function LoadingState({ message }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.badge, { backgroundColor: fills.accentSubtle }]}>
        <Ionicons name="train" size={26} color={theme.colors.primary} />
      </View>
      <ActivityIndicator size="small" color={theme.colors.primary} />
      {message ? (
        <Text
          variant="bodyMedium"
          style={[emphasis.medium, styles.text, { color: theme.colors.onSurfaceVariant }]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.base,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.hero,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  text: {
    textAlign: 'center',
  },
});
