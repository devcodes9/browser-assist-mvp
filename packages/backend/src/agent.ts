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
  discover_all: 'Scanning entire page',
  get_app_state: 'Reading app state',
  fetch_from_page: 'Making authenticated request',
  observe_mutations: 'Watching for page changes',
  get_page_sections: 'Reading page sections',
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

TOOLS - Organized by purpose:

Context gathering (read-only, no approval needed):
- get_page_sections(): Page content broken into semantic sections with headings. Best first tool to understand a page.
- get_page_structure(): Page outline (headings, landmarks). Lighter than get_page_sections.
- discover(): Interactive elements in the current viewport with CSS selectors.
- discover_all(): Scroll through ENTIRE page to find all interactive elements. Use for complete page analysis.
- extract_links(): All links with surrounding text context.
- search_page(query): Find text on the page with surrounding context.
- get_form_fields(): All form fields, labels, and current values.
- extract(selector): Get text/HTML/attributes from a specific element.
- extract_table(selector): Parse a table into structured JSON.
- snapshot(): Raw page text content. Use get_page_sections() instead when possible.
- screenshot(): Visual screenshot (for vision models).
- get_app_state(): Read SPA framework state (Next.js, React, Vue, Redux stores, meta tags, JSON-LD).

Actions (require plan approval):
- show_plan(plan, summary): Present your plan. Required before state-changing actions.
- navigate(url): Go to a URL.
- click(selector): Click an element.
- type(selector, text): Type into an input field.
- scroll_to(target): Scroll to element or "top"/"bottom".

Advanced tools:
- wait_for_element(selector, timeout): Wait for element to appear. Use after navigation.
- observe_mutations(selector?, timeout): Watch for DOM changes after an action.
- fetch_from_page(url, method, headers?, body?): Authenticated HTTP request using page's cookies. Requires approval.
- eval_on_page(code): Run custom JavaScript. Requires approval.

WORKFLOW:
1. UNDERSTAND: Start with get_page_sections() or get_page_structure() + discover() to understand the page.
2. PLAN: Call show_plan() with specific, verified steps (using real selectors from discover/extract_links).
3. EXECUTE: After approval, execute the steps. Actions auto-approve within the approved plan.
4. VERIFY: After actions, use observe_mutations() or wait_for_element() to confirm changes took effect.
5. ADAPT: If something fails, gather new context and call show_plan() again.

KEY PRINCIPLES:
- Always gather context before acting. Never guess selectors — use discover() or extract_links() first.
- After navigation, use wait_for_element() to confirm the page loaded before doing anything else.
- After clicking/submitting, use observe_mutations() to verify the page updated.
- Use get_app_state() on SPAs to understand the app's data without scraping DOM.
- Use fetch_from_page() when you need to call an API that requires authentication.
- Be specific in plans: "Click button #submit-order" not "Click the button".
- For simple direct requests (e.g., "go to google.com"), you can plan immediately.
- If a command fails, diagnose why and retry intelligently.
- Keep responses concise. Report what you did and found, not your reasoning.`;

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
