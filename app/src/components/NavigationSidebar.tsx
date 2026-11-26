import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { BrandMark } from './BrandMark';
import { TabIcon, type TabIconName } from './icons/TabIcons';
import type { RootTabParamList } from '../navigation/types';
import { Touchable } from './Touchable';
import { openAndroidDownload } from './web/GetTheApp';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { emphasis, radius, spacing } from '../theme';

export type SidebarDestination = keyof RootTabParamList | 'Settings';
const NAV_ITEMS: { key: SidebarDestination; label: string; icon: TabIconName | 'settings' }[] = [
  { key: 'HomeTab', label: 'Plan', icon: 'plan' },
  { key: 'MapTab', label: 'Map', icon: 'map' },
  { key: 'NetworkTab', label: 'Network', icon: 'network' },
  { key: 'SavedTab', label: 'Saved', icon: 'saved' },
  { key: 'AlertsTab', label: 'Alerts', icon: 'alerts' },
  { key: 'Settings', label: 'Settings', icon: 'settings' },
];

interface Props {
  active: string;
  onSelect: (destination: SidebarDestination) => void;
  width: number;
  insets: EdgeInsets;
}

/**
 * Persistent navigation for wide app windows.
 */
export function NavigationSidebar({ active, onSelect, width, insets }: Props) {
  const theme = useTheme();
  const install = usePwaInstall();

  return (
    <ScrollView
      role="navigation"
      accessibilityLabel="Main navigation"
      style={[
        styles.sidebar,
        {
          width: width + insets.left,
          backgroundColor: theme.colors.elevation.level2,
          borderRightColor: theme.colors.outlineVariant,
        },
      ]}
      contentContainerStyle={[
        styles.body,
        {
          paddingTop: spacing.lg + insets.top,
          paddingBottom: spacing.lg + insets.bottom,
          paddingLeft: spacing.md + insets.left,
        },
      ]}
      contentInsetAdjustmentBehavior="never"
    >
      <View style={styles.brand}>
        <BrandMark size={40} />
        <View style={styles.brandText}>
          <Text variant="titleMedium" style={[emphasis.heavy, { color: theme.colors.onSurface }]}>
            NCR Metro
          </Text>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Delhi • Noida
          </Text>
        </View>
      </View>

      <View style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const selected = item.key === active;
          const color = selected ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant;
          return (
            <Touchable
              key={item.key}
              radius={radius.card}
              haptic="select"
              onPress={() => onSelect(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={item.label}
              style={{
                backgroundColor: selected ? theme.colors.secondaryContainer : 'transparent',
              }}
            >
              <View style={styles.navRow}>
                {item.icon === 'settings' ? (
                  <Ionicons name={selected ? 'settings' : 'settings-outline'} size={20} color={color} />
                ) : (
                  <TabIcon name={item.icon} focused={selected} size={20} color={color} />
                )}
                <Text
                  variant="labelLarge"
                  style={[
                    selected ? emphasis.heavy : emphasis.medium,
                    { color },
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            </Touchable>
          );
        })}
      </View>

      {/* The rail has room the mobile layout does not, so installing and the
          Android build sit at its foot rather than only inside About. The
          install row shows only while the browser has a prompt to open, and
          goes once the app is installed. */}
      {Platform.OS === 'web' ? (
        <View style={styles.footer}>
          {install.canInstall ? (
            <Touchable
              radius={radius.card}
              haptic="press"
              onPress={install.install}
              accessibilityLabel="Install this app"
              accessibilityHint="Opens the browser's install dialog"
              style={{ backgroundColor: theme.colors.primary }}
            >
              <View style={styles.footerRow}>
                <Ionicons name="add-circle-outline" size={18} color={theme.colors.onPrimary} />
                <Text
                  variant="labelLarge"
                  style={[emphasis.heavy, { color: theme.colors.onPrimary }]}
                >
                  Install this app
                </Text>
              </View>
            </Touchable>
          ) : null}
          <Touchable
            radius={radius.card}
            haptic="press"
            onPress={openAndroidDownload}
            accessibilityRole="link"
            accessibilityLabel="Download for Android"
            accessibilityHint="Opens the latest release on tashif.codes"
            style={{ backgroundColor: theme.colors.secondaryContainer }}
          >
            <View style={styles.footerRow}>
              <Ionicons
                name="logo-android"
                size={18}
                color={theme.colors.onSecondaryContainer}
              />
              <Text
                variant="labelLarge"
                style={[emphasis.heavy, { color: theme.colors.onSecondaryContainer }]}
              >
                Get it on Android
              </Text>
            </View>
          </Touchable>
          <View style={styles.footerNote}>
            <Ionicons name="logo-apple" size={13} color={theme.colors.onSurfaceVariant} />
            {/* Not the usual tracked capitals: they would print "IOS". */}
            <Text
              variant="labelSmall"
              style={[emphasis.medium, { color: theme.colors.onSurfaceVariant }]}
            >
              iOS coming soon
            </Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    flexGrow: 0,
    flexShrink: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flexGrow: 1,
    paddingRight: spacing.md,
    gap: spacing.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  brandText: {
    flex: 1,
    gap: 1,
  },
  nav: {
    flexGrow: 1,
    gap: spacing.xs,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: 13,
  },
  footer: {
    gap: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
