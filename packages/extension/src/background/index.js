/**
 * Background Service Worker
 * Handles WebSocket connection to backend and routes messages
 */
import { CONFIG } from '../shared/config';
let ws = null;
let reconnectAttempts = 0;
// State management
const state = {
    connected: false,
    currentTabId: null,
};
// Initialize WebSocket connection
function connectWebSocket() {
    if (ws?.readyState === WebSocket.OPEN)
        return;
    console.log('[Background] Connecting to backend...');
    ws = new WebSocket(CONFIG.wsUrl);
    ws.onopen = () => {
        console.log('[Background] Connected to backend');
        state.connected = true;
        reconnectAttempts = 0;
        // Notify sidepanel
        broadcastToSidepanel({ type: 'backend:connected' });
    };
    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleBackendMessage(message);
        }
        catch (error) {
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
        // Notify sidepanel
        broadcastToSidepanel({ type: 'backend:disconnected' });
        // Attempt reconnection
        if (reconnectAttempts < CONFIG.maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`[Background] Reconnecting... (attempt ${reconnectAttempts})`);
            setTimeout(connectWebSocket, CONFIG.reconnectDelay);
        }
    };
}
// Handle messages from backend
function handleBackendMessage(message) {
    console.log('[Background] Received from backend:', message.type);
    switch (message.type) {
        case 'agent:message':
            // Forward to sidepanel
            broadcastToSidepanel(message);
            break;
        case 'command:request':
            handleCommandRequest(message);
            break;
        case 'permission:request':
            // Forward to sidepanel for user approval
            broadcastToSidepanel(message);
            break;
        case 'plan:request':
            // Forward plan approval request to sidepanel
            broadcastToSidepanel(message);
            break;
        default:
            console.warn('[Background] Unknown message type:', message);
    }
}
// Handle command execution request from backend
async function handleCommandRequest(message) {
    const { command } = message;
    try {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
            throw new Error('No active tab found');
        }
        // Handle screenshot command directly in background script
        // (chrome.tabs.captureVisibleTab only works here, not in content script)
        if (command.type === 'screenshot') {
            const result = await executeScreenshot(command.id);
            sendToBackend({
                type: 'command:response',
                result,
                tabId: tab.id,
            });
            return;
        }
        // Send other commands to content script
        let response;
        try {
            response = await chrome.tabs.sendMessage(tab.id, {
                type: 'execute:command',
                command,
            });
        }
        catch (err) {
            // Content script not loaded - inject it first
            console.log('[Background] Content script not found, injecting...');
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js'],
            });
            // Wait a bit for script to initialize
            await new Promise((resolve) => setTimeout(resolve, 100));
            // Retry the command
            response = await chrome.tabs.sendMessage(tab.id, {
                type: 'execute:command',
                command,
            });
        }
        // Send result back to backend
        sendToBackend({
            type: 'command:response',
            result: response,
            tabId: tab.id,
        });
    }
    catch (error) {
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
// Execute screenshot in background script (chrome.tabs.captureVisibleTab only works here)
async function executeScreenshot(id) {
    try {
        const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
        // dataUrl format: "data:image/png;base64,iVBORw0KGgo..."
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
    }
    catch (error) {
        console.error('[Background] Screenshot failed:', error);
        return {
            id,
            success: false,
            error: error instanceof Error ? error.message : 'Screenshot failed',
        };
    }
}
// Send message to backend
function sendToBackend(message) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.error('[Background] Cannot send message: WebSocket not connected');
        return;
    }
    ws.send(JSON.stringify(message));
}
// Broadcast message to all sidepanel instances
function broadcastToSidepanel(message) {
    chrome.runtime.sendMessage(message).catch(() => {
        // Sidepanel might not be open, ignore error
    });
}
// Handle messages from sidepanel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('[Background] Received from extension:', message.type);
    switch (message.type) {
        case 'sidepanel:ready':
            // Sidepanel opened, send connection status
            sendResponse({ connected: state.connected });
            break;
        case 'user:message':
            // Forward user message to backend
            if (message.tabId) {
                state.currentTabId = message.tabId;
            }
            sendToBackend(message);
            break;
        case 'permission:response':
            // Forward permission response to backend
            sendToBackend(message);
            break;
        case 'plan:response':
            // Forward plan approval response to backend
            sendToBackend(message);
            break;
        case 'connect:backend':
            // Manual reconnection request
            connectWebSocket();
            break;
        default:
            console.warn('[Background] Unknown message type:', message);
    }
    return true; // Keep message channel open for async responses
});
// Handle extension icon click - open sidepanel
chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id)
        return;
    // Open side panel
    await chrome.sidePanel.open({ tabId: tab.id });
    // Store current tab ID
    state.currentTabId = tab.id;
});
// Initialize on startup
connectWebSocket();
console.log('[Background] Service worker initialized');
