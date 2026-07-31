# Contributing to VibeGL-Core

First off, thank you for considering contributing to VibeGL-Core! It's people like you that make VibeGL such a great tool for the community.

## Development Setup

This project uses `pnpm` as the package manager and `turbo` for monorepo task orchestration.

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Run tests and linting:**
   ```bash
   pnpm run test
   pnpm run lint
   ```

3. **Build the packages:**
   ```bash
   pnpm run build
   ```

4. **Run the playground locally:**
   ```bash
   pnpm run dev
   ```
   The playground runs on Next.js. Note: because of `SharedArrayBuffer` requirements for the physics engine, the local dev server is configured with `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers.

## Pull Request Process
1. Ensure any install or build dependencies are removed before the end of the layer when doing a build.
2. Update the README.md with details of changes to the interface, this includes new environment variables, exposed ports, useful file locations and container parameters.
3. You may merge the Pull Request in once you have the sign-off of at least one other developer, or if you do not have permission to do that, you may request the reviewer to merge it for you.
