// ESLint for the front end (src/, packages/, apps/editor, apps/runtime, tests/).
// Run from VectorSpace/:  npm run lint
//
// Type errors are tsc's job (`npm run typecheck`); this file looks for code that
// compiles but is likely wrong: broken hook rules, unused values, stray `any`.
// The Python API under apps/api has its own linter (ruff, apps/api/ruff.toml).

import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'apps/api', 'test-results', 'playwright-report', 'public'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      // These four come from React Compiler and describe what stops it optimising
      // a component. The build does not run React Compiler, so they are advice,
      // not bugs: warnings, until the compiler is adopted.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // A leading underscore marks a parameter or binding kept on purpose
      // (e.g. a fake's signature that must match the real one).
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // `let x` declared early so closures above its assignment can refer to it.
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
    },
  },
  {
    // A sequence that finishes in one step (a generator with no yield) is a case
    // the action sequencer must handle, so the tests write them on purpose.
    files: ['**/*.test.ts'],
    rules: { 'require-yield': 'off' },
  },
  {
    // 33 bindings left behind when the left rail was removed (19 Oct; the rail can
    // come back from commit 68caea5). Warnings, not errors, until they are cleaned
    // up with the file's current editors: deleting them now would collide with
    // their open branches. Remove this block once `npx eslint src/pages/EditorPage.tsx`
    // shows no unused-vars warnings.
    files: ['src/pages/EditorPage.tsx'],
    rules: { '@typescript-eslint/no-unused-vars': 'warn' },
  },
  {
    // Node-side code: build config, Playwright specs and their helpers.
    files: ['*.config.ts', 'tests/**/*.ts', 'scripts/**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
)
