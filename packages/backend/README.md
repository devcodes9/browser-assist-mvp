# Browser Assist Backend

Node.js backend with AI SDK for browser automation agent.

## Key Principle

**All AI logic lives here.** The extension is just a dumb executor.

## Components

### WebSocket Server (`server.ts`)
- Accepts connections from extension
- Routes messages to agent
- Manages client state

### AI Agent (`agent.ts`)
- Uses AI SDK with provider-agnostic config
- Processes user requests
- Calls browser tools
- Handles permission flow

### Browser Tools (`tools/browser-tools.ts`)
- Tools the AI can use:
  - `navigate(url)`: Navigate browser
  - `click(selector)`: Click element
  - `type(selector, text)`: Type text
  - `extract(selector)`: Get content
  - `snapshot()`: Get page info
- Each tool requests user permission
- Tools execute commands via WebSocket

### Configuration (`config.ts`)
- Loads from `.env` file
- Provider-agnostic (Anthropic, OpenAI, etc.)
- MCP config loading

### MCP Integration (`mcp/mcp-loader.ts`)
- Placeholder for MCP server integration
- Dynamically loads external tools
- See comments for implementation guide

## Development

### Start Server

```bash
npm run dev
```

Runs with auto-reload on file changes.

### Build

```bash
npm run build
```

Compiles TypeScript to `dist/`.

### Type Checking

```bash
npm run type-check
```

## Configuration

Create `.env` file:

```bash
# Provider (anthropic or openai)
AI_PROVIDER=anthropic

# API Key
ANTHROPIC_API_KEY=sk-ant-...

# Model
AI_MODEL=claude-3-5-sonnet-20241022

# Server
PORT=8080
MAX_STEPS=10
```

## Adding New Browser Tools

1. Define tool in `tools/browser-tools.ts`:

```typescript
myTool: tool({
  description: 'What this tool does',
  parameters: z.object({
    param: z.string().describe('Parameter description'),
  }),
  execute: async ({ param }) => {
    const command: BrowserCommand = {
      type: 'mycommand',
      id: `my-${Date.now()}`,
      param,
    };

    // Request permission if needed
    const approved = await requestPermission(command, 'Description');
    if (!approved) return { success: false, error: 'Denied' };

    // Execute
    const result = await executeCommand(command);
    return result;
  },
})
```

2. Update shared types (`../../shared/types.ts`)
3. Implement executor in extension content script

## MCP Integration

MCP allows adding external tools dynamically.

### Configuration

Create `mcp-config.json`:

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

### Implementation (TODO)

Current implementation is a placeholder. To complete:

1. Use `@modelcontextprotocol/sdk` to spawn servers
2. Call `listTools()` to discover tools
3. Create AI SDK tool wrappers
4. Register tools dynamically

See `mcp/mcp-loader.ts` for implementation outline.

## Debugging

### WebSocket Messages

All messages are logged:
- `📨 Received:` - Incoming from extension
- `✓ Extension ready` - Connection established

### Agent Execution

- `🤖 Running agent with message:` - User request
- `✓ Agent finished` - Completion

### Errors

- Check console for stack traces
- Enable verbose logging if needed
- Use VS Code debugger with launch config

## Testing

### Manual Testing

1. Start backend: `npm run dev`
2. Send test message from extension
3. Check logs for execution flow

### Unit Tests (TODO)

```bash
npm test
```

## Production

### Build

```bash
npm run build
```

### Run

```bash
npm start
```

### Environment

Set production environment variables:
- `AI_PROVIDER`
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
- `AI_MODEL`
- `PORT`

### Deployment

Deploy to any Node.js hosting:
- Ensure WebSocket support
- Set environment variables
- Run `npm start`

Popular options:
- Railway
- Render
- Fly.io
- AWS (EC2, ECS)
- Google Cloud Run

Update extension config with production WebSocket URL.
