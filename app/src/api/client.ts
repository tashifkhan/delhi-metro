import { env } from '../config/env';
import { ApiError } from './errors';

interface RequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined>;
}

export class ApiClient {
  private readonly _baseUrl: string;

  constructor(baseUrl = env.apiBaseUrl) {
    this._baseUrl = baseUrl;
  }

  get baseUrl(): string {
    return this._baseUrl;
  }

  private createUrl(path: string, query?: RequestOptions['query']): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this._baseUrl}${normalizedPath}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    const response = await fetch(this.createUrl(path, options?.query), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      let detail: string | undefined;
      try {
        const payload = (await response.json()) as { detail?: string };
        detail = payload.detail;
      } catch {
        detail = undefined;
      }

      throw new ApiError(
        detail ?? `Request failed with status ${response.status}`,
        response.status,
        detail,
      );
    }

    return (await response.json()) as T;
  }
}

export const apiClient = new ApiClient();
