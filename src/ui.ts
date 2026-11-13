import type { CountryCard } from './map-country.js';
import { SearchController, type SearchState } from './search-controller.js';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
  } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (options.className) {
    node.className = options.className;
  }

  if (options.text !== undefined) {
    node.textContent = options.text;
  }

  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      node.setAttribute(key, value);
    }
  }

  return node;
}

function clearChildren(node: HTMLElement): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function formatPopulation(population: number): string {
  return new Intl.NumberFormat('en-US').format(population);
}

function formatArea(area: number | null): string {
  if (area === null) {
    return '—';
  }

  return `${new Intl.NumberFormat('en-US').format(area)} km²`;
}

function joinOrDash(values: string[]): string {
  return values.length > 0 ? values.join(', ') : '—';
}

function createCountryCard(
  country: CountryCard,
  onSelect: (country: CountryCard) => void,
): HTMLElement {
  const item = el('button', {
    className: 'country-card',
    attrs: { type: 'button' },
  });

  if (country.flag) {
    if (country.flag.startsWith('http')) {
      const flag = el('img', {
        className: 'country-card__flag',
        attrs: {
          src: country.flag,
          alt: `${country.name} flag`,
        },
      });
      item.append(flag);
    } else {
      item.append(el('span', { className: 'country-card__flag-emoji', text: country.flag }));
    }
  }

  const body = el('div', { className: 'country-card__body' });
  body.append(el('h2', { className: 'country-card__name', text: country.name }));
  body.append(el('p', { text: `Capital: ${country.capital || '—'}` }));
  body.append(el('p', { text: `Region: ${country.region || '—'}` }));
  body.append(el('p', { text: `Population: ${formatPopulation(country.population)}` }));
  item.append(body);

  item.addEventListener('click', () => {
    onSelect(country);
  });

  return item;
}

function renderDetail(container: HTMLElement, country: CountryCard, onBack: () => void): void {
  clearChildren(container);

  const backButton = el('button', {
    className: 'back-button',
    text: '← Back to results',
    attrs: { type: 'button' },
  });
  backButton.addEventListener('click', onBack);

  const header = el('div', { className: 'detail__header' });

  if (country.flag) {
    if (country.flag.startsWith('http')) {
      header.append(
        el('img', {
          className: 'detail__flag',
          attrs: {
            src: country.flag,
            alt: `${country.name} flag`,
          },
        }),
      );
    } else {
      header.append(el('span', { className: 'detail__flag-emoji', text: country.flag }));
    }
  }

  header.append(el('h2', { className: 'detail__title', text: country.name }));

  const list = el('dl', { className: 'detail__list' });
  const rows: Array<[string, string]> = [
    ['Description', country.description || '—'],
    ['Capital', country.capital || '—'],
    ['Region', country.region || '—'],
    ['Population', formatPopulation(country.population)],
    ['Area', formatArea(country.area)],
    ['Borders', joinOrDash(country.borders)],
    ['Languages', joinOrDash(country.languages)],
    ['Currency', joinOrDash(country.currencies)],
  ];

  for (const [label, value] of rows) {
    list.append(el('dt', { text: label }), el('dd', { text: value }));
  }

  container.append(backButton, header, list);
}

export function mountSearchUi(
  root: HTMLElement,
  controller: SearchController = new SearchController(),
): SearchController {
  const existingApp = root.querySelector('.app');
  if (existingApp) {
    existingApp.remove();
  }

  const app = el('main', { className: 'app' });
  const title = el('h1', { text: 'Country Search' });
  const searchLabel = el('label', {
    className: 'search-label',
    attrs: { for: 'country-query' },
    text: 'Search by country name',
  });
  const input = el('input', {
    className: 'search-input',
    attrs: {
      id: 'country-query',
      type: 'search',
      autocomplete: 'off',
      placeholder: 'Start typing a country name…',
    },
  });
  const status = el('p', {
    className: 'status status--idle',
    attrs: { role: 'status', 'aria-live': 'polite' },
  });
  const loading = el('div', {
    className: 'loading',
    attrs: { role: 'status', 'aria-live': 'polite' },
  });
  const loadingSpinner = el('span', {
    className: 'loading__spinner',
    attrs: { 'aria-hidden': 'true' },
  });
  const loadingText = el('span', { className: 'loading__text' });
  loading.append(loadingSpinner, loadingText);
  loading.hidden = true;

  const results = el('div', {
    className: 'results',
    attrs: { role: 'list' },
  });
  const detail = el('section', {
    className: 'detail',
    attrs: { 'aria-live': 'polite' },
  });
  detail.hidden = true;

  const errorBox = el('div', { className: 'error-box' });
  const errorText = el('p', { className: 'error-box__message' });
  const retryButton = el('button', {
    className: 'retry-button',
    text: 'Retry',
    attrs: { type: 'button' },
  });
  errorBox.append(errorText, retryButton);
  errorBox.hidden = true;

  const historySection = el('section', { className: 'history' });
  const historyTitle = el('h2', { className: 'history__title', text: 'Recent searches' });
  const historyList = el('div', {
    className: 'history__list',
    attrs: { role: 'list' },
  });
  historySection.append(historyTitle, historyList);
  historySection.hidden = true;

  app.append(title, searchLabel, input, historySection, status, loading, errorBox, results, detail);
  root.append(app);

  let selectedCountry: CountryCard | null = null;
  let latestState: SearchState = controller.getState();
  let activeHistoryQuery = '';
  let latestHistoryItems: string[] = controller.getHistory();

  const showList = (): void => {
    selectedCountry = null;
    detail.hidden = true;
    clearChildren(detail);
    results.hidden = false;
  };

  const showDetail = (country: CountryCard): void => {
    selectedCountry = country;
    results.hidden = true;
    detail.hidden = false;
    renderDetail(detail, country, showList);
  };

  const setStatus = (kind: SearchState['status'], text: string): void => {
    status.className = `status status--${kind}`;
    status.textContent = text;
  };

  const setActiveHistoryQuery = (query: string): void => {
    const next = query.trim();
    if (activeHistoryQuery === next) {
      return;
    }

    activeHistoryQuery = next;
    renderHistory(latestHistoryItems);
  };

  const render = (state: SearchState): void => {
    latestState = state;
    clearChildren(results);
    errorBox.hidden = true;
    loading.hidden = true;
    status.textContent = '';
    status.className = 'status';

    if (state.status === 'idle') {
      setActiveHistoryQuery('');
    } else {
      setActiveHistoryQuery(state.query);
    }

    if (selectedCountry && state.status !== 'results') {
      showList();
    }

    if (selectedCountry && state.status === 'results') {
      const stillPresent = state.countries.some(
        (country) => country.name === selectedCountry?.name,
      );
      if (!stillPresent) {
        showList();
      }
    }

    if (state.status === 'idle') {
      setStatus('idle', 'Type to search for countries.');
      return;
    }

    if (state.status === 'loading') {
      setStatus('loading', '');
      loading.hidden = false;
      loadingText.textContent = `Searching for “${state.query}”…`;
      return;
    }

    if (state.status === 'empty') {
      setStatus('empty', `Nothing found for “${state.query}”. Try another name.`);
      return;
    }

    if (state.status === 'error') {
      setStatus('error', '');
      errorBox.hidden = false;
      errorText.textContent = state.errorMessage;
      return;
    }

    setStatus('results', `Found ${state.countries.length} result(s) for “${state.query}”.`);

    for (const country of state.countries) {
      const card = createCountryCard(country, showDetail);
      card.setAttribute('role', 'listitem');
      results.append(card);
    }

    if (selectedCountry) {
      const matched = state.countries.find((country) => country.name === selectedCountry?.name);
      if (matched) {
        showDetail(matched);
      }
    }
  };

  const renderHistory = (items: string[]): void => {
    latestHistoryItems = items;
    clearChildren(historyList);

    if (items.length === 0) {
      historySection.hidden = true;
      return;
    }

    historySection.hidden = false;

    for (const item of items) {
      const isActive = item.toLowerCase() === activeHistoryQuery.toLowerCase();
      const button = el('button', {
        className: isActive ? 'history__item history__item--active' : 'history__item',
        text: item,
        attrs: {
          type: 'button',
          role: 'listitem',
          'aria-pressed': isActive ? 'true' : 'false',
        },
      });

      button.addEventListener('click', () => {
        if (selectedCountry) {
          showList();
        }
        input.value = item;
        setActiveHistoryQuery(item);
        controller.searchNow(item);
      });

      historyList.append(button);
    }
  };

  input.addEventListener('input', () => {
    if (selectedCountry) {
      showList();
    }
    controller.setQuery(input.value);
  });

  retryButton.addEventListener('click', () => {
    if (selectedCountry) {
      showList();
    }
    controller.retry();
  });

  controller.subscribe(render);
  controller.subscribeHistory(renderHistory);
  render(latestState);

  return controller;
}
