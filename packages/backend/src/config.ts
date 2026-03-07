/**
 * Configuration loader
 */

import { config as dotenvConfig } from 'dotenv';
import type { AgentConfig, MCPConfig } from './types.js';
import { readFileSync, existsSync } from 'fs';

// Load .env file
dotenvConfig();

export function loadConfig(): AgentConfig {
  // Determine provider from env
  const provider = (process.env.AI_PROVIDER || 'anthropic') as AgentConfig['provider'];

  // Get API key based on provider
  let apiKey: string;
  switch (provider) {
    case 'anthropic':
      apiKey = process.env.ANTHROPIC_API_KEY || '';
      break;
    case 'openai':
      apiKey = process.env.OPENAI_API_KEY || '';
      break;
    case 'azure':
      apiKey = process.env.AZURE_API_KEY || '';
      break;
    default:
      apiKey = process.env.API_KEY || '';
  }

  if (!apiKey) {
    throw new Error(
      `Missing API key for provider "${provider}". Set ${provider.toUpperCase()}_API_KEY in .env`
    );
  }

  // Get model
  const model = process.env.AI_MODEL || getDefaultModel(provider);

  const config: AgentConfig = {
    provider,
    model,
    apiKey,
    maxSteps: parseInt(process.env.MAX_STEPS || '25'),
  };

  // Add Azure-specific configuration
  if (provider === 'azure') {
    config.azureResourceName = process.env.AZURE_RESOURCE_NAME;
    config.azureDeployment = process.env.AZURE_DEPLOYMENT;
    config.azureApiVersion = process.env.AZURE_API_VERSION || '2024-02-01';

    if (!config.azureResourceName) {
      throw new Error('Missing AZURE_RESOURCE_NAME in .env');
    }
    if (!config.azureDeployment) {
      throw new Error('Missing AZURE_DEPLOYMENT in .env');
    }
  }

  return config;
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

function getDefaultModel(provider: AgentConfig['provider']): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    case 'openai':
      return 'gpt-4-turbo';
    case 'azure':
      return 'gpt-4'; // Azure deployment name, not model
    default:
      return 'default';
  }
}
