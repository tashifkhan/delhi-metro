import { useQuery } from '@tanstack/react-query';

import { mapService } from '../services/mapService';
import type { MapFamily, MapFormat } from '../types';
import { queryKeys } from './queryKeys';

export function useAllMapAssetsQuery() {
  return useQuery({
    queryKey: queryKeys.mapAssets,
    queryFn: () => mapService.getAllAssets(),
  });
}

export function useMapFamilyAssetsQuery(family: MapFamily, format: MapFormat = 'any') {
  return useQuery({
    queryKey: queryKeys.mapFamilyAssets(family, format),
    queryFn: () => mapService.getFamilyAssets(family, format),
  });
}

export function useMapFamilyPrimaryQuery(family: MapFamily) {
  return useQuery({
    queryKey: queryKeys.mapFamilyPrimary(family),
    queryFn: () => mapService.getFamilyPrimaryMaps(family),
  });
}

export function useMapAssetByIdQuery(assetId: string) {
  return useQuery({
    queryKey: queryKeys.mapAssetById(assetId),
    queryFn: () => mapService.getAssetById(assetId),
    enabled: assetId.trim().length > 0,
  });
}
