export const SEARCH_HISTORY_KEY = 'country-search-history';
export const SEARCH_HISTORY_LIMIT = 8;

export type HistoryStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function loadSearchHistory(
  storage: HistoryStorage = localStorage,
  key = SEARCH_HISTORY_KEY,
): string[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
}

export function saveSearchHistory(
  items: string[],
  storage: HistoryStorage = localStorage,
  key = SEARCH_HISTORY_KEY,
): void {
  storage.setItem(key, JSON.stringify(items));
}

export function pushSearchHistory(
  query: string,
  current: string[],
  limit = SEARCH_HISTORY_LIMIT,
): string[] {
  const normalized = query.trim();
  if (!normalized) {
    return current;
  }

  const alreadyExists = current.some((item) => item.toLowerCase() === normalized.toLowerCase());

  if (alreadyExists) {
    return current;
  }

  return [normalized, ...current].slice(0, limit);
}
