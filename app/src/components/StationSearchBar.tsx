import { forwardRef } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Touchable } from './Touchable';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * M3 search bar: a 56pt pill on the high surface container, search glyph on
 * the left and a clear button once there is text. Shared by the Search tab and
 * the station picker so both look and behave the same.
 */
export const StationSearchBar = forwardRef<TextInput, Props>(function StationSearchBar(
  { value, onChangeText, placeholder = 'Search stations', autoFocus },
  ref,
) {
  const theme = useTheme();
  const { fills } = useAppTheme();

  return (
    <View style={[styles.bar, { backgroundColor: fills.containerHigh }]}>
      <Ionicons name="search" size={22} color={theme.colors.onSurfaceVariant} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={placeholder}
        style={[
          styles.input,
          { color: theme.colors.onSurface, fontFamily: theme.fonts.bodyLarge.fontFamily },
          // The browser focus ring would draw a rectangle inside the pill.
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
        ]}
      />
      {value.length > 0 ? (
        <Touchable
          radius={radius.pill}
          haptic="select"
          onPress={() => onChangeText('')}
          accessibilityLabel="Clear search"
        >
          <View style={styles.clear}>
            <Ionicons name="close" size={20} color={theme.colors.onSurfaceVariant} />
          </View>
        </Touchable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: 18,
    paddingRight: spacing.xs,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
  },
  clear: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
