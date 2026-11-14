import { useMemo } from 'react';
import { useMapLayout } from '../../hooks/useMapLayout';
import { BASE_GEOMETRY, LAYOUT_REGISTRY, applyLayouts } from './geometry';

/**
 * The network geometry with every enabled official-map layout applied.
 *
 * The map tab and the route map on the results page both draw from this, so
 * a station sits in the same place on both. Layout requests are cached per
 * session (see `useMapLayout`), so a second caller doesn't stream again.
 */
export function useLiveGeometry(enabled = true) {
  const nmrc = useMapLayout('nmrc', enabled && LAYOUT_REGISTRY.nmrc.enabled);
  const dmrc = useMapLayout('dmrc', enabled && LAYOUT_REGISTRY.dmrc.enabled);
  const geometry = useMemo(
    () => applyLayouts(BASE_GEOMETRY, { nmrc: nmrc.layout, dmrc: dmrc.layout }),
    [nmrc.layout, dmrc.layout],
  );
  return { geometry, nmrc, dmrc };
}
