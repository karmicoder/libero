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
- Plain CSS with custom properties. No Tailwind or similar utility-first frameworks. Utility classes must name meaning (`.danger`, `.eyebrow`), not appearance.
- No CSS preprocessors (Sass, Less, etc.). Native custom properties, nesting, `@layer`, `:has()`, and `calc()`/`color-mix()` cover what we need, and preprocessor variables would compete with the runtime tokens used for theming. If you hit a genuine need (e.g. mixins or generated rules that native CSS can't express), ask the user before adding one.
- Component styling is scoped: put it in a CSS Module next to the component (`Foo.tsx` + `Foo.module.css`) and import it there. `src/styles/` is only for global element overrides (`base.css`), tokens (`tokens.css`), and reusable utility classes. Don't add component-specific selectors to `src/styles/`.
- Only create a React component when it has a reason to exist (state, behavior, composition, logic). Don't wrap a native element just to attach styling (no `A.tsx` around `<a>`); style native elements globally in `base.css` and use utility classes for reusable patterns.
- Colors and spacing come from tokens in `tokens.css`; themes are token overrides (`data-theme`), defaulting to `prefers-color-scheme`.
- Accessibility is required: `jsx-a11y` lint must pass, and the e2e axe scan should stay clean.
- Component tests (Testing Library) for interactions; Playwright for important in-browser behavior.
