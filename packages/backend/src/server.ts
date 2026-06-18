/**
 * WebSocket Server
 * Connects extension to AI agent backend
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { WSMessage, UserMessageFromExtension, ClientConfig } from './types.js';
import { createAgent } from './agent.js';
import { resolveClientConfig, getServerCapabilities, ConfigError } from './config.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
const HEARTBEAT_INTERVAL = 30_000;
const PONG_TIMEOUT = 10_000;
const MAX_CONVERSATION_MESSAGES = 20;
const MAX_RUN_MS = process.env.MAX_RUN_MS ? parseInt(process.env.MAX_RUN_MS) : 180_000;

// Server state
const clients = new Map<WebSocket, ClientState>();

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClientState {
  tabId: number | null;
  agent: ReturnType<typeof createAgent> | null;
  abortController: AbortController | null;
  abortReason: 'user' | 'budget' | null;
  conversationHistory: ConversationMessage[];
  clientConfig: ClientConfig | null;
  isAlive: boolean;
  isProcessing: boolean;
}

// Initialize WebSocket server
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server started on ws://localhost:${PORT}`);

// Heartbeat: ping all clients every 30s, terminate if no pong
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const state = clients.get(ws);
    if (!state) return;

    if (!state.isAlive) {
      console.log('Client failed heartbeat, terminating');
      clients.delete(ws);
      ws.terminate();
      return;
    }

    state.isAlive = false;
    send(ws, { type: 'heartbeat' });

    // If no pong within timeout, mark dead
    setTimeout(() => {
      const s = clients.get(ws);
      if (s && !s.isAlive) {
        // Will be cleaned up next heartbeat cycle
      }
    }, PONG_TIMEOUT);
  });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

wss.on('connection', (ws) => {
  console.log('Extension connected');

  // Initialize client state
  clients.set(ws, {
    tabId: null,
    agent: null,
    abortController: null,
    abortReason: null,
    conversationHistory: [],
    clientConfig: null,
    isAlive: true,
    isProcessing: false,
  });

  // Announce server capabilities (BYOK providers, managed availability/models)
  const caps = getServerCapabilities();
  send(ws, {
    type: 'config:state',
    managedAvailable: caps.managedAvailable,
    managedModels: caps.managedModels,
    byokProviders: caps.byokProviders,
  });

  ws.on('message', async (data) => {
    try {
      const message: WSMessage = JSON.parse(data.toString());
      await handleMessage(ws, message);
    } catch (error) {
      console.error('Failed to handle message:', error);
      sendError(ws, 'Failed to process message');
    }
  });

  ws.on('close', () => {
    console.log('Extension disconnected');
    const state = clients.get(ws);
    state?.abortController?.abort();
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Handle incoming messages
async function handleMessage(ws: WebSocket, message: WSMessage) {
  const state = clients.get(ws);
  if (!state) return;

  switch (message.type) {
    case 'extension:ready':
      state.tabId = message.tabId;
      console.log(`Extension ready (tab: ${message.tabId})`);
      break;

    case 'user:message':
      await handleUserMessage(ws, message);
      break;

    case 'user:stop':
      if (state.abortController) {
        console.log('User stop requested');
        state.abortReason = 'user';
        state.abortController.abort();
      }
      break;

    case 'config:set':
      state.clientConfig = message.config;
      // Try resolving so the client gets immediate validation feedback
      try {
        const resolved = resolveClientConfig(message.config);
        const caps = getServerCapabilities();
        send(ws, {
          type: 'config:state',
          managedAvailable: caps.managedAvailable,
          managedModels: caps.managedModels,
          byokProviders: caps.byokProviders,
          active: {
            mode: message.config.mode,
            provider: resolved.provider,
            model: resolved.model,
          },
        });
      } catch (error) {
        const caps = getServerCapabilities();
        send(ws, {
          type: 'config:state',
          managedAvailable: caps.managedAvailable,
          managedModels: caps.managedModels,
          byokProviders: caps.byokProviders,
          error: error instanceof ConfigError ? error.message : 'Invalid config',
        });
      }
      break;

    case 'command:response':
      if (state.agent) {
        state.agent.handleCommandResponse(message.result);
      }
      break;

    case 'conversation:clear':
      state.conversationHistory = [];
      state.abortController?.abort();
      console.log('Conversation cleared');
      break;

    case 'pong':
      state.isAlive = true;
      break;

    default:
      // Ignore unknown message types silently
      break;
  }
}

// Handle user message - run agent
async function handleUserMessage(ws: WebSocket, message: UserMessageFromExtension) {
  const state = clients.get(ws);
  if (!state) return;

  // Prevent concurrent agent runs
  if (state.isProcessing) {
    sendError(ws, 'Agent is still processing the previous request. Please wait.');
    return;
  }

  // Resolve config now so we fail fast with a clear error instead of crashing the run
  let resolvedConfig;
  try {
    resolvedConfig = resolveClientConfig(state.clientConfig);
  } catch (error) {
    sendError(ws, error instanceof ConfigError ? error.message : 'Invalid model configuration');
    return;
  }

  // Build user message with page context
  const pageContext = message.pageUrl
    ? `[Current page: ${message.pageTitle || 'Untitled'} - ${message.pageUrl}]\n\n`
    : '';
  const userMessageWithContext = pageContext + message.content;

  // Add user message to history
  state.conversationHistory.push({
    role: 'user',
    content: userMessageWithContext,
  });

  // Trim conversation to sliding window
  if (state.conversationHistory.length > MAX_CONVERSATION_MESSAGES) {
    state.conversationHistory = state.conversationHistory.slice(
      -MAX_CONVERSATION_MESSAGES
    );
  }

  state.isProcessing = true;
  const abortController = new AbortController();
  state.abortController = abortController;
  state.abortReason = null;

  // Wall-clock budget: abort runaway runs even if the user doesn't hit Stop.
  const budgetTimer = setTimeout(() => {
    if (!abortController.signal.aborted) {
      console.log(`Run exceeded ${MAX_RUN_MS}ms budget, aborting`);
      state.abortReason = 'budget';
      abortController.abort();
    }
  }, MAX_RUN_MS);

  try {
    const agent = createAgent({
      config: resolvedConfig,
      conversationHistory: state.conversationHistory.slice(0, -1), // Exclude current message (passed separately)
      abortSignal: abortController.signal,
      onMessage: (content, streaming = false, done = false) => {
        send(ws, {
          type: 'agent:message',
          content,
          streaming,
          done,
        });
        if (done && content) {
          state.conversationHistory.push({
            role: 'assistant',
            content,
          });
        }
      },
      onStatus: (status, toolName, toolArgs, summary) => {
        send(ws, {
          type: 'agent:status',
          status,
          toolName,
          toolArgs,
          summary,
        });
      },
      onCommandRequest: (command) => {
        send(ws, {
          type: 'command:request',
          command,
        });
      },
    });

    state.agent = agent;

    // Send thinking status
    send(ws, { type: 'agent:status', status: 'thinking' });

    await agent.run(userMessageWithContext);

    if (abortController.signal.aborted) {
      const content = state.abortReason === 'budget'
        ? `Stopped: run exceeded ${Math.round(MAX_RUN_MS / 1000)}s budget. Send a more specific instruction or break the task into smaller steps.`
        : 'Stopped.';
      send(ws, { type: 'agent:message', content, streaming: false, done: true });
    }

    send(ws, { type: 'agent:status', status: 'idle' });
  } catch (error) {
    console.error('Agent error:', error);
    send(ws, { type: 'agent:status', status: 'error', summary: error instanceof Error ? error.message : 'Agent failed' });
    sendError(ws, error instanceof Error ? error.message : 'Agent failed');
  } finally {
    clearTimeout(budgetTimer);
    state.agent = null;
    state.abortController = null;
    state.abortReason = null;
    state.isProcessing = false;
  }
}

// Send message to extension
function send(ws: WebSocket, message: WSMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Send error message
function sendError(ws: WebSocket, error: string) {
  send(ws, {
    type: 'agent:message',
    content: `Error: ${error}`,
    streaming: false,
    done: true,
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  clearInterval(heartbeatInterval);
  wss.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  clearInterval(heartbeatInterval);
  wss.close(() => {
    process.exit(0);
  });
});
