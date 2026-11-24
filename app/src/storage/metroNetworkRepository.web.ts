import { readJson, writeJson } from './webStore';
import type { MetroNetwork } from '../network/NetworkContext';

const STORAGE_KEY = 'dmrc:metroNetwork';

export const metroNetworkRepository = {
  async load(): Promise<MetroNetwork> {
    const stored = readJson<string>(STORAGE_KEY);
    return stored === 'nmrc' || stored === 'ncrtc' ? stored : 'dmrc';
  },

  async save(network: MetroNetwork): Promise<void> {
    writeJson(STORAGE_KEY, network);
  },
};
