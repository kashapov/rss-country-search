import { createCachedSearch } from './cache.js';
import { debounce } from './debounce.js';
import { classifySearchError } from './error-kind.js';
import {
  loadSearchHistory,
  pushSearchHistory,
  removeSearchHistory,
  saveSearchHistory,
  type HistoryStorage,
} from './history.js';
import { mapCountryResponse, type CountryCard } from './map-country.js';
import { searchCountries } from './search-countries.js';

export type SearchState =
  | { status: 'idle'; countries: CountryCard[]; query: string; errorMessage: null }
  | { status: 'loading'; countries: CountryCard[]; query: string; errorMessage: null }
  | { status: 'results'; countries: CountryCard[]; query: string; errorMessage: null }
  | { status: 'empty'; countries: CountryCard[]; query: string; errorMessage: null }
  | { status: 'error'; countries: CountryCard[]; query: string; errorMessage: string };

export type SearchFn = (
  query: string,
  signal: AbortSignal,
  options?: { timeoutMs?: number },
) => Promise<unknown[]>;

export type SearchControllerOptions = {
  debounceMs?: number;
  searchFn?: SearchFn;
  mapFn?: (raw: unknown) => CountryCard;
  timeoutMs?: number;
  historyStorage?: HistoryStorage;
};

type Listener = (state: SearchState) => void;
type HistoryListener = (history: string[]) => void;

const idleState = (): SearchState => ({
  status: 'idle',
  countries: [],
  query: '',
  errorMessage: null,
});

export class SearchController {
  private state: SearchState = idleState();
  private readonly listeners = new Set<Listener>();
  private readonly historyListeners = new Set<HistoryListener>();
  private readonly searchFn: SearchFn;
  private readonly mapFn: (raw: unknown) => CountryCard;
  private readonly searchOptions: { timeoutMs?: number };
  private readonly historyStorage: HistoryStorage | null;
  private history: string[] = [];
  private readonly runDebouncedSearch: (query: string) => void;
  private abortController: AbortController | null = null;
  private lastQuery = '';
  private requestId = 0;

  constructor(options: SearchControllerOptions = {}) {
    this.searchFn = options.searchFn ?? createCachedSearch(searchCountries);
    this.mapFn =
      options.mapFn ??
      ((raw) => mapCountryResponse(raw as Parameters<typeof mapCountryResponse>[0]));
    this.searchOptions = options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs };
    this.historyStorage =
      options.historyStorage ?? (typeof localStorage === 'undefined' ? null : localStorage);
    this.history = this.historyStorage ? loadSearchHistory(this.historyStorage) : [];
    this.runDebouncedSearch = debounce((query: string) => {
      void this.executeSearch(query);
    }, options.debounceMs ?? 300);
  }

  getState(): SearchState {
    return this.state;
  }

  getHistory(): string[] {
    return [...this.history];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeHistory(listener: HistoryListener): () => void {
    this.historyListeners.add(listener);
    listener(this.getHistory());
    return () => {
      this.historyListeners.delete(listener);
    };
  }

  setQuery(query: string): void {
    this.abortInFlightRequest();

    const normalized = query.trim();
    this.lastQuery = normalized;

    if (normalized.length === 0) {
      this.setState(idleState());
      return;
    }

    this.runDebouncedSearch(normalized);
  }

  searchNow(query: string): void {
    this.abortInFlightRequest();

    const normalized = query.trim();
    this.lastQuery = normalized;

    if (normalized.length === 0) {
      this.setState(idleState());
      return;
    }

    void this.executeSearch(normalized);
  }

  retry(): void {
    if (this.lastQuery.length === 0) {
      return;
    }

    this.abortInFlightRequest();
    void this.executeSearch(this.lastQuery);
  }

  removeHistoryItem(query: string): void {
    const nextHistory = removeSearchHistory(query, this.history);
    if (nextHistory.length === this.history.length) {
      return;
    }

    this.history = nextHistory;
    this.persistHistory();
  }

  private abortInFlightRequest(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async executeSearch(query: string): Promise<void> {
    if (query !== this.lastQuery) {
      return;
    }

    const requestId = ++this.requestId;
    const controller = new AbortController();
    this.abortController = controller;

    this.setState({
      status: 'loading',
      countries: [],
      query,
      errorMessage: null,
    });

    try {
      const rawCountries = await this.searchFn(query, controller.signal, this.searchOptions);

      if (requestId !== this.requestId || query !== this.lastQuery) {
        return;
      }

      const countries = rawCountries.map((raw) => this.mapFn(raw));

      if (countries.length === 0) {
        this.rememberQuery(query);
        this.setState({
          status: 'empty',
          countries: [],
          query,
          errorMessage: null,
        });
        return;
      }

      this.rememberQuery(query);
      this.setState({
        status: 'results',
        countries,
        query,
        errorMessage: null,
      });
    } catch (error) {
      if (requestId !== this.requestId || query !== this.lastQuery) {
        return;
      }

      const classified = classifySearchError(error);

      if (classified.kind === 'aborted') {
        return;
      }

      this.setState({
        status: 'error',
        countries: [],
        query,
        errorMessage: classified.message,
      });
    } finally {
      if (this.abortController === controller) {
        this.abortController = null;
      }
    }
  }

  private rememberQuery(query: string): void {
    const nextHistory = pushSearchHistory(query, this.history);
    if (nextHistory.length === this.history.length && nextHistory[0] === this.history[0]) {
      return;
    }

    this.history = nextHistory;
    this.persistHistory();
  }

  private persistHistory(): void {
    if (this.historyStorage) {
      saveSearchHistory(this.history, this.historyStorage);
    }

    for (const listener of this.historyListeners) {
      listener(this.getHistory());
    }
  }

  private setState(next: SearchState): void {
    this.state = next;
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
