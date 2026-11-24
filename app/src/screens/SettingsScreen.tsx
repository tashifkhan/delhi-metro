import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { Card } from '../components/Card';
import { SectionHeader } from '../components/SectionHeader';
import { SettingDivider, SettingRow } from '../components/SettingRow';
import { useAppTheme } from '../theme/ThemeContext';
import { useOfflinePack } from '../offline/OfflinePackContext';
import { formatBytes } from '../offline/model';
import type { HomeStackParamList } from '../navigation/types';
import { spacing } from '../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Settings'>;

const STYLE_NAMES = { studio: 'Studio', material: 'Material', plain: 'Plain' } as const;
const MODE_NAMES = { system: 'follows the system', light: 'light', dark: 'dark' } as const;

/** Everything that isn't a journey: fares, offline data, looks, and what the app is. */
export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const { settings, updateSettings, fills } = useAppTheme();
  const pack = useOfflinePack();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <SectionHeader title="Fares" />
      <Card>
        <SettingRow
          icon="card-outline"
          title="I use a smart card"
          detail="Show card fares first, with the token fare under them"
          toggle={{ value: settings.smartCard, onChange: (smartCard) => updateSettings({ smartCard }) }}
        />
      </Card>

      <SectionHeader title="App" />
      <Card>
        <SettingRow
          icon="cloud-download-outline"
          title="Offline data"
          detail={
            pack.meta
              ? `Downloaded, ${formatBytes(pack.meta.sizeBytes)}${settings.offlineAutoSync ? ', kept up to date' : ''}`
              : 'Not downloaded'
          }
          onPress={() => navigation.navigate('OfflineData')}
        />
        <SettingDivider color={fills.hairline} />
        <SettingRow
          icon="color-palette-outline"
          title="Appearance"
          detail={`${STYLE_NAMES[settings.uiStyle]}, ${MODE_NAMES[settings.themeMode]}`}
          onPress={() => navigation.navigate('Appearance')}
        />
        <SettingDivider color={fills.hairline} />
        <SettingRow
          icon="information-circle-outline"
          title="About"
          detail="Version, data sources and credits"
          onPress={() => navigation.navigate('About')}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    gap: spacing.sm,
    paddingBottom: spacing['4xl'],
  },
});
