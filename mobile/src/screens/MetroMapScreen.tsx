import { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useMapFamilyPrimaryQuery } from '../hooks';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.5;

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

export function MetroMapScreen() {
  const theme = useTheme();
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useMapFamilyPrimaryQuery('network');
  const [imageLoading, setImageLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: SCREEN_WIDTH, height: SCREEN_WIDTH });

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
        Animated.spring(scale, { toValue: s, useNativeDriver: true, speed: 20, bounciness: 2 }),
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

  const handleDownloadPdf = async () => {
    if (!data?.pdf?.url) {
      Alert.alert('Unavailable', 'PDF map is not available at the moment.');
      return;
    }
    try {
      setDownloading(true);
      const fileUri = (FileSystem.cacheDirectory ?? '') + 'delhi-metro-map.pdf';
      const { uri } = await FileSystem.downloadAsync(data.pdf.url, fileUri);
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Delhi Metro Network Map' });
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Canvas — fills all space between header and tab bar */}
      <View
        style={styles.canvas}
        onLayout={handleCanvasLayout}
        {...panResponder.panHandlers}
      >
        <Pressable onPress={handleDoubleTap} style={styles.canvasFill}>
          {imageUrl ? (
            <>
              {imageLoading && (
                <View style={[StyleSheet.absoluteFill, styles.loader, { backgroundColor: theme.colors.background }]}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Loading network map...
                  </Text>
                </View>
              )}
              <Animated.View
                style={{ transform: [{ scale }, { translateX }, { translateY }] }}
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={{ width: canvasSize.width, height: canvasSize.height }}
                  resizeMode="contain"
                  onLoadEnd={() => setImageLoading(false)}
                />
              </Animated.View>
            </>
          ) : (
            <View style={styles.noImage}>
              <Ionicons name="image-outline" size={48} color={theme.colors.outline} />
              <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
                Map image not available
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Zoom controls — sibling of canvas, outside PanResponder */}
      <View style={[styles.zoomControls, { bottom: insets.bottom + spacing['2xl'] }]} pointerEvents="box-none">
        <Pressable
          style={[styles.zoomBtn, { backgroundColor: isDark ? theme.colors.elevation.level4 : theme.colors.surface }]}
          onPress={handleZoomIn}
        >
          <Ionicons name="add" size={22} color={theme.colors.onSurface} />
        </Pressable>
        <Pressable
          style={[styles.zoomBtn, { backgroundColor: isDark ? theme.colors.elevation.level4 : theme.colors.surface }]}
          onPress={handleZoomOut}
        >
          <Ionicons name="remove" size={22} color={theme.colors.onSurface} />
        </Pressable>
      </View>

      {/* FAB — sibling of canvas, outside PanResponder */}
      <Pressable
        style={[
          styles.fab,
          {
            bottom: insets.bottom + spacing['2xl'],
            left: spacing.base,
            backgroundColor: downloading ? theme.colors.surfaceVariant : theme.colors.primary,
          },
        ]}
        onPress={handleDownloadPdf}
        disabled={downloading}
      >
        {downloading
          ? <ActivityIndicator size={26} color={theme.colors.onSurfaceVariant} />
          : <Ionicons name="download-outline" size={26} color={theme.colors.onPrimary} />
        }
      </Pressable>
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
    gap: spacing.sm,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  fab: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
