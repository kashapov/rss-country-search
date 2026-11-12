import { describe, expect, it, vi } from 'vitest';
import { createCachedSearch } from '../src/cache';
import type { SearchFn } from '../src/search-controller';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('createCachedSearch', () => {
  it('returns cached results for a repeated query without calling search again', async () => {
    const searchFn = vi.fn<SearchFn>(async () => [{ name: 'Spain' }]);
    const cachedSearch = createCachedSearch(searchFn);

    const first = await cachedSearch('spain', new AbortController().signal);
    const second = await cachedSearch('Spain', new AbortController().signal);

    expect(first).toEqual([{ name: 'Spain' }]);
    expect(second).toEqual([{ name: 'Spain' }]);
    expect(searchFn).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent identical queries onto one shared request', async () => {
    const deferred = createDeferred<unknown[]>();
    const searchFn = vi.fn<SearchFn>(async () => deferred.promise);
    const cachedSearch = createCachedSearch(searchFn);

    const firstPromise = cachedSearch('spain', new AbortController().signal);
    const secondPromise = cachedSearch('spain', new AbortController().signal);

    expect(searchFn).toHaveBeenCalledTimes(1);

    deferred.resolve([{ name: 'Spain' }]);

    await expect(firstPromise).resolves.toEqual([{ name: 'Spain' }]);
    await expect(secondPromise).resolves.toEqual([{ name: 'Spain' }]);
  });

  it('does not abort the shared request when one caller cancels', async () => {
    const deferred = createDeferred<unknown[]>();
    let sharedSignal: AbortSignal | undefined;

    const searchFn = vi.fn<SearchFn>(async (_query, signal) => {
      sharedSignal = signal;
      return deferred.promise;
    });
    const cachedSearch = createCachedSearch(searchFn);

    const firstController = new AbortController();
    const secondController = new AbortController();

    const firstPromise = cachedSearch('spain', firstController.signal);
    const secondPromise = cachedSearch('spain', secondController.signal);

    firstController.abort();

    await expect(firstPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(sharedSignal?.aborted).toBe(false);

    deferred.resolve([{ name: 'Spain' }]);

    await expect(secondPromise).resolves.toEqual([{ name: 'Spain' }]);
    expect(searchFn).toHaveBeenCalledTimes(1);
  });
});
