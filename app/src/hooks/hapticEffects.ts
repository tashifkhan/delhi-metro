/**
 * The effects every platform driver implements.
 *
 * Named for intent rather than for strength, so a driver can pick whatever its
 * platform considers "a selection tick" instead of us hard-coding a waveform
 * that only feels right on one device. The shared policy silences routine navigation, selection, and presses.
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
 * Outcomes report the result of an action and take precedence over a switch
 * or long press.
 */
export function isOutcome(effect: HapticEffect): boolean {
  return OUTCOMES.has(effect);
}
