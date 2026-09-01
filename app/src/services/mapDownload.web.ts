import type { SaveNetworkMapOptions } from './mapDownload';

/**
 * Browser download of the network map.
 *
 * The API's `/file` endpoint streams the asset from this same origin, so a
 * plain anchor with `download` is enough — no blob buffering, and the browser
 * shows its own progress. `react-native`'s `Alert` is a no-op on web, so the
 * user-facing messages go through `window.alert` here.
 */
export async function saveNetworkMap({
  downloadUrl,
  extension,
  network,
}: SaveNetworkMapOptions): Promise<void> {
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = `${network}-metro-map.${extension}`;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function notifyMapUnavailable(): void {
  window.alert('The network map is not available at the moment.');
}

export function notifyMapSaveFailed(): void {
  window.alert('Failed to download the map. Please try again.');
}
