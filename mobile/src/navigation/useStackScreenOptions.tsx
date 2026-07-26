import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Appbar, useTheme } from 'react-native-paper';
import { duration } from '../theme/motion';

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

  return ({ navigation }) => ({
    animation: 'slide_from_right',
    animationDuration: duration.medium2,
    header: ({ options, back }) => (
      <Appbar.Header
        style={{ backgroundColor: theme.colors.elevation.level2 }}
        elevated={false}
      >
        {back && (
          <Appbar.BackAction onPress={navigation.goBack} color={theme.colors.onSurface} />
        )}
        <Appbar.Content
          title={options.title ?? ''}
          color={theme.colors.onSurface}
          titleStyle={{ fontWeight: '700' }}
        />
      </Appbar.Header>
    ),
    contentStyle: { backgroundColor: theme.colors.background },
  });
}
