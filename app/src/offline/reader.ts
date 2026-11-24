import { packStore } from './store';
import { parseBundle, selectors, type PackBundle, type PackSelectors } from './bundle';
import { OfflineRouter } from './router';
import { buildOfflinePlan } from './offlinePlan';
import type { PlannedJourney, RouteStrategy } from '../types';

let loaded: Promise<{ bundle: PackBundle; select: PackSelectors; savedAt: number } | null> | null = null;
let router: { bundle: PackBundle; router: OfflineRouter } | null = null;

/**
 * The parsed offline pack, read from storage once and kept in memory. Screens
 * only reach for it when the network and the saved copies have both failed.
 */
export function readPack() {
  if (!loaded) {
    loaded = (async () => {
      const [meta, body] = await Promise.all([packStore.readMeta(), packStore.readBody()]);
      if (!meta || !body) return null;
      const bundle = parseBundle(body);
      if (!bundle) return null;
      const savedAt = Date.parse(meta.generatedAt) || meta.savedAt;
      return { bundle, select: selectors(bundle), savedAt };
    })().catch(() => null);
  }
  return loaded;
}

/** Forget the parsed copy after a sync or removal, so the next read sees the new pack. */
export function invalidatePack(): void {
  loaded = null;
  router = null;
}

/**
 * Plan a trip from the pack, for when the network is down and this trip was
 * never planned online. Null when there is no pack or no route.
 */
export async function planOffline(
  fromCode: string,
  toCode: string,
  strategy: RouteStrategy,
): Promise<{ plan: PlannedJourney; savedAt: number } | null> {
  const pack = await readPack();
  const graph = pack?.bundle.sections.routing_graph;
  if (!pack || !graph) return null;
  if (!router || router.bundle !== pack.bundle) {
    router = { bundle: pack.bundle, router: new OfflineRouter(graph, pack.bundle.sections.overrides ?? []) };
  }
  const plan = buildOfflinePlan(pack.bundle, router.router, fromCode, toCode, strategy);
  return plan ? { plan, savedAt: pack.savedAt } : null;
}

/** A catalog read from the pack, in the `{payload, savedAt}` form the cache uses. */
export async function fromPack<T>(pick: (select: PackSelectors) => T | null): Promise<{ payload: T; savedAt: number } | null> {
  const pack = await readPack();
  if (!pack) return null;
  const payload = pick(pack.select);
  if (payload === null || (Array.isArray(payload) && payload.length === 0)) return null;
  return { payload, savedAt: pack.savedAt };
}
