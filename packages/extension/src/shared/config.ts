/**
 * Extension configuration
 */

export const BACKEND_WS_URL = 'ws://localhost:8080';

export const CONFIG = {
  wsUrl: BACKEND_WS_URL,
  reconnectDelay: 2000,
  maxReconnectAttempts: 5,
} as const;
