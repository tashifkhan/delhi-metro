# Material 3 & Dynamic Theming Guide

This document explains the implementation of Material Design 3 (Material You) with dynamic wallpaper-based colors in the Delhi Metro Expo app.

## Overview

The app implements a full Material 3 design system that supports:
- **Dynamic Theming:** On Android 12+, colors are extracted from the user's wallpaper.
- **Custom Branding:** A hand-crafted "Metrolist-style" blue theme used as a fallback or on non-Android platforms.
- **Dark Mode:** Deep black (`#000000`) background with cool-blue tonal elevations for a premium, high-contrast feel.
- **Unified Navigation:** Automatic adaptation of React Navigation themes to match the Material 3 color palette.

## Core Dependencies

- `react-native-paper`: Provides the MD3 component library and theme provider.
- `@pchmn/expo-material3-theme`: Handles dynamic color extraction from Android 12+ wallpapers and generates full MD3 schemes.
- `@react-navigation/native`: Standard navigation with adapted themes.

## Architecture

The theming logic is centralized in `mobile/src/theme/ThemeContext.tsx`.

### 1. Color Schemes (`src/theme/colors.ts`)

We define two base color schemes:
- `lightScheme`: Standard Material 3 tokens using a primary blue brand color.
- `darkScheme`: Customized with a pure black background (`rgb(0,0,0)`) instead of the default Material dark grey, providing better contrast on OLED screens.

### 2. The Theme Context (`src/theme/ThemeContext.tsx`)

The `ThemeProvider` component performs the following logic:

1. **Check Support:** Detects if the device is Android 12+ (`API 31`).
2. **Extract Colors:** Uses `useMaterial3Theme` to get the wallpaper-based scheme.
3. **Merge Schemes:** 
   - If dynamic theming is supported and active, it uses the extracted colors.
   - Otherwise, it falls back to the hardcoded `lightScheme` and `darkScheme`.
4. **Adapt Navigation:** Uses `adaptNavigationTheme` from `react-native-paper` to ensure the status bar, headers, and tabs look consistent with the Paper components.
5. **Semantic Extensions:** Adds non-standard colors like `success`, `warning`, and `interchange` to the context for use in transit-specific UI elements.

## Usage in Components

Components access the theme via the `useAppTheme` hook (or `useTheme` from `react-native-paper` for standard MD3 tokens).

```tsx
import { useAppTheme } from '../theme';
import { Text, useTheme } from 'react-native-paper';

export function MyComponent() {
  const theme = useTheme(); // Standard MD3 tokens
  const { semantic, isDark } = useAppTheme(); // App-specific extensions

  return (
    <View style={{ backgroundColor: theme.colors.surface }}>
      <Text style={{ color: semantic.success }}>Route Clear</Text>
    </View>
  );
}
```

## Dark Mode Strategy

Our dark mode follows a "Deep Sea" aesthetic:
- **Primary Background:** Pure `#000000`.
- **Surfaces/Cards:** Use tonal elevations (levels 1-5) which are deep blue-tinted greys. This creates a sense of depth and hierarchy that pure black cannot achieve alone.
- **Accent Colors:** Desaturated versions of the brand blue to remain accessible and easy on the eyes in low light.

## Dynamic Theming Logic

```typescript
const IS_ANDROID_12_PLUS = Platform.OS === 'android' && Platform.Version >= 31;
const SHOULD_USE_DYNAMIC_THEME = IS_ANDROID_12_PLUS && isDynamicThemeSupported;

// Inside useMemo
const lightMaterialScheme = SHOULD_USE_DYNAMIC_THEME ? materialTheme.light : lightScheme;
const darkMaterialScheme = SHOULD_USE_DYNAMIC_THEME ? materialTheme.dark : darkScheme;
```

On iOS or older Android versions, the app uses a consistent brand identity based on the `FALLBACK_SOURCE_COLOR` (`#005FAF`).

## Best Practices

1. **Use Tokens:** Never hardcode hex values. Always use `theme.colors.*`.
2. **Elevation:** Use the `Surface` component from `react-native-paper` with an `elevation` prop to automatically pick up the correct tonal background color.
3. **Contrast:** When using custom brand colors, ensure they meet WCAG accessibility standards against the surface tokens.
