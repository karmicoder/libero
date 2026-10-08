# AGENTS.md

Guidance for AI coding agents and humans working in this repo. See `README.md` for setup and `CONTRIBUTING.md` for process.

## Tickets

GitHub Issues (`karmicoder/libero`) are the source of truth for work. Find or open an issue before non-trivial changes, reference it in PRs (`Closes #N`), and put follow-ups in new issues instead of TODO comments.

## Commands

- `npm run dev`: dev server at http://localhost:5173
- `npm run check`: format check, lint, typecheck, tests, build (what CI runs)
- `npm run format`: apply Prettier
- `npm test`: Vitest component tests
- `npm run test:e2e`: Playwright (a separate `e2e` job in CI)

Run `npm run format` and `npm run check` before finishing a change.

## Architecture

- SPA React + TypeScript + Vite. No API server.
- Game engine (rules) and scoreboard layouts (presentation) are loosely coupled through a game state. Neither should import the other.
- Sports are data (`SportDefinition`) in a runtime `SportRegistry` (`src/sports/`). Don't hardcode sport lists in UI; read from the registry so sports can be injected at runtime.
- Engines attach by `sportId` in a separate `EngineRegistry`; `SportDefinition` stays data-only. The sport's state type lives in a neutral, types-only module that both engine and layouts import (enforced by an ESLint `no-restricted-imports` rule).
- Per-sport code lives in `src/games/<sport>/`: `state.ts` (the neutral types) plus other top-level files for pure helpers every side needs (e.g. `clock.ts`; they import neither side), `engine/`, `board/` (scoreboard), `console/`. `engine/` and `board/` never import each other; `board/` never imports `src/engines`; `console/` gets the engine from `EngineRegistry` (`src/engines/`), not from `engine/`. The lint patterns match relative import strings, so extend them if a path alias is ever added.
- An engine is a pure, serialisable reducer: `reduce(state, action) → { state, messages }`. `messages` are transient domain notices (e.g. `goal-scored`), never persisted or replayed. No Redux or other state-management library; use `useReducer` or a tiny store.
- The scorer console is the master and owns game state. Scoreboards are view-only: they receive `snapshot` (full state) and `notice` messages over a `SyncChannel` and never run the reducer. Clocks are `{ baseSeconds, runningSince }` so every window derives the displayed time from `Date.now()`; no tick actions.

## Design principles

- **UX guidance over hard validation.** The user knows best what the scoreboard should show. Warn and guide in the UI; block only when needed for state validity (e.g. removing the current period, having no `play` period).
- **"10-foot" scoreboard.** Boards are read from across a room: huge, high-contrast, glanceable type. Layout is defined by aspect ratio (a scaled 16:9 stage), not pixel sizes.
- **Debounce repeated-press adjustments, never discrete events.** Controls where the operator nudges a number with repeated presses (stoppage time ±; later manual subs remaining ± in #15) use `useDebouncedCommit` (`src/match/`): the console shows the pending value at once, marks it pending, and dispatches once after 1000 ms unchanged, so the boards never flash intermediate values. Flush on blur and before a dependent dispatch (e.g. period change). Goals, cards, substitutions and clock start/stop dispatch immediately. Timers here only pace the UI; they never feed the game clock.

## Conventions

- Semantic HTML: real `button`, `h1`-`h3`, `fieldset`, native form controls. Never `div` or `span` with click handlers.
- Plain CSS with custom properties. No Tailwind or similar utility-first frameworks. Utility classes must name meaning (`.danger`, `.eyebrow`), not appearance.
- No CSS preprocessors (Sass, Less, etc.). Native custom properties, nesting, `@layer`, `:has()`, and `calc()`/`color-mix()` cover what we need, and preprocessor variables would compete with the runtime tokens used for theming. If you hit a genuine need (e.g. mixins or generated rules that native CSS can't express), ask the user before adding one.
- Component styling is scoped: put it in a CSS Module next to the component (`Foo.tsx` + `Foo.module.css`) and import it there. `src/styles/` is only for global element overrides (`base.css`), tokens (`tokens.css`), and reusable utility classes. Don't add component-specific selectors to `src/styles/`.
- Only create a React component when it has a reason to exist (state, behavior, composition, logic). Don't wrap a native element just to attach styling (no `A.tsx` around `<a>`); style native elements globally in `base.css` and use utility classes for reusable patterns.
- Colors and spacing come from tokens in `tokens.css`; themes are token overrides (`data-theme`), defaulting to `prefers-color-scheme`.
- Accessibility is required: `jsx-a11y` lint must pass, and the e2e axe scan should stay clean.
- Component tests (Testing Library) for interactions; Playwright for important in-browser behavior.
