# Libero

Digital scoreboard for multiple sports. A React single-page app with no API server.

Football and volleyball come first. Game rules (engine) and scoreboard layouts
(presentation) are meant to stay separate, linked only through a game state, and
new sports are meant to be registrable at runtime.

## Getting started

Requires Node 24 (LTS), see `.nvmrc`.

```sh
npm install
npm run dev          # http://localhost:5173
```

## Scripts

| Script             | What it does                                                    |
| ------------------ | --------------------------------------------------------------- |
| `npm run check`    | Everything CI runs: format, lint, typecheck, tests, build       |
| `npm test`         | Vitest + Testing Library component tests                        |
| `npm run test:e2e` | Playwright (Chromium) with axe a11y scan; starts the dev server |
| `npm run lint`     | ESLint, including `jsx-a11y`                                    |
| `npm run format`   | Prettier                                                        |

First e2e run needs a browser: `npx playwright install chromium`.
CI (`.github/workflows/ci.yml`) runs two parallel jobs: `check` (format, lint,
typecheck, unit tests, build) and `e2e` (Playwright; uploads a report on failure).

## Contributing

Work is tracked in [GitHub Issues](https://github.com/karmicoder/libero/issues). See [CONTRIBUTING.md](CONTRIBUTING.md). AI agents: see [AGENTS.md](AGENTS.md).

## Layout

- `src/sports/`: `SportDefinition` + `SportRegistry` (the seam for runtime-injected sports)
- `src/pages/`: route components (sport selection is home; `/match/:sportId` is a stub)
- `src/styles/`: tokens (themes), base element styles, component styles

## Styling conventions

- Semantic markup first: real `button`, `h1`, `fieldset`, native radios. No `div` buttons.
- Plain CSS with custom properties. No utility-first frameworks; utility classes
  carry meaning (`.eyebrow`, `.visually-hidden`, later `.danger`), not appearance.
- Themes are token sets in `src/styles/tokens.css`. Default follows
  `prefers-color-scheme`; `<html data-theme="...">` overrides it.
