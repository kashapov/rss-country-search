# DESIGN.md

## Request cancellation

Stale responses are cancelled with `AbortController`, not filtered after the fact with a “latest response” flag.

Why:

1. **Network work stops.** `abort()` marks the request as canceled in DevTools and frees the browser from waiting on an obsolete response.
2. **Debounce window is covered.** Cancellation runs on every input change in `SearchController.setQuery()` (`src/search-controller.ts`), before the debounced search fires. Without that, a slow response for `sp` could still arrive while the UI already shows the typed text `spain`.
3. **Errors stay honest.** `classifySearchError()` (`src/error-kind.ts`) treats `AbortError` as silent cancellation and `TimeoutError` / `HttpError` / network failures as user-visible errors. A timestamp flag would still leave canceled work looking like a normal failure path.

Flow:

1. User types → previous `AbortController` is aborted.
2. Debounce timer resets.
3. When the timer fires, a new controller starts `searchCountries()` with `AbortSignal.any([callerSignal, AbortSignal.timeout(ms)])`.
4. If the user types again, step 1 repeats; the old promise rejects with `AbortError` and does not update UI state.

## Debounce delay

Default delay: **300ms** (`SearchController` constructor in `src/search-controller.ts`).

- **Without debounce:** every keystroke becomes a request. Typing `spain` would trigger up to 5 network calls, more aborts, and noisier Network traffic.
- **Too large (for example 1000ms+):** the UI feels laggy; users pause and wonder whether search is broken.
- **300ms:** short enough to feel live, long enough to collapse a normal typing burst into one request after the pause.

History clicks bypass debounce through `searchNow()` so replay stays immediate (and can hit the cache).

## Complexity

### `mapCountryResponse` (`src/map-country.ts`)

Let `L` be the number of languages and `C` the number of currencies on one country object.

- Reading scalar fields and building the result object: **O(1)**
- Mapping languages/currencies: **O(L + C)**
- Copying borders: **O(B)** where `B` is the number of border codes

Overall per country: **O(L + C + B)**. For a search result list of `N` countries the controller maps each item once: **O(N · (L + C + B))**. No nested country-to-country scans.

### Cache and in-flight dedupe (`src/cache.ts`)

- Cache key lookup / insert: **O(1)** average (`Map`)
- In-flight lookup / insert / delete: **O(1)** average
- Serving a cached hit: **O(1)** plus returning the already stored array reference
- Deduping concurrent callers: one shared promise, each caller wraps it with its own `AbortSignal` listener — **O(1)** extra work per caller, not a new network request

Memory grows with the number of distinct normalized queries stored in the cache for the page lifetime: **O(Q)** entries.

## Clean code practices

- **Single responsibility**
  - `debounce` only delays calls (`src/debounce.ts`)
  - `searchCountries` only talks to the API (`src/search-countries.ts`)
  - `mapCountryResponse` only transforms data (`src/map-country.ts`)
  - `classifySearchError` only classifies failures (`src/error-kind.ts`)
  - `SearchController` only orchestrates state/abort/history (`src/search-controller.ts`)
  - `mountSearchUi` only renders DOM (`src/ui.ts`)
- **Dependency inversion for tests:** `SearchController` accepts `searchFn`, `mapFn`, and `historyStorage`, so race/cache/history tests do not need a real network or browser `localStorage`.
- **Explicit domain errors:** `HttpError` carries status instead of opaque strings (`src/http-error.ts`).
- **No `innerHTML`:** UI builds nodes with `createElement` / `textContent` to avoid HTML injection and keep rendering predictable (`src/ui.ts`).
- **Fail closed on bad storage:** `loadSearchHistory()` returns `[]` on invalid JSON instead of throwing into the UI (`src/history.ts`).
