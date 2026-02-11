# Setup Instructions

## Prerequisites

- Node.js >= 18
- npm
- Chrome browser
- AI API key (Anthropic or OpenAI)

## Installation (5 minutes)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Backend

```bash
cd packages/backend
cp .env.example .env
```

Edit `.env` and add your API key:

```bash
# For Anthropic Claude (recommended)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
AI_MODEL=claude-3-5-sonnet-20241022

# OR for OpenAI
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-your-actual-key-here
# AI_MODEL=gpt-4-turbo
```

### 3. Build Extension

```bash
cd ../..  # Back to root
npm run build:extension
```

You should see:
```
✓ built in 374ms
✓ Manifest copied to dist/
✓ Build artifacts organized
```

### 4. Load Extension in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Navigate to and select: `packages/extension/dist/`
6. Extension should appear with name "Browser Assist AI"

### 5. Start Backend

```bash
npm run dev:backend
```

You should see:
```
🚀 WebSocket server started on ws://localhost:8080
```

### 6. Test the Extension

1. Click the extension icon in Chrome toolbar (puzzle piece icon, then Browser Assist AI)
2. Side panel opens on the right
3. Wait for status to show "Connected" (green)
4. Try these commands:
   - "Navigate to example.com"
   - "Extract the page title"
   - "Take a snapshot"

## Troubleshooting

### Extension won't load

**Error: "Could not load manifest"**
- Make sure you selected `packages/extension/dist/` (not the root or src folder)
- Rebuild: `npm run build:extension`

**Error: Missing files**
- Check `packages/extension/dist/` contains:
  - manifest.json
  - background.js
  - content.js
  - sidepanel.html
  - assets/ folder

### Backend won't start

**Error: "Missing API key"**
- Check `.env` file exists in `packages/backend/`
- Verify API key is correct
- Make sure no quotes around the key

**Error: "Port already in use"**
- Change PORT in `.env`: `PORT=3000`
- Update extension config: `packages/extension/src/shared/config.ts`

### Extension shows "Disconnected"

1. Make sure backend is running: `npm run dev:backend`
2. Check WebSocket URL matches:
   - Backend: `PORT=8080` in `.env`
   - Extension: `BACKEND_WS_URL` in `packages/extension/src/shared/config.ts`
3. Click "Reconnect" button in side panel

### Commands don't work

1. Open DevTools on the page (F12)
2. Check Console for errors
3. Look for `[Content] Script loaded` message
4. Verify CSS selectors are correct

### Permission dialog doesn't appear

- Check background service worker console:
  1. Go to `chrome://extensions/`
  2. Find "Browser Assist AI"
  3. Click "service worker" link
  4. Check for errors

## Development Workflow

### Backend Development

```bash
# Watch mode (auto-restarts on changes)
npm run dev:backend
```

Edit files in `packages/backend/src/`, server restarts automatically.

### Extension Development

```bash
# Watch mode (rebuilds on changes)
npm run dev:extension
```

After each rebuild:
1. Go to `chrome://extensions/`
2. Click refresh icon on "Browser Assist AI"
3. Reload any pages where you want to test

### Type Checking

```bash
# Check all packages
npm run type-check

# Check specific package
npm run type-check --workspace=packages/backend
npm run type-check --workspace=packages/extension
```

## Next Steps

- Read [README.md](./README.md) for full documentation
- See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
- Check [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) for overview

## Common Commands

```bash
# Build everything
npm run build

# Build extension only
npm run build:extension

# Build backend only
npm run build:backend

# Type check
npm run type-check

# Clean build
rm -rf packages/*/dist
npm run build
```

## Production Deployment

### Extension

1. Build: `npm run build:extension`
2. Zip `packages/extension/dist/`
3. Upload to Chrome Web Store

### Backend

1. Build: `npm run build:backend`
2. Deploy `packages/backend/` to Node.js host
3. Set environment variables
4. Run: `npm start --workspace=packages/backend`
5. Update extension WebSocket URL to production

## Support

Found an issue? Check:
1. [QUICKSTART.md](./QUICKSTART.md)
2. [README.md](./README.md) troubleshooting section
3. Backend console for errors
4. Chrome DevTools console

---

Ready to go! 🚀
