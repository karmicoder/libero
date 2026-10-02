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

## Conventions

- Semantic HTML: real `button`, `h1`-`h3`, `fieldset`, native form controls. Never `div` or `span` with click handlers.
- Plain CSS with custom properties in `src/styles/`. No Tailwind or similar utility-first frameworks. Utility classes must name meaning (`.danger`, `.eyebrow`), not appearance.
- Colors and spacing come from tokens in `tokens.css`; themes are token overrides (`data-theme`), defaulting to `prefers-color-scheme`.
- Accessibility is required: `jsx-a11y` lint must pass, and the e2e axe scan should stay clean.
- Component tests (Testing Library) for interactions; Playwright for important in-browser behavior.
