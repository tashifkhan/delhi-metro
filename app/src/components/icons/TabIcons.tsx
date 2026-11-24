import Svg, { Circle, Path } from 'react-native-svg';

export type TabIconName = 'plan' | 'map' | 'network' | 'saved' | 'alerts';

interface Props {
  name: TabIconName;
  focused: boolean;
  color: string;
  size?: number;
}

/**
 * The five tab icons, drawn as SVG so the tab bar doesn't depend on an icon
 * font. Plan, Map, Saved and Alerts follow Lucide's route, map, bookmark and
 * megaphone (ISC licence); Network is our own: two lines joined at an
 * interchange.
 *
 * Focused icons get a heavier stroke, and the bookmark fills in, so the
 * selected tab reads without relying on colour alone.
 */
export function TabIcon({ name, focused, color, size = 24 }: Props) {
  const stroke = {
    stroke: color,
    strokeWidth: focused ? 2.2 : 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {name === 'plan' && (
        <>
          <Circle cx={6} cy={19} r={3} {...stroke} />
          <Path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" {...stroke} />
          <Circle cx={18} cy={5} r={3} {...stroke} fill={focused ? color : 'none'} />
        </>
      )}
      {name === 'map' && (
        <>
          <Path d="M3 6.6 9 4l6 2.6L21 4v13.4L15 20l-6-2.6L3 20z" {...stroke} />
          <Path d="M9 4v13.4M15 6.6V20" {...stroke} />
        </>
      )}
      {name === 'network' && (
        <>
          <Path d="M6 3v18M18 3v18M6 12h12" {...stroke} />
          <Circle cx={6} cy={12} r={2.2} {...stroke} fill={color} />
          <Circle cx={18} cy={12} r={2.2} {...stroke} fill={color} />
        </>
      )}
      {name === 'saved' && (
        <Path
          d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
          {...stroke}
          fill={focused ? color : 'none'}
        />
      )}
      {name === 'alerts' && (
        <>
          <Path d="m3 11 18-5v12L3 14z" {...stroke} fill={focused ? color : 'none'} />
          <Path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" {...stroke} />
        </>
      )}
    </Svg>
  );
}
