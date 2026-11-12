import { HttpError } from './http-error';

const DEFAULT_TIMEOUT_MS = 8_000;
const API_BASE_URL = 'https://countries.dev/name';

export type SearchCountriesOptions = {
  timeoutMs?: number;
};

export async function searchCountries(
  query: string,
  signal: AbortSignal,
  options: SearchCountriesOptions = {},
): Promise<unknown[]> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const composedSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  const url = `${API_BASE_URL}/${encodeURIComponent(query)}`;

  const response = await fetch(url, { signal: composedSignal });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new HttpError(`Request failed with status ${response.status}`, response.status);
  }

  return (await response.json()) as unknown[];
}
