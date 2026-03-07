/**
 * Extension configuration
 */

export const BACKEND_WS_URL = 'ws://localhost:8080';

export const CONFIG = {
  wsUrl: BACKEND_WS_URL,
  reconnectDelay: 2000, // Base delay (exponential backoff applied on top)
  maxReconnectAttempts: 10,
} as const;
