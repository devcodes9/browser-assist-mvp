/**
 * AI SDK Agent
 * Handles reasoning and tool orchestration. No approval gating —
 * the user controls execution via the Stop button.
 */

import { generateText, NoSuchToolError } from 'ai';
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

interface AgentCallbacks {
  onMessage: (content: string, streaming?: boolean, done?: boolean) => void;
  onStatus: (status: 'thinking' | 'tool_call' | 'tool_result' | 'idle' | 'error', toolName?: string, toolArgs?: Record<string, unknown>, summary?: string) => void;
  onCommandRequest: (command: BrowserCommand) => void;
}

interface PendingCommand {
  resolve: (result: CommandResult) => void;
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
  list_tabs: 'Listing browser tabs',
  switch_tab: 'Switching tab',
  open_tab: 'Opening new tab',
  close_tab: 'Closing tab',
};

export function createAgent(options: {
  config: AgentConfig;
  conversationHistory: ConversationMessage[];
  abortSignal?: AbortSignal;
  onMessage: AgentCallbacks['onMessage'];
  onStatus: AgentCallbacks['onStatus'];
  onCommandRequest: AgentCallbacks['onCommandRequest'];
}) {
  const {
    config,
    conversationHistory,
    abortSignal,
    onMessage,
    onStatus,
    onCommandRequest,
  } = options;

  const pendingCommands = new Map<string, PendingCommand>();

  const model = getModel(config);

  const browserTools = createBrowserTools({
    onCommandRequest,
    pendingCommands,
  });

  const mcpTools = loadMCPTools();

  const tools = {
    ...browserTools,
    ...mcpTools,
  };

  const systemPrompt = `You are a browser automation agent. The user gives you a task; you execute it directly using browser tools. The user can press Stop at any time, so don't ask for approval — just act.

# Style
- Lead with action. Briefly state what you're about to do in one short line if it's non-trivial, then do it.
- Never ask "Would you like me to…" or "Should I…". Just proceed.
- When you finish, report the result in 1-3 lines. Lead with the answer.
- If you genuinely cannot proceed (need credentials, ambiguous target, page broken), say so concisely and stop.

# Loop
1. Read the page before acting. Use get_page_sections() for content or discover() / discover_all() for interactive elements. Never guess selectors.
2. Act. Use the right tool — navigate, click, type, fetch_from_page, etc.
3. Verify. After navigation use wait_for_element(); after a click that triggers async UI use observe_mutations(). Don't assume success.
4. Adapt. If a step fails, try ONE alternative. If that fails, stop and explain.

# Tools

Reading:
- get_page_sections(): semantic content by section — usually the best first read.
- discover(): interactive elements in viewport with CSS selectors.
- discover_all(): scrolls the whole page; use when target may be below the fold or lazy-loaded.
- extract_links(): links with surrounding context.
- search_page(query): find text on the current page.
- get_form_fields(): form fields, labels, current values.
- extract(selector) / extract_table(selector): scoped text or tabular data.
- get_page_structure(): heading/landmark outline.
- snapshot(): raw page text fallback.
- screenshot(): visual capture.
- get_app_state(): Next.js / React / Vue / Redux / JSON-LD state without scraping the DOM.

Navigation & tabs:
- navigate(url), scroll_to(target).
- list_tabs(), switch_tab(tabId), open_tab(url), close_tab(tabId).

Acting:
- click(selector), type(selector, text).

Advanced:
- wait_for_element(selector, timeout).
- observe_mutations(selector, timeout).
- fetch_from_page(url, method, headers, body): authenticated HTTP from the page's session.
- eval_on_page(code): arbitrary JS when no dedicated tool fits.

# Failure & dead ends
- If a page is broken (404, maintenance, access denied), don't keep poking it. Move on or report.
- Don't retry the same failing action. Diagnose (wrong selector? page not loaded? wrong tab?) and change something, or stop.
- For multi-site tasks: if one site is down, skip it and continue.

# Research & comparison
- Use open_tab() + switch_tab() to gather from multiple sources in parallel-ish.
- Use extract_links() to find subpages worth visiting. Try different search terms before declaring "not found".`;

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
          abortSignal,
          // Repair malformed tool calls — most commonly Llama/Groq sending
          // `null` or `""` for zero-parameter tools instead of `{}`.
          experimental_repairToolCall: async ({ toolCall, error }) => {
            if (NoSuchToolError.isInstance(error)) return null;

            const argsStr = typeof toolCall.args === 'string'
              ? toolCall.args.trim()
              : JSON.stringify(toolCall.args);

            if (argsStr === '' || argsStr === 'null' || argsStr === 'undefined' || toolCall.args == null) {
              return {
                toolCallType: 'function',
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                args: '{}',
              };
            }

            return null;
          },
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
        if (abortSignal?.aborted) {
          // Server decides the user-facing abort message based on reason
          return;
        }
        console.error('Agent execution failed:', error);
        throw error;
      }
    },

    handleCommandResponse(result: CommandResult) {
      const pending = pendingCommands.get(result.id);
      if (pending) {
        pendingCommands.delete(result.id);
        // Always resolve — return errors as results so the model can adapt
        // instead of crashing the agent loop
        pending.resolve(result);
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

    case 'openai-compatible': {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
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
