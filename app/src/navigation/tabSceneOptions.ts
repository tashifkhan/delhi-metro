import { SceneStyleInterpolators, type BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { ViewStyle } from 'react-native';
import { animationPreference, type AnimationStyle } from '../theme/animationPreferences';

const centeredScene: ViewStyle = { opacity: 1, transform: [{ translateX: 0 }] };

const fadeInPlace: NonNullable<BottomTabNavigationOptions['sceneStyleInterpolator']> = (props) => {
  const { sceneStyle } = SceneStyleInterpolators.forFade(props);
  return {
    sceneStyle: [
      sceneStyle,
      {
        // A mounted tab can retain the native shift transform after the
        // animation preference changes. Write zero on the native driver too.
        transform: [{
          translateX: props.current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [0, 0, 0],
          }),
        }],
      },
    ],
  };
};

export function tabSceneOptions(style: AnimationStyle): BottomTabNavigationOptions {
  const animation = animationPreference(style, false).tabs;
  return {
    animation,
    sceneStyle: centeredScene,
    sceneStyleInterpolator: animation === 'fade' ? fadeInPlace : undefined,
  };
}
