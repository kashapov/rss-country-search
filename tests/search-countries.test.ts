import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../src/http-error';
import { searchCountries } from '../src/search-countries';

describe('HttpError', () => {
  it('extends Error and stores the response status', () => {
    const error = new HttpError('Server error', 500);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.name).toBe('HttpError');
    expect(error.message).toBe('Server error');
    expect(error.status).toBe(500);
  });
});

describe('searchCountries', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests countries.dev by name and returns parsed JSON on success', async () => {
    const countries = [{ name: 'Spain', capital: 'Madrid' }];
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => countries,
    });

    const signal = new AbortController().signal;
    const result = await searchCountries('spain', signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://countries.dev/name/spain');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(result).toEqual(countries);
  });

  it('encodes the query in the request URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await searchCountries('united states', new AbortController().signal);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://countries.dev/name/united%20states');
  });

  it('returns an empty array when the API responds with 404', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' }),
    });

    const result = await searchCountries('zzzzz', new AbortController().signal);

    expect(result).toEqual([]);
  });

  it('throws HttpError when response.ok is false and status is not 404', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ message: 'boom' }),
    });

    await expect(searchCountries('spain', new AbortController().signal)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof HttpError && error.status === 500 && error.message.length > 0,
    );
  });

  it('aborts when the caller signal is aborted', async () => {
    const controller = new AbortController();

    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error('missing signal'));
          return;
        }

        if (signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }

        signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const pending = searchCountries('spain', controller.signal);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('times out through AbortSignal.timeout composed with the caller signal', async () => {
    vi.useFakeTimers();

    try {
      fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error('missing signal'));
            return;
          }

          signal.addEventListener('abort', () => {
            const reason = signal.reason;
            if (reason instanceof DOMException && reason.name === 'TimeoutError') {
              reject(reason);
              return;
            }

            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      });

      const pending = searchCountries('spain', new AbortController().signal, { timeoutMs: 1000 });
      const expectation = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });

      await vi.advanceTimersByTimeAsync(1000);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});
