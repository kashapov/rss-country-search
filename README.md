# Country Search

Live country search powered by [countries.dev](https://countries.dev).

## Scripts

- `npm test` — run unit tests
- `npm run build` — compile TypeScript to `dist/`
- `npm run build:pages` — build a static bundle into `site/` for GitHub Pages

## Deploy

Push the `country-search` branch, then in GitHub: **Settings → Pages → Source: GitHub Actions**.  
The workflow `.github/workflows/deploy-pages.yml` publishes the `site/` bundle.
