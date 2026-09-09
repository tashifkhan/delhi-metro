import { createContext, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import { AlertsStack } from './AlertsStack';
import { ExploreStack } from './ExploreStack';
import { HomeStack } from './HomeStack';
import { LinesStack } from './LinesStack';
import { MapStack } from './MapStack';
import { useHaptics } from '../hooks/useHaptics';
import { DesktopShell, type DesktopTab } from '../components/web/DesktopShell';

/**
 * Desktop web root. The same five stacks as the mobile tab bar, switched from
 * a persistent sidebar. Only the active stack mounts, so each tab keeps its
 * own push history while it is selected.
 *
 * Content is centred in a max-width column: without the constraint every
 * screen stretches to the full window and reads as a blown-up phone. The map
 * is the exception — it wants every pixel, so it stays full-bleed.
 */
const CONTENT_MAX_WIDTH = 920;

const DesktopTabsContext = createContext<{ selectTab: (tab: DesktopTab) => void } | null>(
  null,
);

/**
 * Cross-tab links (e.g. Home's "view alerts" banner) call
 * `navigation.getParent()?.navigate('AlertsTab')` on mobile. On desktop there
 * is no parent tab navigator, so screens use this instead: it switches the
 * sidebar tab when inside the desktop shell and is null elsewhere.
 */
export function useDesktopTabs() {
  return useContext(DesktopTabsContext);
}

export function DesktopRoot() {
  const theme = useTheme();
  const haptics = useHaptics();
  const [active, setActive] = useState<DesktopTab>('HomeTab');

  const handleSelect = (tab: DesktopTab) => {
    if (tab !== active) haptics.select();
    setActive(tab);
  };

  const fullBleed = active === 'MapTab';

  return (
    <DesktopTabsContext.Provider value={{ selectTab: handleSelect }}>
    <View style={[styles.shell, { backgroundColor: theme.colors.background }]}>
      <DesktopShell active={active} onSelect={handleSelect} />
      <View style={styles.main}>
        <View
          style={[
            styles.content,
            // Remount the stack on tab switch so a lingering detail route
            // from one tab can never render inside another.
            fullBleed && styles.contentFullBleed,
            !fullBleed && { maxWidth: CONTENT_MAX_WIDTH },
          ]}
        >
          {active === 'HomeTab' && <HomeStack key="HomeTab" />}
          {active === 'SearchTab' && <ExploreStack key="SearchTab" />}
          {active === 'LinesTab' && <LinesStack key="LinesTab" />}
          {active === 'MapTab' && <MapStack key="MapTab" />}
          {active === 'AlertsTab' && <AlertsStack key="AlertsTab" />}
        </View>
      </View>
    </View>
    </DesktopTabsContext.Provider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
  },
  main: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
  },
  contentFullBleed: {
    maxWidth: undefined,
  },
});
