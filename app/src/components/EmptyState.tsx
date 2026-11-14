import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme } from '../theme/ThemeContext';
import { StateLayout } from './loading/StateLayout';

interface Props {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Empty state on the loading layout. Sits inside lists, so it centres in its
 * parent rather than painting a full-screen background.
 */
export function EmptyState({ title, subtitle, icon = 'folder-open-outline' }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();

  return (
    <StateLayout
      fullScreen={false}
      style={styles.fill}
      visual={
        <View style={[styles.circle, { backgroundColor: fills.containerHigh }]}>
          <Ionicons name={icon} size={40} color={theme.colors.onSurfaceVariant} />
        </View>
      }
      title={title}
      subtitle={subtitle}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  circle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
