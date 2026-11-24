import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { NETWORK_NAMES } from '../network';
import type { MetroNetwork } from '../types';

/**
 * The operators' own roundels, taken from their published logos.
 *
 * A station list mixes both networks, so each row needs to say which one runs
 * it. The marks read faster than a text chip and stay legible at badge size,
 * where "Delhi Metro" would crowd the line badges beside it.
 */
const MARKS: Partial<Record<MetroNetwork, ReturnType<typeof require>>> = {
  dmrc: require('../../assets/operators/dmrc.png'),
  nmrc: require('../../assets/operators/nmrc.png'),
};

interface Props {
  network: MetroNetwork;
  size?: number;
}

/** NCRTC has no roundel in the app, so it gets lettering in Namo Bharat's orange. */
const LETTERS: Partial<Record<MetroNetwork, { text: string; color: string }>> = {
  ncrtc: { text: 'NB', color: '#D9632E' },
};

export function OperatorMark({ network, size = 18 }: Props) {
  const mark = MARKS[network];
  const letters = LETTERS[network];
  if (!mark) {
    return (
      <View
        accessible
        accessibilityLabel={NETWORK_NAMES[network]}
        style={[styles.letters, { width: size, height: size, borderRadius: size / 2, backgroundColor: letters?.color ?? '#666' }]}
      >
        <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '700' }}>{letters?.text ?? '?'}</Text>
      </View>
    );
  }
  return (
    <Image
      source={mark}
      style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }]}
      contentFit="contain"
      accessibilityLabel={NETWORK_NAMES[network]}
      accessible
    />
  );
}

const styles = StyleSheet.create({
  letters: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    // The roundels carry their own white field, so no tint or background.
    backgroundColor: 'transparent',
  },
});
