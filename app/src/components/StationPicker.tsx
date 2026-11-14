import { useHaptics } from '../hooks/useHaptics';
import { useState } from 'react';
import { FlatList, Modal, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import { StationCard } from './StationCard';
import { StationListSkeleton } from './StationListSkeleton';
import { StationSearchBar } from './StationSearchBar';
import { Touchable } from './Touchable';
import { EmptyState } from './EmptyState';
import { useStationSearchQuery } from '../hooks';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { spacing, radius, emphasis } from '../theme';
import type { StationSearchResult } from '../types';

interface Props {
  visible: boolean;
  onSelect: (station: { code: string; name: string }) => void;
  onClose: () => void;
  title?: string;
  selectedCode?: string;
}

/**
 * Full-height sheet for picking a station: title and close button, the same
 * search bar as the Search tab, then the segmented result list.
 */
export function StationPicker({ visible, onSelect, onClose, title = 'Choose a station', selectedCode }: Props) {
  const theme = useTheme();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const [searchText, setSearchText] = useState('');
  // Filtering runs against the catalog already in memory, so waiting out a
  // debounce only makes the list lag behind the keys.
  const { data: results, isLoading } = useStationSearchQuery(searchText);
  const data = results ?? [];

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
              style={[emphasis.medium, styles.title, { color: theme.colors.onSurface }]}
            >
              {title}
            </Text>
            <Touchable
              radius={radius.pill}
              onPress={() => {
                haptics.navigate();
                handleClose();
              }}
              accessibilityLabel="Close station picker"
            >
              <View style={styles.close}>
                <Ionicons name="close" size={24} color={theme.colors.onSurface} />
              </View>
            </Touchable>
          </View>

          <View style={styles.barWrap}>
            <StationSearchBar
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search Delhi and Noida stations"
              autoFocus
            />
          </View>

          {isLoading ? (
            <StationListSkeleton />
          ) : (
            <FlatList
              data={data}
              keyExtractor={(item) => `${item.network ?? 'dmrc'}:${item.station_code}`}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.list}
              renderItem={({ item, index }) => (
                <StationCard
                  station={item}
                  selected={item.station_code === selectedCode}
                  onPress={() => handleSelect(item)}
                  showChevron={false}
                  network={item.network}
                  first={index === 0}
                  last={index === data.length - 1}
                />
              )}
              ListEmptyComponent={
                <EmptyState
                  title="No stations found"
                  subtitle={
                    searchText.trim()
                      ? `Nothing matches "${searchText.trim()}"`
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
    borderRadius: 28,
    overflow: 'hidden',
    paddingBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  title: {
    flex: 1,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barWrap: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  list: {
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
});
