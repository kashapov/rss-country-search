export type CountryCard = {
  name: string;
  flag: string;
  capital: string;
  region: string;
  population: number;
  description: string;
  area: number | null;
  languages: string[];
  currencies: string[];
  borders: string[];
};

type RawLanguage = {
  name?: string;
};

type RawCurrency = {
  code?: string;
  name?: string;
  symbol?: string;
};

type RawCountry = {
  name?: string;
  nativeName?: string;
  flag?: string;
  flags?: {
    svg?: string;
    png?: string;
  };
  capital?: string;
  region?: string;
  population?: number;
  area?: number;
  languages?: RawLanguage[];
  currencies?: RawCurrency[];
  borders?: string[];
};

function formatCurrency(currency: RawCurrency): string {
  const parts = [currency.name, currency.code, currency.symbol].filter((part): part is string =>
    Boolean(part),
  );

  if (parts.length === 0) {
    return '';
  }

  if (!currency.name) {
    return parts.join(', ');
  }

  const details = [currency.code, currency.symbol].filter((part): part is string => Boolean(part));

  if (details.length === 0) {
    return currency.name;
  }

  return `${currency.name} (${details.join(', ')})`;
}

export function mapCountryResponse(raw: RawCountry): CountryCard {
  const name = raw.name ?? '';

  return {
    name,
    flag: raw.flags?.svg ?? raw.flags?.png ?? raw.flag ?? '',
    capital: raw.capital ?? '',
    region: raw.region ?? '',
    population: raw.population ?? 0,
    description: raw.nativeName ?? name,
    area: typeof raw.area === 'number' ? raw.area : null,
    languages: (raw.languages ?? [])
      .map((language) => language.name)
      .filter((languageName): languageName is string => Boolean(languageName)),
    currencies: (raw.currencies ?? [])
      .map(formatCurrency)
      .filter((currency) => currency.length > 0),
    borders: raw.borders ?? [],
  };
}
