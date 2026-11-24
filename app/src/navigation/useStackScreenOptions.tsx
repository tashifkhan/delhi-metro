import { useHaptics } from '../hooks/useHaptics';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { StyleSheet, View } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Appbar, Text, useTheme } from 'react-native-paper';
import { duration } from '../theme/motion';
import { emphasis, spacing } from '../theme';
import { useAppTheme } from '../theme/ThemeContext';
import { animationPreference } from '../theme/animationPreferences';

type OptionsFactory = (props: {
  navigation: { goBack: () => void };
}) => NativeStackNavigationOptions;

/**
 * Shared options for every stack in the app.
 *
 * All five stacks previously repeated this header verbatim. Keeping it in one
 * place means the app bar and the push transition stay in step — and gives the
 * navigation animation a single home.
 *
 * The push uses a horizontal slide, Material's "shared axis X" for forward and
 * backward movement within a hierarchy.
 */
export function useStackScreenOptions(): OptionsFactory {
  const theme = useTheme();
  const haptics = useHaptics();
  const isDesktop = useIsDesktop();
  const { animationStyle } = useAppTheme();

  return ({ navigation }) => ({
    animation: animationPreference(animationStyle, false).stack,
    animationDuration: duration.medium2,
    header: ({ options, back }) => {
      const title = options.title ?? '';

      // Desktop headings are plain page titles, not app bars. The level2 band
      // next to the sidebar read as a second navbar.
      if (isDesktop) {
        return (
          <View style={styles.desktopHeader}>
            {back ? (
              <Appbar.BackAction
                onPress={() => { haptics.navigate(); navigation.goBack(); }}
                color={theme.colors.onSurface}
                style={styles.desktopBack}
              />
            ) : null}
            <Text
              variant="headlineSmall"
              numberOfLines={1}
              style={[emphasis.heavy, styles.desktopTitle, { color: theme.colors.onSurface }]}
            >
              {title}
            </Text>
            {options.headerRight
              ? options.headerRight({ canGoBack: Boolean(back), tintColor: theme.colors.onSurface })
              : null}
          </View>
        );
      }

      return (
        <Appbar.Header
          style={{ backgroundColor: theme.colors.background }}
          elevated={false}
        >
          {back ? (
            <Appbar.BackAction onPress={() => { haptics.navigate(); navigation.goBack(); }} color={theme.colors.onSurface} />
          ) : null}

          <Appbar.Content
            title={title}
            color={theme.colors.onSurface}
            titleStyle={{ fontWeight: '600' }}
          />
          {options.headerRight
            ? options.headerRight({ canGoBack: Boolean(back), tintColor: theme.colors.onSurface })
            : null}
        </Appbar.Header>
      );
    },
    contentStyle: { backgroundColor: theme.colors.background },
  });
}

const styles = StyleSheet.create({
  desktopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  desktopBack: {
    margin: 0,
  },
  desktopTitle: {
    flex: 1,
    letterSpacing: -0.3,
  },
});
