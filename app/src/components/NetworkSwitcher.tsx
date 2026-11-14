import { StyleSheet, View } from 'react-native';

import { NETWORK_NAMES, useMetroNetwork, type MetroNetwork } from '../network';
import { PillSegmented, type PillOption } from './PillSegmented';

const OPTIONS: PillOption<MetroNetwork>[] = [
  { value: 'dmrc', label: 'Delhi', accessibilityLabel: `Show ${NETWORK_NAMES.dmrc}` },
  { value: 'nmrc', label: 'Noida', accessibilityLabel: `Show ${NETWORK_NAMES.nmrc}` },
];

/**
 * Delhi / Noida switch for screens that show one operator at a time (alerts,
 * the official map). The pill segmented track needs a fixed width: its options
 * share the track equally, and the app bar would otherwise give it none.
 */
export function NetworkSwitcher({ compact = false }: { compact?: boolean }) {
  const { network, setNetwork } = useMetroNetwork();

  return (
    <View style={[styles.wrap, { width: compact ? 168 : 220 }]}>
      <PillSegmented
        options={OPTIONS}
        value={network}
        onChange={setNetwork}
        compact={compact}
        accessibilityLabel="Network"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // The app bar is taller than the track; centre it instead of stretching.
    alignSelf: 'center',
  },
});
