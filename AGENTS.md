# Repository Guidelines

## Project Structure & Module Organization

The extension manifest is at the repository root, and the current content script is `src/content.js`. Keep additional browser code under `src/`, static assets under `assets/`, and automated checks under `tests/` (or colocated `*.test.*` files). Keep each feature’s UI, background logic, and shared utilities in clearly named modules.

## Build, Test, and Development Commands

There is no build toolchain or test script yet; the extension currently loads directly from the repository folder. If a build toolchain is added, expose standard workflows through package scripts so contributors can run them consistently, for example:

- `npm run build` — produce the loadable extension bundle.
- `npm test` — run automated checks.
- `npm run dev` — start the local development or watch workflow, if supported.

Document required browser setup and any unpacked-extension loading steps alongside those scripts.

## Coding Style & Naming Conventions

Follow the formatter and linter configured by the project once introduced; do not add competing style tools. Use consistent two-space indentation for JavaScript/TypeScript and JSON. Prefer descriptive `camelCase` names for variables and functions, `PascalCase` for component or class names, and `kebab-case` for asset filenames. Keep browser permissions and host access narrowly scoped.

## Testing Guidelines

There is no test framework or coverage requirement configured yet. Add tests for user-visible behavior and core logic as the corresponding features are implemented. Name tests after the module or behavior they cover (for example, `message-parser.test.ts`) and make them runnable through `npm test`.

## Commit & Pull Request Guidelines

Git history is not available in this checkout, so no repository-specific commit convention can be verified. Use short, imperative commit subjects (for example, `Add profile capture flow`). Pull requests should describe the user-facing change, list verification performed, link related issues, and include screenshots for UI changes. Call out permission or manifest changes explicitly.

## Security & Configuration

Do not commit credentials, personal data, browser profiles, or local environment files. Keep secrets in local environment configuration and exclude them from version control. Review manifest permissions whenever extension capabilities change.
