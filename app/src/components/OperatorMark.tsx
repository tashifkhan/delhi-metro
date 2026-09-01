import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { NETWORK_NAMES } from '../network';
import type { MetroNetwork } from '../types';

/**
 * The operators' own roundels, taken from their published logos.
 *
 * A station list mixes both networks, so each row needs to say which one runs
 * it. The marks read faster than a text chip and stay legible at badge size,
 * where "Delhi Metro" would crowd the line badges beside it.
 */
const MARKS: Record<MetroNetwork, ReturnType<typeof require>> = {
  dmrc: require('../../assets/operators/dmrc.png'),
  nmrc: require('../../assets/operators/nmrc.png'),
};

interface Props {
  network: MetroNetwork;
  size?: number;
}

export function OperatorMark({ network, size = 18 }: Props) {
  return (
    <Image
      source={MARKS[network]}
      style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }]}
      contentFit="contain"
      accessibilityLabel={NETWORK_NAMES[network]}
      accessible
    />
  );
}

const styles = StyleSheet.create({
  mark: {
    // The roundels carry their own white field, so no tint or background.
    backgroundColor: 'transparent',
  },
});
