import type { ApiClient } from '../api/client';
import { DmrcService } from '../services/dmrcService';

export interface ServiceContainer {
  dmrcService: DmrcService;
}

export function createServiceContainer(apiClient: ApiClient): ServiceContainer {
  return {
    dmrcService: new DmrcService(apiClient),
  };
}
