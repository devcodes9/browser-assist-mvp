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
        console.log('[Content] Command completed:', result.success);
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
    case 'wait_for_element':
      return executeWaitForElement(command.id, command.selector, command.timeout);
    case 'discover_all':
      return executeDiscoverAll(command.id);
    case 'get_app_state':
      return executeGetAppState(command.id);
    case 'fetch_from_page':
      return executeFetchFromPage(command.id, command.url, command.method, command.headers, command.body);
    case 'observe_mutations':
      return executeObserveMutations(command.id, command.selector, command.timeout);
    case 'get_page_sections':
      return executeGetPageSections(command.id);
    default:
      throw new Error(`Unknown command type: ${(command as any).type}`);
  }
}

// Shadow DOM-aware querySelector: searches through shadow roots
function deepQuerySelector(selector: string, root: Document | ShadowRoot | Element = document): Element | null {
  // Try normal querySelector first
  const result = root.querySelector(selector);
  if (result) return result;

  // Search inside shadow roots
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      const shadowResult = deepQuerySelector(selector, el.shadowRoot);
      if (shadowResult) return shadowResult;
    }
  }
  return null;
}

function deepQuerySelectorAll(selector: string, root: Document | ShadowRoot | Element = document): Element[] {
  const results: Element[] = Array.from(root.querySelectorAll(selector));

  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      results.push(...deepQuerySelectorAll(selector, el.shadowRoot));
    }
  }
  return results;
}

// Navigate to URL
async function executeNavigate(id: string, url: string): Promise<CommandResult> {
  try {
    new URL(url);
    window.location.href = url;
    return { id, success: true, data: { url } };
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}

// Click element — dispatches full mouse event sequence like a real user
async function executeClick(id: string, selector: string): Promise<CommandResult> {
  const element = document.querySelector(selector) || deepQuerySelector(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Element is not clickable: ${selector}`);
  }

  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Get element center coordinates for realistic mouse events
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const eventInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
  };

  // Full mouse event sequence — this works with custom handlers that listen
  // for mousedown/mouseup instead of click (e.g., drag-and-drop UIs, canvas apps)
  element.dispatchEvent(new MouseEvent('pointerdown', { ...eventInit, pointerId: 1 } as any));
  element.dispatchEvent(new MouseEvent('mousedown', eventInit));
  element.dispatchEvent(new MouseEvent('pointerup', { ...eventInit, pointerId: 1 } as any));
  element.dispatchEvent(new MouseEvent('mouseup', eventInit));
  element.dispatchEvent(new MouseEvent('click', eventInit));

  return { id, success: true, data: { selector } };
}

// Type text into element — works with inputs, textareas, contenteditable, and rich editors
async function executeType(
  id: string,
  selector: string,
  text: string
): Promise<CommandResult> {
  const element = document.querySelector(selector) || deepQuerySelector(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  const htmlEl = element as HTMLElement;
  htmlEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise((resolve) => setTimeout(resolve, 300));
  htmlEl.focus();

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    // Standard form inputs — use native setter for React/framework compatibility
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, text);
    } else {
      element.value = text;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // Rich text editors, contenteditable, etc.
    const isContentEditable = htmlEl.isContentEditable ||
      htmlEl.getAttribute('contenteditable') === 'true' ||
      htmlEl.getAttribute('role') === 'textbox';

    if (isContentEditable) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(htmlEl);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    // execCommand('insertText') simulates real typing
    const success = document.execCommand('insertText', false, text);

    if (!success) {
      htmlEl.textContent = text;
      htmlEl.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: text }));
      htmlEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
  }

  return { id, success: true, data: { selector, text } };
}

// Extract content from element
async function executeExtract(id: string, selector: string): Promise<CommandResult> {
  const element = document.querySelector(selector) || deepQuerySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  const data = {
    text: element.textContent?.trim() || '',
    html: element.innerHTML,
    tag: element.tagName.toLowerCase(),
    attributes: {} as Record<string, string>,
  };

  const attrs = ['id', 'class', 'href', 'src', 'alt', 'title', 'value', 'placeholder'];
  for (const attr of attrs) {
    const value = element.getAttribute(attr);
    if (value) {
      data.attributes[attr] = value;
    }
  }

  return { id, success: true, data };
}

// Take snapshot of page
async function executeSnapshot(id: string): Promise<CommandResult> {
  return {
    id,
    success: true,
    data: {
      url: window.location.href,
      title: document.title,
      content: extractPageContent(),
      metadata: {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        scroll: { x: window.scrollX, y: window.scrollY },
      },
    },
  };
}

function extractPageContent(): string {
  const selectors = ['main', 'article', '[role="main"]', '#content', '.content', 'body'];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const text = element.textContent || '';
      return text.replace(/\s+/g, ' ').trim().slice(0, 10000);
    }
  }

  return document.body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 10000) || '';
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

    const isVisible =
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0;

    if (!isVisible) return;

    const isInViewport =
      rect.top < viewportHeight &&
      rect.bottom > 0 &&
      rect.left < viewportWidth &&
      rect.right > 0;

    const selector = generateUniqueSelector(el, index);
    if (seenSelectors.has(selector)) return;
    seenSelectors.add(selector);

    const text =
      el.getAttribute('aria-label') ||
      el.getAttribute('alt') ||
      el.getAttribute('title') ||
      el.innerText?.trim().slice(0, 100) ||
      el.getAttribute('placeholder') ||
      '';

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

function generateUniqueSelector(element: HTMLElement, fallbackIndex: number): string {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const testId = element.getAttribute('data-testid') || element.getAttribute('data-test-id');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }

  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(/\s+/).filter((c) => c.length > 0 && !c.startsWith('_'));
    if (classes.length > 0) {
      const classSelector = '.' + classes.slice(0, 3).map((c) => CSS.escape(c)).join('.');
      if (document.querySelectorAll(classSelector).length === 1) {
        return classSelector;
      }
    }
  }

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
  const headings = Array.from(
    document.querySelectorAll('h1, h2, h3, h4, h5, h6, nav, main, article, section, footer, header')
  );
  const outline = headings
    .map((el) => {
      const tag = el.tagName.toLowerCase();
      const text = el.textContent?.trim().slice(0, 100) || '';
      const elId = el.id ? `#${el.id}` : '';
      const role = el.getAttribute('role') || '';
      return { tag, text, id: elId, role };
    })
    .filter((item) => item.text.length > 0 || item.tag === 'nav' || item.tag === 'main');

  return {
    id,
    success: true,
    data: { outline, title: document.title, url: window.location.href },
  };
}

// Extract table data
async function executeExtractTable(id: string, selector: string): Promise<CommandResult> {
  const table = document.querySelector(selector);
  if (!table || table.tagName !== 'TABLE') {
    throw new Error(`Element is not a table: ${selector}`);
  }

  const rows = Array.from((table as HTMLTableElement).rows);
  const data = rows.map((row) =>
    Array.from(row.cells).map((cell) => cell.textContent?.trim() || '')
  );

  return { id, success: true, data: { table: data } };
}

// Extract links with context
async function executeExtractLinks(id: string): Promise<CommandResult> {
  const links = Array.from(document.querySelectorAll('a[href]'));
  const extracted = links
    .map((link) => {
      const el = link as HTMLAnchorElement;
      const context = el.parentElement?.textContent?.slice(0, 200).replace(/\s+/g, ' ').trim() || '';
      return {
        text: el.textContent?.trim() || '',
        href: el.href,
        context: context !== el.textContent?.trim() ? context : undefined,
      };
    })
    .filter((l) => l.text.length > 0 && !l.href.startsWith('javascript:'));

  const unique = Array.from(new Map(extracted.map((item) => [item.href, item])).values());

  return { id, success: true, data: { links: unique.slice(0, 100) } };
}

// Get form fields
async function executeGetFormFields(id: string): Promise<CommandResult> {
  const inputs = Array.from(
    document.querySelectorAll('input, select, textarea, button[type="submit"]')
  );
  const fields = inputs.map((el) => {
    const element = el as HTMLElement;
    let label = '';

    if (element.id) {
      const labelEl = document.querySelector(`label[for="${element.id}"]`);
      if (labelEl) label = labelEl.textContent?.trim() || '';
    }
    if (!label && element.closest('label')) {
      label = element.closest('label')?.textContent?.trim() || '';
    }
    if (!label) {
      label =
        element.getAttribute('aria-label') ||
        element.getAttribute('placeholder') ||
        element.getAttribute('name') ||
        '';
    }

    return {
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute('type'),
      name: element.getAttribute('name'),
      id: element.id,
      label: label.slice(0, 100),
      value: (element as any).value || '',
    };
  });

  return { id, success: true, data: { fields } };
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

  await new Promise((r) => setTimeout(r, 500));

  return { id, success: true, data: { scrolledTo: target, scrollY: window.scrollY } };
}

// Search page with context snippets
async function executeSearchPage(id: string, query: string): Promise<CommandResult> {
  const bodyText = document.body.innerText;
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const matches = (bodyText.match(regex) || []).length;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const contexts: string[] = [];
  let node;
  while ((node = walker.nextNode()) && contexts.length < 5) {
    if (node.textContent && regex.test(node.textContent)) {
      const parent = node.parentElement;
      if (parent) {
        contexts.push(parent.textContent?.trim().slice(0, 150) || '');
      }
      regex.lastIndex = 0;
    }
  }

  return {
    id,
    success: true,
    data: { query, matches, contexts: [...new Set(contexts)] },
  };
}

// Execute JavaScript on the page
// NOTE: This is an intentional feature for the AI agent to run arbitrary JS
// on the user's behalf. It requires explicit user permission via the plan/permission system.
async function executeEval(id: string, code: string): Promise<CommandResult> {
  try {
    // Using indirect eval to execute user-approved code in global scope
    const indirectEval = eval;
    const asyncWrapper = `(async () => { ${code} })()`;
    const result = await indirectEval(asyncWrapper);

    let serialized: unknown;
    try {
      serialized = JSON.parse(JSON.stringify(result));
    } catch {
      serialized = String(result);
    }

    return { id, success: true, data: { result: serialized } };
  } catch (error) {
    throw new Error(`Eval failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Wait for element to appear (polling)
async function executeWaitForElement(
  id: string,
  selector: string,
  timeout: number
): Promise<CommandResult> {
  const start = Date.now();
  const pollInterval = 200;

  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) {
      return {
        id,
        success: true,
        data: {
          selector,
          found: true,
          elapsed: Date.now() - start,
          tagName: el.tagName.toLowerCase(),
          text: el.textContent?.trim().slice(0, 100) || '',
        },
      };
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  return {
    id,
    success: false,
    error: `Element not found after ${timeout}ms: ${selector}`,
  };
}

// ============================================================================
// Phase 2: Deep Context Tools
// ============================================================================

// Discover ALL interactive elements by scrolling through the entire page
async function executeDiscoverAll(id: string): Promise<CommandResult> {
  const originalScrollY = window.scrollY;
  const pageHeight = document.body.scrollHeight;
  const viewportHeight = window.innerHeight;
  const allElements = new Map<string, {
    selector: string;
    tagName: string;
    text: string;
    type?: string;
    role?: string;
    attributes: Record<string, string>;
  }>();

  const interactiveSelectors = [
    'a[href]', 'button', 'input:not([type="hidden"])', 'textarea', 'select',
    '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="radio"]',
    '[role="textbox"]', '[role="menuitem"]', '[role="tab"]',
    '[onclick]', '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  // Scroll through the page in viewport-sized chunks
  const scrollSteps = Math.ceil(pageHeight / viewportHeight);
  for (let step = 0; step <= scrollSteps; step++) {
    window.scrollTo({ top: step * viewportHeight, behavior: 'instant' as ScrollBehavior });
    // Small delay for lazy-loaded content to appear
    await new Promise((r) => setTimeout(r, 150));

    // Also check shadow DOM
    const elements = deepQuerySelectorAll(interactiveSelectors);
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!(el instanceof HTMLElement)) continue;

      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const selector = generateUniqueSelector(el, allElements.size);
      if (allElements.has(selector)) continue;

      const text =
        el.getAttribute('aria-label') ||
        el.getAttribute('alt') ||
        el.getAttribute('title') ||
        el.innerText?.trim().slice(0, 100) ||
        el.getAttribute('placeholder') ||
        '';

      const attributes: Record<string, string> = {};
      for (const attr of ['href', 'src', 'alt', 'title', 'placeholder', 'value', 'name', 'id', 'class', 'type']) {
        const value = el.getAttribute(attr);
        if (value) attributes[attr] = value.slice(0, 200);
      }

      allElements.set(selector, {
        selector,
        tagName: el.tagName.toLowerCase(),
        text,
        role: el.getAttribute('role') || undefined,
        type: el instanceof HTMLInputElement ? el.type : undefined,
        attributes,
      });
    }
  }

  // Restore original scroll position
  window.scrollTo({ top: originalScrollY, behavior: 'instant' as ScrollBehavior });

  return {
    id,
    success: true,
    data: {
      elements: Array.from(allElements.values()),
      totalElements: allElements.size,
      pageHeight,
      url: window.location.href,
    },
  };
}

// Get SPA framework state (__NEXT_DATA__, React, Vue, Angular, etc.)
async function executeGetAppState(id: string): Promise<CommandResult> {
  const state: Record<string, unknown> = {};

  // Next.js
  const nextData = (window as any).__NEXT_DATA__;
  if (nextData) {
    state.nextjs = {
      page: nextData.page,
      query: nextData.query,
      buildId: nextData.buildId,
      props: truncateDeep(nextData.props?.pageProps, 3),
    };
  }

  // Nuxt.js
  const nuxtData = (window as any).__NUXT__;
  if (nuxtData) {
    state.nuxt = {
      state: truncateDeep(nuxtData.state, 3),
      data: truncateDeep(nuxtData.data, 3),
    };
  }

  // Generic window stores (Redux, Zustand, etc.)
  const storeKeys = ['__STORE__', '__REDUX_STORE__', '__store'];
  for (const key of storeKeys) {
    const store = (window as any)[key];
    if (store) {
      const storeState = typeof store.getState === 'function' ? store.getState() : store;
      state[key] = truncateDeep(storeState, 3);
    }
  }

  // React root detection
  const reactRoot = document.getElementById('root') || document.getElementById('__next') || document.getElementById('app');
  if (reactRoot) {
    const fiberKey = Object.keys(reactRoot).find((k) => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    if (fiberKey) {
      state.reactDetected = true;
      state.reactRootId = reactRoot.id;
    }
  }

  // Angular
  const ngRoot = document.querySelector('[ng-version]') || document.querySelector('[_nghost]');
  if (ngRoot) {
    state.angularDetected = true;
    state.angularVersion = ngRoot.getAttribute('ng-version') || 'unknown';
  }

  // Vue
  const vueRoot = document.querySelector('[data-v-app]') || document.querySelector('#app');
  if (vueRoot && (vueRoot as any).__vue_app__) {
    state.vueDetected = true;
  }

  // Meta tags (useful for understanding the page)
  const metaTags: Record<string, string> = {};
  document.querySelectorAll('meta[name], meta[property]').forEach((meta) => {
    const name = meta.getAttribute('name') || meta.getAttribute('property') || '';
    const content = meta.getAttribute('content') || '';
    if (name && content) metaTags[name] = content.slice(0, 200);
  });
  if (Object.keys(metaTags).length > 0) {
    state.meta = metaTags;
  }

  // JSON-LD structured data
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  if (jsonLdScripts.length > 0) {
    const jsonLd: unknown[] = [];
    jsonLdScripts.forEach((script) => {
      try {
        jsonLd.push(JSON.parse(script.textContent || ''));
      } catch {
        // invalid JSON-LD, skip
      }
    });
    if (jsonLd.length > 0) state.jsonLd = jsonLd;
  }

  return {
    id,
    success: true,
    data: {
      frameworks: Object.keys(state).filter((k) => !['meta', 'jsonLd'].includes(k)),
      state,
      url: window.location.href,
    },
  };
}

// Truncate deeply nested objects to prevent huge payloads
function truncateDeep(obj: unknown, maxDepth: number, currentDepth = 0): unknown {
  if (currentDepth >= maxDepth) return '[truncated]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') {
    if (typeof obj === 'string' && obj.length > 500) return obj.slice(0, 500) + '...';
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.slice(0, 10).map((item) => truncateDeep(item, maxDepth, currentDepth + 1));
  }
  const result: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>);
  for (const key of keys.slice(0, 20)) {
    result[key] = truncateDeep((obj as Record<string, unknown>)[key], maxDepth, currentDepth + 1);
  }
  if (keys.length > 20) result['...'] = `${keys.length - 20} more keys`;
  return result;
}

// Make authenticated fetch from page context (uses page's cookies/session)
async function executeFetchFromPage(
  id: string,
  url: string,
  method: string,
  headers?: Record<string, string>,
  body?: string
): Promise<CommandResult> {
  try {
    const options: RequestInit = {
      method,
      credentials: 'include', // Include cookies
    };

    if (headers) {
      options.headers = headers;
    }

    if (body && method !== 'GET' && method !== 'HEAD') {
      options.body = body;
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';

    let responseData: unknown;
    if (contentType.includes('application/json')) {
      responseData = await response.json();
      // Truncate large JSON responses
      responseData = truncateDeep(responseData, 4);
    } else {
      const text = await response.text();
      responseData = text.slice(0, 10000);
    }

    return {
      id,
      success: true,
      data: {
        status: response.status,
        statusText: response.statusText,
        contentType,
        body: responseData,
      },
    };
  } catch (error) {
    throw new Error(`Fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Observe DOM mutations (useful after actions to know when page finished updating)
async function executeObserveMutations(
  id: string,
  selector?: string,
  timeout: number = 5000
): Promise<CommandResult> {
  const target = selector
    ? (document.querySelector(selector) || document.body)
    : document.body;

  return new Promise((resolve) => {
    const changes: Array<{ type: string; target: string; summary: string }> = [];
    let settled = false;
    let debounceTimer: ReturnType<typeof setTimeout>;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const targetEl = mutation.target as HTMLElement;
        const targetDesc = targetEl.id
          ? `#${targetEl.id}`
          : targetEl.tagName?.toLowerCase() || 'unknown';

        if (mutation.type === 'childList') {
          const added = mutation.addedNodes.length;
          const removed = mutation.removedNodes.length;
          if (added > 0 || removed > 0) {
            changes.push({
              type: 'childList',
              target: targetDesc,
              summary: `+${added} -${removed} nodes`,
            });
          }
        } else if (mutation.type === 'attributes') {
          changes.push({
            type: 'attributes',
            target: targetDesc,
            summary: `${mutation.attributeName} changed`,
          });
        }
      }

      // Debounce: wait for mutations to settle (300ms of quiet)
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          observer.disconnect();
          resolve({
            id,
            success: true,
            data: {
              changed: true,
              totalChanges: changes.length,
              changes: changes.slice(0, 20), // Limit to 20 most recent
            },
          });
        }
      }, 300);
    });

    observer.observe(target, {
      childList: true,
      attributes: true,
      subtree: true,
    });

    // Timeout: resolve even if no mutations observed
    setTimeout(() => {
      if (!settled) {
        settled = true;
        observer.disconnect();
        resolve({
          id,
          success: true,
          data: {
            changed: changes.length > 0,
            totalChanges: changes.length,
            changes: changes.slice(0, 20),
            timedOut: true,
          },
        });
      }
    }, timeout);
  });
}

// Get page broken into semantic sections (structured content)
async function executeGetPageSections(id: string): Promise<CommandResult> {
  const sections: Array<{
    type: string;
    heading?: string;
    content: string;
    selector?: string;
  }> = [];

  // Strategy: find all heading elements, then extract content between them
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));

  if (headings.length === 0) {
    // No headings — try semantic elements
    const semanticSelectors = ['main', 'article', 'section', '[role="main"]', '.content', '#content'];
    for (const sel of semanticSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        sections.push({
          type: el.tagName.toLowerCase(),
          content: el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 2000) || '',
          selector: sel,
        });
      }
    }

    if (sections.length === 0) {
      sections.push({
        type: 'body',
        content: document.body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 5000) || '',
      });
    }
  } else {
    // Walk through headings and extract section content
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const headingTag = heading.tagName.toLowerCase();
      const headingText = heading.textContent?.trim() || '';

      // Collect text between this heading and the next
      let content = '';
      let sibling = heading.nextElementSibling;
      while (sibling) {
        // Stop if we hit the next heading of same or higher level
        if (sibling.tagName.match(/^H[1-6]$/)) {
          const siblingLevel = parseInt(sibling.tagName[1]);
          const currentLevel = parseInt(headingTag[1]);
          if (siblingLevel <= currentLevel) break;
        }
        content += (sibling.textContent?.trim() || '') + ' ';
        sibling = sibling.nextElementSibling;
      }

      content = content.replace(/\s+/g, ' ').trim();

      if (headingText || content) {
        sections.push({
          type: headingTag,
          heading: headingText.slice(0, 200),
          content: content.slice(0, 2000),
          selector: heading.id ? `#${heading.id}` : undefined,
        });
      }
    }
  }

  // Also extract nav links
  const navs = document.querySelectorAll('nav');
  const navData: Array<{ text: string; href: string }> = [];
  navs.forEach((nav) => {
    nav.querySelectorAll('a[href]').forEach((link) => {
      const a = link as HTMLAnchorElement;
      const text = a.textContent?.trim() || '';
      if (text) navData.push({ text: text.slice(0, 100), href: a.href });
    });
  });

  return {
    id,
    success: true,
    data: {
      title: document.title,
      url: window.location.href,
      sections: sections.slice(0, 30),
      navigation: navData.slice(0, 30),
      totalSections: sections.length,
    },
  };
}
