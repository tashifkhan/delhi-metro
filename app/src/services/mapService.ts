import { apiClient } from '../api/client';
import { catalogCache, type Cached } from '../storage/catalogCache';
import type {
  MapAsset,
  MapAssetByFormatResponse,
  MapAssetListResponse,
  MapFamily,
  MapFormat,
} from '../types';
import type { MetroNetwork } from '../network';

const API_V1 = '/api/v1';

export const mapService = {
  getAllAssets(network: MetroNetwork = 'dmrc'): Promise<MapAssetListResponse> {
    return apiClient.get<MapAssetListResponse>(`${API_V1}/${network}/maps/assets`);
  },

  getFamilyAssets(
    family: MapFamily,
    format: MapFormat = 'any',
    network: MetroNetwork = 'dmrc',
  ): Promise<MapAssetListResponse> {
    return apiClient.get<MapAssetListResponse>(`${API_V1}/${network}/maps/${family}/assets`, {
      query: { format },
    });
  },

  /** The last network-map metadata this device stored, if any. */
  async getCachedFamilyPrimaryMaps(
    family: MapFamily,
    network: MetroNetwork = 'dmrc',
  ): Promise<Cached<MapAssetByFormatResponse> | null> {
    if (family !== 'network') return null;
    const stored = await catalogCache.readMap(network);
    if (!stored) return null;
    return { data: stored.payload, savedAt: stored.savedAt, fromCache: true };
  },

  /**
   * The network map's metadata is cached so the Noida map still opens from
   * the last URL `expo-image` stored on disk. Other families are not shown
   * offline and stay live.
   */
  getFamilyPrimaryMaps(
    family: MapFamily,
    network: MetroNetwork = 'dmrc',
    shown?: Cached<MapAssetByFormatResponse>,
  ): Promise<Cached<MapAssetByFormatResponse> | MapAssetByFormatResponse> {
    const load = () =>
      apiClient.get<MapAssetByFormatResponse>(`${API_V1}/${network}/maps/${family}`);
    if (family === 'network') {
      return catalogCache.map(network, load, shown);
    }
    return load();
  },

  getAssetById(assetId: string): Promise<MapAsset> {
    return apiClient.get<MapAsset>(`${API_V1}/dmrc/maps/assets/${assetId}`);
  },

  getDownloadUrl(
    family: MapFamily,
    format: MapFormat = 'any',
    network: MetroNetwork = 'dmrc',
  ): string {
    const query = new URLSearchParams({ format }).toString();
    return `${apiClient.baseUrl}${API_V1}/${network}/maps/${family}/download?${query}`;
  },

  getProxyFileUrl(
    family: MapFamily,
    format: MapFormat = 'any',
    network: MetroNetwork = 'dmrc',
  ): string {
    const query = new URLSearchParams({ format }).toString();
    return `${apiClient.baseUrl}${API_V1}/${network}/maps/${family}/file?${query}`;
  },
};
