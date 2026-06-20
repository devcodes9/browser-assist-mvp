/**
 * Background Service Worker
 * Handles WebSocket connection to backend and routes messages
 */

import type { WSMessage, CommandRequestMessage } from '@shared/types';
import { CONFIG } from '../shared/config';

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const state = {
  connected: false,
  currentTabId: null as number | null,
};

// --- Connection with exponential backoff ---

function getReconnectDelay(): number {
  // Exponential backoff: 2s, 4s, 8s, 16s, 32s, max 60s
  const base = 2000;
  const delay = Math.min(base * Math.pow(2, reconnectAttempts), 60_000);
  return delay;
}

function connectWebSocket() {
  if (ws?.readyState === WebSocket.OPEN) return;

  // Clear any pending reconnect
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  console.log('[Background] Connecting to backend...');
  ws = new WebSocket(CONFIG.wsUrl);

  ws.onopen = () => {
    console.log('[Background] Connected to backend');
    state.connected = true;
    reconnectAttempts = 0;

    // Persist connection state
    chrome.storage.session.set({ backendConnected: true });

    broadcastToSidepanel({ type: 'backend:connected' });
  };

  ws.onmessage = (event) => {
    try {
      const message: WSMessage = JSON.parse(event.data);
      handleBackendMessage(message);
    } catch (error) {
      console.error('[Background] Failed to parse message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('[Background] WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('[Background] Disconnected from backend');
    state.connected = false;
    ws = null;

    chrome.storage.session.set({ backendConnected: false });
    broadcastToSidepanel({ type: 'backend:disconnected' });

    // Exponential backoff reconnection
    if (reconnectAttempts < CONFIG.maxReconnectAttempts) {
      const delay = getReconnectDelay();
      console.log(`[Background] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts + 1}/${CONFIG.maxReconnectAttempts})`);
      reconnectAttempts++;
      reconnectTimer = setTimeout(connectWebSocket, delay);
    } else {
      console.log('[Background] Max reconnect attempts reached');
    }
  };
}

// Handle messages from backend
function handleBackendMessage(message: WSMessage) {
  switch (message.type) {
    case 'agent:message':
    case 'agent:status':
    case 'config:state':
      broadcastToSidepanel(message);
      break;

    case 'command:request':
      handleCommandRequest(message);
      break;

    case 'heartbeat':
      // Respond to heartbeat with pong
      sendToBackend({ type: 'pong' });
      break;

    default:
      break;
  }
}

// Handle command execution request from backend
async function handleCommandRequest(message: CommandRequestMessage) {
  const { command } = message;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error('No active tab found');
    }

    // Handle commands that run in background (not content script)
    if (command.type === 'screenshot') {
      const result = await executeScreenshot(command.id);
      sendToBackend({ type: 'command:response', result, tabId: tab.id });
      return;
    }

    if (command.type === 'list_tabs') {
      const result = await executeListTabs(command.id);
      sendToBackend({ type: 'command:response', result, tabId: tab.id });
      return;
    }

    if (command.type === 'switch_tab') {
      const result = await executeSwitchTab(command.id, command.tabId);
      sendToBackend({ type: 'command:response', result, tabId: command.tabId });
      return;
    }

    if (command.type === 'open_tab') {
      const result = await executeOpenTab(command.id, command.url);
      sendToBackend({ type: 'command:response', result, tabId: tab.id });
      return;
    }

    if (command.type === 'close_tab') {
      const result = await executeCloseTab(command.id, command.tabId);
      sendToBackend({ type: 'command:response', result, tabId: tab.id });
      return;
    }

    // Send to content script
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        type: 'execute:command',
        command,
      });
    } catch {
      // Content script not loaded - inject it first
      console.log('[Background] Content script not found, injecting...');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      response = await chrome.tabs.sendMessage(tab.id, {
        type: 'execute:command',
        command,
      });
    }

    sendToBackend({ type: 'command:response', result: response, tabId: tab.id });
  } catch (error) {
    console.error('[Background] Command execution failed:', error);
    sendToBackend({
      type: 'command:response',
      result: {
        id: command.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      tabId: state.currentTabId ?? 0,
    });
  }
}

async function executeScreenshot(id: string) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
    const base64Data = dataUrl.split(',')[1];

    return {
      id,
      success: true,
      data: {
        imageBase64: base64Data,
        mimeType: 'image/png',
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    return {
      id,
      success: false,
      error: error instanceof Error ? error.message : 'Screenshot failed',
    };
  }
}

async function executeListTabs(id: string) {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const tabData = tabs.map((tab) => ({
      tabId: tab.id,
      title: tab.title || '',
      url: tab.url || '',
      active: tab.active,
      index: tab.index,
    }));
    return { id, success: true, data: { tabs: tabData } };
  } catch (error) {
    return { id, success: false, error: error instanceof Error ? error.message : 'Failed to list tabs' };
  }
}

async function executeSwitchTab(id: string, tabId: number) {
  try {
    await chrome.tabs.update(tabId, { active: true });
    const tab = await chrome.tabs.get(tabId);
    // Inject content script into the new tab if needed
    if (tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
      } catch {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
      }
    }
    return {
      id,
      success: true,
      data: { tabId: tab.id, title: tab.title || '', url: tab.url || '' },
    };
  } catch (error) {
    return { id, success: false, error: error instanceof Error ? error.message : 'Failed to switch tab' };
  }
}

async function executeOpenTab(id: string, url: string) {
  try {
    const tab = await chrome.tabs.create({ url, active: true });
    // Wait a moment for the page to start loading, then inject content script
    await new Promise((r) => setTimeout(r, 500));
    if (tab.id) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
      } catch {
        // Page might not be ready yet, content script will be injected on demand
      }
    }
    return {
      id,
      success: true,
      data: { tabId: tab.id, title: tab.title || '', url: tab.url || '' },
    };
  } catch (error) {
    return { id, success: false, error: error instanceof Error ? error.message : 'Failed to open tab' };
  }
}

async function executeCloseTab(id: string, tabId: number) {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    if (tabs.length <= 1) {
      return { id, success: false, error: 'Cannot close the last tab' };
    }
    await chrome.tabs.remove(tabId);
    return { id, success: true, data: { closedTabId: tabId } };
  } catch (error) {
    return { id, success: false, error: error instanceof Error ? error.message : 'Failed to close tab' };
  }
}

function sendToBackend(message: WSMessage) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('[Background] Cannot send: WebSocket not connected');
    return;
  }
  ws.send(JSON.stringify(message));
}

function broadcastToSidepanel(message: unknown) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Sidepanel might not be open
  });
}

// Handle messages from sidepanel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'sidepanel:ready':
      // Sidepanel opened - send current connection status and auto-reconnect if needed
      sendResponse({ connected: state.connected });
      if (!state.connected) {
        reconnectAttempts = 0; // Reset on manual reopen
        connectWebSocket();
      }
      break;

    case 'user:message':
      if (message.tabId) {
        state.currentTabId = message.tabId;
      }
      sendToBackend(message);
      break;

    case 'user:stop':
    case 'conversation:clear':
    case 'config:set':
      sendToBackend(message);
      break;

    case 'connect:backend':
      reconnectAttempts = 0;
      connectWebSocket();
      break;

    default:
      break;
  }

  return true;
});

// Handle extension icon click - open sidepanel
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await chrome.sidePanel.open({ tabId: tab.id });
  state.currentTabId = tab.id;
});

// Initialize on startup
connectWebSocket();

console.log('[Background] Service worker initialized');
