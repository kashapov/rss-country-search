import type { SearchFn } from './search-controller.js';

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

export function createCachedSearch(searchFn: SearchFn): SearchFn {
  const cache = new Map<string, unknown[]>();
  const inFlight = new Map<string, Promise<unknown[]>>();

  return (query, signal, options) => {
    const key = query.trim().toLowerCase();

    const cached = cache.get(key);
    if (cached) {
      if (signal.aborted) {
        return Promise.reject(abortError());
      }

      return Promise.resolve(cached);
    }

    let sharedPromise = inFlight.get(key);

    if (!sharedPromise) {
      const sharedController = new AbortController();

      sharedPromise = searchFn(query, sharedController.signal, options)
        .then((result) => {
          cache.set(key, result);
          return result;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, sharedPromise);
    }

    return new Promise<unknown[]>((resolve, reject) => {
      if (signal.aborted) {
        reject(abortError());
        return;
      }

      const onAbort = () => {
        reject(abortError());
      };

      signal.addEventListener('abort', onAbort, { once: true });

      sharedPromise!
        .then((result) => {
          signal.removeEventListener('abort', onAbort);

          if (signal.aborted) {
            reject(abortError());
            return;
          }

          resolve(result);
        })
        .catch((error: unknown) => {
          signal.removeEventListener('abort', onAbort);

          if (signal.aborted) {
            reject(abortError());
            return;
          }

          reject(error);
        });
    });
  };
}
