# Quick Start Guide

Get up and running in 5 minutes.

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure Backend

```bash
cd packages/backend
cp .env.example .env
```

Edit `.env` and add your API key:

```bash
# For Anthropic Claude (recommended)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here

# OR for OpenAI
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-your-actual-key-here
```

## 3. Build Extension

```bash
cd ../..  # Back to root
npm run build:extension
```

## 4. Load Extension in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Toggle "Developer mode" (top right)
4. Click "Load unpacked"
5. Navigate to and select: `packages/extension/dist/`

## 5. Start Backend

```bash
npm run dev:backend
```

Wait for: `🚀 WebSocket server started on ws://localhost:8080`

## 6. Use the Extension

1. Click the extension icon in Chrome toolbar
2. Side panel opens on the right
3. Wait for "Connected" status (green)
4. Type a command, for example:
   - "Navigate to google.com"
   - "Search for AI agents"
   - "Extract the page title"

## Example Session

**You**: Navigate to example.com

**AI**: I'll navigate to example.com for you.

*Permission prompt appears*

**You**: *Click "Approve"*

**AI**: Successfully navigated to https://example.com

---

**You**: Extract the page title

**AI**: The page title is "Example Domain"

## Troubleshooting

### "Disconnected" status

- Make sure backend is running: `npm run dev:backend`
- Check console for errors
- Click "Reconnect" button

### Commands not working

- Open DevTools on the page (F12)
- Check for content script errors
- Verify selectors are correct

### Build errors

```bash
# Clean and rebuild
rm -rf packages/extension/dist
npm run build:extension
```

## Next Steps

- Read [README.md](./README.md) for full documentation
- Explore the [architecture](#architecture)
- Customize the agent's behavior in `packages/backend/src/agent.ts`
