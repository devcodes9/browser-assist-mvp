/**
 * Configuration loader
 *
 * Two paths:
 *  - BYOK: the client (extension) sends its own provider/model/apiKey via
 *    config:set. We trust those values and pass them to the AI SDK.
 *  - Managed: the client sends a license key + a model id. If the license key
 *    matches one we have on the server, we swap in our env-configured
 *    provider credentials so the user never sees them.
 */

import { config as dotenvConfig } from 'dotenv';
import type {
  AgentConfig,
  AgentProvider,
  ClientConfig,
  ManagedModelOption,
  MCPConfig,
} from './types.js';
import { readFileSync, existsSync } from 'fs';

dotenvConfig();

const BYOK_PROVIDERS: AgentProvider[] = ['anthropic', 'openai', 'azure', 'openai-compatible'];

export interface ServerCapabilities {
  byokProviders: AgentProvider[];
  managedAvailable: boolean;
  managedModels: ManagedModelOption[];
}

export function getServerCapabilities(): ServerCapabilities {
  return {
    byokProviders: BYOK_PROVIDERS,
    managedAvailable: getManagedLicenseKeys().length > 0 && hasManagedCredentials(),
    managedModels: getManagedModels(),
  };
}

export class ConfigError extends Error {}

/**
 * Resolve an AgentConfig from what the client sent.
 * Throws ConfigError with a user-facing message if the config is invalid.
 */
export function resolveClientConfig(client: ClientConfig | null): AgentConfig {
  const maxSteps = parseInt(process.env.MAX_STEPS || '25');

  if (!client) {
    throw new ConfigError(
      'No model configuration. Open Settings and configure a provider (BYOK) or enter a license key (Managed).'
    );
  }

  if (client.mode === 'managed') {
    return resolveManaged(client, maxSteps);
  }
  return resolveByok(client, maxSteps);
}

function resolveByok(client: ClientConfig, maxSteps: number): AgentConfig {
  const provider = client.provider;
  if (!provider) throw new ConfigError('BYOK: select a provider in Settings.');
  if (!BYOK_PROVIDERS.includes(provider)) {
    throw new ConfigError(`BYOK: unsupported provider "${provider}".`);
  }
  if (!client.model) throw new ConfigError('BYOK: enter a model name in Settings.');
  if (!client.apiKey) throw new ConfigError('BYOK: enter your API key in Settings.');

  const config: AgentConfig = {
    provider,
    model: client.model,
    apiKey: client.apiKey,
    maxSteps,
  };

  if (provider === 'openai-compatible') {
    if (!client.baseURL) {
      throw new ConfigError('BYOK: openai-compatible providers require a base URL (e.g. https://openrouter.ai/api/v1).');
    }
    config.baseURL = client.baseURL;
  }

  if (provider === 'azure') {
    if (!client.azureResourceName) throw new ConfigError('BYOK Azure: enter resource name.');
    if (!client.azureDeployment) throw new ConfigError('BYOK Azure: enter deployment name.');
    config.azureResourceName = client.azureResourceName;
    config.azureDeployment = client.azureDeployment;
    config.azureApiVersion = client.azureApiVersion || '2024-02-01';
  }

  return config;
}

function resolveManaged(client: ClientConfig, maxSteps: number): AgentConfig {
  const validKeys = getManagedLicenseKeys();
  if (validKeys.length === 0 || !hasManagedCredentials()) {
    throw new ConfigError(
      'Managed mode is not available on this server. Switch to BYOK in Settings.'
    );
  }
  if (!client.licenseKey) {
    throw new ConfigError('Managed: enter your license key in Settings.');
  }
  if (!validKeys.includes(client.licenseKey)) {
    throw new ConfigError('Managed: invalid license key.');
  }

  const requestedModel = client.managedModel;
  const allowed = getManagedModels();
  if (!requestedModel) {
    throw new ConfigError('Managed: select a model in Settings.');
  }
  if (!allowed.some((m) => m.id === requestedModel)) {
    throw new ConfigError(`Managed: model "${requestedModel}" is not in the allowed list.`);
  }

  // Server-side credentials (never leave the backend)
  const provider = (process.env.MANAGED_PROVIDER || 'anthropic') as AgentProvider;
  const apiKey = process.env.MANAGED_API_KEY || '';
  if (!apiKey) {
    throw new ConfigError('Managed: server missing MANAGED_API_KEY.');
  }

  const config: AgentConfig = {
    provider,
    model: requestedModel,
    apiKey,
    maxSteps,
  };

  if (provider === 'openai-compatible') {
    config.baseURL = process.env.MANAGED_BASE_URL;
    if (!config.baseURL) throw new ConfigError('Managed: server missing MANAGED_BASE_URL.');
  }
  if (provider === 'azure') {
    config.azureResourceName = process.env.AZURE_RESOURCE_NAME;
    config.azureDeployment = process.env.AZURE_DEPLOYMENT || requestedModel;
    config.azureApiVersion = process.env.AZURE_API_VERSION || '2024-02-01';
  }

  return config;
}

function getManagedLicenseKeys(): string[] {
  return (process.env.MANAGED_LICENSE_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

function hasManagedCredentials(): boolean {
  return !!process.env.MANAGED_API_KEY;
}

function getManagedModels(): ManagedModelOption[] {
  const raw = process.env.MANAGED_MODELS || '';
  // Format: "id1:Label 1,id2:Label 2" — falls back to id if no label.
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, label] = entry.split(':').map((s) => s.trim());
      return { id, label: label || id };
    });
}

export function loadMCPConfig(): MCPConfig | null {
  const mcpConfigPath = process.env.MCP_CONFIG_PATH || './mcp-config.json';

  if (!existsSync(mcpConfigPath)) {
    return null;
  }

  try {
    const content = readFileSync(mcpConfigPath, 'utf-8');
    return JSON.parse(content) as MCPConfig;
  } catch (error) {
    console.warn('Failed to load MCP config:', error);
    return null;
  }
}
