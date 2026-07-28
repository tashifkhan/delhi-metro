import { Platform, StyleSheet, View } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Appbar, Text, useTheme } from 'react-native-paper';
import { duration } from '../theme/motion';
import { NetworkSwitcher } from '../components/NetworkSwitcher';
import { emphasis } from '../theme';

type OptionsFactory = (props: {
  navigation: { goBack: () => void };
}) => NativeStackNavigationOptions;

/**
 * The shared app bar.
 *
 * iOS centres its title, so a switcher in the same flex row pushed the title
 * off the bar's centre. Centring it again needs the space on the left of the
 * title to match the switcher on the right — and the switcher is a third of
 * the bar, so guessing that width either clipped the title or overflowed the
 * switcher off screen.
 *
 * Rather than measure it, the left side renders the same switcher with zero
 * opacity. The two sides are then identical by construction, the title centres
 * between them, and it ellipsises before it can reach either.
 *
 * Android keeps its left-aligned title, which the switcher never disturbed.
 */
function CentredSwitcherHeader({ title }: { title: string }) {
  const theme = useTheme();

  return (
    <>
      <View
        style={styles.mirror}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <NetworkSwitcher compact />
      </View>

      <Text
        variant="titleLarge"
        numberOfLines={1}
        style={[emphasis.heavy, styles.title, { color: theme.colors.onSurface }]}
      >
        {title}
      </Text>

      <NetworkSwitcher compact />
    </>
  );
}

export function useStackScreenOptions({ networkSwitcher = false } = {}): OptionsFactory {
  const theme = useTheme();

  return ({ navigation }) => ({
    animation: 'slide_from_right',
    animationDuration: duration.medium2,
    header: ({ options, back }) => {
      const title = options.title ?? '';
      const showSwitcher = !back && networkSwitcher;

      return (
        <Appbar.Header
          style={{ backgroundColor: theme.colors.elevation.level2 }}
          elevated={false}
        >
          {back && (
            <Appbar.BackAction onPress={navigation.goBack} color={theme.colors.onSurface} />
          )}

          {showSwitcher && Platform.OS === 'ios' ? (
            <CentredSwitcherHeader title={title} />
          ) : (
            <>
              <Appbar.Content
                title={title}
                color={theme.colors.onSurface}
                titleStyle={{ fontWeight: '700' }}
              />
              {showSwitcher && <NetworkSwitcher compact />}
            </>
          )}
        </Appbar.Header>
      );
    },
    contentStyle: { backgroundColor: theme.colors.background },
  });
}

const styles = StyleSheet.create({
  mirror: {
    opacity: 0,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
