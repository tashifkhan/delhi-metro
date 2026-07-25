import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, emphasis } from '../theme';

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.errorContainer }]}>
        <Ionicons name="cloud-offline-outline" size={32} color={theme.colors.onErrorContainer} />
      </View>
      <Text
        variant="titleMedium"
        style={[emphasis.strong, styles.text, { color: theme.colors.onSurface }]}
      >
        Something went wrong
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.text, { color: theme.colors.onSurfaceVariant }]}
      >
        {message}
      </Text>
      {onRetry ? (
        <Button
          mode="contained"
          onPress={onRetry}
          icon="refresh"
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Try Again
        </Button>
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
    gap: spacing.sm,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.hero,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  text: {
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
    borderRadius: radius.pill,
  },
  buttonContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
