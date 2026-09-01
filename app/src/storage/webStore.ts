/**
 * Minimal `localStorage` wrapper shared by the web storage repositories.
 *
 * Reads and writes both swallow failures: storage can be unavailable entirely
 * (private-mode Safari, cookies blocked) or full, and neither should break a
 * screen whose data is only being cached.
 */
export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache writes are best-effort.
  }
}
