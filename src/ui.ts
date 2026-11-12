import type { CountryCard } from './map-country';
import { SearchController, type SearchState } from './search-controller';

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

export function mountSearchUi(
  root: HTMLElement,
  controller: SearchController = new SearchController(),
): SearchController {
  clearChildren(root);

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
    className: 'status',
    attrs: { role: 'status', 'aria-live': 'polite' },
  });
  const results = el('div', {
    className: 'results',
    attrs: { role: 'list' },
  });
  const errorBox = el('div', { className: 'error-box' });
  const errorText = el('p', { className: 'error-box__message' });
  const retryButton = el('button', {
    className: 'retry-button',
    text: 'Retry',
    attrs: { type: 'button' },
  });
  errorBox.append(errorText, retryButton);
  errorBox.hidden = true;

  app.append(title, searchLabel, input, status, errorBox, results);
  root.append(app);

  const render = (state: SearchState): void => {
    clearChildren(results);
    errorBox.hidden = true;
    status.textContent = '';

    if (state.status === 'idle') {
      status.textContent = 'Type to search for countries.';
      return;
    }

    if (state.status === 'loading') {
      status.textContent = `Searching for “${state.query}”…`;
      return;
    }

    if (state.status === 'empty') {
      status.textContent = `Nothing found for “${state.query}”. Try another name.`;
      return;
    }

    if (state.status === 'error') {
      status.textContent = '';
      errorBox.hidden = false;
      errorText.textContent = state.errorMessage;
      return;
    }

    status.textContent = `Found ${state.countries.length} result(s) for “${state.query}”.`;

    for (const country of state.countries) {
      const card = createCountryCard(country, () => {
        // Detail view is added in the next step.
      });
      card.setAttribute('role', 'listitem');
      results.append(card);
    }
  };

  input.addEventListener('input', () => {
    controller.setQuery(input.value);
  });

  retryButton.addEventListener('click', () => {
    controller.retry();
  });

  controller.subscribe(render);

  return controller;
}
