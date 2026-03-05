/**
 * Content Script - DOM Executor
 * Executes browser commands deterministically (no AI logic)
 */

import type { BrowserCommand, CommandResult } from '@shared/types';

console.log('[Content] Script loaded');

// Listen for commands from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'execute:command') {
    const command: BrowserCommand = message.command;
    console.log('[Content] Executing command:', command.type);

    executeCommand(command)
      .then((result) => {
        console.log('[Content] Command completed:', result);
        sendResponse(result);
      })
      .catch((error) => {
        console.error('[Content] Command failed:', error);
        sendResponse({
          id: command.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

    return true; // Keep message channel open for async response
  }
});

// Execute browser command
async function executeCommand(command: BrowserCommand): Promise<CommandResult> {
  switch (command.type) {
    case 'navigate':
      return executeNavigate(command.id, command.url);

    case 'click':
      return executeClick(command.id, command.selector);

    case 'type':
      return executeType(command.id, command.selector, command.text);

    case 'extract':
      return executeExtract(command.id, command.selector);

    case 'snapshot':
      return executeSnapshot(command.id);

    case 'discover':
      return executeDiscover(command.id);

    case 'get_page_structure':
      return executeGetPageStructure(command.id);

    case 'extract_table':
      return executeExtractTable(command.id, command.selector);

    case 'extract_links':
      return executeExtractLinks(command.id);

    case 'get_form_fields':
      return executeGetFormFields(command.id);

    case 'scroll_to':
      return executeScrollTo(command.id, command.target);

    case 'search_page':
      return executeSearchPage(command.id, command.query);

    case 'eval':
      return executeEval(command.id, command.code);

    default:
      throw new Error(`Unknown command type: ${(command as any).type}`);
  }
}

// Navigate to URL
async function executeNavigate(id: string, url: string): Promise<CommandResult> {
  try {
    // Validate URL
    new URL(url);

    // Navigate via location
    window.location.href = url;

    return {
      id,
      success: true,
      data: { url },
    };
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }
}

// Click element
async function executeClick(id: string, selector: string): Promise<CommandResult> {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Element is not clickable: ${selector}`);
  }

  // Scroll element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Wait a bit for scroll
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Click
  element.click();

  return {
    id,
    success: true,
    data: { selector },
  };
}

// Type text into element
async function executeType(
  id: string,
  selector: string,
  text: string
): Promise<CommandResult> {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLTextAreaElement)
  ) {
    throw new Error(`Element is not typeable: ${selector}`);
  }

  // Scroll element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Wait a bit for scroll
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Focus
  element.focus();

  // Clear existing value
  element.value = '';

  // Type text (simulate typing for better compatibility)
  for (let i = 0; i < text.length; i++) {
    element.value += text[i];

    // Dispatch input event
    element.dispatchEvent(new Event('input', { bubbles: true }));

    // Small delay between characters
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  // Dispatch change event
  element.dispatchEvent(new Event('change', { bubbles: true }));

  return {
    id,
    success: true,
    data: { selector, text },
  };
}

// Extract content from element
async function executeExtract(id: string, selector: string): Promise<CommandResult> {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  // Extract text content and relevant attributes
  const data = {
    text: element.textContent?.trim() || '',
    html: element.innerHTML,
    tag: element.tagName.toLowerCase(),
    attributes: {} as Record<string, string>,
  };

  // Common useful attributes
  const attrs = ['id', 'class', 'href', 'src', 'alt', 'title', 'value', 'placeholder'];
  for (const attr of attrs) {
    const value = element.getAttribute(attr);
    if (value) {
      data.attributes[attr] = value;
    }
  }

  return {
    id,
    success: true,
    data,
  };
}

// Take snapshot of page
async function executeSnapshot(id: string): Promise<CommandResult> {
  const data = {
    url: window.location.href,
    title: document.title,
    // Get main content (try common content selectors)
    content: extractPageContent(),
    metadata: {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      scroll: {
        x: window.scrollX,
        y: window.scrollY,
      },
    },
  };

  return {
    id,
    success: true,
    data,
  };
}

// Extract main page content
function extractPageContent(): string {
  // Try common content selectors
  const selectors = [
    'main',
    'article',
    '[role="main"]',
    '#content',
    '.content',
    'body',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      // Get text content, cleaned up
      const text = element.textContent || '';
      return text.replace(/\s+/g, ' ').trim();
    }
  }

  return document.body.textContent?.replace(/\s+/g, ' ').trim() || '';
}

// Discover all interactive elements on the page
async function executeDiscover(id: string): Promise<CommandResult> {
  const interactiveSelectors = [
    'a[href]',
    'button',
    'input:not([type="hidden"])',
    'textarea',
    'select',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="textbox"]',
    '[role="menuitem"]',
    '[role="tab"]',
    '[onclick]',
    '[tabindex]:not([tabindex="-1"])',
  ];

  const allElements = document.querySelectorAll(interactiveSelectors.join(', '));
  const elements: Array<{
    selector: string;
    tagName: string;
    text: string;
    type?: string;
    role?: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    attributes: Record<string, string>;
    isVisible: boolean;
    isInViewport: boolean;
  }> = [];

  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const seenSelectors = new Set<string>();

  allElements.forEach((el, index) => {
    if (!(el instanceof HTMLElement)) return;

    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);

    // Check visibility
    const isVisible =
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0;

    if (!isVisible) return;

    // Check if in viewport
    const isInViewport =
      rect.top < viewportHeight &&
      rect.bottom > 0 &&
      rect.left < viewportWidth &&
      rect.right > 0;

    // Generate unique selector
    const selector = generateUniqueSelector(el, index);

    // Skip duplicates
    if (seenSelectors.has(selector)) return;
    seenSelectors.add(selector);

    // Get element text
    const text =
      el.getAttribute('aria-label') ||
      el.getAttribute('alt') ||
      el.getAttribute('title') ||
      el.innerText?.trim().slice(0, 100) ||
      el.getAttribute('placeholder') ||
      '';

    // Gather relevant attributes
    const attributes: Record<string, string> = {};
    const attrNames = ['href', 'src', 'alt', 'title', 'placeholder', 'value', 'name', 'id', 'class'];
    for (const attr of attrNames) {
      const value = el.getAttribute(attr);
      if (value) attributes[attr] = value.slice(0, 200);
    }

    elements.push({
      selector,
      tagName: el.tagName.toLowerCase(),
      text,
      role: el.getAttribute('role') || undefined,
      type: el instanceof HTMLInputElement ? el.type : undefined,
      boundingBox: {
        x: Math.round(rect.x + window.scrollX),
        y: Math.round(rect.y + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      attributes,
      isVisible,
      isInViewport,
    });
  });

  return {
    id,
    success: true,
    data: {
      elements,
      viewport: { width: viewportWidth, height: viewportHeight },
      scrollPosition: { x: window.scrollX, y: window.scrollY },
      url: window.location.href,
      totalElements: elements.length,
    },
  };
}

// Generate unique CSS selector for an element
function generateUniqueSelector(element: HTMLElement, fallbackIndex: number): string {
  // Try ID first (most reliable)
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Try data-testid (common in React apps)
  const testId = element.getAttribute('data-testid') || element.getAttribute('data-test-id');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }

  // Try unique class combination
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(/\s+/).filter((c) => c.length > 0 && !c.startsWith('_'));
    if (classes.length > 0) {
      const classSelector = '.' + classes.slice(0, 3).map((c) => CSS.escape(c)).join('.');
      if (document.querySelectorAll(classSelector).length === 1) {
        return classSelector;
      }
    }
  }

  // Build path with nth-of-type
  const path: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.body && path.length < 5) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      path.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    const parent: HTMLElement | null = current.parentElement;
    if (parent) {
      const siblings: Element[] = Array.from(parent.children);
      const currentTag = current.tagName;
      const sameTagSiblings = siblings.filter((s: Element) => s.tagName === currentTag);
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parent;
  }

  return path.join(' > ') || `[data-discover-index="${fallbackIndex}"]`;
}

// Get page structure (outline)
async function executeGetPageStructure(id: string): Promise<CommandResult> {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, nav, main, article, section, footer, header'));
    const outline = headings.map(el => {
        const tag = el.tagName.toLowerCase();
        const text = el.textContent?.trim().slice(0, 100) || '';
        const id = el.id ? `#${el.id}` : '';
        const role = el.getAttribute('role') || '';
        return { tag, text, id, role };
    }).filter(item => item.text.length > 0 || item.tag === 'nav' || item.tag === 'main');

    return {
        id,
        success: true,
        data: { outline, title: document.title, url: window.location.href }
    };
}

// Extract table data
async function executeExtractTable(id: string, selector: string): Promise<CommandResult> {
    const table = document.querySelector(selector);
    if (!table || table.tagName !== 'TABLE') {
        throw new Error(`Element is not a table: ${selector}`);
    }

    const rows = Array.from((table as HTMLTableElement).rows);
    const data = rows.map(row =>
        Array.from(row.cells).map(cell => cell.textContent?.trim() || '')
    );

    return {
        id,
        success: true,
        data: { table: data }
    };
}

// Extract links with context
async function executeExtractLinks(id: string): Promise<CommandResult> {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const extracted = links.map(link => {
        const el = link as HTMLAnchorElement;
        // Get surrounding text (naive approach: parent text)
        const context = el.parentElement?.textContent?.slice(0, 200).replace(/\s+/g, ' ').trim() || '';
        return {
            text: el.textContent?.trim() || '',
            href: el.href,
            context: context !== el.textContent?.trim() ? context : undefined
        };
    }).filter(l => l.text.length > 0 && !l.href.startsWith('javascript:'));

    // Deduplicate by href
    const unique = Array.from(new Map(extracted.map(item => [item.href, item])).values());

    return {
        id,
        success: true,
        data: { links: unique.slice(0, 100) } // Limit to 100
    };
}

// Get form fields
async function executeGetFormFields(id: string): Promise<CommandResult> {
    const inputs = Array.from(document.querySelectorAll('input, select, textarea, button[type="submit"]'));
    const fields = inputs.map(el => {
        const element = el as HTMLElement;
        let label = '';

        // Try to find label
        if (element.id) {
            const labelEl = document.querySelector(`label[for="${element.id}"]`);
            if (labelEl) label = labelEl.textContent?.trim() || '';
        }
        if (!label && element.closest('label')) {
            label = element.closest('label')?.textContent?.trim() || '';
        }
        if (!label) {
            label = element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.getAttribute('name') || '';
        }

        return {
            tag: element.tagName.toLowerCase(),
            type: element.getAttribute('type'),
            name: element.getAttribute('name'),
            id: element.id,
            label: label.slice(0, 100),
            value: (element as any).value || ''
        };
    });

    return {
        id,
        success: true,
        data: { fields }
    };
}

// Scroll to target
async function executeScrollTo(id: string, target: string): Promise<CommandResult> {
    if (target === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === 'bottom') {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } else {
        const element = document.querySelector(target);
        if (!element) throw new Error(`Element not found: ${target}`);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Wait for scroll
    await new Promise(r => setTimeout(r, 500));

    return {
        id,
        success: true,
        data: { scrolledTo: target, scrollY: window.scrollY }
    };
}

// Search page
async function executeSearchPage(id: string, query: string): Promise<CommandResult> {
    // Case insensitive text search in body
    const bodyText = document.body.innerText;
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = (bodyText.match(regex) || []).length;

    return {
        id,
        success: true,
        data: { query, matches }
    };
}

// Execute arbitrary JS
async function executeEval(id: string, code: string): Promise<CommandResult> {
    try {
        // Basic safety: avoid infinite loops if possible, but eval is inherently unsafe
        // Run in new Function wrapper to isolate scope slightly
        const func = new Function(code);
        const result = func();

        // Handle promises if code returns a promise
        const resolved = result instanceof Promise ? await result : result;

        return {
            id,
            success: true,
            data: { result: resolved }
        };
    } catch (error) {
        throw new Error(`Eval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
