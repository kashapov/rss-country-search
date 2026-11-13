import { describe, expect, it } from 'vitest';
import { mapCountryResponse } from '../src/map-country';
import spainFixture from './fixtures/spain.json';

describe('mapCountryResponse', () => {
  it('maps API fields needed for a country card', () => {
    const country = mapCountryResponse(spainFixture);

    expect(country).toMatchObject({
      name: 'Spain',
      flag: 'https://flagcdn.com/es.svg',
      capital: 'Madrid',
      region: 'Europe',
      population: 47351567,
    });
  });

  it('maps languages to a list of language names', () => {
    const country = mapCountryResponse(spainFixture);

    expect(country.languages).toEqual(['Spanish']);
  });

  it('maps detail fields: description, area, borders and currencies', () => {
    const country = mapCountryResponse(spainFixture);

    expect(country.description).toBe('España');
    expect(country.area).toBe(505992);
    expect(country.borders).toEqual(['AND', 'FRA', 'GIB', 'PRT', 'MAR']);
    expect(country.currencies).toEqual(['Euro (EUR, €)']);
  });

  it('falls back to emoji flag when flags.svg is missing', () => {
    const raw = {
      name: 'Spain',
      flag: '🇪🇸',
      capital: 'Madrid',
      region: 'Europe',
      population: 1,
      languages: [],
      currencies: [],
      borders: [],
      area: 0,
      nativeName: 'España',
    };

    const country = mapCountryResponse(raw);

    expect(country.flag).toBe('🇪🇸');
  });

  it('uses safe defaults for missing optional collections', () => {
    const country = mapCountryResponse({
      name: 'Narnia',
      capital: 'Cair Paravel',
      region: 'Fantasy',
      population: 0,
    });

    expect(country).toMatchObject({
      name: 'Narnia',
      capital: 'Cair Paravel',
      region: 'Fantasy',
      population: 0,
      flag: '',
      description: 'Narnia',
      area: null,
      languages: [],
      currencies: [],
      borders: [],
    });
  });
});
