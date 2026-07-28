import { apiClient } from '../api/client';
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

  getFamilyPrimaryMaps(
    family: MapFamily,
    network: MetroNetwork = 'dmrc',
  ): Promise<MapAssetByFormatResponse> {
    return apiClient.get<MapAssetByFormatResponse>(`${API_V1}/${network}/maps/${family}`);
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
