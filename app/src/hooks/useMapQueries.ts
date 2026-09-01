import { useQuery } from '@tanstack/react-query';

import { mapService } from '../services/mapService';
import type { MapFamily, MapFormat } from '../types';
import { queryKeys } from './queryKeys';
import { useMetroNetwork } from '../network';

export function useAllMapAssetsQuery() {
  const { network } = useMetroNetwork();
  return useQuery({
    queryKey: queryKeys.mapAssets(network),
    queryFn: () => mapService.getAllAssets(network),
  });
}

export function useMapFamilyAssetsQuery(family: MapFamily, format: MapFormat = 'any') {
  const { network } = useMetroNetwork();
  return useQuery({
    queryKey: queryKeys.mapFamilyAssets(network, family, format),
    queryFn: () => mapService.getFamilyAssets(family, format, network),
  });
}

export function useMapFamilyPrimaryQuery(family: MapFamily) {
  const { network } = useMetroNetwork();
  return useQuery({
    queryKey: queryKeys.mapFamilyPrimary(network, family),
    queryFn: () => mapService.getFamilyPrimaryMaps(family, network),
  });
}

export function useMapAssetByIdQuery(assetId: string) {
  const { network } = useMetroNetwork();
  return useQuery({
    queryKey: queryKeys.mapAssetById(network, assetId),
    queryFn: () => mapService.getAssetById(assetId),
    enabled: assetId.trim().length > 0,
  });
}
