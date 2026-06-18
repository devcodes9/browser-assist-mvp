/**
 * Browser Action Tools
 * Tools that the AI agent can use to control the browser.
 *
 * No per-action approval gates. The user controls execution via the Stop button.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { BrowserCommand, CommandResult } from '../types.js';

interface BrowserToolsOptions {
  onCommandRequest: (command: BrowserCommand) => void;
  pendingCommands: Map<
    string,
    { resolve: (result: CommandResult) => void; reject: (error: Error) => void }
  >;
}

const DEFAULT_TIMEOUT = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const LOOP_FAILURE_THRESHOLD = 3;

// Per-command timeout budgets. Tools that wait for explicit user-supplied
// timeouts (wait_for_element, observe_mutations) are handled separately
// in executeCommand via `slack`.
const TIMEOUTS: Record<string, number> = {
  screenshot: 10_000,
  list_tabs: 5_000,
  switch_tab: 10_000,
  open_tab: 15_000,
  close_tab: 5_000,
  navigate: 30_000,
  click: 15_000,
  type: 15_000,
  extract: 10_000,
  snapshot: 15_000,
  discover: 15_000,
  discover_all: 60_000,
  get_app_state: 10_000,
  fetch_from_page: 60_000,
  get_page_sections: 15_000,
  get_page_structure: 10_000,
  extract_table: 10_000,
  extract_links: 10_000,
  get_form_fields: 10_000,
  scroll_to: 10_000,
  search_page: 10_000,
  eval_on_page: 20_000,
};

const TIMEOUT_SLACK = 2_000; // extra time for round-trip on dynamic-timeout tools

function getTimeout(command: BrowserCommand): number {
  if (command.type === 'wait_for_element' || command.type === 'observe_mutations') {
    return command.timeout + TIMEOUT_SLACK;
  }
  return TIMEOUTS[command.type] ?? DEFAULT_TIMEOUT;
}

function callSignature(command: BrowserCommand): string {
  const { id: _id, type, ...rest } = command as BrowserCommand & { id: string };
  return `${type}:${JSON.stringify(rest)}`;
}

export function createBrowserTools(options: BrowserToolsOptions) {
  const { onCommandRequest, pendingCommands } = options;

  // Loop detector: consecutive failed calls with identical (type, args).
  // Cleared on any successful call. Read-only repeats with success don't count.
  const recentFailures: string[] = [];

  async function rawExecute(command: BrowserCommand): Promise<CommandResult> {
    const timeout = getTimeout(command);
    return new Promise((resolve) => {
      pendingCommands.set(command.id, {
        resolve,
        reject: (err) => resolve({ id: command.id, success: false, error: err.message }),
      });
      onCommandRequest(command);

      setTimeout(() => {
        if (pendingCommands.has(command.id)) {
          pendingCommands.delete(command.id);
          resolve({
            id: command.id,
            success: false,
            error: `Command timeout after ${timeout / 1000}s: ${command.type}`,
          });
        }
      }, timeout);
    });
  }

  async function executeCommand(command: BrowserCommand): Promise<CommandResult> {
    const sig = callSignature(command);

    if (
      recentFailures.length >= LOOP_FAILURE_THRESHOLD &&
      recentFailures.slice(-LOOP_FAILURE_THRESHOLD).every((s) => s === sig)
    ) {
      return {
        id: command.id,
        success: false,
        error: `Loop detected: ${command.type} with these arguments has failed ${LOOP_FAILURE_THRESHOLD} times in a row. STOP repeating this call. Change approach: try a different selector, a different tool, navigate to a fresh page, or stop and report the blocker to the user.`,
      };
    }

    const result = await rawExecute(command);

    if (result.success) {
      recentFailures.length = 0;
    } else {
      recentFailures.push(sig);
      if (recentFailures.length > 16) recentFailures.shift();
    }

    return result;
  }

  // Retry wrapper for commands that may fail due to timing (element not found after navigation)
  async function executeWithRetry(
    command: BrowserCommand,
    retries = MAX_RETRIES
  ): Promise<CommandResult> {
    let lastResult: CommandResult | undefined;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const cmd = attempt === 0
        ? command
        : { ...command, id: `${command.id}-retry${attempt}` };
      lastResult = await executeCommand(cmd);

      if (lastResult.success) return lastResult;

      const isRetryable = lastResult.error?.includes('not found') || lastResult.error?.includes('not loaded');
      if (attempt < retries && isRetryable) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY * (attempt + 1)));
        continue;
      }
      return lastResult;
    }
    return lastResult!;
  }

  return {
    navigate: tool({
      description: 'Navigate the browser to a specific URL.',
      parameters: z.object({
        url: z.string().describe('The URL to navigate to'),
      }),
      execute: async ({ url }) => {
        const command: BrowserCommand = {
          type: 'navigate',
          id: `nav-${Date.now()}`,
          url,
        };
        return await executeCommand(command);
      },
    }),

    click: tool({
      description: 'Click an element on the page using a CSS selector.',
      parameters: z.object({
        selector: z.string().describe('CSS selector for the element to click'),
      }),
      execute: async ({ selector }) => {
        const command: BrowserCommand = {
          type: 'click',
          id: `click-${Date.now()}`,
          selector,
        };
        return await executeWithRetry(command);
      },
    }),

    type: tool({
      description: 'Type text into an input field using a CSS selector.',
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
          .describe('Max time to wait in milliseconds (use 5000 for default)'),
      }),
      execute: async ({ selector, timeout }) => {
        const command: BrowserCommand = {
          type: 'wait_for_element',
          id: `wait-${Date.now()}`,
          selector,
          timeout: timeout || 5000,
        };
        return await executeCommand(command);
      },
    }),

    eval_on_page: tool({
      description:
        'Execute custom JavaScript on the page. Use this for complex data extraction, checking state, or logic that cannot be done with other tools.',
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
        return await executeCommand(command);
      },
    }),

    discover_all: tool({
      description:
        'Scan the ENTIRE page by scrolling through it, finding all interactive elements including those below the fold and lazy-loaded content. Use this instead of discover() when you need a complete picture of the page. Returns elements without bounding boxes (position-independent).',
      parameters: z.object({}),
      execute: async () => {
        const command: BrowserCommand = {
          type: 'discover_all',
          id: `discall-${Date.now()}`,
        };
        return await executeCommand(command);
      },
    }),

    get_app_state: tool({
      description:
        'Detect and extract SPA framework state: Next.js (__NEXT_DATA__), Nuxt, React, Vue, Angular, Redux stores, meta tags, and JSON-LD structured data. Powerful for understanding what data the page has without scraping the DOM.',
      parameters: z.object({}),
      execute: async () => {
        const command: BrowserCommand = {
          type: 'get_app_state',
          id: `appstate-${Date.now()}`,
        };
        return await executeCommand(command);
      },
    }),

    fetch_from_page: tool({
      description:
        'Make an authenticated HTTP request from the page context. Uses the page\'s cookies and session automatically. Useful for calling APIs that require authentication without any setup.',
      parameters: z.object({
        url: z.string().describe('URL to fetch'),
        method: z.string().describe('HTTP method (GET, POST, PUT, DELETE)'),
        headers: z.string().describe('JSON-encoded request headers, or empty string for none'),
        body: z.string().describe('Request body for POST/PUT, or empty string for none'),
      }),
      execute: async ({ url, method, headers, body }) => {
        const parsedHeaders = headers
          ? (() => { try { return JSON.parse(headers); } catch { return undefined; } })()
          : undefined;
        const command: BrowserCommand = {
          type: 'fetch_from_page',
          id: `fetch-${Date.now()}`,
          url,
          method: method || 'GET',
          headers: parsedHeaders,
          body: body || undefined,
        };
        return await executeCommand(command);
      },
    }),

    observe_mutations: tool({
      description:
        'Watch for DOM changes on the page (or a specific element). Useful after clicking a button or submitting a form to know when the page has finished updating. Returns a summary of what changed.',
      parameters: z.object({
        selector: z.string().describe('CSS selector to observe, or empty string for entire page'),
        timeout: z.number().describe('Max time to wait for changes in ms (use 5000 for default)'),
      }),
      execute: async ({ selector, timeout }) => {
        const command: BrowserCommand = {
          type: 'observe_mutations',
          id: `observe-${Date.now()}`,
          selector: selector || undefined,
          timeout: timeout || 5000,
        };
        return await executeCommand(command);
      },
    }),

    get_page_sections: tool({
      description:
        'Get the page content broken into semantic sections based on headings and landmarks. Returns structured content with heading hierarchy, section text, and navigation links. Better than snapshot() for understanding page layout and content.',
      parameters: z.object({}),
      execute: async () => {
        const command: BrowserCommand = {
          type: 'get_page_sections',
          id: `sections-${Date.now()}`,
        };
        return await executeCommand(command);
      },
    }),

    list_tabs: tool({
      description: 'List all open browser tabs. Returns tab ID, title, URL, and whether it is active.',
      parameters: z.object({}),
      execute: async () => {
        const command: BrowserCommand = {
          type: 'list_tabs',
          id: `tabs-${Date.now()}`,
        };
        return await executeCommand(command);
      },
    }),

    switch_tab: tool({
      description: 'Switch to a different browser tab by its tab ID. Use list_tabs first to get tab IDs.',
      parameters: z.object({
        tabId: z.number().describe('The tab ID to switch to (from list_tabs)'),
      }),
      execute: async ({ tabId }) => {
        const command: BrowserCommand = {
          type: 'switch_tab',
          id: `swtab-${Date.now()}`,
          tabId,
        };
        return await executeCommand(command);
      },
    }),

    open_tab: tool({
      description: 'Open a new browser tab with a URL. Returns the new tab ID.',
      parameters: z.object({
        url: z.string().describe('The URL to open in the new tab'),
      }),
      execute: async ({ url }) => {
        const command: BrowserCommand = {
          type: 'open_tab',
          id: `newtab-${Date.now()}`,
          url,
        };
        return await executeCommand(command);
      },
    }),

    close_tab: tool({
      description: 'Close a browser tab by its tab ID. Cannot close the last remaining tab.',
      parameters: z.object({
        tabId: z.number().describe('The tab ID to close (from list_tabs)'),
      }),
      execute: async ({ tabId }) => {
        const command: BrowserCommand = {
          type: 'close_tab',
          id: `closetab-${Date.now()}`,
          tabId,
        };
        return await executeCommand(command);
      },
    }),
  };
}
