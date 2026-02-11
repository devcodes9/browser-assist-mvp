# Browser Assist Extension

Chrome Extension (Manifest V3) that acts as a dumb executor for the AI backend.

## Key Principle

**No AI logic in the extension.** All reasoning, planning, and decision-making happens in the backend.

## Components

### Background Service Worker
- Maintains WebSocket connection to backend
- Routes messages between sidepanel and backend
- Forwards commands to content script

### Content Script
- Executes browser commands deterministically
- Pure executor - no intelligence
- Available commands:
  - `navigate(url)`: Navigate to URL
  - `click(selector)`: Click element
  - `type(selector, text)`: Type into input
  - `extract(selector)`: Get element content
  - `snapshot()`: Get page info

### Side Panel UI
- Chat interface for user interaction
- Displays agent messages
- Permission gates for browser actions
- Connection status indicator

## Development

### Build

```bash
npm run build
```

Output: `dist/` directory

### Watch Mode

```bash
npm run dev
```

Rebuilds on file changes. Reload extension in Chrome after each rebuild.

### Type Checking

```bash
npm run type-check
```

## Loading in Chrome

1. Build the extension
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` directory

## Configuration

Edit `src/shared/config.ts` to change WebSocket URL:

```typescript
export const BACKEND_WS_URL = 'ws://localhost:8080';
```

## Message Flow

```
User types in Side Panel
  ↓
Side Panel → Background (user:message)
  ↓
Background → Backend (WebSocket)
  ↓
Backend processes with AI
  ↓
Backend → Background (command:request)
  ↓
Background → Content Script (execute:command)
  ↓
Content Script executes DOM operation
  ↓
Content Script → Background (result)
  ↓
Background → Backend (command:response)
  ↓
Backend → Background (agent:message)
  ↓
Background → Side Panel (display response)
```

## File Structure

```
src/
├── background/
│   └── index.ts          # Service worker
├── content/
│   └── index.ts          # DOM executor
├── sidepanel/
│   ├── App.tsx           # Main React app
│   ├── main.tsx          # Entry point
│   ├── index.css         # Styles
│   └── components/
│       ├── ChatInterface.tsx
│       ├── PermissionGate.tsx
│       └── ConnectionStatus.tsx
└── shared/
    └── config.ts         # Configuration
```

## Debugging

### Background Service Worker

1. Go to `chrome://extensions/`
2. Find "Browser Assist AI"
3. Click "service worker" link
4. DevTools opens for background script

### Content Script

1. Open DevTools on any page (F12)
2. Check Console for `[Content] Script loaded`
3. Look for command execution logs

### Side Panel

1. Open side panel
2. Right-click in panel
3. Select "Inspect"
4. DevTools opens for side panel
