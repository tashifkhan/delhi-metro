import { useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import { useMapFamilyPrimaryQuery } from '../hooks';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { colors, spacing, typography } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function MetroMapScreen() {
  const { data, isLoading, isError, refetch } = useMapFamilyPrimaryQuery('network');
  const [imageLoading, setImageLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!data?.pdf?.url) {
      Alert.alert('Unavailable', 'PDF map is not available at the moment.');
      return;
    }
    try {
      setDownloading(true);
      const response = await fetch(data.pdf.url);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const file = new File('cache', 'delhi-metro-map.pdf');
      file.write(new Uint8Array(arrayBuffer));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf' });
    } catch {
      Alert.alert('Error', 'Failed to download the map. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading map..." />;
  if (isError) return <ErrorState message="Could not load map data" onRetry={refetch} />;

  const imageUrl = data?.image?.url;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        maximumZoomScale={5}
        minimumZoomScale={1}
        bouncesZoom
        showsVerticalScrollIndicator={false}
      >
        {imageUrl ? (
          <>
            {imageLoading && (
              <View style={styles.imageLoader}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.imageLoaderText}>Loading network map...</Text>
              </View>
            )}
            <Image
              source={{ uri: imageUrl }}
              style={styles.mapImage}
              resizeMode="contain"
              onLoadEnd={() => setImageLoading(false)}
            />
          </>
        ) : (
          <View style={styles.noImage}>
            <Ionicons name="image-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.noImageText}>Map image not available</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actionBar}>
        <Text style={styles.hint}>Pinch to zoom</Text>
        <Pressable
          style={({ pressed }) => [styles.downloadButton, pressed && styles.downloadPressed]}
          onPress={handleDownloadPdf}
          disabled={downloading}
        >
          {downloading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="download-outline" size={20} color={colors.white} />
          )}
          <Text style={styles.downloadText}>
            {downloading ? 'Downloading...' : 'Download PDF'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.3,
  },
  imageLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  imageLoaderText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  noImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  noImageText: {
    fontSize: typography.sizes.body,
    color: colors.textTertiary,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hint: {
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  downloadPressed: {
    backgroundColor: colors.primaryDark,
  },
  downloadText: {
    color: colors.white,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
});
