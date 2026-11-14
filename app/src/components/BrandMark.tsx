import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from 'react-native-paper';

interface Props {
  size?: number;
  /** Tile colour. Defaults to the theme's primary container. */
  background?: string;
  /** Leave the tile out, for places that already draw one. */
  bare?: boolean;
}

/**
 * The app mark: two metro lines crossing at an interchange ring.
 *
 * A piece of network map says "metro" more precisely than a train glyph, and
 * two lines meeting is what the app does: Delhi and Noida in one planner. The
 * line colours come from the theme so the mark follows the palette.
 */
export function BrandMark({ size = 40, background, bare = false }: Props) {
  const theme = useTheme();
  const tile = background ?? theme.colors.primaryContainer;
  const ink = theme.colors.onPrimaryContainer;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="NCR Metro">
      {bare ? null : <Rect x={0} y={0} width={48} height={48} rx={15} fill={tile} />}
      {/* North-south line */}
      <Path
        d="M23 7 V41"
        stroke={theme.colors.tertiary}
        strokeWidth={5.5}
        strokeLinecap="round"
        fill="none"
      />
      {/* East-west line, bending at 45 degrees through the interchange */}
      <Path
        d="M7 36 H14 L32 18 H41"
        stroke={theme.colors.primary}
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={23} cy={27} r={6} fill={bare ? theme.colors.surface : tile} stroke={ink} strokeWidth={3} />
    </Svg>
  );
}
