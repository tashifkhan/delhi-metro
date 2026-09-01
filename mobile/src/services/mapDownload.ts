import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import type { MetroNetwork } from '../network';

export interface SaveNetworkMapOptions {
  downloadUrl: string;
  extension: 'png' | 'jpg';
  network: MetroNetwork;
  networkName: string;
}

/**
 * Save the network map to the device gallery.
 *
 * The web build swaps in `mapDownload.web.ts`, which hands the file to the
 * browser instead — `expo-media-library` has no meaningful web behaviour.
 */
export async function saveNetworkMap({
  downloadUrl,
  extension,
  network,
  networkName,
}: SaveNetworkMapOptions): Promise<void> {
  const permission = await MediaLibrary.requestPermissionsAsync(true, []);
  if (!permission.granted) {
    Alert.alert(
      'Permission needed',
      'Allow photo saving to store the network map on your device.',
    );
    return;
  }

  const fileUri = (FileSystem.cacheDirectory ?? '') + `${network}-metro-map.${extension}`;
  const { uri } = await FileSystem.downloadAsync(downloadUrl, fileUri);
  await MediaLibrary.saveToLibraryAsync(uri);

  Alert.alert(
    'Map saved',
    `${networkName} network map was saved to your ${
      process.env.EXPO_OS === 'ios' ? 'Photos' : 'Gallery'
    }.`,
  );
}

export function notifyMapUnavailable(): void {
  Alert.alert('Unavailable', 'The network map is not available at the moment.');
}

export function notifyMapSaveFailed(): void {
  Alert.alert('Error', 'Failed to save the map. Please try again.');
}
