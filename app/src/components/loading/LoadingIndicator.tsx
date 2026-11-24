import { useEffect, useRef, useState } from 'react';
import { Animated as RNAnimated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { useAnimatedProps, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useTheme } from 'react-native-paper';
import { useAppTheme } from '../../theme/ThemeContext';
import { SHAPES, frameAt, morphPath } from './shapes';

interface Props {
  /** Outer size in points. 48 is the M3 default; full-screen states use more. */
  size?: number;
  /** Shape colour. Defaults to the theme's primary colour. */
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Share of the box the shape's furthest point reaches. Leaves room for the overshoot. */
const SHAPE_RATIO = 0.86;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Material 3 Expressive loading indicator: a shape that morphs through the
 * `MaterialShapes` sequence while it turns. Just the shape, with no container
 * circle behind it.
 *
 * On iOS and Android the path is computed on the UI thread by Reanimated, so a
 * loading screen costs no React renders. The web keeps a requestAnimationFrame
 * loop, which only re-renders this component. With reduce motion on, or the
 * app's animation setting at "none", the shape holds still; the label around it
 * still says the screen is working.
 */
export function LoadingIndicator({
  size = 48,
  color,
  style,
  accessibilityLabel = 'Loading',
}: Props) {
  const theme = useTheme();
  const { animationStyle, look } = useAppTheme();
  const still = animationStyle === 'none';
  const fill = color ?? theme.colors.primary;
  const c = size / 2;
  const radius = (size * SHAPE_RATIO) / 2;

  if (look.style === 'plain') {
    return (
      <View
        style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
      >
        <Ticker color={fill} dot={Math.max(4, Math.round(size / 10))} still={still} />
      </View>
    );
  }

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {still ? (
          <Path d={morphPath(SHAPES[0], SHAPES[0], 0, 0, radius, c, c)} fill={fill} />
        ) : Platform.OS === 'web' ? (
          <WebShape radius={radius} c={c} fill={fill} />
        ) : (
          <NativeShape radius={radius} c={c} fill={fill} />
        )}
      </Svg>
    </View>
  );
}

interface ShapeProps {
  radius: number;
  c: number;
  fill: string;
}

function NativeShape({ radius, c, fill }: ShapeProps) {
  const elapsed = useSharedValue(0);
  useFrameCallback((frame) => {
    elapsed.value += frame.timeSincePreviousFrame ?? 0;
  });
  const animatedProps = useAnimatedProps(() => {
    const f = frameAt(elapsed.value);
    return { d: morphPath(f.from, f.to, f.progress, f.rotation, radius, c, c) };
  });
  return <AnimatedPath animatedProps={animatedProps} fill={fill} />;
}

function WebShape({ radius, c, fill }: ShapeProps) {
  const [elapsed, setElapsed] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      if (start.current === null) start.current = now;
      setElapsed(now - start.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  const f = frameAt(elapsed);
  return <Path d={morphPath(f.from, f.to, f.progress, f.rotation, radius, c, c)} fill={fill} />;
}

/** Plain's loader: three dots that brighten in turn. */
function Ticker({ color, dot, still }: { color: string; dot: number; still: boolean }) {
  const [phase] = useState(() => new RNAnimated.Value(0));
  useEffect(() => {
    if (still) return undefined;
    const loop = RNAnimated.loop(
      RNAnimated.timing(phase, { toValue: 3, duration: 900, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, still]);
  return (
    <View style={{ flexDirection: 'row', gap: dot }}>
      {[0, 1, 2].map((i) => (
        <RNAnimated.View
          key={i}
          style={{
            width: dot,
            height: dot,
            backgroundColor: color,
            opacity: still
              ? 0.6
              : phase.interpolate({
                  inputRange: [0, i, i + 0.5, i + 1, 3],
                  outputRange: [0.25, 0.25, 1, 0.25, 0.25],
                  extrapolate: 'clamp',
                }),
          }}
        />
      ))}
    </View>
  );
}
