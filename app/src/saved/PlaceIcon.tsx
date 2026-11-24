import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../theme/ThemeContext';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  work: 'briefcase-outline',
  office: 'briefcase-outline',
  college: 'school-outline',
  school: 'school-outline',
  university: 'school-outline',
  gym: 'barbell-outline',
};

/** A place's badge: its own icon for the usual labels, otherwise its first letter. */
export function PlaceIcon({ label, size = 40 }: { label: string; size?: number }) {
  const theme = useTheme();
  const { look } = useAppTheme();
  const icon = ICONS[label.trim().toLowerCase()];
  const color = theme.colors.onPrimaryContainer;
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: look.style === 'plain' ? look.radius.icon : size / 2,
          backgroundColor: theme.colors.primaryContainer,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {icon ? (
        <Ionicons name={icon} size={size * 0.48} color={color} />
      ) : (
        <Text variant="titleMedium" style={{ color, fontWeight: '600' }}>
          {label.trim().charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
