import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchController } from '../src/search-controller';
import { searchCountries } from '../src/search-countries';
import spainFixture from './fixtures/spain.json';

type PendingRequest = {
  url: string;
  resolve: (response: Response) => void;
  reject: (error: unknown) => void;
};

function createAbortAwareFetchMock() {
  const pending: PendingRequest[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal;

      const rejectIfAborted = () => {
        reject(new DOMException('Aborted', 'AbortError'));
      };

      if (!signal) {
        reject(new Error('Expected AbortSignal on fetch'));
        return;
      }

      if (signal.aborted) {
        rejectIfAborted();
        return;
      }

      const request: PendingRequest = { url, resolve, reject };
      pending.push(request);

      signal.addEventListener(
        'abort',
        () => {
          const index = pending.indexOf(request);
          if (index >= 0) {
            pending.splice(index, 1);
          }
          rejectIfAborted();
        },
        { once: true },
      );
    });
  });

  return {
    fetchMock,
    pending,
    resolveOk(urlPart: string, body: unknown) {
      const index = pending.findIndex((request) => request.url.includes(urlPart));
      if (index < 0) {
        throw new Error(`No pending request for ${urlPart}`);
      }

      const [request] = pending.splice(index, 1);
      request!.resolve({
        ok: true,
        status: 200,
        json: async () => body,
      } as Response);
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

describe('search request race', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps only the latest query when an older response would arrive later', async () => {
    const { fetchMock, pending, resolveOk } = createAbortAwareFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    const controller = new SearchController({
      debounceMs: 100,
      searchFn: searchCountries,
      timeoutMs: 60_000,
    });

    controller.setQuery('sp');
    await vi.advanceTimersByTimeAsync(100);
    await flushMicrotasks();

    expect(pending).toHaveLength(1);
    expect(pending[0]?.url).toContain('/name/sp');

    const olderSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;

    controller.setQuery('spain');
    await flushMicrotasks();

    expect(olderSignal.aborted).toBe(true);
    expect(pending).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(100);
    await flushMicrotasks();

    expect(pending).toHaveLength(1);
    expect(pending[0]?.url).toContain('/name/spain');

    // Older request is already aborted; only the latest response can win.
    resolveOk('/name/spain', [spainFixture]);
    await flushMicrotasks();

    expect(controller.getState()).toMatchObject({
      status: 'results',
      query: 'spain',
      countries: [{ name: 'Spain', capital: 'Madrid' }],
    });
  });

  it('aborts the in-flight request on every input change, not only when debounce fires', async () => {
    const { fetchMock, pending } = createAbortAwareFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    const controller = new SearchController({
      debounceMs: 300,
      searchFn: searchCountries,
      timeoutMs: 60_000,
    });

    controller.setQuery('sp');
    await vi.advanceTimersByTimeAsync(300);
    await flushMicrotasks();
    expect(pending).toHaveLength(1);

    const firstSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    controller.setQuery('spa');
    await flushMicrotasks();

    expect(firstSignal.aborted).toBe(true);
    expect(pending).toHaveLength(0);
    expect(controller.getState().status).toBe('loading');
  });
});
