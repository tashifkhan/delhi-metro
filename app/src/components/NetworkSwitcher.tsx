import { View } from 'react-native';

import { NETWORK_NAMES, useMetroNetwork, type MetroNetwork } from '../network';
import { PillSegmented, type PillOption } from './PillSegmented';

const OPTIONS: PillOption<MetroNetwork>[] = [
  { value: 'dmrc', label: 'Delhi', accessibilityLabel: `Show ${NETWORK_NAMES.dmrc}` },
  { value: 'nmrc', label: 'Noida', accessibilityLabel: `Show ${NETWORK_NAMES.nmrc}` },
  { value: 'ncrtc', label: 'Namo Bharat', accessibilityLabel: 'Show Namo Bharat and Meerut Metro map' },
];

/**
 * Operator switch for the official map, the one view that shows one
 * operator's map at a time.
 */
export function NetworkSwitcher({ wide }: { wide: boolean }) {
  const { network, setNetwork } = useMetroNetwork();

  return (
    <View style={wide ? { width: 264 } : undefined}>
      <PillSegmented
        options={OPTIONS}
        value={network}
        onChange={setNetwork}
        compact={wide}
        accessibilityLabel="Choose an official map"
      />
    </View>
  );
}
