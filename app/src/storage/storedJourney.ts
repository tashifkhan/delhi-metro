import type { PlannedJourney } from '../types';

/**
 * A plan read back from storage, with the moment it was stored.
 *
 * `savedAt` is not part of the plan the API returns, so it lives beside the
 * payload. Plans stored before this field existed have no time, and the
 * screen then says only that the plan was saved.
 */
export interface StoredJourney {
  plan: PlannedJourney;
  savedAt: number | null;
}
