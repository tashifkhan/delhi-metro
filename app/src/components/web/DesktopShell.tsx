import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';

import type { RootTabParamList } from '../../navigation/types';
import { Touchable } from '../Touchable';
import { openAndroidDownload } from './GetTheApp';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { emphasis, radius, spacing } from '../../theme';

export type DesktopTab = keyof RootTabParamList;

const NAV_ITEMS: {
  key: DesktopTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'HomeTab', label: 'Plan', icon: 'train-outline', activeIcon: 'train' },
  { key: 'SearchTab', label: 'Search', icon: 'search-outline', activeIcon: 'search' },
  { key: 'LinesTab', label: 'Lines', icon: 'git-branch-outline', activeIcon: 'git-branch' },
  { key: 'MapTab', label: 'Map', icon: 'map-outline', activeIcon: 'map' },
  { key: 'AlertsTab', label: 'Alerts', icon: 'notifications-outline', activeIcon: 'notifications' },
];

interface Props {
  active: DesktopTab;
  onSelect: (tab: DesktopTab) => void;
}

/**
 * Sidebar navigation for the desktop web shell. Same five destinations as the
 * mobile tab bar, rendered as a persistent rail so wide viewports read as a
 * desktop app instead of a stretched phone.
 */
export function DesktopShell({ active, onSelect }: Props) {
  const theme = useTheme();
  const install = usePwaInstall();

  return (
    <View
      style={[
        styles.sidebar,
        {
          backgroundColor: theme.colors.elevation.level2,
          borderRightColor: theme.colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.brand}>
        <View style={[styles.brandMark, { backgroundColor: theme.colors.primary }]}>
          <Ionicons name="train" size={20} color={theme.colors.onPrimary} />
        </View>
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
                <Ionicons
                  name={selected ? item.activeIcon : item.icon}
                  size={20}
                  color={
                    selected
                      ? theme.colors.onSecondaryContainer
                      : theme.colors.onSurfaceVariant
                  }
                />
                <Text
                  variant="labelLarge"
                  style={[
                    selected ? emphasis.heavy : emphasis.medium,
                    {
                      color: selected
                        ? theme.colors.onSecondaryContainer
                        : theme.colors.onSurfaceVariant,
                    },
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
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 272,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: radius.icon,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandText: {
    flex: 1,
    gap: 1,
  },
  nav: {
    flex: 1,
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
