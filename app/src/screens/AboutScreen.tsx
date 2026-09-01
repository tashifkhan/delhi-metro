import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Text, useTheme } from 'react-native-paper';

import { Card } from '../components/Card';
import { SectionHeader } from '../components/SectionHeader';
import { Touchable } from '../components/Touchable';
import { OperatorMark } from '../components/OperatorMark';
import { apiClient } from '../api/client';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, emphasis } from '../theme';
import type { MetroNetwork } from '../network';

const REPOSITORY_URL = 'https://github.com/tashifkhan/delhi-metro';
const API_DOCS_URL = 'https://ncr-metro.tashif.codes/api';

interface SourceEntry {
  network: MetroNetwork;
  operator: string;
  detail: string;
}

const SOURCES: SourceEntry[] = [
  {
    network: 'dmrc',
    operator: 'Delhi Metro',
    detail: "Routes, fares and train times come from DMRC's own website API and the Delhi Metro Sarthi service.",
  },
  {
    network: 'nmrc',
    operator: 'Noida Metro',
    detail: "Aqua Line stations, fares and notices are read from NMRC's public passenger pages.",
  },
];

interface LinkEntry {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  url: string;
}

const LINKS: LinkEntry[] = [
  {
    icon: 'logo-github',
    title: 'Source code',
    subtitle: 'The app, the API and the research notes',
    url: REPOSITORY_URL,
  },
  {
    icon: 'code-slash-outline',
    title: 'API docs',
    subtitle: 'Every endpoint, with a playground to call them',
    url: API_DOCS_URL,
  },
  {
    icon: 'bug-outline',
    title: 'Report a problem',
    subtitle: 'Wrong fare, missing station, anything else',
    url: `${REPOSITORY_URL}/issues`,
  },
];

function LinkRow({ entry }: { entry: LinkEntry }) {
  const theme = useTheme();
  const { fills } = useAppTheme();

  return (
    <Touchable
      radius={radius.hero}
      onPress={() => {
        // A dead link should not take the screen down with it: there may be no
        // browser to hand the URL to.
        Linking.openURL(entry.url).catch(() => {});
      }}
      accessibilityRole="link"
      accessibilityLabel={entry.title}
      accessibilityHint={entry.subtitle}
    >
      <View style={styles.linkRow}>
        <View style={[styles.linkIcon, { backgroundColor: fills.subtle }]}>
          <Ionicons name={entry.icon} size={18} color={theme.colors.onSurfaceVariant} />
        </View>
        <View style={styles.linkText}>
          <Text variant="titleSmall" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
            {entry.title}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {entry.subtitle}
          </Text>
        </View>
        <Ionicons name="open-outline" size={16} color={theme.colors.onSurfaceVariant} />
      </View>
    </Touchable>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={styles.detailRow}>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text
        variant="bodyMedium"
        numberOfLines={1}
        style={[emphasis.strong, styles.detailValue, { color: theme.colors.onSurface }]}
      >
        {value}
      </Text>
    </View>
  );
}

export function AboutScreen() {
  const theme = useTheme();
  const { fills } = useAppTheme();

  const version = Constants.expoConfig?.version ?? 'unknown';
  // The origin is worth showing: it is the first thing to check when the app
  // is reporting something the operator's own site disagrees with.
  const apiOrigin = apiClient.baseUrl.replace(/^https?:\/\//, '');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Card radius={radius.hero} elevated style={styles.introCard}>
        <View style={styles.intro}>
          <Text variant="headlineSmall" style={[emphasis.heavy, { color: theme.colors.onSurface }]}>
            NCR Metro
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Plan a journey across Delhi Metro and Noida Metro in one search. Fares,
            interchanges and first and last trains are read from the operators as you
            ask for them, not from a copy kept inside the app.
          </Text>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Where the data comes from" icon="git-network-outline" />
        <View style={styles.sourceList}>
          {SOURCES.map((source) => (
            <Card key={source.network} radius={radius.hero} style={styles.sourceCard}>
              <View style={styles.sourceRow}>
                <OperatorMark network={source.network} size={20} />
                <View style={styles.sourceText}>
                  <Text
                    variant="titleSmall"
                    style={[emphasis.strong, { color: theme.colors.onSurface }]}
                  >
                    {source.operator}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {source.detail}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
        <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
          Both operators publish this data for passengers, and neither runs this app.
          When one of them changes a page or goes down, what you see here is wrong until
          it is fixed. Check the station or the operator before a journey that has to be
          right.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Links" icon="link-outline" />
        <Card radius={radius.hero} style={styles.linkCard}>
          {LINKS.map((entry, index) => (
            <View key={entry.url}>
              {index > 0 ? (
                <View style={[styles.divider, { backgroundColor: fills.hairline }]} />
              ) : null}
              <LinkRow entry={entry} />
            </View>
          ))}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Privacy" icon="lock-closed-outline" />
        <Text variant="bodyMedium" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
          There are no accounts and no analytics. Your searches, saved routes and theme
          settings stay on this device, and nothing sent to the API identifies you.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Version" icon="information-circle-outline" />
        <Card radius={radius.hero} style={styles.detailCard}>
          <DetailRow label="App" value={version} />
          <View style={[styles.divider, { backgroundColor: fills.hairline }]} />
          <DetailRow label="API" value={apiOrigin} />
          <View style={[styles.divider, { backgroundColor: fills.hairline }]} />
          <DetailRow label="Licence" value="MIT" />
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    paddingBottom: spacing['3xl'],
    gap: spacing.lg,
  },
  introCard: {
    borderRadius: radius.hero,
  },
  intro: {
    padding: spacing.base,
    gap: spacing.sm,
  },
  section: {
    gap: spacing.xs,
  },
  sourceList: {
    gap: spacing.sm,
  },
  sourceCard: {
    borderRadius: radius.hero,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.base,
  },
  sourceText: {
    flex: 1,
    gap: 2,
  },
  note: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  linkCard: {
    borderRadius: radius.hero,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    flex: 1,
    gap: 2,
  },
  detailCard: {
    borderRadius: radius.hero,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  detailValue: {
    flexShrink: 1,
  },
  divider: {
    height: 1,
  },
});
