import { useEffect, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from 'react-native-paper';
import { useAppTheme } from '../../theme/ThemeContext';
import { SHAPES, frameAt, morphPath } from './shapes';

interface Props {
  /** Outer size in points. 48 is the M3 default; full-screen states use more. */
  size?: number;
  /** Draw the circular primaryContainer behind the shape (ContainedLoadingIndicator). */
  contained?: boolean;
  /** Shape colour. Defaults to onPrimaryContainer when contained, primary otherwise. */
  color?: string;
  containerColor?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Shape size relative to the container, from M3's 38dp-in-48dp spec. */
const ACTIVE_RATIO = 38 / 48;

/**
 * Material 3 Expressive loading indicator: a shape that morphs through the
 * `MaterialShapes` sequence while it turns.
 *
 * Drawn with react-native-svg so web, iOS and Android look the same. One
 * requestAnimationFrame loop updates a single path. With reduce motion on, or
 * the app's animation setting at "none", the shape holds still; the label
 * around it still says the screen is working.
 */
export function LoadingIndicator({
  size = 48,
  contained = true,
  color,
  containerColor,
  style,
  accessibilityLabel = 'Loading',
}: Props) {
  const theme = useTheme();
  const { animationStyle } = useAppTheme();
  const still = animationStyle === 'none';
  const [elapsed, setElapsed] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (still) return undefined;
    let frame = 0;
    const tick = (now: number) => {
      if (start.current === null) start.current = now;
      setElapsed(now - start.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [still]);

  const c = size / 2;
  const radius = (size * ACTIVE_RATIO) / 2;
  const d = still
    ? morphPath(SHAPES[0], SHAPES[0], 0, 0, radius, c, c)
    : (() => {
        const f = frameAt(elapsed);
        return morphPath(f.from, f.to, f.progress, f.rotation, radius, c, c);
      })();

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {contained ? (
          <Circle cx={c} cy={c} r={c} fill={containerColor ?? theme.colors.primaryContainer} />
        ) : null}
        <Path
          d={d}
          fill={color ?? (contained ? theme.colors.onPrimaryContainer : theme.colors.primary)}
        />
      </Svg>
    </View>
  );
}
