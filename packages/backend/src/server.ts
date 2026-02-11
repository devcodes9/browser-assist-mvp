/**
 * WebSocket Server
 * Connects extension to AI agent backend
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { WSMessage, UserMessageFromExtension } from './types.js';
import { createAgent } from './agent.js';
import { loadConfig } from './config.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;

// Server state
const clients = new Map<WebSocket, ClientState>();

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClientState {
  tabId: number | null;
  agent: ReturnType<typeof createAgent> | null;
  conversationHistory: ConversationMessage[];
  planApproved: boolean; // When true, all actions auto-approve
}

// Initialize WebSocket server
const wss = new WebSocketServer({ port: PORT });

console.log(`🚀 WebSocket server started on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  console.log('📱 Extension connected');

  // Initialize client state
  clients.set(ws, {
    tabId: null,
    agent: null,
    conversationHistory: [],
    planApproved: false,
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
    console.log('📱 Extension disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Handle incoming messages
async function handleMessage(ws: WebSocket, message: WSMessage) {
  console.log('📨 Received:', message.type);

  const state = clients.get(ws);
  if (!state) return;

  switch (message.type) {
    case 'extension:ready':
      state.tabId = message.tabId;
      console.log(`✓ Extension ready (tab: ${message.tabId})`);
      break;

    case 'user:message':
      await handleUserMessage(ws, message);
      break;

    case 'command:response':
      // Command response from extension
      // Agent will handle this via pending promises
      if (state.agent) {
        state.agent.handleCommandResponse(message.result);
      }
      break;

    case 'permission:response':
      // Permission response from user
      if (state.agent) {
        state.agent.handlePermissionResponse(
          message.commandId,
          message.approved
        );
      }
      break;

    case 'plan:response':
      // Plan approval response from user
      if (state.agent) {
        state.agent.handlePlanResponse(
          message.planId,
          message.approved,
          message.feedback
        );
        if (message.approved) {
          state.planApproved = true;
          console.log('✓ Plan approved - subsequent actions will auto-execute');
        }
      }
      break;

    default:
      console.warn('Unknown message type:', message);
  }
}

// Handle user message - run agent
async function handleUserMessage(ws: WebSocket, message: UserMessageFromExtension) {
  const state = clients.get(ws);
  if (!state) return;

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

  try {
    // Load configuration
    const config = loadConfig();

    // Create agent instance for this session
    const agent = createAgent({
      config,
      conversationHistory: state.conversationHistory,
      isPlanApproved: () => state.planApproved,
      onMessage: (content, streaming = false, done = false) => {
        send(ws, {
          type: 'agent:message',
          content,
          streaming,
          done,
        });
        // Add assistant response to history when done
        if (done && content) {
          state.conversationHistory.push({
            role: 'assistant',
            content,
          });
        }
      },
      onCommandRequest: (command) => {
        send(ws, {
          type: 'command:request',
          command,
        });
      },
      onPermissionRequest: (command, description) => {
        send(ws, {
          type: 'permission:request',
          command,
          description,
        });
      },
      onPlanRequest: (plan) => {
        send(ws, {
          type: 'plan:request',
          ...plan,
        });
      },
    });

    state.agent = agent;

    // Run agent with user message (including page context)
    await agent.run(userMessageWithContext);

    console.log('✓ Agent completed');
  } catch (error) {
    console.error('Agent error:', error);
    sendError(ws, error instanceof Error ? error.message : 'Agent failed');
  } finally {
    state.agent = null;
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
  console.log('\n👋 Shutting down...');
  wss.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down...');
  wss.close(() => {
    process.exit(0);
  });
});
