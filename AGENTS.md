# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Browser Assist AI is an npm workspace monorepo (`packages/backend`, `packages/extension`, `shared/`). The backend is a Node.js WebSocket server that hosts an AI agent for browser automation. It has no database or external infrastructure dependencies — only an AI provider API key is required.

### Backend service

- **Dev server**: `npm run dev:backend` (runs `tsx watch` with auto-restart on changes)
- **Type-check (lint)**: `npm run type-check --workspace=packages/backend`
- **Build**: `npm run build:backend`
- The backend listens on `ws://localhost:8080` by default (configurable via `PORT` env var)
- There are no automated test suites yet; manual testing is done via WebSocket client connection

### Environment variables

The backend reads AI provider config from environment variables (see `packages/backend/.env.example`). Required secrets: `AI_PROVIDER`, plus the corresponding API key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `AZURE_API_KEY` + `AZURE_RESOURCE_NAME` + `AZURE_DEPLOYMENT`). These are injected as env vars in the Cloud Agent environment; `dotenv` will not override existing process env vars, so the `.env` file serves as fallback only.

### Gotchas

- The `shared/` package (`@browser-assist/shared`) is a workspace dependency referenced by `"main": "./types.ts"` — it ships raw `.ts` files consumed directly by `tsx` in dev mode, but the build step runs `scripts/copy-shared.js` to copy types into `dist/`.
- No ESLint or Prettier is configured; `tsc --noEmit` (via `npm run type-check`) is the only static analysis available.
- The project uses `package-lock.json` → always use `npm` (not pnpm/yarn).
