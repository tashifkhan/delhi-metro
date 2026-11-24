import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
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
import {
  STUDIO_COMBOS,
  STUDIO_NEUTRALS,
  type UiStyle,
} from '../theme/studio';
import { LOOKS } from '../theme/look';
import { spacing, radius, emphasis, onColor } from '../theme';

const STYLES: { id: UiStyle; label: string; detail: string }[] = [
  { id: 'studio', label: 'Studio', detail: 'Warm greys, one accent' },
  { id: 'material', label: 'Material', detail: 'Material You colour' },
  { id: 'plain', label: 'Plain', detail: 'Raw, no decoration' },
];

/**
 * A thumbnail of what each style does to a card and a button, drawn with the
 * style's own corners and colours so the choice reads before it's made.
 */
function StylePreview({ style, isDark }: { style: UiStyle; isDark: boolean }) {
  const theme = useTheme();
  const look = LOOKS[style];
  const n = isDark ? STUDIO_NEUTRALS.dark : STUDIO_NEUTRALS.light;
  const studioAccent = isDark ? STUDIO_COMBOS[0].dark.accent : STUDIO_COMBOS[0].light.accent;
  const paper = style === 'material' ? theme.colors.elevation.level2 : style === 'plain' ? n.background : n.surface;
  const edge = style === 'material' ? 'transparent' : n.border;
  const fill = style === 'material' ? theme.colors.primary : style === 'plain' ? n.foreground : studioAccent;
  const line = style === 'material' ? theme.colors.onSurfaceVariant : n.faint;
  return (
    <View
      style={[
        styles.preview,
        { backgroundColor: paper, borderColor: edge, borderRadius: look.radius.card },
      ]}
    >
      <View style={[styles.previewLine, { backgroundColor: line, width: '70%' }]} />
      <View style={[styles.previewLine, { backgroundColor: line, width: '45%', opacity: 0.6 }]} />
      <View style={[styles.previewButton, { backgroundColor: fill, borderRadius: look.radius.pill }]} />
    </View>
  );
}

const THEME_MODES: { id: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { id: 'light', label: 'Light', icon: 'sunny-outline' },
  { id: 'dark', label: 'Dark', icon: 'moon-outline' },
];

/** How many palettes to show before the list collapses behind "Show more". */
const FEATURED_COUNT = 4;
const PAGE_ANIMATIONS = [
  { id: 'slide', label: 'Slide', icon: 'swap-horizontal-outline' },
  { id: 'fade', label: 'Fade', icon: 'contrast-outline' },
  { id: 'none', label: 'Off', icon: 'pause-outline' },
] as const;

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
        haptic={false}
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
  const { settings, updateSettings, isDark, fills, dynamicAvailable, reduceMotionEnabled } =
    useAppTheme();
  const material = settings.uiStyle === 'material';

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
      {/* Style */}
      <View style={styles.section}>
        <SectionHeader title="Style" icon="shapes-outline" />
        <View style={styles.modeRow} accessibilityRole="radiogroup">
          {STYLES.map((option) => {
            const active = settings.uiStyle === option.id;
            const fg = active ? theme.colors.onPrimaryContainer : theme.colors.onSurface;
            return (
              <View key={option.id} style={styles.modeSlot}>
                <Touchable
                  radius={radius.hero}
                  haptic="select"
                  onPress={() => updateSettings({ uiStyle: option.id })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${option.label} style. ${option.detail}`}
                  style={{
                    backgroundColor: active ? theme.colors.primaryContainer : fills.subtle,
                  }}
                >
                  <View style={styles.styleCard}>
                    <StylePreview style={option.id} isDark={isDark} />
                    <Text variant="labelLarge" style={[emphasis.strong, { color: fg }]}>
                      {option.label}
                    </Text>
                    <Text
                      variant="bodySmall"
                      numberOfLines={1}
                      style={{ color: active ? fg : theme.colors.onSurfaceVariant }}
                    >
                      {option.detail}
                    </Text>
                  </View>
                </Touchable>
              </View>
            );
          })}
        </View>
        {settings.uiStyle === 'studio' && (
          <View style={styles.comboRow} accessibilityRole="radiogroup">
            {STUDIO_COMBOS.map((combo) => {
              const active = settings.studioColor === combo.id;
              const swatch = isDark ? combo.dark.accent : combo.light.accent;
              return (
                <Touchable
                  key={combo.id}
                  radius={radius.pill}
                  haptic="select"
                  onPress={() => updateSettings({ studioColor: combo.id })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${combo.name} accent`}
                  style={{
                    backgroundColor: active ? theme.colors.primaryContainer : fills.subtle,
                  }}
                >
                  <View style={styles.combo}>
                    <View style={[styles.comboDot, { backgroundColor: swatch }]}>
                      {active && <Ionicons name="checkmark" size={12} color={onColor(swatch)} />}
                    </View>
                    <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
                      {combo.name}
                    </Text>
                  </View>
                </Touchable>
              );
            })}
          </View>
        )}
        <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
          {settings.uiStyle === 'studio'
            ? 'The look of taf.sh: warm greys, hairline edges and one accent colour.'
            : settings.uiStyle === 'plain'
              ? 'No colour except the metro lines. Square corners, no cards.'
              : 'Tonal surfaces and your choice of palette, or your wallpaper colours.'}
        </Text>
      </View>

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

      {/* Palette, Material only */}
      {material && (
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
            haptic="select"
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
      )}

      {/* Options */}
      <View style={styles.section}>
        <SectionHeader title="Options" icon="options-outline" />
        <View style={styles.toggleList}>
          {material && (
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
          )}
          {material && (
          <ToggleCard
            icon="contrast"
            title="High contrast"
            subtitle="Stronger text and outlines — a less soft Material look"
            value={settings.highContrast}
            onChange={(highContrast) => updateSettings({ highContrast })}
          />
          )}
          <ToggleCard
            icon="pulse"
            title="Haptics"
            subtitle="Light feedback for switches and results"
            value={settings.hapticsEnabled}
            onChange={(hapticsEnabled) => updateSettings({ hapticsEnabled })}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Page animations" icon="play-outline" />
        <View style={styles.modeRow} accessibilityRole="radiogroup">
          {PAGE_ANIMATIONS.map((option) => {
            const active = settings.animationStyle === option.id;
            const color = active ? theme.colors.onPrimaryContainer : theme.colors.onSurface;
            return (
              <View key={option.id} style={styles.modeSlot}>
                <Touchable
                  radius={radius.hero}
                  haptic="select"
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.label} page animations`}
                  accessibilityState={{ selected: active }}
                  onPress={() => updateSettings({ animationStyle: option.id })}
                  style={{ backgroundColor: active ? theme.colors.primaryContainer : fills.subtle }}
                >
                  <View style={styles.modeCard}>
                    <Ionicons name={option.icon} size={20} color={color} />
                    <Text variant="labelLarge" style={[emphasis.strong, { color }]}>
                      {option.label}
                    </Text>
                  </View>
                </Touchable>
              </View>
            );
          })}
        </View>
        <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
          {reduceMotionEnabled
            ? 'Your device has Reduce Motion enabled. Page animations stay off.'
            : 'Controls page transitions, tab changes and content reveals.'}
        </Text>
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
    overflow: 'hidden',
  },
  // Style
  styleCard: {
    alignItems: 'center',
    gap: 2,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  preview: {
    width: 64,
    height: 48,
    borderWidth: 1,
    padding: 7,
    gap: 4,
    marginBottom: spacing.xs,
  },
  previewLine: {
    height: 4,
    borderRadius: 2,
  },
  previewButton: {
    marginTop: 'auto',
    height: 10,
    width: 28,
  },
  comboRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  combo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
  },
  comboDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
