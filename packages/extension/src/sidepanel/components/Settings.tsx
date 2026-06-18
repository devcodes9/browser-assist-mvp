import { useState } from 'react';
import type {
  AgentProvider,
  ClientConfig,
  ClientMode,
  ManagedModelOption,
} from '@shared/types';

interface SettingsProps {
  initial: ClientConfig | null;
  byokProviders: AgentProvider[];
  managedAvailable: boolean;
  managedModels: ManagedModelOption[];
  activeError?: string;
  onSave: (config: ClientConfig) => void;
  onClose: () => void;
}

const PROVIDER_LABELS: Record<AgentProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  azure: 'Azure OpenAI',
  'openai-compatible': 'OpenAI-compatible (OpenRouter, Ollama, etc.)',
};

const PROVIDER_HINTS: Record<AgentProvider, string> = {
  anthropic: 'e.g. claude-3-5-sonnet-20241022, claude-opus-4',
  openai: 'e.g. gpt-4o, gpt-4-turbo',
  azure: 'Deployment name (e.g. gpt-4o-deployment)',
  'openai-compatible': 'Any model id supported by the base URL',
};

export default function Settings({
  initial,
  byokProviders,
  managedAvailable,
  managedModels,
  activeError,
  onSave,
  onClose,
}: SettingsProps) {
  const [mode, setMode] = useState<ClientMode>(initial?.mode ?? 'byok');
  const [provider, setProvider] = useState<AgentProvider>(
    initial?.provider ?? byokProviders[0] ?? 'anthropic'
  );
  const [model, setModel] = useState(initial?.model ?? '');
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '');
  const [baseURL, setBaseURL] = useState(initial?.baseURL ?? '');
  const [azureResourceName, setAzureResourceName] = useState(initial?.azureResourceName ?? '');
  const [azureDeployment, setAzureDeployment] = useState(initial?.azureDeployment ?? '');
  const [azureApiVersion, setAzureApiVersion] = useState(initial?.azureApiVersion ?? '2024-02-01');
  const [licenseKey, setLicenseKey] = useState(initial?.licenseKey ?? '');
  const [managedModel, setManagedModel] = useState(
    initial?.managedModel ?? managedModels[0]?.id ?? ''
  );

  const handleSave = () => {
    const config: ClientConfig = { mode };
    if (mode === 'byok') {
      config.provider = provider;
      config.model = model.trim();
      config.apiKey = apiKey.trim();
      if (provider === 'openai-compatible') config.baseURL = baseURL.trim();
      if (provider === 'azure') {
        config.azureResourceName = azureResourceName.trim();
        config.azureDeployment = azureDeployment.trim();
        config.azureApiVersion = azureApiVersion.trim();
      }
    } else {
      config.licenseKey = licenseKey.trim();
      config.managedModel = managedModel;
    }
    onSave(config);
  };

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true">
      <div className="settings-backdrop" onClick={onClose} />
      <div className="settings-modal">
        <div className="settings-header">
          <h3>Settings</h3>
          <button className="settings-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${mode === 'byok' ? 'active' : ''}`}
            onClick={() => setMode('byok')}
            type="button"
          >
            Bring your own key
          </button>
          <button
            className={`settings-tab ${mode === 'managed' ? 'active' : ''}`}
            onClick={() => setMode('managed')}
            type="button"
            disabled={!managedAvailable}
            title={managedAvailable ? '' : 'Managed mode is not configured on this server'}
          >
            Managed (paid)
          </button>
        </div>

        {activeError && <div className="settings-error">{activeError}</div>}

        {mode === 'byok' ? (
          <div className="settings-body">
            <label className="settings-field">
              <span>Provider</span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as AgentProvider)}
              >
                {byokProviders.map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                ))}
              </select>
            </label>

            <label className="settings-field">
              <span>Model</span>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={PROVIDER_HINTS[provider]}
              />
            </label>

            <label className="settings-field">
              <span>API key</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            {provider === 'openai-compatible' && (
              <>
                <label className="settings-field">
                  <span>Base URL</span>
                  <input
                    type="text"
                    value={baseURL}
                    onChange={(e) => setBaseURL(e.target.value)}
                    placeholder="https://openrouter.ai/api/v1"
                  />
                </label>
                <p className="settings-hint">
                  Examples: OpenRouter (<code>https://openrouter.ai/api/v1</code>), or a local LLM exposed via a tunnel — e.g. run <code>ollama serve</code> then <code>ngrok http 11434</code> and paste the ngrok URL + <code>/v1</code>. For a local backend, <code>http://localhost:11434/v1</code> works directly.
                </p>
              </>
            )}

            {provider === 'azure' && (
              <>
                <label className="settings-field">
                  <span>Azure resource name</span>
                  <input
                    type="text"
                    value={azureResourceName}
                    onChange={(e) => setAzureResourceName(e.target.value)}
                  />
                </label>
                <label className="settings-field">
                  <span>Azure deployment</span>
                  <input
                    type="text"
                    value={azureDeployment}
                    onChange={(e) => setAzureDeployment(e.target.value)}
                  />
                </label>
                <label className="settings-field">
                  <span>Azure API version</span>
                  <input
                    type="text"
                    value={azureApiVersion}
                    onChange={(e) => setAzureApiVersion(e.target.value)}
                  />
                </label>
              </>
            )}

            <p className="settings-hint">
              Your key is stored only in this browser (chrome.storage.local) and sent to your backend over WebSocket. It never leaves your machine unless your backend forwards it.
            </p>
          </div>
        ) : (
          <div className="settings-body">
            {!managedAvailable && (
              <p className="settings-hint settings-warn">
                Managed mode is not configured on the connected backend. Ask the operator to set MANAGED_LICENSE_KEYS, MANAGED_API_KEY and MANAGED_MODELS.
              </p>
            )}

            <label className="settings-field">
              <span>License key</span>
              <input
                type="password"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Paste your license key"
                autoComplete="off"
                spellCheck={false}
                disabled={!managedAvailable}
              />
            </label>

            <label className="settings-field">
              <span>Model</span>
              <select
                value={managedModel}
                onChange={(e) => setManagedModel(e.target.value)}
                disabled={!managedAvailable || managedModels.length === 0}
              >
                {managedModels.length === 0 ? (
                  <option value="">(no models offered)</option>
                ) : (
                  managedModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))
                )}
              </select>
            </label>

            <p className="settings-hint">
              Managed mode uses the backend's API credentials. You only pay (and only see models) when your license key is valid.
            </p>
          </div>
        )}

        <div className="settings-actions">
          <button className="settings-cancel" onClick={onClose} type="button">Cancel</button>
          <button className="settings-save" onClick={handleSave} type="button">Save</button>
        </div>
      </div>
    </div>
  );
}
