# Browser Assist Roadmap

## Current State Analysis

Based on logs analysis, the MVP demonstrates core browser automation but has friction in:
- Connection stability (7 connect/disconnect cycles)
- Permission fatigue (12+ manual approvals per task)
- Limited context gathering (no deep page understanding)
- No persistent workflows or memory

---

## Phase 1: Stability & Core UX
*Focus: Make what exists work reliably*

### 1.1 Connection Reliability
- [ ] Add WebSocket heartbeat (ping/pong every 30s)
- [ ] Exponential backoff for reconnection (2s, 4s, 8s, 16s, max 60s)
- [ ] Persist connection state via `chrome.storage.session`
- [ ] Auto-reconnect when sidepanel reopens

### 1.2 Permission System Overhaul
- [ ] **Batch approval**: "Approve all actions for this task"
- [ ] **Domain trust**: Remember approved sites for session
- [ ] **Action categories**: Auto-approve read-only (discover, snapshot, extract)
- [ ] **Preview mode**: Show what will happen before execution

### 1.3 Conversation Management
- [ ] Sliding window: Keep last 15 messages, summarize older
- [ ] Token budget check before API call
- [ ] Clear conversation command
- [ ] Export conversation history

### 1.4 Error Handling
- [ ] Retry with backoff for transient failures
- [ ] Better error messages (element not found vs not visible vs not clickable)
- [ ] `waitForElement(selector, timeout)` tool
- [ ] Graceful degradation when extension disconnects mid-task

---

## Phase 2: Deep Context & Agentic Search
*Focus: Understand pages like Claude Code understands codebases*

### 2.1 Full Document Context
- [ ] **DOM tree extraction**: Get full page structure (not just visible)
- [ ] **Semantic chunking**: Break large pages into meaningful sections
- [ ] **Scroll-and-discover**: Automatically scroll to find all elements
- [ ] **iframe support**: Navigate into iframes for embedded content

### 2.2 Agentic Search (Not RAG)
- [ ] **Multi-step search**: Agent decides what to search, evaluates results, refines
- [ ] **Cross-tab context**: Search across multiple open tabs
- [ ] **Link following**: Autonomously follow links to gather information
- [ ] **Form exploration**: Understand form structures and options

### 2.3 Page Understanding Tools
```
New tools to add:
- searchPage(query): Find text/elements matching semantic query
- getPageStructure(): Returns heading hierarchy, sections, landmarks
- extractTable(selector): Parse tables into structured data
- extractLinks(filter?): Get all links with context
- getFormFields(): Understand all form inputs and their purposes
- scrollTo(target): Scroll to element/position and discover new content
```

### 2.4 Agent Execution Tools (Context Power-Up)
*Give the agent code execution capabilities (like Claude Code's bash) for richer context gathering*

#### 2.4.1 JS Eval on DOM (Recommended, Primary)
*Browser-native "bash" — run arbitrary JS in the page's security context*
- [ ] **`evalOnPage(code)`**: Execute JS in content script context via `chrome.scripting.executeScript`
- [ ] **Authenticated fetches**: `fetch()` from page origin with cookies/session (no auth setup needed)
- [ ] **App state access**: Read `window.__STORE__`, `__NEXT_DATA__`, React fiber tree, etc.
- [ ] **DOM queries as grep**: `querySelectorAll`, tree walks, semantic search over DOM
- [ ] **Sandboxing & limits**: Timeout execution, cap return payload size, block unsafe DOM mutations/navigation
- [ ] **Result serialization**: Auto-serialize DOM nodes, Maps, Sets back to agent-readable JSON

#### 2.4.2 OS Bash Tool (Secondary, Opt-in)
*For tasks that need system-level access (local files, CLI tools, network diagnostics)*
- [ ] **Bash tool**: Run shell commands (curl, jq, grep, etc.) for off-page data
- [ ] **Sandboxed execution**: Restrict to safe read-only/network operations
- [ ] **Output parsing**: Pipe shell output back into agent context
- [ ] **Composability**: Chain bash + browser tools (e.g., curl external API → fill form with result)

### 2.5 Content Script Enhancements
- [ ] Shadow DOM traversal
- [ ] Canvas/WebGL content detection (warn for Google Docs, Figma, etc.)
- [ ] Dynamic content detection (infinite scroll, lazy loading)
- [ ] Mutation observer for page changes

---

## Phase 3: MCP Integration
*Focus: Extensibility through Model Context Protocol*

### 3.1 MCP Server Management
- [ ] **Server registry**: Configure MCP servers via UI or config file
- [ ] **Dynamic loading**: Add/remove servers without restart
- [ ] **Health monitoring**: Check server status, auto-reconnect
- [ ] **Capability discovery**: List available tools from each server

### 3.2 Built-in MCP Servers
```
Priority servers to integrate:
- filesystem: Read/write local files
- fetch: Make HTTP requests (for APIs)
- puppeteer: Headless browser for background tasks
- sqlite: Local data persistence
- github: Repo operations
```

### 3.3 MCP Tool Routing
- [ ] Smart tool selection based on task
- [ ] Tool composition (chain MCP tools with browser tools)
- [ ] Parallel tool execution where possible
- [ ] Tool result caching

### 3.4 Custom MCP Development
- [ ] Documentation for building custom servers
- [ ] Template/scaffold for new servers
- [ ] Testing harness for MCP tools

---

## Phase 4: Skills & Workflows
*Focus: Reusable automation patterns*

### 4.1 Skills Configuration
```yaml
# Example skill definition
name: "research-topic"
description: "Research a topic across multiple sources"
triggers:
  - "research {topic}"
  - "find information about {topic}"
steps:
  - search_google: "{topic}"
  - for_each_result(limit=5):
      - open_link
      - extract_main_content
      - summarize
  - compile_findings
output: "markdown_report"
```

- [ ] **Skill YAML/JSON schema**: Define reusable multi-step procedures
- [ ] **Skill library**: Built-in skills for common tasks
- [ ] **Skill editor UI**: Create/edit skills in sidepanel
- [ ] **Skill sharing**: Import/export skill definitions

### 4.2 Workflow Engine
- [ ] **Step recording**: Watch user actions, generate workflow
- [ ] **Step replay**: Execute recorded steps on new pages
- [ ] **Conditional logic**: If/else based on page state
- [ ] **Loop support**: Repeat actions for lists/pagination
- [ ] **Error recovery**: Define fallback actions

### 4.3 Workflow Memory
- [ ] **Execution history**: Log all workflow runs with results
- [ ] **Variable persistence**: Save values between steps
- [ ] **Cross-session memory**: Remember context across browser restarts
- [ ] **Learning from corrections**: Update workflow when user intervenes

### 4.4 Built-in Skills
```
Priority skills to build:
- fill-form: Smart form filling with context
- scrape-list: Extract repeated items (products, articles, etc.)
- compare-pages: Side-by-side content comparison
- monitor-page: Watch for changes, notify
- screenshot-flow: Document a process with screenshots
- data-entry: Enter data from spreadsheet/CSV
```

---

## Phase 5: Advanced Capabilities
*Focus: Power user features*

### 5.1 Multi-Tab Orchestration
- [ ] Coordinate actions across multiple tabs
- [ ] Tab groups for related tasks
- [ ] Background tab execution
- [ ] Tab state synchronization

### 5.2 Headless Mode
- [ ] Run workflows without visible browser
- [ ] Scheduled execution (cron-like)
- [ ] Batch processing mode
- [ ] Results aggregation

### 5.3 API & Integrations
- [ ] REST API for external triggering
- [ ] Webhook support for notifications
- [ ] Zapier/Make integration
- [ ] CLI for headless execution

### 5.4 Collaboration
- [ ] Share workflows with team
- [ ] Collaborative editing
- [ ] Audit logs
- [ ] Role-based permissions

---

## Phase 6: Intelligence Layer
*Focus: Smarter automation*

### 6.1 Visual Understanding
- [ ] Screenshot analysis for layout understanding
- [ ] Visual element matching (find button that "looks like X")
- [ ] Chart/graph data extraction
- [ ] CAPTCHA detection and warning

### 6.2 Adaptive Automation
- [ ] Self-healing selectors (find element even if DOM changes)
- [ ] Pattern learning from user corrections
- [ ] Confidence scoring for actions
- [ ] A/B testing for automation strategies

### 6.3 Natural Language Improvements
- [ ] Ambiguity resolution ("click the button" -> "which button?")
- [ ] Context-aware suggestions
- [ ] Proactive assistance ("I notice you do this often...")
- [ ] Multi-language support

---

## Technical Debt & Infrastructure

### Async Buffer (H2A)
*Asynchronous Human-to-Agent message buffer for non-blocking communication*
- [ ] **H2A message queue**: Buffer human messages while agent is processing
- [ ] **Agent-to-Human async responses**: Stream partial results without blocking
- [ ] **Task queue**: Queue multiple tasks, agent processes sequentially
- [ ] **Priority interrupts**: Allow user to interrupt/reprioritize mid-task

### Logging & Observability
- [ ] Structured logging with request IDs
- [ ] Remove redundant logs (e.g., "No MCP servers" on every message)
- [ ] Performance metrics (command latency, token usage)
- [ ] Error tracking integration (Sentry)

### Testing
- [ ] Unit tests for browser tools
- [ ] Integration tests with mock extension
- [ ] E2E tests with Playwright
- [ ] Workflow regression tests

### Security
- [ ] API key encryption at rest
- [ ] Audit sensitive actions
- [ ] Content Security Policy review
- [ ] Permission scope minimization

### Performance
- [ ] Lazy load MCP tools
- [ ] Command batching
- [ ] Response streaming optimization
- [ ] Memory usage profiling

---

## Priority Matrix

| Phase | Effort | Impact | Dependencies |
|-------|--------|--------|--------------|
| 1. Stability | Low | High | None |
| 2. Deep Context | Medium | High | Phase 1 |
| 3. MCP Integration | Medium | High | Phase 1 |
| 4. Skills & Workflows | High | Very High | Phase 2, 3 |
| 5. Advanced | High | Medium | Phase 4 |
| 6. Intelligence | Very High | High | Phase 2, 4 |

---

## Quick Wins (Do This Week)

1. **Heartbeat**: Add ping/pong to WebSocket (prevents disconnects)
2. **Batch approve**: Single "approve all" button in permission dialog
3. **History limit**: Cap conversation at 20 messages
4. **Log cleanup**: Remove per-message "No MCP servers" log

---

## Open Questions

- [ ] Should workflows be stored locally or synced to cloud?
- [ ] How to handle authentication for logged-in-only pages?
- [ ] Should skills be shareable in a public registry?
- [ ] How to version workflows when target sites change?
- [ ] Privacy implications of storing page content for context?

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Avg approvals per task | 12+ | 1-2 |
| Connection drops per hour | ~7 | 0 |
| Task completion rate | Unknown | >90% |
| Steps to complete simple task | 10+ | 3-5 |

---

*Last updated: 2026-01-31*
