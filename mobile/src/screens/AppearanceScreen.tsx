import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { Switch } from '../components/Switch';
import { Card } from '../components/Card';
import { Touchable } from '../components/Touchable';
import { SectionHeader } from '../components/SectionHeader';
import { useHaptics } from '../hooks/useHaptics';
import { useAppTheme } from '../theme/ThemeContext';
import {
  DYNAMIC_PALETTE_ID,
  PALETTES,
  paletteFromId,
  type Palette,
} from '../theme/palettes';
import type { ThemeMode } from '../storage/appSettingsRepository';
import { spacing, radius, emphasis, onColor } from '../theme';

const THEME_MODES: { id: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { id: 'light', label: 'Light', icon: 'sunny-outline' },
  { id: 'dark', label: 'Dark', icon: 'moon-outline' },
];

/** How many palettes to show before the list collapses behind "Show more". */
const FEATURED_COUNT = 4;

function PaletteCard({
  palette,
  selected,
  isDark,
  onPress,
}: {
  palette: Palette;
  selected: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const isDynamic = palette.id === DYNAMIC_PALETTE_ID;

  // Preview the swatch the palette will actually produce in the current mode.
  const accent = isDynamic
    ? theme.colors.primary
    : isDark
      ? palette.primaryDark
      : palette.primaryLight;

  return (
    <View style={styles.paletteSlot}>
      <Touchable
        radius={radius.hero}
        haptic="select"
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${palette.label} palette`}
        style={{
          backgroundColor: selected ? theme.colors.primaryContainer : fills.subtle,
        }}
      >
        <View style={styles.paletteCard}>
          <Text
            variant="titleMedium"
            style={[
              emphasis.heavy,
              {
                color: selected
                  ? theme.colors.onPrimaryContainer
                  : theme.colors.onSurface,
              },
            ]}
            numberOfLines={1}
          >
            {palette.label}
          </Text>
          <Text
            variant="bodySmall"
            style={{
              color: selected
                ? theme.colors.onPrimaryContainer
                : theme.colors.onSurfaceVariant,
            }}
            numberOfLines={1}
          >
            {isDynamic ? 'Wallpaper colors' : 'Fixed palette'}
          </Text>
          <View style={[styles.swatch, { backgroundColor: accent }]}>
            {selected && <Ionicons name="checkmark" size={14} color={onColor(accent)} />}
          </View>
        </View>
      </Touchable>
    </View>
  );
}

function ToggleCard({
  icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();
  const haptics = useHaptics();

  // Weighted by direction, so switching on and off feel distinguishable —
  // hence the explicit call rather than Touchable's `haptic` prop.
  const handleToggle = () => {
    haptics.toggle(!value);
    onChange(!value);
  };

  return (
    <Card radius={radius.hero} style={styles.toggleSurface}>
      <Touchable
        radius={radius.hero}
        onPress={handleToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ selected: value }}
        accessibilityLabel={title}
        accessibilityHint={subtitle}
      >
        <View style={styles.toggleRow}>
          <View style={[styles.toggleIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <Ionicons name={icon} size={20} color={theme.colors.onPrimaryContainer} />
          </View>
          <View style={styles.toggleText}>
            <Text
              variant="titleSmall"
              style={[emphasis.strong, { color: theme.colors.onSurface }]}
            >
              {title}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {subtitle}
            </Text>
          </View>
          {/*
            The row owns the gesture; passing no handler keeps the switch
            display-only. Letting both handle the tap would toggle twice and
            land back on the old value.
          */}
          <Switch value={value} />
        </View>
      </Touchable>
    </Card>
  );
}

export function AppearanceScreen() {
  const theme = useTheme();
  const { settings, updateSettings, isDark, fills, dynamicAvailable } = useAppTheme();

  const availablePalettes = useMemo(
    () => PALETTES.filter((p) => p.id !== DYNAMIC_PALETTE_ID || dynamicAvailable),
    [dynamicAvailable],
  );

  const selected = paletteFromId(settings.paletteId);
  const featured = availablePalettes.slice(0, FEATURED_COUNT);

  // If the active palette is not among the featured ones, start expanded so
  // the current selection is visible without hunting for it.
  const [showAll, setShowAll] = useState(() => !featured.some((p) => p.id === selected.id));

  const visible = showAll ? availablePalettes : featured;
  const hiddenCount = availablePalettes.length - featured.length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Theme mode */}
      <View style={styles.section}>
        <SectionHeader title="Theme" icon="contrast-outline" />
        <View style={styles.modeRow}>
          {THEME_MODES.map((mode) => {
            const active = settings.themeMode === mode.id;
            const fg = active ? theme.colors.onPrimaryContainer : theme.colors.onSurface;
            return (
              <View key={mode.id} style={styles.modeSlot}>
                <Touchable
                  radius={radius.hero}
                  haptic="select"
                  onPress={() => updateSettings({ themeMode: mode.id })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${mode.label} theme`}
                  style={{
                    backgroundColor: active ? theme.colors.primaryContainer : fills.subtle,
                  }}
                >
                  <View style={styles.modeCard}>
                    <Ionicons name={mode.icon} size={20} color={fg} />
                    <Text variant="labelLarge" style={[emphasis.strong, { color: fg }]}>
                      {mode.label}
                    </Text>
                  </View>
                </Touchable>
              </View>
            );
          })}
        </View>
      </View>

      {/* Palette */}
      <View style={styles.section}>
        <SectionHeader title="Color palette" icon="color-palette-outline" />
        <View style={styles.paletteGrid} accessibilityRole="radiogroup">
          {visible.map((palette) => (
            <PaletteCard
              key={palette.id}
              palette={palette}
              isDark={isDark}
              selected={palette.id === selected.id}
              onPress={() => updateSettings({ paletteId: palette.id })}
            />
          ))}
        </View>

        {hiddenCount > 0 && (
          <Touchable
            radius={radius.pill}
            onPress={() => setShowAll((v) => !v)}
            accessibilityLabel={showAll ? 'Show fewer palettes' : 'Show all palettes'}
            accessibilityState={{ expanded: showAll }}
            style={{ backgroundColor: fills.subtle }}
          >
            <View style={styles.showMore}>
              <Ionicons
                name={showAll ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.colors.primary}
              />
              <Text variant="labelLarge" style={[emphasis.strong, { color: theme.colors.primary }]}>
                {showAll ? 'Show less' : `Show more · ${hiddenCount} palettes`}
              </Text>
            </View>
          </Touchable>
        )}

        {!dynamicAvailable && (
          <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
            Wallpaper colors need Android 12 or newer.
          </Text>
        )}
      </View>

      {/* Options */}
      <View style={styles.section}>
        <SectionHeader title="Options" icon="options-outline" />
        <View style={styles.toggleList}>
          <ToggleCard
            icon="moon"
            title="AMOLED black"
            subtitle={
              isDark
                ? 'Pure black surfaces to save power on OLED screens'
                : 'Applies when the dark theme is active'
            }
            value={settings.amoledDark}
            onChange={(amoledDark) => updateSettings({ amoledDark })}
          />
          <ToggleCard
            icon="contrast"
            title="High contrast"
            subtitle="Stronger text and outlines — a less soft Material look"
            value={settings.highContrast}
            onChange={(highContrast) => updateSettings({ highContrast })}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    gap: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  section: {
    gap: spacing.xs,
  },
  // Theme mode
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeSlot: {
    flex: 1,
  },
  modeCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.base,
  },
  // Palette
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paletteSlot: {
    // Two per row, accounting for the gap between them.
    width: '48.5%',
    flexGrow: 1,
  },
  paletteCard: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  showMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  note: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  // Toggles
  toggleList: {
    gap: spacing.sm,
  },
  toggleSurface: {
    borderRadius: radius.hero,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
  },
  toggleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
});
