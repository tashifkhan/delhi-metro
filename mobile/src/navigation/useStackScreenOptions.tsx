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
 * Shared options for every stack in the app.
 *
 * All five stacks previously repeated this header verbatim. Keeping it in one
 * place means the app bar and the push transition stay in step — and gives the
 * navigation animation a single home.
 *
 * The push uses a horizontal slide, Material's "shared axis X" for forward and
 * backward movement within a hierarchy.
 *
 * `networkSwitcher` is opt-in: journey planning and station search work across
 * both operators, so a network toggle there would suggest a scope that no
 * longer exists. Only the screens that genuinely show one operator's content
 * at a time — alerts and the network map — ask for it.
 *
 * Every element below is a *direct* child of `Appbar.Header`. It inspects its
 * children to decide alignment and spacing, so grouping them in a fragment
 * hides them from that check and silently left-aligns every title on iOS.
 *
 * On the two screens that do carry the switcher, iOS needs the space left of
 * the title to match it, or the centred title lands off-centre. Rather than
 * measure the switcher, the left side renders it again at zero opacity: the
 * sides are then identical by construction, and the title ellipsises before it
 * can reach either. Android left-aligns throughout, so it never needs this.
 */
export function useStackScreenOptions({ networkSwitcher = false } = {}): OptionsFactory {
  const theme = useTheme();

  return ({ navigation }) => ({
    animation: 'slide_from_right',
    animationDuration: duration.medium2,
    header: ({ options, back }) => {
      const title = options.title ?? '';
      const showSwitcher = !back && networkSwitcher;
      const centreAroundSwitcher = showSwitcher && Platform.OS === 'ios';

      return (
        <Appbar.Header
          style={{ backgroundColor: theme.colors.elevation.level2 }}
          elevated={false}
        >
          {back ? (
            <Appbar.BackAction onPress={navigation.goBack} color={theme.colors.onSurface} />
          ) : null}

          {centreAroundSwitcher ? (
            <View
              style={styles.mirror}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <NetworkSwitcher compact />
            </View>
          ) : null}

          {centreAroundSwitcher ? (
            <Text
              variant="titleLarge"
              numberOfLines={1}
              // A title that only just overruns should shrink rather than lose
              // characters; anything genuinely long still ellipsises.
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[emphasis.heavy, styles.title, { color: theme.colors.onSurface }]}
            >
              {title}
            </Text>
          ) : (
            <Appbar.Content
              title={title}
              color={theme.colors.onSurface}
              titleStyle={{ fontWeight: '700' }}
            />
          )}

          {showSwitcher ? <NetworkSwitcher compact /> : null}
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
