import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, emphasis } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function EmptyState({ title, subtitle, icon = 'folder-open-outline' }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: fills.subtle }]}>
        <Ionicons name={icon} size={32} color={theme.colors.onSurfaceVariant} />
      </View>
      <Text
        variant="titleMedium"
        style={[emphasis.strong, styles.text, { color: theme.colors.onSurface }]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          variant="bodyMedium"
          style={[styles.text, { color: theme.colors.onSurfaceVariant }]}
        >
          {subtitle}
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
});
