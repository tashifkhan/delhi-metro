import { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { ActivityIndicator, FAB, Surface, Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useMapFamilyPrimaryQuery } from '../hooks';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { Touchable } from '../components/Touchable';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius } from '../theme';
import { useMetroNetwork } from '../network';
import { mapService } from '../services/mapService';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.5;
const DELHI_NETWORK_MAP_SOURCE = require('../../assets/delhi-metro-network-map-2026-07.jpg');

function getDistance(touches: { pageX: number; pageY: number }[]) {
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

function clampScale(val: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, val));
}

function clampTranslation(tx: number, ty: number, s: number, w: number, h: number) {
  const maxX = Math.max(0, (w * (s - 1)) / 2);
  const maxY = Math.max(0, (h * (s - 1)) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, tx)),
    y: Math.min(maxY, Math.max(-maxY, ty)),
  };
}

type HighResolutionMapImageProps = {
  canvasSize: { width: number; height: number };
  scale: Animated.Value;
  source: number | { uri: string };
  sourceKey: string;
  translateX: Animated.Value;
  translateY: Animated.Value;
};

function HighResolutionMapImage({
  canvasSize,
  scale,
  source,
  sourceKey,
  translateX,
  translateY,
}: HighResolutionMapImageProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  if (failed) {
    return (
      <ErrorState
        message="The complete network map could not be loaded"
        onRetry={() => {
          setFailed(false);
          setLoading(true);
          setRetryKey((value) => value + 1);
        }}
      />
    );
  }

  const imageWidth = Animated.multiply(scale, canvasSize.width);
  const imageHeight = Animated.multiply(scale, canvasSize.height);

  return (
    <>
      {loading && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.loader,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Loading high-resolution map...
          </Text>
        </View>
      )}
      <Animated.View
        style={{
          width: imageWidth,
          height: imageHeight,
          transform: [{ translateX }, { translateY }],
        }}
      >
        <Image
          key={`${sourceKey}:${retryKey}`}
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          allowDownscaling={false}
          cachePolicy="disk"
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      </Animated.View>
    </>
  );
}

export function MetroMapScreen() {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const { width } = useWindowDimensions();
  const { network, networkName } = useMetroNetwork();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useMapFamilyPrimaryQuery('network');
  const [downloading, setDownloading] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width, height: width });

  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const sv = useRef(1);
  const txv = useRef(0);
  const tyv = useRef(0);
  const lastDist = useRef<number | null>(null);
  const lastPan = useRef<{ x: number; y: number } | null>(null);
  const lastTapTime = useRef(0);

  const handleCanvasLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasSize({ width, height });
    }
  };

  const applyTransform = (newScale: number, newTx: number, newTy: number, animated = false) => {
    const s = clampScale(newScale);
    const { x, y } = clampTranslation(newTx, newTy, s, canvasSize.width, canvasSize.height);
    sv.current = s;
    txv.current = x;
    tyv.current = y;
    if (animated) {
      Animated.parallel([
        Animated.spring(scale, { toValue: s, useNativeDriver: false, speed: 20, bounciness: 2 }),
        Animated.spring(translateX, { toValue: x, useNativeDriver: true, speed: 20, bounciness: 2 }),
        Animated.spring(translateY, { toValue: y, useNativeDriver: true, speed: 20, bounciness: 2 }),
      ]).start();
    } else {
      scale.setValue(s);
      translateX.setValue(x);
      translateY.setValue(y);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        lastDist.current = null;
        lastPan.current = null;
        if (evt.nativeEvent.touches.length === 1) {
          lastPan.current = { x: evt.nativeEvent.touches[0].pageX, y: evt.nativeEvent.touches[0].pageY };
        }
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          lastPan.current = null;
          const dist = getDistance(touches as { pageX: number; pageY: number }[]);
          if (lastDist.current !== null) {
            applyTransform(sv.current * (dist / lastDist.current), txv.current, tyv.current);
          }
          lastDist.current = dist;
        } else if (touches.length === 1 && sv.current > 1) {
          lastDist.current = null;
          const touch = touches[0];
          if (lastPan.current) {
            applyTransform(sv.current, txv.current + (touch.pageX - lastPan.current.x), tyv.current + (touch.pageY - lastPan.current.y));
          }
          lastPan.current = { x: touch.pageX, y: touch.pageY };
        }
      },
      onPanResponderRelease: () => {
        lastDist.current = null;
        lastPan.current = null;
      },
    }),
  ).current;

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      applyTransform(sv.current > 1.2 ? MIN_SCALE : 2.5, 0, 0, true);
    }
    lastTapTime.current = now;
  };

  const handleZoomIn = () => applyTransform(sv.current + ZOOM_STEP, txv.current, tyv.current, true);
  const handleZoomOut = () => applyTransform(sv.current - ZOOM_STEP, txv.current, tyv.current, true);

  const handleDownloadMap = async () => {
    const asset = data?.image;
    if (!asset?.url) {
      Alert.alert('Unavailable', 'The network map is not available at the moment.');
      return;
    }
    try {
      setDownloading(true);
      const permission = await MediaLibrary.requestPermissionsAsync(true, []);
      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          'Allow photo saving to store the network map on your device.',
        );
        return;
      }

      const extension =
        asset.content_type?.toLowerCase().includes('png') ||
        asset.source_path.toLowerCase().endsWith('.png')
          ? 'png'
          : 'jpg';
      const fileUri =
        (FileSystem.cacheDirectory ?? '') + `${network}-metro-map.${extension}`;
      const downloadUrl = mapService.getProxyFileUrl('network', 'image', network);
      const { uri } = await FileSystem.downloadAsync(downloadUrl, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(
        'Map saved',
        `${networkName} network map was saved to your ${process.env.EXPO_OS === 'ios' ? 'Photos' : 'Gallery'}.`,
      );
    } catch {
      Alert.alert('Error', 'Failed to save the map. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading map..." />;
  if (isError) return <ErrorState message="Could not load map data" onRetry={refetch} />;

  const remoteImageUrl =
    network === 'nmrc' && data?.image
      ? mapService.getProxyFileUrl('network', 'image', network)
      : data?.image?.url;
  const imageSource =
    network === 'dmrc'
      ? DELHI_NETWORK_MAP_SOURCE
      : remoteImageUrl
        ? { uri: remoteImageUrl }
        : null;
  const imageSourceKey =
    network === 'dmrc' ? 'delhi-network-map-2026-07' : remoteImageUrl;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Canvas — fills all space between header and tab bar */}
      <View
        style={styles.canvas}
        onLayout={handleCanvasLayout}
        {...panResponder.panHandlers}
      >
        <Pressable onPress={handleDoubleTap} style={styles.canvasFill}>
          {imageSource && imageSourceKey ? (
            <HighResolutionMapImage
              key={imageSourceKey}
              source={imageSource}
              sourceKey={imageSourceKey}
              canvasSize={canvasSize}
              scale={scale}
              translateX={translateX}
              translateY={translateY}
            />
          ) : (
            <EmptyState
              title="Map unavailable"
              subtitle="The complete network map is not available right now"
              icon="map-outline"
            />
          )}
        </Pressable>
      </View>

      {/* Zoom controls — sibling of canvas, outside PanResponder */}
      <Surface
        style={[styles.zoomControls, { bottom: insets.bottom + spacing['2xl'] }]}
        elevation={3}
      >
        <Touchable
          radius={radius.iconSmall}
          onPress={handleZoomIn}
          accessibilityLabel="Zoom in"
          style={{ backgroundColor: fills.floating }}
        >
          <View style={styles.zoomBtn}>
            <Ionicons name="add" size={22} color={theme.colors.onSurface} />
          </View>
        </Touchable>
        <View style={[styles.zoomDivider, { backgroundColor: theme.colors.outlineVariant }]} />
        <Touchable
          radius={radius.iconSmall}
          onPress={handleZoomOut}
          accessibilityLabel="Zoom out"
          style={{ backgroundColor: fills.floating }}
        >
          <View style={styles.zoomBtn}>
            <Ionicons name="remove" size={22} color={theme.colors.onSurface} />
          </View>
        </Touchable>
      </Surface>

      {/* Download FAB — sibling of canvas, outside PanResponder */}
      <FAB
        icon={downloading ? 'progress-download' : 'download'}
        label="Save map"
        loading={downloading}
        disabled={downloading}
        onPress={handleDownloadMap}
        accessibilityLabel={`Save the ${networkName} network map to the device`}
        style={[styles.fab, { bottom: insets.bottom + spacing['2xl'] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
  },
  canvasFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 1,
  },
  noImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  zoomControls: {
    position: 'absolute',
    right: spacing.base,
    borderRadius: radius.icon,
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.sm,
  },
  fab: {
    position: 'absolute',
    left: spacing.base,
    borderRadius: radius.icon,
  },
});
