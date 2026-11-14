import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';
import { radius as radii } from '../theme';

type Tone = 'low' | 'default' | 'high';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /**
   * Which surface container the card sits on. `low` is a resting card,
   * `default` a panel that holds other controls, `high` a card nested in one.
   */
  tone?: Tone;
  /** Kept for older call sites. An elevated card is the `default` tone. */
  elevated?: boolean;
}

/**
 * A tonal container.
 *
 * Material You separates surfaces by tone rather than shadow, so a card is a
 * step up the surface container ladder from the page. Dark mode keeps a faint
 * hairline because AMOLED black against the first container step is too close
 * to see on some panels.
 */
export function Card({ children, style, radius = radii.card, tone, elevated = false }: Props) {
  const { fills } = useAppTheme();
  const resolved: Tone = tone ?? (elevated ? 'default' : 'low');
  const background =
    resolved === 'high'
      ? fills.containerHigh
      : resolved === 'default'
        ? fills.container
        : fills.containerLow;

  return (
    <View
      style={[
        styles.base,
        { borderRadius: radius, borderColor: fills.hairline, backgroundColor: background },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});
