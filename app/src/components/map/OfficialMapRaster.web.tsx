import { useEffect, useRef } from 'react';
import { MAX_MAP_IMAGE_EDGE, type OfficialMapRasterProps } from './mapViewport';

export function OfficialMapRaster({ uri, onReady, onError }: OfficialMapRasterProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const target = canvas.current;
    const context = target?.getContext('2d');
    if (!target || !context) {
      onError();
      return;
    }
    let active = true;
    const image = new window.Image();
    image.src = uri;
    void image.decode().then(() => {
      if (!active) return;
      const { naturalWidth, naturalHeight } = image;
      const scale = Math.min(1, MAX_MAP_IMAGE_EDGE / Math.max(naturalWidth, naturalHeight));
      target.width = Math.max(1, Math.round(naturalWidth * scale));
      target.height = Math.max(1, Math.round(naturalHeight * scale));
      context.imageSmoothingQuality = 'high';
      // Drawing an operator's cross-origin image is allowed without CORS.
      // The canvas is for display only, so it never reads pixels back.
      context.drawImage(image, 0, 0, target.width, target.height);
      onReady({ width: target.width, height: target.height });
    }).catch(() => {
      if (active) onError();
    }).finally(() => image.removeAttribute('src'));
    return () => {
      active = false;
      image.removeAttribute('src');
    };
  }, [uri, onReady, onError]);

  return <canvas ref={canvas} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />;
}
