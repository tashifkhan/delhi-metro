/**
 * Whether a line's published status means trains are running as usual.
 *
 * Each operator words it differently: DMRC says "Normal Service", NCRTC says
 * "Operational". Anything else is treated as a disruption worth showing.
 */
const RUNNING = new Set(['normal service', 'normal', 'operational', 'running', 'running normally']);

export function isLineNormal(status: string | null | undefined): boolean {
  return RUNNING.has((status ?? '').trim().toLowerCase());
}
