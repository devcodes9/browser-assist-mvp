/**
 * Shared types for browser-assist MVP
 * Used by both extension and backend
 */

// ============================================================================
// Browser Command Protocol
// ============================================================================

export type BrowserCommand =
  | NavigateCommand
  | ClickCommand
  | TypeCommand
  | ExtractCommand
  | SnapshotCommand
  | DiscoverCommand
  | ScreenshotCommand
  | GetPageStructureCommand
  | ExtractTableCommand
  | ExtractLinksCommand
  | GetFormFieldsCommand
  | ScrollToCommand
  | SearchPageCommand
  | EvalCommand;

export interface NavigateCommand {
  type: 'navigate';
  id: string;
  url: string;
}

export interface ClickCommand {
  type: 'click';
  id: string;
  selector: string;
}

export interface TypeCommand {
  type: 'type';
  id: string;
  selector: string;
  text: string;
}

export interface ExtractCommand {
  type: 'extract';
  id: string;
  selector: string;
}

export interface SnapshotCommand {
  type: 'snapshot';
  id: string;
}

export interface DiscoverCommand {
  type: 'discover';
  id: string;
}

export interface ScreenshotCommand {
  type: 'screenshot';
  id: string;
}

export interface InteractiveElement {
  selector: string;
  tagName: string;
  text: string;
  type?: string;
  role?: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  attributes: Record<string, string>;
  isVisible: boolean;
  isInViewport: boolean;
}

export interface GetPageStructureCommand {
  type: 'get_page_structure';
  id: string;
}

export interface ExtractTableCommand {
  type: 'extract_table';
  id: string;
  selector: string;
}

export interface ExtractLinksCommand {
  type: 'extract_links';
  id: string;
}

export interface GetFormFieldsCommand {
  type: 'get_form_fields';
  id: string;
}

export interface ScrollToCommand {
  type: 'scroll_to';
  id: string;
  target: string | 'top' | 'bottom';
}

export interface SearchPageCommand {
  type: 'search_page';
  id: string;
  query: string;
}

export interface EvalCommand {
  type: 'eval';
  id: string;
  code: string;
}

// ============================================================================
// Command Results
// ============================================================================

export interface CommandResult {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================================
// WebSocket Messages (Extension ↔ Backend)
// ============================================================================

export type WSMessage =
  | ExtensionReadyMessage
  | UserMessageFromExtension
  | AgentMessageToExtension
  | CommandRequestMessage
  | CommandResponseMessage
  | PermissionRequestMessage
  | PermissionResponseMessage
  | PlanRequestMessage
  | PlanResponseMessage;

// Extension → Backend
export interface ExtensionReadyMessage {
  type: 'extension:ready';
  tabId: number;
}

export interface UserMessageFromExtension {
  type: 'user:message';
  content: string;
  tabId: number;
  pageUrl?: string;
  pageTitle?: string;
}

export interface CommandResponseMessage {
  type: 'command:response';
  result: CommandResult;
  tabId: number;
}

export interface PermissionResponseMessage {
  type: 'permission:response';
  commandId: string;
  approved: boolean;
  tabId: number;
}

// Backend → Extension
export interface AgentMessageToExtension {
  type: 'agent:message';
  content: string;
  streaming: boolean;
  done: boolean;
}

export interface CommandRequestMessage {
  type: 'command:request';
  command: BrowserCommand;
}

export interface PermissionRequestMessage {
  type: 'permission:request';
  command: BrowserCommand;
  description: string;
}

// Plan approval messages
export interface PlanRequestMessage {
  type: 'plan:request';
  planId: string;
  plan: string[];  // List of planned actions
  summary: string; // Brief description
}

export interface PlanResponseMessage {
  type: 'plan:response';
  planId: string;
  approved: boolean;
  feedback?: string; // If user wants to modify
}

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  provider: 'anthropic' | 'openai' | 'azure' | 'custom';
  model: string;
  apiKey: string;
  maxSteps?: number;
  // Azure-specific configuration
  azureResourceName?: string;
  azureDeployment?: string;
  azureApiVersion?: string;
}

// ============================================================================
// MCP Configuration
// ============================================================================

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPConfig {
  servers: MCPServerConfig[];
}

// ============================================================================
// UI State
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
}

export interface PendingPermission {
  id: string;
  command: BrowserCommand;
  description: string;
}
