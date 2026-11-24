import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import { Card } from '../components/Card';
import { Touchable } from '../components/Touchable';
import { useAppTheme } from '../theme/ThemeContext';
import type { HomeStackParamList } from '../navigation/types';
import { spacing, emphasis } from '../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Settings'>;

const STYLE_NAMES = { studio: 'Studio', material: 'Material', plain: 'Plain' } as const;
const MODE_NAMES = { system: 'follows the system', light: 'light', dark: 'dark' } as const;

interface Row {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  onPress: () => void;
}

/** Everything that isn't a journey: how the app looks, and what it is. */
export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const { settings, fills } = useAppTheme();

  const rows: Row[] = [
    {
      key: 'appearance',
      icon: 'color-palette-outline',
      title: 'Appearance',
      detail: `${STYLE_NAMES[settings.uiStyle]}, ${MODE_NAMES[settings.themeMode]}`,
      onPress: () => navigation.navigate('Appearance'),
    },
    {
      key: 'about',
      icon: 'information-circle-outline',
      title: 'About',
      detail: 'Version, data sources and credits',
      onPress: () => navigation.navigate('About'),
    },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <Card>
        {rows.map((row, index) => (
          <View key={row.key}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: fills.hairline }]} /> : null}
            <Touchable radius={0} onPress={row.onPress} accessibilityLabel={`${row.title}. ${row.detail}`}>
              <View style={styles.row}>
                <Ionicons name={row.icon} size={22} color={theme.colors.onSurfaceVariant} />
                <View style={styles.text}>
                  <Text variant="titleMedium" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                    {row.title}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {row.detail}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurfaceVariant} />
              </View>
            </Touchable>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    gap: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: 64,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 54,
  },
});
