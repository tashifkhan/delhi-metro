import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Surface } from 'react-native-paper';
import { useAppTheme } from '../theme/ThemeContext';
import { radius as radii } from '../theme';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Lifts the card a step further in light mode. */
  elevated?: boolean;
}

/**
 * A raised container.
 *
 * Light and dark define "raised" differently: a shadow reads clearly on a
 * light background but disappears against near-black, where an outline is what
 * separates the card from the page. This picks the right one, and always
 * reserves the border width so switching theme never shifts the layout.
 */
export function Card({ children, style, radius = radii.card, elevated = false }: Props) {
  const { isDark, fills } = useAppTheme();

  return (
    <Surface
      elevation={isDark ? 0 : elevated ? 2 : 1}
      style={[
        styles.base,
        { borderRadius: radius, borderColor: fills.hairline },
        style,
      ]}
    >
      {children}
    </Surface>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});
