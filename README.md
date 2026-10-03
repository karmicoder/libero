# Libero

Digital scoreboard for multiple sports. A React single-page app with no API server.

Football and volleyball come first. Game rules (engine) and scoreboard layouts
(presentation) are meant to stay separate, linked only through a game state, and
new sports are meant to be registrable at runtime.

## Getting started

Requires the Node version in `engines.node` in `package.json` (Node 24 LTS).

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
- `src/pages/`: route components (sport selection is home; `/match/:sportId` is
  currently a placeholder `MatchPage`, replaced by the football routes below)
- `src/styles/`: tokens (themes), base element styles, shared utility classes

## Architecture

The football scoreboard and scorer console are being built under
[#1](https://github.com/karmicoder/libero/issues/1); the pieces marked _planned_
land with the child issues.

- **Engine vs. layout.** A game engine (rules) and a scoreboard layout
  (presentation) never import each other. They share only a neutral, types-only
  game state module; an ESLint `no-restricted-imports` rule enforces this
  (_planned_, [#2](https://github.com/karmicoder/libero/issues/2)).
- **Registries.** `SportRegistry` holds sports as data. Engines attach by
  `sportId` in a separate `EngineRegistry` (_planned_), so sports and engines can
  both be injected at runtime.
- **Engines are pure reducers:** `reduce(state, action) → { state, messages }`.
  State is serialisable; `messages` are transient notices (goal, card,
  substitution) used for banners. There is no Redux or other state library.
- **Console is master.** The scorer console owns the game state and pushes it to
  view-only scoreboards over a `SyncChannel` (`BroadcastChannel` on the same
  device) as `snapshot` (full state) and `notice` messages. A board never runs the
  reducer and does not update while disconnected. Clocks are
  `{ baseSeconds, runningSince }`, so each window derives its own display time.
- **Routes (_planned_):** `/match/football` is the console and
  `/match/football/board` is the scoreboard.

### Opening the scoreboard in a second window

From the console, use **Open scoreboard** (a new window you can move to a second
screen or projector). The **Board connected** indicator shows when it is linked.
Both windows must be on the same device and browser profile. Cross-device sync
is a follow-up ([#23](https://github.com/karmicoder/libero/issues/23)).

## Design principles

- **UX guidance over hard validation.** Warn and guide; block only when needed
  for state validity.
- **"10-foot" scoreboards.** Huge, high-contrast, glanceable type; layout is a
  scaled 16:9 stage defined by aspect ratio, not pixel sizes.

## Styling conventions

- Semantic markup first: real `button`, `h1`, `fieldset`, native radios. No `div` buttons.
- Plain CSS with custom properties. No utility-first frameworks; utility classes
  carry meaning (`.eyebrow`, `.visually-hidden`, later `.danger`), not appearance.
- Themes are token sets in `src/styles/tokens.css`. Default follows
  `prefers-color-scheme`; `<html data-theme="...">` overrides it.
