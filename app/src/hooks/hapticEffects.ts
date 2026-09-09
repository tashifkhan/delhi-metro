/**
 * The effects every platform driver implements.
 *
 * Named for intent rather than for strength, so a driver can pick whatever its
 * platform considers "a selection tick" instead of us hard-coding a waveform
 * that only feels right on one device. Weight grows down the list: navigation,
 * selection, commitment, outcome.
 */
export type HapticEffect =
  | 'navigate'
  | 'select'
  | 'toggleOff'
  | 'toggleOn'
  | 'press'
  | 'longPress'
  | 'success'
  | 'warning'
  | 'error';

const OUTCOMES = new Set<HapticEffect>(['success', 'warning', 'error']);

/**
 * Outcomes are multi-beat patterns that report the result of an action, so
 * they need room to play out and take precedence over an incidental tap.
 */
export function isOutcome(effect: HapticEffect): boolean {
  return OUTCOMES.has(effect);
}
