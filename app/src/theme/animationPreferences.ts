export const ANIMATION_STYLES = ['slide', 'fade', 'none'] as const;
export type AnimationStyle = typeof ANIMATION_STYLES[number];

export function readAnimationStyle(value: unknown): AnimationStyle {
  return ANIMATION_STYLES.includes(value as AnimationStyle)
    ? value as AnimationStyle
    : 'slide';
}

export function animationPreference(style: AnimationStyle, reduceMotion: boolean) {
  const active = reduceMotion ? 'none' : style;
  return {
    style: active,
    stack: active === 'slide' ? 'slide_from_right' : active,
    tabs: active === 'slide' ? 'shift' : active,
  } as const;
}
