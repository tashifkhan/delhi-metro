import { PillSegmented, type PillOption } from './PillSegmented';
import type { RouteStrategy } from '../types';

interface Props {
  active: RouteStrategy;
  onChange: (strategy: RouteStrategy) => void;
}

const OPTIONS: PillOption<RouteStrategy>[] = [
  {
    value: 'least-distance',
    label: 'Shortest',
    accessibilityLabel: 'Route preference: shortest',
  },
  {
    value: 'minimum-interchange',
    label: 'Fewer changes',
    accessibilityLabel: 'Route preference: fewer changes',
  },
];

/** Route preference on the results screen. Swiping the screen also flips it. */
export function StrategyToggle({ active, onChange }: Props) {
  return (
    <PillSegmented
      options={OPTIONS}
      value={active}
      onChange={onChange}
      accessibilityLabel="Route preference"
    />
  );
}
