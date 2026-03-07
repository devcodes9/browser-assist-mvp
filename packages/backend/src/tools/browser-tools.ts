/**
 * Browser Action Tools
 * Tools that the AI agent can use to control the browser
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { BrowserCommand, CommandResult } from '../types.js';

interface PlanRequest {
  planId: string;
  plan: string[];
  summary: string;
}

interface BrowserToolsOptions {
  onCommandRequest: (command: BrowserCommand) => void;
  onPermissionRequest: (command: BrowserCommand, description: string) => void;
  onPlanRequest: (plan: PlanRequest) => void;
  pendingCommands: Map<
    string,
    { resolve: (result: CommandResult) => void; reject: (error: Error) => void }
  >;
  pendingPermissions: Map<
    string,
    { resolve: (approved: boolean) => void; reject: (error: Error) => void }
  >;
  pendingPlans: Map<
    string,
    { resolve: (result: { approved: boolean; feedback?: string }) => void; reject: (error: Error) => void }
  >;
  isPlanApproved: () => boolean;
}

const COMMAND_TIMEOUT = 30_000;
const PERMISSION_TIMEOUT = 60_000;
const PLAN_TIMEOUT = 300_000;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

export function createBrowserTools(options: BrowserToolsOptions) {
  const {
    onCommandRequest,
    onPermissionRequest,
    onPlanRequest,
    pendingCommands,
    pendingPermissions,
    pendingPlans,
    isPlanApproved,
  } = options;

  async function requestPermission(
    command: BrowserCommand,
    description: string
  ): Promise<boolean> {
    if (isPlanApproved()) {
      return true;
    }

    return new Promise((resolve, reject) => {
      pendingPermissions.set(command.id, { resolve, reject });
      onPermissionRequest(command, description);

      setTimeout(() => {
        if (pendingPermissions.has(command.id)) {
          pendingPermissions.delete(command.id);
          reject(new Error('Permission request timeout'));
        }
      }, PERMISSION_TIMEOUT);
    });
  }

  async function requestPlanApproval(
    plan: string[],
    summary: string
  ): Promise<{ approved: boolean; feedback?: string }> {
    const planId = `plan-${Date.now()}`;

    return new Promise((resolve, reject) => {
      pendingPlans.set(planId, { resolve, reject });
      onPlanRequest({ planId, plan, summary });

      setTimeout(() => {
        if (pendingPlans.has(planId)) {
          pendingPlans.delete(planId);
          reject(new Error('Plan approval timeout'));
        }
      }, PLAN_TIMEOUT);
    });
  }

  async function executeCommand(command: BrowserCommand): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      pendingCommands.set(command.id, { resolve, reject });
      onCommandRequest(command);

      setTimeout(() => {
        if (pendingCommands.has(command.id)) {
          pendingCommands.delete(command.id);
          reject(new Error(`Command timeout after ${COMMAND_TIMEOUT / 1000}s: ${command.type}`));
        }
      }, COMMAND_TIMEOUT);
    });
  }

  // Retry wrapper for commands that may fail due to timing (element not found after navigation)
  async function executeWithRetry(
    command: BrowserCommand,
    retries = MAX_RETRIES
  ): Promise<CommandResult> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const cmd = attempt === 0
          ? command
          : { ...command, id: `${command.id}-retry${attempt}` };
        return await executeCommand(cmd);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isRetryable = msg.includes('not found') || msg.includes('not loaded');

        if (attempt < retries && isRetryable) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Unreachable');
  }

  return {
    navigate: tool({
      description: 'Navigate the browser to a specific URL',
      parameters: z.object({
        url: z.string().describe('The URL to navigate to'),
      }),
      execute: async ({ url }) => {
        const command: BrowserCommand = {
          type: 'navigate',
          id: `nav-${Date.now()}`,
          url,
        };

        const approved = await requestPermission(command, `Navigate to ${url}`);
        if (!approved) {
          return { success: false, error: 'Permission denied by user' };
        }

        return await executeCommand(command);
      },
    }),

    click: tool({
      description: 'Click an element on the page using a CSS selector',
      parameters: z.object({
        selector: z.string().describe('CSS selector for the element to click'),
      }),
      execute: async ({ selector }) => {
        const command: BrowserCommand = {
          type: 'click',
          id: `click-${Date.now()}`,
          selector,
        };

        const approved = await requestPermission(command, `Click element: ${selector}`);
        if (!approved) {
          return { success: false, error: 'Permission denied by user' };
        }

        return await executeWithRetry(command);
      },
    }),

    type: tool({
      description: 'Type text into an input field using a CSS selector',
      parameters: z.object({
        selector: z.string().describe('CSS selector for the input element'),
        text: z.string().describe('Text to type into the element'),
      }),
      execute: async ({ selector, text }) => {
        const command: BrowserCommand = {
          type: 'type',
          id: `type-${Date.now()}`,
          selector,
          text,
        };

        const approved = await requestPermission(command, `Type "${text}" into ${selector}`);
        if (!approved) {
          return { success: false, error: 'Permission denied by user' };
        }

        return await executeWithRetry(command);
      },
    }),

    extract: tool({
      description: 'Extract content from an element on the page',
      parameters: z.object({
        selector: z.string().describe('CSS selector for the element to extract from'),
      }),
      execute: async ({ selector }) => {
        const command: BrowserCommand = {
          type: 'extract',
          id: `extract-${Date.now()}`,
          selector,
        };
        return await executeWithRetry(command);
      },
    }),

    snapshot: tool({
      description: 'Get a snapshot of the current page (URL, title, content)',
      parameters: z.object({}),
      execute: async () => {
        const command: BrowserCommand = {
          type: 'snapshot',
          id: `snapshot-${Date.now()}`,
        };
        return await executeCommand(command);
      },
    }),

    discover: tool({
      description:
        'Find all interactive elements on the page (buttons, links, inputs, etc). Returns their CSS selectors which you can use with click() and type(). Always call this before clicking or typing to get the correct selectors.',
      parameters: z.object({}),
      execute: async () => {
        const command: BrowserCommand = {
          type: 'discover',
          id: `discover-${Date.now()}`,
        };
        return await executeCommand(command);
      },
    }),

    screenshot: tool({
      description:
        'Take a screenshot of the current visible page. Returns a base64-encoded PNG image.',
      parameters: z.object({}),
      execute: async () => {
        const command: BrowserCommand = {
          type: 'screenshot',
          id: `screenshot-${Date.now()}`,
        };
        return await executeCommand(command);
      },
    }),

    get_page_structure: tool({
      description:
        'Get a structured outline of the page (headings, landmarks, sections) to understand the content hierarchy without reading the full DOM.',
      parameters: z.object({}),
      execute: async () => {
        const command: BrowserCommand = {
          type: 'get_page_structure',
          id: `struct-${Date.now()}`,
        };
        return await executeCommand(command);
      },
    }),

    extract_table: tool({
      description: 'Extract data from an HTML table into structured JSON.',
      parameters: z.object({
        selector: z.string().describe('CSS selector for the table element'),
      }),
      execute: async ({ selector }) => {
        const command: BrowserCommand = {
          type: 'extract_table',
          id: `tbl-${Date.now()}`,
          selector,
        };
        return await executeWithRetry(command);
      },
    }),

    extract_links: tool({
      description:
        'Extract all links from the page with their context (surrounding text) to help decide where to navigate next.',
      parameters: z.object({}),
      execute: async () => {
        const command: BrowserCommand = {
          type: 'extract_links',
          id: `lnks-${Date.now()}`,
        };
        return await executeCommand(command);
      },
    }),

    get_form_fields: tool({
      description:
        'Identify all form fields, labels, and their relationships to understand what information is requested.',
      parameters: z.object({}),
      execute: async () => {
        const command: BrowserCommand = {
          type: 'get_form_fields',
          id: `form-${Date.now()}`,
        };
        return await executeCommand(command);
      },
    }),

    scroll_to: tool({
      description:
        'Scroll the page to a specific element or position ("top", "bottom"). Useful to reveal lazy-loaded content.',
      parameters: z.object({
        target: z.string().describe('CSS selector or "top" or "bottom"'),
      }),
      execute: async ({ target }) => {
        const command: BrowserCommand = {
          type: 'scroll_to',
          id: `scr-${Date.now()}`,
          target,
        };
        return await executeCommand(command);
      },
    }),

    search_page: tool({
      description:
        'Search for text or elements matching a query on the page. Returns match counts and locations.',
      parameters: z.object({
        query: z.string().describe('Text to search for'),
      }),
      execute: async ({ query }) => {
        const command: BrowserCommand = {
          type: 'search_page',
          id: `srch-${Date.now()}`,
          query,
        };
        return await executeCommand(command);
      },
    }),

    wait_for_element: tool({
      description:
        'Wait for an element to appear on the page. Useful after navigation or dynamic content loading. Returns when element is found or timeout is reached.',
      parameters: z.object({
        selector: z.string().describe('CSS selector to wait for'),
        timeout: z
          .number()
          .optional()
          .default(5000)
          .describe('Max time to wait in milliseconds (default 5000)'),
      }),
      execute: async ({ selector, timeout }) => {
        const command: BrowserCommand = {
          type: 'wait_for_element',
          id: `wait-${Date.now()}`,
          selector,
          timeout: timeout ?? 5000,
        };
        return await executeCommand(command);
      },
    }),

    eval_on_page: tool({
      description:
        'Execute custom JavaScript on the page. Use this for complex data extraction, checking state, or logic that cannot be done with other tools. Requires approval.',
      parameters: z.object({
        code: z
          .string()
          .describe('JavaScript code to execute. The last expression will be returned.'),
      }),
      execute: async ({ code }) => {
        const command: BrowserCommand = {
          type: 'eval',
          id: `eval-${Date.now()}`,
          code,
        };

        const approved = await requestPermission(
          command,
          `Execute JavaScript: ${code.slice(0, 80)}${code.length > 80 ? '...' : ''}`
        );
        if (!approved) {
          return { success: false, error: 'Permission denied by user' };
        }

        return await executeCommand(command);
      },
    }),

    show_plan: tool({
      description:
        'Show a plan to the user and wait for approval before executing actions. Call this FIRST before taking any actions. Once approved, all subsequent navigate/click/type actions will auto-execute without individual permission prompts. Call again if you need to deviate from the original plan.',
      parameters: z.object({
        plan: z
          .array(z.string())
          .describe('List of actions you plan to take'),
        summary: z
          .string()
          .describe('Brief one-line summary of what you will accomplish'),
      }),
      execute: async ({ plan, summary }) => {
        const result = await requestPlanApproval(plan, summary);

        if (result.approved) {
          return {
            success: true,
            approved: true,
            message: 'Plan approved. You can now execute the actions.',
          };
        } else {
          return {
            success: true,
            approved: false,
            feedback: result.feedback,
            message: result.feedback
              ? `Plan not approved. User feedback: ${result.feedback}`
              : 'Plan not approved by user.',
          };
        }
      },
    }),
  };
}
