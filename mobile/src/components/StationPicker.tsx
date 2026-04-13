import { FlatList, Modal, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, IconButton, Searchbar, Surface, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { LineBadge } from './LineBadge';
import { useDebounce, useStationSearchQuery } from '../hooks';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme';
import type { StationSearchResult } from '../types';

interface Props {
  visible: boolean;
  onSelect: (station: { code: string; name: string }) => void;
  onClose: () => void;
  title?: string;
}

export function StationPicker({ visible, onSelect, onClose, title = 'Select Station' }: Props) {
  const theme = useTheme();
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
            {title}
          </Text>
          <IconButton icon="close" onPress={handleClose} iconColor={theme.colors.onSurface} />
        </View>

        <Searchbar
          placeholder="Search station name..."
          value={searchText}
          onChangeText={setSearchText}
          autoFocus
          autoCapitalize="characters"
          style={[styles.searchbar, { backgroundColor: theme.colors.elevation.level3 }]}
          inputStyle={{ color: theme.colors.onSurface }}
          placeholderTextColor={theme.colors.outline}
          elevation={0}
        />

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <View style={[styles.loadingCard, { backgroundColor: isDark ? theme.colors.elevation.level2 : theme.colors.surfaceVariant }]}>
              <View style={[styles.loadingIcon, { backgroundColor: isDark ? theme.colors.elevation.level4 : theme.colors.primaryContainer }]}>
                <Ionicons name="train-outline" size={22} color={theme.colors.primary} />
              </View>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '500' }}>
                Searching stations...
              </Text>
            </View>
            {/* Skeleton rows */}
            {[0.6, 0.4, 0.25].map((opacity, i) => (
              <View key={i} style={[styles.skeletonRow, { opacity }]}>
                <View style={[styles.skeletonCircle, { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.surfaceVariant }]} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={[styles.skeletonBar, { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.surfaceVariant, width: '70%' }]} />
                  <View style={[styles.skeletonBar, { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.surfaceVariant, width: '40%', height: 10 }]} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={results ?? []}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const lineColor = item.metro_lines?.[0]?.primary_color_code;
              const iconBg = lineColor?.startsWith('#')
                ? lineColor + '20'
                : theme.colors.primaryContainer;
              return (
                <View style={styles.resultWrapper}>
                  <Surface
                    style={styles.resultCard}
                    elevation={isDark ? 2 : 1}
                  >
                    <TouchableRipple
                      onPress={() => handleSelect(item)}
                      rippleColor={theme.colors.primaryContainer}
                      borderless
                      style={styles.resultRipple}
                    >
                      <View style={styles.resultRow}>
                        <View style={[styles.resultIcon, { backgroundColor: iconBg }]}>
                          <Ionicons name="train" size={18} color={lineColor ?? theme.colors.onSurfaceVariant} />
                        </View>
                        <View style={styles.resultContent}>
                          <View style={styles.resultNameRow}>
                            <Text
                              variant="titleSmall"
                              style={{ color: theme.colors.onSurface, fontWeight: '600', flex: 1 }}
                              numberOfLines={1}
                            >
                              {item.station_name}
                            </Text>
                            <View style={[styles.resultCodeBadge, { backgroundColor: isDark ? theme.colors.elevation.level5 : theme.colors.background }]}>
                              <Text variant="labelSmall" style={{ color: theme.colors.primary, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                                {item.station_code}
                              </Text>
                            </View>
                          </View>
                          {!!item.metro_lines?.length && (
                            <View style={styles.badgesRow}>
                              {item.metro_lines.map((line) => (
                                <LineBadge
                                  key={`${item.station_code}-${line.line_code}`}
                                  name={line.line_color}
                                  color={line.primary_color_code}
                                  compact
                                />
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableRipple>
                  </Surface>
                </View>
              );
            }}
            ListEmptyComponent={
              isLoading ? null : (
                <View style={styles.emptyContainer}>
                  <View style={[styles.emptyIcon, { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.surfaceVariant }]}>
                    <Ionicons name="search-outline" size={28} color={theme.colors.outline} />
                  </View>
                  <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}>
                    No stations found
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.outline, textAlign: 'center' }}>
                    Try a different station name or code
                  </Text>
                </View>
              )
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: spacing.base,
    paddingTop: spacing.md,
  },
  searchbar: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: 999,
  },
  list: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  resultWrapper: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
  },
  resultCard: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  resultCardLight: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  resultRipple: {
    borderRadius: 18,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultContent: {
    flex: 1,
    gap: spacing.xs,
  },
  resultNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultCodeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  loadingCard: {
    borderRadius: 20,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  skeletonBar: {
    height: 14,
    borderRadius: 7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
});
