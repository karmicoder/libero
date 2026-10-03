import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
      prettier,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // Engine/layout seam: rules (engine) and presentation (board, console) share
  // only the neutral top-level modules (`state.ts` types, pure helpers like
  // `clock.ts`) that sit directly in `src/games/<sport>/`. The console reaches the engine through
  // `EngineRegistry` (src/engines), never the sport's engine directory.
  // The patterns match import strings, so they cover relative imports only. If
  // a path alias (e.g. `@/`) is ever added, extend them to match it.
  {
    files: ['src/games/*/engine/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/board', '**/board/**', '**/console', '**/console/**'],
              message:
                'Engines must not import scoreboard or console code. Share types via state.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/games/*/board/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/engine',
                '**/engine/**',
                '**/engines',
                '**/engines/**',
              ],
              message:
                'Scoreboards are view-only and never run the reducer. Import types from state.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/games/*/console/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/engine', '**/engine/**'],
              message:
                'Get the engine from EngineRegistry (src/engines) instead of importing it directly.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/games/*/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/engine',
                '**/engine/**',
                '**/engines',
                '**/engines/**',
                '**/board',
                '**/board/**',
                '**/console',
                '**/console/**',
              ],
              message:
                'Top-level sport modules (state.ts, clock.ts, ...) are the neutral shared seam; they import nothing from either side.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.{ts,js}', 'e2e/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
