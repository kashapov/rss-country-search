import { describe, expect, it, vi } from 'vitest';
import {
  loadSearchHistory,
  pushSearchHistory,
  removeSearchHistory,
  saveSearchHistory,
  SEARCH_HISTORY_KEY,
} from '../src/history';
import { SearchController } from '../src/search-controller';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));

  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    store,
  };
}

describe('search history helpers', () => {
  it('loads valid history and ignores broken JSON', () => {
    const storage = createMemoryStorage({
      [SEARCH_HISTORY_KEY]: JSON.stringify(['Spain', 'France', 42, '']),
    });

    expect(loadSearchHistory(storage)).toEqual(['Spain', 'France']);
    expect(loadSearchHistory(createMemoryStorage({ [SEARCH_HISTORY_KEY]: '{bad' }))).toEqual([]);
  });

  it('pushes newest query to the front only when it is new', () => {
    expect(pushSearchHistory('Spain', ['France', 'Italy'], 3)).toEqual([
      'Spain',
      'France',
      'Italy',
    ]);
  });

  it('keeps existing history order when the query is repeated', () => {
    expect(pushSearchHistory('spain', ['France', 'Spain', 'Italy'], 3)).toEqual([
      'France',
      'Spain',
      'Italy',
    ]);
  });

  it('persists history to storage', () => {
    const storage = createMemoryStorage();
    saveSearchHistory(['Spain', 'Italy'], storage);

    expect(storage.getItem(SEARCH_HISTORY_KEY)).toBe(JSON.stringify(['Spain', 'Italy']));
  });

  it('removes a history item without touching the others', () => {
    expect(removeSearchHistory('spain', ['France', 'Spain', 'Italy'])).toEqual(['France', 'Italy']);
  });
});

describe('SearchController history', () => {
  it('saves successful queries and can replay them immediately', async () => {
    const storage = createMemoryStorage();
    const searchFn = vi.fn(async (query: string) => [{ name: query }]);

    const controller = new SearchController({
      debounceMs: 0,
      searchFn,
      historyStorage: storage,
      mapFn: (raw) => ({
        name: String((raw as { name: string }).name),
        flag: '',
        capital: '',
        region: '',
        population: 0,
        description: '',
        area: null,
        languages: [],
        currencies: [],
        borders: [],
      }),
    });

    controller.searchNow('spain');
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.getHistory()).toEqual(['spain']);
    expect(JSON.parse(storage.getItem(SEARCH_HISTORY_KEY)!)).toEqual(['spain']);

    controller.searchNow('spain');
    await Promise.resolve();
    await Promise.resolve();

    expect(searchFn).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toMatchObject({
      status: 'results',
      query: 'spain',
    });
  });

  it('removes a history item and persists the change', async () => {
    const storage = createMemoryStorage({
      [SEARCH_HISTORY_KEY]: JSON.stringify(['france', 'spain']),
    });

    const controller = new SearchController({
      debounceMs: 0,
      searchFn: vi.fn(async () => []),
      historyStorage: storage,
    });

    expect(controller.getHistory()).toEqual(['france', 'spain']);

    controller.removeHistoryItem('spain');

    expect(controller.getHistory()).toEqual(['france']);
    expect(JSON.parse(storage.getItem(SEARCH_HISTORY_KEY)!)).toEqual(['france']);
  });
});
