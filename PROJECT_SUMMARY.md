# Browser Assist AI - Project Summary

## What is this?

A production-grade MVP of a browser-based AI agent built with strict separation of concerns:

- **Chrome Extension** = Dumb executor (no AI logic)
- **Backend** = Smart agent (all reasoning and planning)

## What can it do?

The AI agent can:
- ✅ Navigate to URLs
- ✅ Click elements
- ✅ Type into input fields
- ✅ Extract content from pages
- ✅ Take page snapshots

All actions require explicit user permission via a UI dialog.

## Tech Stack

### Extension
- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **Chrome API**: Manifest V3, Side Panel API
- **Communication**: WebSocket client

### Backend
- **Runtime**: Node.js 18+
- **AI**: Vercel AI SDK (provider-agnostic)
- **WebSocket**: ws library
- **Types**: TypeScript with strict mode

### Shared
- Monorepo with npm workspaces
- Shared TypeScript types
- JSON-based command protocol

## Project Structure

```
browser-assist-mvp/
├── packages/
│   ├── extension/          # Chrome Extension
│   │   ├── dist/           # Build output (load this in Chrome)
│   │   ├── src/
│   │   │   ├── background/ # Service worker (WebSocket client)
│   │   │   ├── content/    # DOM executor (no intelligence)
│   │   │   └── sidepanel/  # React UI (chat + permissions)
│   │   └── manifest.json
│   └── backend/            # AI Backend
│       ├── dist/           # Build output
│       ├── src/
│       │   ├── server.ts   # WebSocket server
│       │   ├── agent.ts    # AI SDK agent
│       │   ├── tools/      # Browser action tools
│       │   └── mcp/        # MCP integration (placeholder)
│       └── .env            # Configuration
└── shared/
    └── types.ts            # Shared TypeScript types
```

## Quick Start

See [QUICKSTART.md](./QUICKSTART.md) for detailed setup instructions.

```bash
# 1. Install
npm install

# 2. Configure
cd packages/backend
cp .env.example .env
# Edit .env with your API key

# 3. Build extension
npm run build:extension

# 4. Load in Chrome
# chrome://extensions → Load unpacked → select packages/extension/dist/

# 5. Start backend
npm run dev:backend

# 6. Use extension
# Click extension icon → Chat in side panel
```

## Key Files

### Extension Entry Points
- `packages/extension/src/background/index.ts` - Service worker
- `packages/extension/src/content/index.ts` - DOM executor
- `packages/extension/src/sidepanel/App.tsx` - React UI

### Backend Entry Points
- `packages/backend/src/server.ts` - WebSocket server
- `packages/backend/src/agent.ts` - AI agent
- `packages/backend/src/tools/browser-tools.ts` - Browser commands

### Shared
- `shared/types.ts` - All TypeScript types

## How It Works

1. **User types** in side panel: "Navigate to google.com"
2. **Side panel** sends message to background service worker
3. **Background** forwards to backend via WebSocket
4. **Backend AI agent** processes request, decides to use `navigate` tool
5. **Agent** requests permission from user
6. **User** sees permission dialog, clicks "Approve"
7. **Backend** sends `navigate` command to extension
8. **Background** routes to content script
9. **Content script** executes `window.location.href = 'https://google.com'`
10. **Content script** sends result back to backend
11. **Backend** sends success message to user
12. **Side panel** displays "Successfully navigated to google.com"

## Command Protocol

All commands follow this pattern:

```typescript
// 1. Backend → Extension: Request permission
{
  type: 'permission:request',
  command: { type: 'click', selector: '#btn' },
  description: 'Click submit button'
}

// 2. Extension → Backend: User approves
{
  type: 'permission:response',
  approved: true
}

// 3. Backend → Extension: Execute command
{
  type: 'command:request',
  command: { type: 'click', id: 'click-123', selector: '#btn' }
}

// 4. Extension → Backend: Return result
{
  type: 'command:response',
  result: { id: 'click-123', success: true }
}
```

## Configuration

### AI Provider

Set in `packages/backend/.env`:

```bash
# Anthropic (default)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key
AI_MODEL=claude-3-5-sonnet-20241022

# OR OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
AI_MODEL=gpt-4-turbo
```

### WebSocket URL

Default: `ws://localhost:8080`

Change in `packages/extension/src/shared/config.ts`:

```typescript
export const BACKEND_WS_URL = 'ws://your-server.com';
```

## Features

### Implemented ✅
- Manifest V3 Chrome extension
- Side panel UI with React
- WebSocket communication
- Permission gates for all actions
- Browser command execution (navigate, click, type, extract, snapshot)
- AI SDK integration (Anthropic, OpenAI)
- Provider-agnostic configuration
- TypeScript throughout
- Monorepo structure

### Placeholder 📝
- MCP integration (architecture ready, implementation pending)
- Streaming UI updates (backend streams, UI doesn't display yet)

### Not Implemented ❌
- Authentication
- Session persistence
- Multi-tab support
- Error recovery/retries
- Command history
- Tests
- Production icons

## Development Commands

```bash
# Install all dependencies
npm install

# Type check
npm run type-check

# Build everything
npm run build

# Build extension only
npm run build:extension

# Build backend only
npm run build:backend

# Dev mode (backend auto-restart)
npm run dev:backend

# Dev mode (extension auto-rebuild)
npm run dev:extension
```

## Documentation

- [README.md](./README.md) - Full documentation
- [QUICKSTART.md](./QUICKSTART.md) - Get started in 5 minutes
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture
- [packages/extension/README.md](./packages/extension/README.md) - Extension docs
- [packages/backend/README.md](./packages/backend/README.md) - Backend docs

## Common Tasks

### Add a new browser command

1. Define in `shared/types.ts`
2. Add executor in `packages/extension/src/content/index.ts`
3. Add tool in `packages/backend/src/tools/browser-tools.ts`

### Change AI model

Edit `packages/backend/.env`:
```bash
AI_MODEL=gpt-4-turbo
```

### Deploy to production

**Extension:**
1. Build: `npm run build:extension`
2. Zip `packages/extension/dist/`
3. Upload to Chrome Web Store

**Backend:**
1. Build: `npm run build:backend`
2. Deploy `packages/backend/dist/` to Node.js host
3. Set environment variables
4. Update extension's WebSocket URL

## Troubleshooting

### "Disconnected" in side panel
- Check backend is running: `npm run dev:backend`
- Check WebSocket URL matches
- Click "Reconnect" button

### Commands not executing
- Open DevTools on page (F12)
- Check for content script errors
- Verify selector is correct

### Type errors
- Run: `npm run type-check`
- Check for missing imports

### Build fails
- Clean: `rm -rf packages/*/dist`
- Reinstall: `rm -rf node_modules && npm install`
- Rebuild: `npm run build`

## License

MIT

## Next Steps

1. **Try it out**: Follow QUICKSTART.md
2. **Read architecture**: See ARCHITECTURE.md
3. **Customize**: Add your own commands
4. **Deploy**: Ship to production
5. **Contribute**: Add features or fix bugs

## Support

- Issues: [GitHub Issues](https://github.com/your-repo/issues)
- Questions: See README.md

---

Built with ❤️ as a production-grade MVP focused on:
- Clean architecture
- Separation of concerns
- Type safety
- Extensibility
