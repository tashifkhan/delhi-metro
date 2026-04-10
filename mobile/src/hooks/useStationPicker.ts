import { useState, useCallback } from 'react';

export interface SelectedStation {
  code: string;
  name: string;
}

export function useStationPicker() {
  const [visible, setVisible] = useState(false);
  const [station, setStation] = useState<SelectedStation | null>(null);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  const select = useCallback((s: SelectedStation) => {
    setStation(s);
    setVisible(false);
  }, []);

  return { visible, station, open, close, select, setStation };
}
