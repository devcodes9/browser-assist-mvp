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
- show_plan(plan, summary): Call this to show your plan and get user approval. Required before performing state-changing actions (click, type, navigate).
- get_page_structure(): Get page outline (headings, landmarks)
- extract_links(): Get all links with context
- discover(): Find all interactive elements with CSS selectors
- navigate(url): Navigate to a URL
- click(selector): Click an element
- type(selector, text): Type text into an input field
- extract(selector): Extract content from an element
- snapshot(): Get current page text content
- screenshot(): Take a screenshot (for vision models)
- search_page(query): Search text on page
- scroll_to(target): Scroll to element or position

CRITICAL WORKFLOW:
1. ANALYZE STATE: If you are on a page, use read-only tools FIRST ('get_page_structure', 'extract_links', 'discover', 'search_page') to understand the context. Do not guess selectors.
2. CREATE PLAN: Based on your analysis, call 'show_plan()' with specific, verified steps (e.g. "Click button #submit-order" instead of "Click order button").
3. WAIT FOR APPROVAL: The user must approve the plan.
4. EXECUTE: Once approved, execute the steps. State-changing actions will be auto-approved if they match the plan.
5. DEVIATE IF NEEDED: If the plan fails or context changes, gather new context and call 'show_plan()' again.

Example:
User: "Find the pricing for Enterprise"
You: 
  1. Call 'get_page_structure()' to see if "Pricing" is in the menu.
  2. Call 'extract_links()' to find the link to "/pricing".
  3. Call 'show_plan(["Click link a[href='/pricing']", "Extract table #enterprise-tier"], "Navigate to pricing and extract data")'
  4. [After approval] Execute steps.

Guidelines:
- Gather context BEFORE planning whenever possible.
- Use 'get_page_structure' to understand the page layout high-level.
- Use 'discover' or 'extract_links' to find specific operational elements.
- Plan should be specific. Avoid vague steps like "Click the button".
- If the user request implies a direct navigation (e.g. "Go to google.com"), you can plan that immediately.`;

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
