import { useHaptics } from '../hooks/useHaptics';
import { useState } from 'react';
import { FlatList, Modal, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Searchbar, Text, useTheme } from 'react-native-paper';
import { StationCard } from './StationCard';
import { StationListSkeleton } from './StationListSkeleton';
import { EmptyState } from './EmptyState';
import { useDebounce, useStationSearchQuery } from '../hooks';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, emphasis } from '../theme';
import type { StationSearchResult } from '../types';

interface Props {
  visible: boolean;
  onSelect: (station: { code: string; name: string }) => void;
  onClose: () => void;
  title?: string;
  selectedCode?: string;
}

export function StationPicker({ visible, onSelect, onClose, title = 'Select Station', selectedCode }: Props) {
  const theme = useTheme();
  const haptics = useHaptics();
  const { fills } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const [searchText, setSearchText] = useState('');
  const debouncedQuery = useDebounce(searchText, 300);
  const { data: results, isLoading } = useStationSearchQuery(debouncedQuery);

  const handleSelect = (station: StationSearchResult) => {
    onSelect({ code: station.station_code, name: station.station_name });
    setSearchText('');
  };

  const handleClose = () => {
    setSearchText('');
    onClose();
  };

  // A pageSheet already sits below the status bar on iOS, so applying the top
  // inset there would leave a second, empty gap above the title.
  const topPadding = Platform.OS === 'ios' ? spacing.sm : insets.top;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      transparent={isDesktop}
    >
      <View style={[styles.backdrop, isDesktop && styles.backdropDesktop]}>
        <View
          style={[
            styles.container,
            { paddingTop: topPadding, backgroundColor: theme.colors.background },
            isDesktop && styles.containerDesktop,
          ]}
        >
        <View style={styles.header}>
          <Text
            variant="headlineSmall"
            style={[emphasis.heavy, styles.title, { color: theme.colors.onSurface }]}
          >
            {title}
          </Text>
          <IconButton
            icon="close"
            onPress={() => { haptics.navigate(); handleClose(); }}
            iconColor={theme.colors.onSurfaceVariant}
            accessibilityLabel="Close station picker"
          />
        </View>

        <Searchbar
          placeholder="Search both metro networks"
          value={searchText}
          onChangeText={setSearchText}
          autoFocus
          autoCapitalize="characters"
          style={[styles.searchbar, { backgroundColor: fills.subtle }]}
          inputStyle={{ color: theme.colors.onSurface }}
          placeholderTextColor={theme.colors.outline}
          elevation={0}
        />

        {isLoading ? (
          <StationListSkeleton />
        ) : (
          <FlatList
            data={results ?? []}
            keyExtractor={(item) => `${item.network ?? 'dmrc'}:${item.station_code}`}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <StationCard
                station={item}
                selected={item.station_code === selectedCode}
                onPress={() => handleSelect(item)}
                showChevron={false}
                network={item.network}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                title="No stations found"
                subtitle={
                  debouncedQuery.trim()
                    ? `Nothing matches "${debouncedQuery.trim()}"`
                    : 'Try a different station name or code'
                }
                icon="search-outline"
              />
            }
          />
        )}
      </View>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  // On desktop the sheet becomes a centred dialog over the content instead of
  // a full-screen page.
  backdropDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  container: {
    flex: 1,
  },
  containerDesktop: {
    flex: undefined,
    width: '100%',
    maxWidth: 600,
    maxHeight: '85%',
    borderRadius: radius.card,
    overflow: 'hidden',
    paddingBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    flex: 1,
  },
  searchbar: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: radius.pill,
  },
  list: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
});
