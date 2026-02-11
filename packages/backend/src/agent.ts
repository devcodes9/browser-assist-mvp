/**
 * AI SDK Agent
 * Handles reasoning, planning, and tool orchestration
 */

import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createAzure } from '@ai-sdk/azure';
import type { AgentConfig, BrowserCommand, CommandResult } from './types.js';
import { createBrowserTools } from './tools/browser-tools.js';
import { loadMCPTools } from './mcp/mcp-loader.js';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PlanRequest {
  planId: string;
  plan: string[];
  summary: string;
}

interface AgentCallbacks {
  onMessage: (content: string, streaming?: boolean, done?: boolean) => void;
  onCommandRequest: (command: BrowserCommand) => void;
  onPermissionRequest: (command: BrowserCommand, description: string) => void;
  onPlanRequest: (plan: PlanRequest) => void;
}

interface PendingCommand {
  resolve: (result: CommandResult) => void;
  reject: (error: Error) => void;
}

interface PendingPermission {
  resolve: (approved: boolean) => void;
  reject: (error: Error) => void;
}

interface PendingPlan {
  resolve: (result: { approved: boolean; feedback?: string }) => void;
  reject: (error: Error) => void;
}

export function createAgent(options: {
  config: AgentConfig;
  conversationHistory: ConversationMessage[];
  isPlanApproved: () => boolean;
  onMessage: AgentCallbacks['onMessage'];
  onCommandRequest: AgentCallbacks['onCommandRequest'];
  onPermissionRequest: AgentCallbacks['onPermissionRequest'];
  onPlanRequest: AgentCallbacks['onPlanRequest'];
}) {
  const {
    config,
    conversationHistory,
    isPlanApproved,
    onMessage,
    onCommandRequest,
    onPermissionRequest,
    onPlanRequest,
  } = options;

  // Pending command/permission/plan promises
  const pendingCommands = new Map<string, PendingCommand>();
  const pendingPermissions = new Map<string, PendingPermission>();
  const pendingPlans = new Map<string, PendingPlan>();

  // Get AI model based on config
  const model = getModel(config);

  // Create browser tools
  const browserTools = createBrowserTools({
    onCommandRequest,
    onPermissionRequest,
    onPlanRequest,
    pendingCommands,
    pendingPermissions,
    pendingPlans,
    isPlanApproved,
  });

  // Load MCP tools (if configured)
  const mcpTools = loadMCPTools();

  // Combine all tools
  const tools = {
    ...browserTools,
    ...mcpTools,
  };

  // System prompt (constant across conversation)
  const systemPrompt = `You are a browser automation assistant. You help users automate browser tasks.

You have access to browser control tools:
- show_plan(plan, summary): ALWAYS call this FIRST to show your plan and get user approval
- discover(): Find all interactive elements with CSS selectors
- navigate(url): Navigate to a URL
- click(selector): Click an element
- type(selector, text): Type text into an input field
- extract(selector): Extract content from an element
- snapshot(): Get current page text content
- screenshot(): Take a screenshot (for vision models)

CRITICAL WORKFLOW:
1. When user asks for a task, FIRST call show_plan() with your planned steps
2. Wait for approval before taking any actions
3. Once approved, execute your plan - actions will auto-approve
4. If you need to deviate significantly from the plan, call show_plan() again

Example:
User: "Add a todo item"
You: Call show_plan(["Navigate to todo app", "Click add button", "Type 'Buy groceries'"], "Add a new todo item")
[After approval] Execute the steps

Guidelines:
- Always show plan first for multi-step tasks
- Use discover() to get selectors before clicking
- Call show_plan() again if encountering unexpected situations
- Remember previous actions in this conversation`;

  return {
    async run(userMessage: string) {
      try {
        console.log('🤖 Running agent with message:', userMessage);
        console.log('📜 Conversation history length:', conversationHistory.length);

        // Build messages from conversation history + current message
        const messages = [
          // Include previous conversation for context
          ...conversationHistory.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
          // Add current user message
          {
            role: 'user' as const,
            content: userMessage,
          },
        ];

        // Use generateText with conversation history
        const result = await generateText({
          model,
          system: systemPrompt,
          messages,
          tools,
          maxSteps: config.maxSteps,
        });

        // Send final response
        onMessage(result.text, false, true);

        console.log('✓ Agent finished');
      } catch (error) {
        console.error('Agent execution failed:', error);
        throw error;
      }
    },

    // Handle command response from extension
    handleCommandResponse(result: CommandResult) {
      const pending = pendingCommands.get(result.id);
      if (pending) {
        pendingCommands.delete(result.id);
        if (result.success) {
          pending.resolve(result);
        } else {
          pending.reject(new Error(result.error || 'Command failed'));
        }
      }
    },

    // Handle permission response from user
    handlePermissionResponse(commandId: string, approved: boolean) {
      const pending = pendingPermissions.get(commandId);
      if (pending) {
        pendingPermissions.delete(commandId);
        pending.resolve(approved);
      }
    },

    // Handle plan approval response from user
    handlePlanResponse(planId: string, approved: boolean, feedback?: string) {
      const pending = pendingPlans.get(planId);
      if (pending) {
        pendingPlans.delete(planId);
        pending.resolve({ approved, feedback });
      }
    },
  };
}

// Get AI model instance based on config
function getModel(config: AgentConfig) {
  switch (config.provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
      });
      return anthropic(config.model);
    }

    case 'openai': {
      const openai = createOpenAI({
        apiKey: config.apiKey,
      });
      return openai(config.model);
    }

    case 'azure': {
      // Azure OpenAI
      const azure = createAzure({
        apiKey: config.apiKey,
        resourceName: config.azureResourceName!,
        apiVersion: config.azureApiVersion,
      });
      // Use the deployment name
      return azure(config.azureDeployment || config.model);
    }

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}
