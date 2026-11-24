import { readJson, writeJson } from '../storage/webStore';
import { decodeSaved, type SavedState } from './model';

const STORAGE_KEY = 'dmrc:saved';

export const savedRepository = {
  async load(): Promise<SavedState> {
    return decodeSaved(readJson<unknown>(STORAGE_KEY));
  },

  async save(state: SavedState): Promise<void> {
    writeJson(STORAGE_KEY, state);
  },
};
