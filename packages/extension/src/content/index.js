/**
 * Content Script - DOM Executor
 * Executes browser commands deterministically (no AI logic)
 */
console.log('[Content] Script loaded');
// Listen for commands from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'execute:command') {
        const command = message.command;
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
async function executeCommand(command) {
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
        default:
            throw new Error(`Unknown command type: ${command.type}`);
    }
}
// Navigate to URL
async function executeNavigate(id, url) {
    try {
        new URL(url);
        window.location.href = url;
        return { id, success: true, data: { url } };
    }
    catch {
        throw new Error(`Invalid URL: ${url}`);
    }
}
// Click element
async function executeClick(id, selector) {
    const element = document.querySelector(selector);
    if (!element) {
        throw new Error(`Element not found: ${selector}`);
    }
    if (!(element instanceof HTMLElement)) {
        throw new Error(`Element is not clickable: ${selector}`);
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise((resolve) => setTimeout(resolve, 300));
    element.click();
    return { id, success: true, data: { selector } };
}
// Type text into element
async function executeType(id, selector, text) {
    const element = document.querySelector(selector);
    if (!element) {
        throw new Error(`Element not found: ${selector}`);
    }
    if (!(element instanceof HTMLInputElement) &&
        !(element instanceof HTMLTextAreaElement) &&
        !element.getAttribute('contenteditable')) {
        throw new Error(`Element is not typeable: ${selector}`);
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise((resolve) => setTimeout(resolve, 300));
    element.focus();
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        // Use native setter for React/framework compatibility
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(element, text);
        }
        else {
            element.value = text;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    else {
        // contenteditable
        element.textContent = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return { id, success: true, data: { selector, text } };
}
// Extract content from element
async function executeExtract(id, selector) {
    const element = document.querySelector(selector);
    if (!element) {
        throw new Error(`Element not found: ${selector}`);
    }
    const data = {
        text: element.textContent?.trim() || '',
        html: element.innerHTML,
        tag: element.tagName.toLowerCase(),
        attributes: {},
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
async function executeSnapshot(id) {
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
function extractPageContent() {
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
async function executeDiscover(id) {
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
    const elements = [];
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const seenSelectors = new Set();
    allElements.forEach((el, index) => {
        if (!(el instanceof HTMLElement))
            return;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isVisible = style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0;
        if (!isVisible)
            return;
        const isInViewport = rect.top < viewportHeight &&
            rect.bottom > 0 &&
            rect.left < viewportWidth &&
            rect.right > 0;
        const selector = generateUniqueSelector(el, index);
        if (seenSelectors.has(selector))
            return;
        seenSelectors.add(selector);
        const text = el.getAttribute('aria-label') ||
            el.getAttribute('alt') ||
            el.getAttribute('title') ||
            el.innerText?.trim().slice(0, 100) ||
            el.getAttribute('placeholder') ||
            '';
        const attributes = {};
        const attrNames = ['href', 'src', 'alt', 'title', 'placeholder', 'value', 'name', 'id', 'class'];
        for (const attr of attrNames) {
            const value = el.getAttribute(attr);
            if (value)
                attributes[attr] = value.slice(0, 200);
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
function generateUniqueSelector(element, fallbackIndex) {
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
    const path = [];
    let current = element;
    while (current && current !== document.body && path.length < 5) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
            path.unshift(`#${CSS.escape(current.id)}`);
            break;
        }
        const parent = current.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children);
            const currentTag = current.tagName;
            const sameTagSiblings = siblings.filter((s) => s.tagName === currentTag);
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
async function executeGetPageStructure(id) {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, nav, main, article, section, footer, header'));
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
async function executeExtractTable(id, selector) {
    const table = document.querySelector(selector);
    if (!table || table.tagName !== 'TABLE') {
        throw new Error(`Element is not a table: ${selector}`);
    }
    const rows = Array.from(table.rows);
    const data = rows.map((row) => Array.from(row.cells).map((cell) => cell.textContent?.trim() || ''));
    return { id, success: true, data: { table: data } };
}
// Extract links with context
async function executeExtractLinks(id) {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const extracted = links
        .map((link) => {
        const el = link;
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
async function executeGetFormFields(id) {
    const inputs = Array.from(document.querySelectorAll('input, select, textarea, button[type="submit"]'));
    const fields = inputs.map((el) => {
        const element = el;
        let label = '';
        if (element.id) {
            const labelEl = document.querySelector(`label[for="${element.id}"]`);
            if (labelEl)
                label = labelEl.textContent?.trim() || '';
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
            value: element.value || '',
        };
    });
    return { id, success: true, data: { fields } };
}
// Scroll to target
async function executeScrollTo(id, target) {
    if (target === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    else if (target === 'bottom') {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
    else {
        const element = document.querySelector(target);
        if (!element)
            throw new Error(`Element not found: ${target}`);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    await new Promise((r) => setTimeout(r, 500));
    return { id, success: true, data: { scrolledTo: target, scrollY: window.scrollY } };
}
// Search page with context snippets
async function executeSearchPage(id, query) {
    const bodyText = document.body.innerText;
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = (bodyText.match(regex) || []).length;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const contexts = [];
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
async function executeEval(id, code) {
    try {
        // Using indirect eval to execute user-approved code in global scope
        const indirectEval = eval;
        const asyncWrapper = `(async () => { ${code} })()`;
        const result = await indirectEval(asyncWrapper);
        let serialized;
        try {
            serialized = JSON.parse(JSON.stringify(result));
        }
        catch {
            serialized = String(result);
        }
        return { id, success: true, data: { result: serialized } };
    }
    catch (error) {
        throw new Error(`Eval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// Wait for element to appear (polling)
async function executeWaitForElement(id, selector, timeout) {
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
export {};
