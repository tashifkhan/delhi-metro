import { readJson, writeJson } from './webStore';
import type { MetroNetwork } from '../network/NetworkContext';

const STORAGE_KEY = 'dmrc:metroNetwork';

export const metroNetworkRepository = {
  async load(): Promise<MetroNetwork> {
    return readJson<string>(STORAGE_KEY) === 'nmrc' ? 'nmrc' : 'dmrc';
  },

  async save(network: MetroNetwork): Promise<void> {
    writeJson(STORAGE_KEY, network);
  },
};
