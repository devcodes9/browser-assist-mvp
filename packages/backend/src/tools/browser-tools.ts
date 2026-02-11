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

  // Helper to request permission
  async function requestPermission(
    command: BrowserCommand,
    description: string
  ): Promise<boolean> {
    // If plan is already approved, auto-approve all actions
    if (isPlanApproved()) {
      console.log(`✓ Auto-approved (plan approved): ${description}`);
      return true;
    }

    return new Promise((resolve, reject) => {
      pendingPermissions.set(command.id, { resolve, reject });
      onPermissionRequest(command, description);

      // Timeout after 60 seconds
      setTimeout(() => {
        if (pendingPermissions.has(command.id)) {
          pendingPermissions.delete(command.id);
          reject(new Error('Permission request timeout'));
        }
      }, 60000);
    });
  }

  // Helper to request plan approval
  async function requestPlanApproval(
    plan: string[],
    summary: string
  ): Promise<{ approved: boolean; feedback?: string }> {
    const planId = `plan-${Date.now()}`;

    return new Promise((resolve, reject) => {
      pendingPlans.set(planId, { resolve, reject });
      onPlanRequest({ planId, plan, summary });

      // Timeout after 5 minutes for plan approval
      setTimeout(() => {
        if (pendingPlans.has(planId)) {
          pendingPlans.delete(planId);
          reject(new Error('Plan approval timeout'));
        }
      }, 300000);
    });
  }

  // Helper to execute command
  async function executeCommand(command: BrowserCommand): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      pendingCommands.set(command.id, { resolve, reject });
      onCommandRequest(command);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (pendingCommands.has(command.id)) {
          pendingCommands.delete(command.id);
          reject(new Error('Command execution timeout'));
        }
      }, 30000);
    });
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

        // Request permission
        const approved = await requestPermission(command, `Navigate to ${url}`);
        if (!approved) {
          return { success: false, error: 'Permission denied by user' };
        }

        // Execute command
        const result = await executeCommand(command);
        return result;
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

        // Request permission
        const approved = await requestPermission(
          command,
          `Click element: ${selector}`
        );
        if (!approved) {
          return { success: false, error: 'Permission denied by user' };
        }

        // Execute command
        const result = await executeCommand(command);
        return result;
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

        // Request permission
        const approved = await requestPermission(
          command,
          `Type "${text}" into ${selector}`
        );
        if (!approved) {
          return { success: false, error: 'Permission denied by user' };
        }

        // Execute command
        const result = await executeCommand(command);
        return result;
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

        // No permission needed for read-only operations
        const result = await executeCommand(command);
        return result;
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

        // No permission needed for read-only operations
        const result = await executeCommand(command);
        return result;
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

        // No permission needed for read-only operations
        const result = await executeCommand(command);
        return result;
      },
    }),

    screenshot: tool({
      description:
        'Take a screenshot of the current visible page. Returns a base64-encoded PNG image. Use this with vision-capable models to see and understand what is on the page visually.',
      parameters: z.object({}),
      execute: async () => {
        const command: BrowserCommand = {
          type: 'screenshot',
          id: `screenshot-${Date.now()}`,
        };

        // No permission needed for read-only operations
        const result = await executeCommand(command);
        return result;
      },
    }),

    show_plan: tool({
      description:
        'Show a plan to the user and wait for approval before executing actions. Call this FIRST before taking any actions. Once approved, all subsequent navigate/click/type actions will auto-execute without asking. Call again if you need to deviate from the original plan.',
      parameters: z.object({
        plan: z
          .array(z.string())
          .describe('List of actions you plan to take, e.g. ["Navigate to Google Docs", "Click on document area", "Type the content"]'),
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
