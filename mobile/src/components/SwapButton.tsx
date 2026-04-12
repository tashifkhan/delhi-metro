import { IconButton, useTheme } from 'react-native-paper';

interface Props {
  onPress: () => void;
}

export function SwapButton({ onPress }: Props) {
  const theme = useTheme();

  return (
    <IconButton
      icon="swap-vertical"
      mode="contained-tonal"
      size={20}
      onPress={onPress}
      containerColor={theme.colors.primaryContainer}
      iconColor={theme.colors.onPrimaryContainer}
    />
  );
}
