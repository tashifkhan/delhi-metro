import { useHaptics } from '../hooks/useHaptics';
import { IconButton, useTheme } from 'react-native-paper';

interface Props {
  onPress: () => void;
}

export function SwapButton({ onPress }: Props) {
  const theme = useTheme();
  const haptics = useHaptics();

  return (
    <IconButton
      icon="swap-vertical"
      mode="contained-tonal"
      size={20}
      onPress={() => { haptics.press(); onPress(); }}
      containerColor={theme.colors.primaryContainer}
      iconColor={theme.colors.onPrimaryContainer}
    />
  );
}
