import { apiClient } from '../api/client';
import type {
  MapAsset,
  MapAssetByFormatResponse,
  MapAssetListResponse,
  MapFamily,
  MapFormat,
} from '../types';

export const mapService = {
  getAllAssets(): Promise<MapAssetListResponse> {
    return apiClient.get<MapAssetListResponse>('/dmrc/maps/assets');
  },

  getFamilyAssets(family: MapFamily, format: MapFormat = 'any'): Promise<MapAssetListResponse> {
    return apiClient.get<MapAssetListResponse>(`/dmrc/maps/${family}/assets`, {
      query: { format },
    });
  },

  getFamilyPrimaryMaps(family: MapFamily): Promise<MapAssetByFormatResponse> {
    return apiClient.get<MapAssetByFormatResponse>(`/dmrc/maps/${family}`);
  },

  getAssetById(assetId: string): Promise<MapAsset> {
    return apiClient.get<MapAsset>(`/dmrc/maps/assets/${assetId}`);
  },

  getDownloadUrl(family: MapFamily, format: MapFormat = 'any'): string {
    const query = new URLSearchParams({ format }).toString();
    return `${apiClient.baseUrl}/dmrc/maps/${family}/download?${query}`;
  },

  getProxyFileUrl(family: MapFamily, format: MapFormat = 'any'): string {
    const query = new URLSearchParams({ format }).toString();
    return `${apiClient.baseUrl}/dmrc/maps/${family}/file?${query}`;
  },
};
