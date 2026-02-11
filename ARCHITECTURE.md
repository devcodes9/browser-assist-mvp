# Architecture Documentation

## Overview

Browser Assist AI is built with a strict separation of concerns:

- **Extension**: Deterministic executor (zero intelligence)
- **Backend**: All AI reasoning and planning

## Core Principles

1. **No AI in the browser**: Extension is completely dumb
2. **Backend owns reasoning**: All planning, decision-making, and tool orchestration happens server-side
3. **Explicit permissions**: User must approve every browser action
4. **Provider agnostic**: Easy to swap AI providers
5. **MCP compatible**: Designed for Model Context Protocol integration

## Component Architecture

### Extension (packages/extension)

```
┌─────────────────────────────────────────────────┐
│              Chrome Extension                   │
│                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────┐│
│  │ Side Panel  │  │ Background  │  │ Content ││
│  │   (React)   │  │  Service    │  │ Script  ││
│  │             │  │   Worker    │  │         ││
│  └──────┬──────┘  └──────┬──────┘  └────┬────┘│
│         │                │                │     │
│         └────────────────┴────────────────┘     │
│                          │                      │
└──────────────────────────┼──────────────────────┘
                           │
                      WebSocket
                           │
┌──────────────────────────┼──────────────────────┐
│                Backend   │                      │
│                          ↓                      │
│  ┌────────────┐  ┌─────────────┐  ┌──────────┐│
│  │ WebSocket  │  │  AI Agent   │  │ Browser  ││
│  │  Server    │→→│  (AI SDK)   │→→│  Tools   ││
│  └────────────┘  └─────────────┘  └──────────┘│
│                         │                      │
│                         ↓                      │
│                  ┌─────────────┐               │
│                  │ MCP Servers │               │
│                  │  (Optional) │               │
│                  └─────────────┘               │
└─────────────────────────────────────────────────┘
```

### Message Flow

```
User Input
  ↓
[Side Panel]
  ↓ user:message
[Background Service Worker]
  ↓ WebSocket
[Backend WebSocket Server]
  ↓
[AI Agent] ← Makes decisions
  ↓ Uses tools
[Browser Tools] ← Calls browser commands
  ↓ permission:request
[Side Panel] ← Shows permission dialog
  ↓ User approves
  ↓ permission:response
[Backend] ← Continues execution
  ↓ command:request
[Background] ← Routes to content script
  ↓
[Content Script] ← Executes DOM operation
  ↓ command:response
[Backend] ← Receives result
  ↓ agent:message
[Side Panel] ← Displays response to user
```

## Data Flow

### 1. User Message Flow

```typescript
// Side Panel → Background
{
  type: 'user:message',
  content: 'Navigate to google.com',
  tabId: 123
}

// Background → Backend (WebSocket)
{
  type: 'user:message',
  content: 'Navigate to google.com',
  tabId: 123
}
```

### 2. Permission Request Flow

```typescript
// Backend → Extension
{
  type: 'permission:request',
  command: {
    type: 'navigate',
    id: 'nav-1234',
    url: 'https://google.com'
  },
  description: 'Navigate to Google'
}

// Extension → Backend (after user approval)
{
  type: 'permission:response',
  commandId: 'nav-1234',
  approved: true,
  tabId: 123
}
```

### 3. Command Execution Flow

```typescript
// Backend → Extension
{
  type: 'command:request',
  command: {
    type: 'click',
    id: 'click-1234',
    selector: '#submit-button'
  }
}

// Extension → Backend
{
  type: 'command:response',
  result: {
    id: 'click-1234',
    success: true,
    data: { selector: '#submit-button' }
  },
  tabId: 123
}
```

## Browser Commands

All browser commands are defined in `shared/types.ts`:

| Command | Purpose | Permission Required |
|---------|---------|---------------------|
| `navigate(url)` | Navigate to URL | Yes |
| `click(selector)` | Click element | Yes |
| `type(selector, text)` | Type into input | Yes |
| `extract(selector)` | Get element content | No |
| `snapshot()` | Get page info | No |

### Adding New Commands

1. **Define type** in `shared/types.ts`:
```typescript
export interface MyCommand {
  type: 'mycommand';
  id: string;
  param: string;
}

export type BrowserCommand =
  | NavigateCommand
  | ClickCommand
  | MyCommand; // Add here
```

2. **Add executor** in `packages/extension/src/content/index.ts`:
```typescript
async function executeCommand(command: BrowserCommand) {
  switch (command.type) {
    case 'mycommand':
      return executeMyCommand(command.id, command.param);
    // ...
  }
}
```

3. **Add tool** in `packages/backend/src/tools/browser-tools.ts`:
```typescript
myTool: tool({
  description: 'Does something',
  parameters: z.object({
    param: z.string(),
  }),
  execute: async ({ param }) => {
    const command: BrowserCommand = {
      type: 'mycommand',
      id: `my-${Date.now()}`,
      param,
    };
    // Handle permission and execution
  },
})
```

## AI SDK Integration

The backend uses Vercel's AI SDK for provider-agnostic AI:

```typescript
// Agent runs with tools
const result = await generateText({
  model,  // Provider-agnostic model
  messages,
  tools,  // Browser tools + MCP tools
  maxSteps,
});
```

### Supported Providers

- **Anthropic**: Claude 3.5 Sonnet (default)
- **OpenAI**: GPT-4 Turbo
- **Custom**: Easy to add via AI SDK

### Model Configuration

```bash
# .env
AI_PROVIDER=anthropic  # or openai
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-3-5-sonnet-20241022
```

## MCP Integration (Future)

MCP allows dynamically adding external tools:

```typescript
// Load MCP servers from config
const mcpTools = await loadMCPTools();

// Combine with browser tools
const allTools = {
  ...browserTools,
  ...mcpTools,
};

// Agent can use all tools
await generateText({ model, messages, tools: allTools });
```

### MCP Configuration

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": {}
    }
  ]
}
```

## Security Considerations

### Extension Security

- ✅ Manifest V3 (latest security standards)
- ✅ Content script runs in isolated world
- ✅ No eval() or unsafe code execution
- ✅ No API keys in extension
- ✅ All operations require user permission

### Backend Security

- ⚠️ **MVP has no authentication** - add auth before production
- ⚠️ **WebSocket not encrypted** - use WSS in production
- ✅ API keys in environment variables
- ✅ No command injection vulnerabilities

### Recommended Production Security

1. Add WebSocket authentication (JWT)
2. Use WSS (secure WebSocket)
3. Rate limiting
4. Input validation
5. CORS configuration
6. API key rotation

## Performance Considerations

### Current Implementation

- Synchronous command execution
- Single tab support
- No command batching
- No retry logic

### Production Improvements

1. **Parallel execution**: Run independent commands concurrently
2. **Command batching**: Group related operations
3. **Retry logic**: Handle transient failures
4. **Caching**: Cache page snapshots
5. **Streaming**: Stream agent responses to UI

## Error Handling

### Extension

```typescript
try {
  const result = await executeCommand(command);
  sendResponse(result);
} catch (error) {
  sendResponse({
    id: command.id,
    success: false,
    error: error.message,
  });
}
```

### Backend

```typescript
try {
  await agent.run(userMessage);
} catch (error) {
  sendError(ws, error.message);
}
```

## Testing Strategy (Future)

### Unit Tests

- Browser tools (mock WebSocket)
- Content script executors (mock DOM)
- Agent logic (mock AI SDK)

### Integration Tests

- WebSocket message flow
- Command execution pipeline
- Permission flow

### E2E Tests

- Full user scenarios
- Actual browser automation
- Multiple providers

## Deployment

### Extension

1. Build: `npm run build:extension`
2. Upload `packages/extension/dist/` to Chrome Web Store
3. Update WebSocket URL to production

### Backend

1. Build: `npm run build:backend`
2. Deploy to Node.js host (Railway, Render, etc.)
3. Set environment variables
4. Ensure WebSocket support

## Development Workflow

### Hot Reload

```bash
# Terminal 1: Backend (auto-restarts)
npm run dev:backend

# Terminal 2: Extension (rebuilds on change)
npm run dev:extension
```

After extension rebuild, reload in `chrome://extensions/`

### Debugging

- **Background**: Click "service worker" in chrome://extensions/
- **Content**: Open DevTools on page
- **Sidepanel**: Right-click → Inspect in side panel
- **Backend**: Use VS Code debugger or console.log

## Future Enhancements

1. ✅ Streaming responses in UI
2. ✅ Session persistence
3. ✅ Multi-tab support
4. ✅ Complete MCP implementation
5. ✅ Authentication
6. ✅ Rate limiting
7. ✅ Better error recovery
8. ✅ Command history
9. ✅ Undo/redo operations
10. ✅ Screenshot capture
