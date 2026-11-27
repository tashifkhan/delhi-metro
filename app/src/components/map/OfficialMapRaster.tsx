import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Image, type ImageRef } from 'expo-image';
import { MAX_MAP_IMAGE_EDGE, type OfficialMapRasterProps } from './mapViewport';

export function OfficialMapRaster({ uri, onReady, onError }: OfficialMapRasterProps) {
  const [image, setImage] = useState<ImageRef | null>(null);
  useEffect(() => {
    let active = true;
    let loaded: ImageRef | null = null;
    Image.loadAsync(uri, { maxWidth: MAX_MAP_IMAGE_EDGE, maxHeight: MAX_MAP_IMAGE_EDGE })
      .then((result) => {
        if (!active) {
          result.release();
          return;
        }
        loaded = result;
        setImage(result);
        onReady({ width: result.width, height: result.height });
      })
      .catch(() => {
        if (active) onError();
      });
    return () => {
      active = false;
      loaded?.release();
    };
  }, [uri, onReady, onError]);

  return image ? (
    <Image source={image} style={StyleSheet.absoluteFill} contentFit="contain" allowDownscaling={false} onError={onError} />
  ) : null;
}
