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

- `src/sports/`: `SportDefinition` (data only) + `SportRegistry`, the seam for runtime-injected sports
- `src/engines/`: `EngineRegistry`; engines attach by `sportId`
- `src/consoles/`, `src/boards/`: registries for the scorer console and scoreboard components per sport
- `src/games/<sport>/`: everything sport-specific (see below)
- `src/match/`: sport-agnostic hosts. `MatchSession` owns the `MatchStore` (state + local backup and resume), `ConsoleHost` and `BoardHost` wire a console or board to it
- `src/sync/`: `SyncChannel` and its `BroadcastChannel` transport
- `src/pages/`: route components. `SportSelectPage` is home, `MatchPage` renders the scorer console, `BoardPage` renders the scoreboard
- `src/styles/`: tokens (themes), base element styles, shared utility classes
- `e2e/`: Playwright specs

Each sport lives in `src/games/<sport>/` (football today):

- `state.ts`: the neutral, types-only game state. Engine and board both import it; ESLint enforces that they import nothing else from each other
- `engine/`: the pure reducer
- `board/`: the scoreboard layout
- `console/`: the scorer console. It gets the engine from `EngineRegistry`, not from `engine/`
- other top-level files (`clock.ts`, `config.ts`, ...): pure helpers every side may use

## Routes

| Route                   | Page              | What it is                                       |
| ----------------------- | ----------------- | ------------------------------------------------ |
| `/`                     | `SportSelectPage` | Pick a sport                                     |
| `/match/:sportId`       | `MatchPage`       | Scorer console (master); e.g. `/match/football`  |
| `/match/:sportId/board` | `BoardPage`       | View-only scoreboard, full window, no app header |

A sport that is not `ready`, or has no engine and console registered, shows a
"coming soon" placeholder on `/match/:sportId`.

## Architecture

- **Engine vs. layout.** A game engine (rules) and a scoreboard layout
  (presentation) never import each other. They share only the neutral,
  types-only game state module (`state.ts`); ESLint `no-restricted-imports`
  rules in `eslint.config.js` enforce this.
- **Registries.** `SportRegistry` holds sports as data. Engines attach by
  `sportId` in a separate `EngineRegistry`, and consoles and boards in their own
  registries, so sports and their code can be injected at runtime. UI reads the
  sport list from the registry; nothing hardcodes it.
- **Engines are pure reducers:** `reduce(state, action) → { state, messages }`.
  State is serialisable; `messages` are transient notices (goal, card,
  substitution) used for banners, never persisted or replayed. There is no Redux
  or other state library.
- **Console is master.** The scorer console owns the game state and pushes it to
  view-only scoreboards over a `SyncChannel` (`BroadcastChannel` on the same
  device) as `snapshot` (full state) and `notice` messages. A board never runs the
  reducer and does not update while disconnected. Clocks are
  `{ baseSeconds, runningSince }`, so each window derives its own display time
  from the monotonic `performance.now()` (so system clock changes can't move
  it); there are no tick actions.
- **Resume.** The console keeps a best-effort backup of the match in
  `localStorage` and offers to resume it after a reload. A running clock comes
  back stopped; you can add the estimated time since the last save.

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
