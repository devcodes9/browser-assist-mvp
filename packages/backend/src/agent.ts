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
  onStatus: (status: 'thinking' | 'tool_call' | 'tool_result' | 'idle' | 'error', toolName?: string, toolArgs?: Record<string, unknown>, summary?: string) => void;
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

// Human-readable labels for tool calls shown in the UI
const TOOL_LABELS: Record<string, string> = {
  navigate: 'Navigating',
  click: 'Clicking element',
  type: 'Typing text',
  extract: 'Extracting content',
  snapshot: 'Reading page',
  discover: 'Finding interactive elements',
  screenshot: 'Taking screenshot',
  get_page_structure: 'Analyzing page structure',
  extract_table: 'Extracting table data',
  extract_links: 'Extracting links',
  get_form_fields: 'Analyzing form fields',
  scroll_to: 'Scrolling',
  search_page: 'Searching page',
  eval_on_page: 'Running JavaScript',
  wait_for_element: 'Waiting for element',
  show_plan: 'Proposing plan',
};

export function createAgent(options: {
  config: AgentConfig;
  conversationHistory: ConversationMessage[];
  isPlanApproved: () => boolean;
  onMessage: AgentCallbacks['onMessage'];
  onStatus: AgentCallbacks['onStatus'];
  onCommandRequest: AgentCallbacks['onCommandRequest'];
  onPermissionRequest: AgentCallbacks['onPermissionRequest'];
  onPlanRequest: AgentCallbacks['onPlanRequest'];
}) {
  const {
    config,
    conversationHistory,
    isPlanApproved,
    onMessage,
    onStatus,
    onCommandRequest,
    onPermissionRequest,
    onPlanRequest,
  } = options;

  const pendingCommands = new Map<string, PendingCommand>();
  const pendingPermissions = new Map<string, PendingPermission>();
  const pendingPlans = new Map<string, PendingPlan>();

  const model = getModel(config);

  const browserTools = createBrowserTools({
    onCommandRequest,
    onPermissionRequest,
    onPlanRequest,
    pendingCommands,
    pendingPermissions,
    pendingPlans,
    isPlanApproved,
  });

  const mcpTools = loadMCPTools();

  const tools = {
    ...browserTools,
    ...mcpTools,
  };

  const systemPrompt = `You are a browser automation assistant. You help users automate browser tasks.

You have access to browser control tools:
- show_plan(plan, summary): Show your plan and get user approval before performing actions.
- get_page_structure(): Get page outline (headings, landmarks, sections)
- extract_links(): Get all links with surrounding context
- discover(): Find all interactive elements with CSS selectors
- navigate(url): Navigate to a URL
- click(selector): Click an element
- type(selector, text): Type text into an input field
- extract(selector): Extract content from an element
- snapshot(): Get current page text content
- screenshot(): Take a screenshot (for vision models)
- search_page(query): Search for text on the page
- scroll_to(target): Scroll to element or position ("top", "bottom")
- wait_for_element(selector, timeout): Wait for an element to appear (useful after navigation)
- get_form_fields(): Identify all form fields and labels
- extract_table(selector): Extract table data as structured JSON
- eval_on_page(code): Execute custom JavaScript on the page

WORKFLOW:
1. UNDERSTAND: Use read-only tools first (get_page_structure, extract_links, discover, search_page) to understand the page.
2. PLAN: Call show_plan() with specific, verified steps before taking state-changing actions.
3. EXECUTE: After approval, execute the steps. Actions auto-approve if they match the plan.
4. ADAPT: If something fails or context changes, gather new info and call show_plan() again.

KEY PRINCIPLES:
- Always gather context before acting. Never guess selectors.
- After navigation, use wait_for_element() or snapshot() to confirm the page loaded.
- Be specific in plans: "Click button #submit-order" not "Click the button".
- For simple direct requests (e.g., "go to google.com"), you can plan immediately.
- If a command fails, diagnose why (element not found? page not loaded? wrong selector?) and retry intelligently.
- Keep responses concise. Report what you did and what you found, not your internal reasoning.`;

  return {
    async run(userMessage: string) {
      try {
        const messages = [
          ...conversationHistory.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
          {
            role: 'user' as const,
            content: userMessage,
          },
        ];

        const result = await generateText({
          model,
          system: systemPrompt,
          messages,
          tools,
          maxSteps: config.maxSteps,
          onStepFinish: ({ toolCalls, toolResults }) => {
            if (toolCalls && toolCalls.length > 0) {
              for (const tc of toolCalls) {
                const label = TOOL_LABELS[tc.toolName] || tc.toolName;
                onStatus('tool_call', tc.toolName, tc.args as Record<string, unknown>, label);
              }
            }
            if (toolResults && toolResults.length > 0) {
              onStatus('thinking');
            }
          },
        });

        onMessage(result.text, false, true);
      } catch (error) {
        console.error('Agent execution failed:', error);
        throw error;
      }
    },

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

    handlePermissionResponse(commandId: string, approved: boolean) {
      const pending = pendingPermissions.get(commandId);
      if (pending) {
        pendingPermissions.delete(commandId);
        pending.resolve(approved);
      }
    },

    handlePlanResponse(planId: string, approved: boolean, feedback?: string) {
      const pending = pendingPlans.get(planId);
      if (pending) {
        pendingPlans.delete(planId);
        pending.resolve({ approved, feedback });
      }
    },
  };
}

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
      const azure = createAzure({
        apiKey: config.apiKey,
        resourceName: config.azureResourceName!,
        apiVersion: config.azureApiVersion,
      });
      return azure(config.azureDeployment || config.model);
    }

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}
