import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import { Touchable } from '../components/Touchable';
import { useAppTheme } from '../theme/ThemeContext';
import { useOfflinePack } from '../offline/OfflinePackContext';
import { fetchManifest } from '../offline/sync';
import { formatBytes } from '../offline/model';
import { env } from '../config/env';
import { spacing, radius, emphasis } from '../theme';

type Step = 'fares' | 'offline';

function Choice({
  icon,
  title,
  detail,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  return (
    <Touchable
      radius={radius.hero}
      haptic="select"
      onPress={onPress}
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityState={{ selected }}
      style={{
        backgroundColor: selected ? theme.colors.primaryContainer : fills.containerLow,
        borderColor: selected ? theme.colors.primary : fills.hairline,
        borderWidth: 1,
      }}
    >
      <View style={styles.choice}>
        <Ionicons name={icon} size={26} color={selected ? theme.colors.onPrimaryContainer : theme.colors.onSurface} />
        <View style={styles.choiceText}>
          <Text variant="titleMedium" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
            {title}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {detail}
          </Text>
        </View>
      </View>
    </Touchable>
  );
}

/**
 * Two questions on first launch: how you pay, and whether to keep the network
 * on the phone. Either can be skipped, and both live in Settings afterwards.
 */
export function OnboardingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { updateSettings } = useAppTheme();
  const pack = useOfflinePack();
  const [step, setStep] = useState<Step>('fares');
  const [size, setSize] = useState<number | null>(null);

  useEffect(() => {
    if (step !== 'offline') return;
    let active = true;
    void fetchManifest(env.apiBaseUrl, fetch).then((m) => active && m && setSize(m.size_bytes));
    return () => {
      active = false;
    };
  }, [step]);

  const finish = () => updateSettings({ onboarded: true });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <View style={styles.head}>
        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {step === 'fares' ? '1 of 2' : '2 of 2'}
        </Text>
        <Text variant="headlineMedium" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
          {step === 'fares' ? 'How do you pay for the metro?' : 'Use it without a connection?'}
        </Text>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          {step === 'fares'
            ? 'Delhi Metro charges less on a smart card, and less again off-peak. We’ll show the fare you actually pay.'
            : 'Download every line, station, timing and map now, and the app keeps working underground and with no signal.'}
        </Text>
      </View>

      {step === 'fares' ? (
        <View style={styles.choices}>
          <Choice
            icon="card-outline"
            title="Smart card"
            detail="Show card fares first"
            onPress={() => {
              updateSettings({ smartCard: true });
              setStep('offline');
            }}
          />
          <Choice
            icon="qr-code-outline"
            title="Token or QR ticket"
            detail="Show the standard fare"
            onPress={() => {
              updateSettings({ smartCard: false });
              setStep('offline');
            }}
          />
        </View>
      ) : (
        <View style={styles.choices}>
          <Choice
            icon="cloud-download-outline"
            title={size ? `Download (${formatBytes(size)})` : 'Download'}
            detail="Kept up to date when you're online. You can turn that off in Settings."
            onPress={() => {
              // The download carries on in the background; nothing waits for it.
              void pack.syncNow();
              finish();
            }}
          />
          <Choice icon="time-outline" title="Not now" detail="You can download it later from Settings, Offline data" onPress={finish} />
        </View>
      )}

      <Touchable radius={radius.pill} onPress={finish} accessibilityLabel="Skip setup">
        <View style={styles.skip}>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            Skip
          </Text>
        </View>
      </Touchable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  head: {
    gap: spacing.sm,
  },
  choices: {
    gap: spacing.md,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    padding: spacing.lg,
  },
  choiceText: {
    flex: 1,
    gap: 2,
  },
  skip: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
