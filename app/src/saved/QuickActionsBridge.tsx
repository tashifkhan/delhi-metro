import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as QuickActions from 'expo-quick-actions';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useSaved } from './SavedContext';
import { shortcutsFor, MAX_SHORTCUTS } from './shortcuts';
import type { RootTabParamList } from '../navigation/types';

type NavRef = NavigationContainerRefWithCurrent<RootTabParamList>;

function open(ref: NavRef, action: QuickActions.Action) {
  const code = action.params?.code;
  const name = action.params?.name;
  if (typeof code !== 'string' || typeof name !== 'string') return;
  const go = () =>
    ref.navigate('HomeTab', { screen: 'Home', params: { presetFrom: { code, name }, openTo: true } });
  if (ref.isReady()) {
    go();
    return;
  }
  // Cold start: the navigator mounts after first-launch setup or settings load.
  const timer = setInterval(() => {
    if (!ref.isReady()) return;
    clearInterval(timer);
    go();
  }, 100);
  setTimeout(() => clearInterval(timer), 10_000);
}

/**
 * Keeps the app icon's long-press menu in step with saved places ("From
 * Home"), and opens Plan from there with the place filled in and the To
 * picker open. iOS and Android only.
 */
export function QuickActionsBridge({ navigationRef }: { navigationRef: NavRef }) {
  const { places, loaded } = useSaved();

  useEffect(() => {
    if (!loaded || Platform.OS === 'web') return;
    const limit = Math.min(MAX_SHORTCUTS, QuickActions.maxCount ?? MAX_SHORTCUTS);
    void QuickActions.setItems(shortcutsFor(places, limit)).catch(() => undefined);
  }, [places, loaded]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    if (QuickActions.initial) open(navigationRef, QuickActions.initial);
    const subscription = QuickActions.addListener((action) => open(navigationRef, action));
    return () => subscription.remove();
  }, [navigationRef]);

  return null;
}
