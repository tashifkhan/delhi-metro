import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Card } from '../components/Card';
import { SettingDivider, SettingRow } from '../components/SettingRow';
import { LoadingIndicator } from '../components/loading/LoadingIndicator';
import { useOfflinePack } from '../offline/OfflinePackContext';
import { formatBytes } from '../offline/model';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme';

function when(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * The offline pack: what's on the phone, keeping it current, and removing it.
 */
export function OfflineDataScreen() {
  const theme = useTheme();
  const { fills, settings, updateSettings } = useAppTheme();
  const pack = useOfflinePack();
  const syncing = pack.status === 'syncing';

  let lastLine: string | null = null;
  if (pack.last) {
    switch (pack.last.kind) {
      case 'downloaded':
        lastLine = `Updated ${when(pack.last.at)}.`;
        break;
      case 'up-to-date':
        lastLine = `Checked ${when(pack.last.at)}. Already the newest.`;
        break;
      case 'unavailable':
        lastLine = "The server doesn't offer an offline pack yet. Try again later.";
        break;
      case 'failed':
        lastLine = `Couldn't update: ${pack.last.reason}.`;
        break;
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <Text variant="bodyMedium" style={[styles.intro, { color: theme.colors.onSurfaceVariant }]}>
        The offline pack holds every line, station and station detail, first and last trains, the latest alerts
        and the network maps, so the app works without a connection. Routes you plan offline are estimates until
        you're back online.
      </Text>

      <Card>
        <View style={styles.status}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            {pack.meta ? 'Downloaded' : 'Not downloaded'}
          </Text>
          {pack.meta ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {formatBytes(pack.meta.sizeBytes)} · data from {when(Date.parse(pack.meta.generatedAt) || pack.meta.savedAt)}
            </Text>
          ) : null}
          {lastLine ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {lastLine}
            </Text>
          ) : null}
        </View>
        <SettingDivider color={fills.hairline} />
        <SettingRow
          icon={pack.meta ? 'refresh' : 'cloud-download-outline'}
          title={syncing ? 'Checking…' : pack.meta ? 'Sync now' : 'Download'}
          onPress={() => void pack.syncNow()}
          disabled={syncing}
          trailing={syncing ? <LoadingIndicator size={28} /> : null}
        />
        {pack.meta ? (
          <>
            <SettingDivider color={fills.hairline} />
            <SettingRow icon="trash-outline" title="Remove from this phone" onPress={() => void pack.remove()} disabled={syncing} />
          </>
        ) : null}
      </Card>

      <Card>
        <SettingRow
          title="Keep it up to date"
          detail="Checks when you open the app and when your connection comes back, at most every few hours"
          toggle={{ value: settings.offlineAutoSync, onChange: (offlineAutoSync) => updateSettings({ offlineAutoSync }) }}
        />
        <SettingDivider color={fills.hairline} />
        <SettingRow
          title="Only on Wi-Fi"
          detail="Hold automatic updates until you're on Wi-Fi"
          disabled={!settings.offlineAutoSync}
          toggle={{ value: settings.offlineWifiOnly, onChange: (offlineWifiOnly) => updateSettings({ offlineWifiOnly }) }}
        />
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
  intro: {
    paddingHorizontal: spacing.xs,
  },
  status: {
    padding: spacing.base,
    gap: 4,
  },
});
