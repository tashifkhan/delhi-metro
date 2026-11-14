import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StateLayout } from './loading/StateLayout';
import { StateButton } from './loading/StateButton';

interface Props {
  message: string;
  onRetry?: () => void;
}

/** Error state on the same layout and 96pt circle as the loading indicator. */
export function ErrorState({ message, onRetry }: Props) {
  const theme = useTheme();

  return (
    <StateLayout
      visual={
        <View style={[styles.circle, { backgroundColor: theme.colors.errorContainer }]}>
          <Ionicons name="cloud-offline-outline" size={40} color={theme.colors.onErrorContainer} />
        </View>
      }
      title={message}
      // Only failures that can be retried are about the connection; "Station
      // not found" is not.
      subtitle={onRetry ? 'Check your connection and try again.' : undefined}
      actions={
        onRetry ? <StateButton label="Try again" icon="refresh" onPress={onRetry} /> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
