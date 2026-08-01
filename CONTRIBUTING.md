# Contributing to VibeGL-Core

Thank you for contributing — this file contains quick setup and hygiene checks to keep the repo safe for publishing.

## Development quickstart

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Run tests and linting:
   ```bash
   pnpm run test
   pnpm run lint
   ```
3. Build the packages:
   ```bash
   pnpm run build
   ```
4. Run the playground locally:
   ```bash
   pnpm run dev
   ```

Note: the physics engine uses SharedArrayBuffer and may require COOP/COEP headers in dev.

## Security / Pre-commit
- The project has a pre-commit scanner to refuse commits including `.env`, `.npmrc`, or obvious tokens (NPM_TOKEN, PRIVATE_KEY, AWS_SECRET, etc.).
- Run `pnpm run precommit` locally to test the checks before committing.

## Pull Request Process
1. Follow Conventional Commits for commit messages.
2. Open a PR against `main`; include a description, testing notes, and mention any breaking changes.
3. At least one maintainer review is required before merging.

## Code of Conduct & License
Follow the repo's CODE_OF_CONDUCT.md and ensure license headers are intact for contributed files.
