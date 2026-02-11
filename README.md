# Browser Assist AI - MVP

A Chrome Extension-based AI agent for browser automation, built with separation of concerns:

- **Extension**: Dumb executor (no AI logic)
- **Backend**: AI reasoning and planning using AI SDK

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Side Panel  │  │  Background  │  │   Content    │     │
│  │   (React)    │←→│   Service    │←→│   Script     │     │
│  │              │  │   Worker     │  │  (Executor)  │     │
│  └──────────────┘  └──────┬───────┘  └──────────────┘     │
└────────────────────────────┼─────────────────────────────────┘
                             │ WebSocket
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  WebSocket   │→→│   AI Agent   │→→│ Browser Tools│     │
│  │   Server     │  │   (AI SDK)   │  │   + MCP      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Extension (packages/extension)

- ✅ Manifest V3 Chrome Extension
- ✅ Side Panel UI with React
- ✅ Background service worker (WebSocket client)
- ✅ Content script (deterministic DOM executor)
- ✅ Permission gates for all browser actions
- ❌ No AI logic, no heuristics, no retries

### Backend (packages/backend)

- ✅ WebSocket server
- ✅ AI SDK Agent with provider-agnostic config
- ✅ Browser action tools (navigate, click, type, extract, snapshot)
- ✅ Permission request flow
- ✅ MCP integration support (placeholder)
- ✅ Configurable via environment variables

## Project Structure

```
browser-assist-mvp/
├── packages/
│   ├── extension/          # Chrome Extension
│   │   ├── manifest.json
│   │   ├── src/
│   │   │   ├── background/  # Service worker
│   │   │   ├── content/     # DOM executor
│   │   │   ├── sidepanel/   # React UI
│   │   │   └── shared/      # Config
│   │   ├── public/
│   │   └── package.json
│   └── backend/            # AI Backend
│       ├── src/
│       │   ├── server.ts    # WebSocket server
│       │   ├── agent.ts     # AI SDK agent
│       │   ├── config.ts    # Config loader
│       │   ├── tools/       # Browser tools
│       │   └── mcp/         # MCP integration
│       └── package.json
└── shared/                 # Shared types
    └── types.ts
```

## Setup Instructions

### Prerequisites

- Node.js >= 18
- npm
- Chrome browser
- API key for AI provider (Anthropic, OpenAI, or Azure OpenAI)

### Installation

1. **Install dependencies**

```bash
npm install
```

2. **Configure backend**

Create `.env` file in `packages/backend/`:

```bash
# For Anthropic (default)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-3-5-sonnet-20241022

# OR for OpenAI
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-...
# AI_MODEL=gpt-4-turbo

# OR for Azure OpenAI (see AZURE_SETUP.md)
# AI_PROVIDER=azure
# AZURE_API_KEY=...
# AZURE_RESOURCE_NAME=...
# AZURE_DEPLOYMENT=gpt-4

# Optional
PORT=8080
MAX_STEPS=10
```

3. **Build extension**

```bash
npm run build:extension
```

4. **Load extension in Chrome**

- Open `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select `packages/extension/dist/` directory

### Running

1. **Start backend server**

```bash
npm run dev:backend
```

You should see:
```
🚀 WebSocket server started on ws://localhost:8080
```

2. **Open Chrome extension**

- Click the extension icon in Chrome toolbar
- Side panel will open
- Wait for "Connected" status

3. **Start using**

Try these example tasks:
- "Navigate to google.com"
- "Search for AI agents"
- "Extract the page title"

## Development

### Extension development

```bash
# Watch mode (rebuilds on changes)
npm run dev:extension

# Type checking
npm run type-check --workspace=packages/extension
```

After changes, reload the extension in `chrome://extensions/`

### Backend development

```bash
# Watch mode (auto-restarts on changes)
npm run dev:backend

# Type checking
npm run type-check --workspace=packages/backend
```

## Browser Command Protocol

The extension and backend communicate via WebSocket using a JSON protocol defined in `shared/types.ts`.

### Commands (Backend → Extension)

```typescript
// Navigate to URL
{
  type: 'command:request',
  command: {
    type: 'navigate',
    id: 'nav-123',
    url: 'https://example.com'
  }
}

// Click element
{
  type: 'command:request',
  command: {
    type: 'click',
    id: 'click-123',
    selector: '#submit-button'
  }
}

// Type text
{
  type: 'command:request',
  command: {
    type: 'type',
    id: 'type-123',
    selector: 'input[name="search"]',
    text: 'hello world'
  }
}

// Extract content
{
  type: 'command:request',
  command: {
    type: 'extract',
    id: 'extract-123',
    selector: 'h1'
  }
}

// Take snapshot
{
  type: 'command:request',
  command: {
    type: 'snapshot',
    id: 'snapshot-123'
  }
}
```

### Responses (Extension → Backend)

```typescript
{
  type: 'command:response',
  result: {
    id: 'click-123',
    success: true,
    data: { selector: '#submit-button' }
  },
  tabId: 123
}
```

### Permission Flow

1. Backend requests permission:
```typescript
{
  type: 'permission:request',
  command: { type: 'click', id: 'click-123', selector: '#btn' },
  description: 'Click submit button'
}
```

2. User approves/denies in UI

3. Extension responds:
```typescript
{
  type: 'permission:response',
  commandId: 'click-123',
  approved: true,
  tabId: 123
}
```

## MCP Integration

To add MCP servers, create `packages/backend/mcp-config.json`:

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
      "env": {}
    }
  ]
}
```

**Note**: MCP integration is a placeholder in this MVP. Full implementation requires:
1. Spawning MCP server processes
2. Using `@modelcontextprotocol/sdk` to communicate
3. Dynamically registering discovered tools

## Configuration

### AI Provider

Switch between providers in `.env`:

```bash
# Anthropic (Claude)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-3-5-sonnet-20241022

# OpenAI (GPT)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
AI_MODEL=gpt-4-turbo
```

### WebSocket URL

Default: `ws://localhost:8080`

To change, edit `packages/extension/src/shared/config.ts`:

```typescript
export const BACKEND_WS_URL = 'ws://localhost:3000';
```

## Troubleshooting

### Extension not connecting

1. Check backend is running: `npm run dev:backend`
2. Check WebSocket URL matches in config
3. Check browser console for errors
4. Try manual reconnect in side panel

### Commands failing

1. Check content script is loaded (inspect page, look for console logs)
2. Verify selectors are correct
3. Check permission was granted
4. Look at background service worker console

### Type errors

```bash
npm run type-check
```

## Production Deployment

### Extension

1. Build: `npm run build:extension`
2. Package `packages/extension/dist/` as ZIP
3. Upload to Chrome Web Store

### Backend

1. Build: `npm run build:backend`
2. Deploy to your hosting platform:
   - Set environment variables
   - Run: `npm start --workspace=packages/backend`
   - Ensure WebSocket support

3. Update extension config with production WebSocket URL

## Limitations (MVP)

- ❌ No streaming responses in UI (foundation is there)
- ❌ No session persistence
- ❌ No multi-tab support
- ❌ No error recovery/retry logic
- ❌ MCP integration is placeholder only
- ❌ No auth/security on WebSocket
- ❌ Icons are placeholders

## Next Steps

1. Implement streaming UI updates
2. Add proper MCP server spawning and tool discovery
3. Add session management
4. Add authentication
5. Improve error handling
6. Add tests
7. Create proper icons
8. Add telemetry/logging

## License

MIT
# browser-assist-mvp
