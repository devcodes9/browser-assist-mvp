import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
const PROVIDER_LABELS = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    azure: 'Azure OpenAI',
    'openai-compatible': 'OpenAI-compatible (OpenRouter, Ollama, etc.)',
};
const PROVIDER_HINTS = {
    anthropic: 'e.g. claude-3-5-sonnet-20241022, claude-opus-4',
    openai: 'e.g. gpt-4o, gpt-4-turbo',
    azure: 'Deployment name (e.g. gpt-4o-deployment)',
    'openai-compatible': 'Any model id supported by the base URL',
};
export default function Settings({ initial, byokProviders, managedAvailable, managedModels, activeError, onSave, onClose, }) {
    const [mode, setMode] = useState(initial?.mode ?? 'byok');
    const [provider, setProvider] = useState(initial?.provider ?? byokProviders[0] ?? 'anthropic');
    const [model, setModel] = useState(initial?.model ?? '');
    const [apiKey, setApiKey] = useState(initial?.apiKey ?? '');
    const [baseURL, setBaseURL] = useState(initial?.baseURL ?? '');
    const [azureResourceName, setAzureResourceName] = useState(initial?.azureResourceName ?? '');
    const [azureDeployment, setAzureDeployment] = useState(initial?.azureDeployment ?? '');
    const [azureApiVersion, setAzureApiVersion] = useState(initial?.azureApiVersion ?? '2024-02-01');
    const [licenseKey, setLicenseKey] = useState(initial?.licenseKey ?? '');
    const [managedModel, setManagedModel] = useState(initial?.managedModel ?? managedModels[0]?.id ?? '');
    const handleSave = () => {
        const config = { mode };
        if (mode === 'byok') {
            config.provider = provider;
            config.model = model.trim();
            config.apiKey = apiKey.trim();
            if (provider === 'openai-compatible')
                config.baseURL = baseURL.trim();
            if (provider === 'azure') {
                config.azureResourceName = azureResourceName.trim();
                config.azureDeployment = azureDeployment.trim();
                config.azureApiVersion = azureApiVersion.trim();
            }
        }
        else {
            config.licenseKey = licenseKey.trim();
            config.managedModel = managedModel;
        }
        onSave(config);
    };
    return (_jsxs("div", { className: "settings-overlay", role: "dialog", "aria-modal": "true", children: [_jsx("div", { className: "settings-backdrop", onClick: onClose }), _jsxs("div", { className: "settings-modal", children: [_jsxs("div", { className: "settings-header", children: [_jsx("h3", { children: "Settings" }), _jsx("button", { className: "settings-close", onClick: onClose, "aria-label": "Close", children: "\u00D7" })] }), _jsxs("div", { className: "settings-tabs", children: [_jsx("button", { className: `settings-tab ${mode === 'byok' ? 'active' : ''}`, onClick: () => setMode('byok'), type: "button", children: "Bring your own key" }), _jsx("button", { className: `settings-tab ${mode === 'managed' ? 'active' : ''}`, onClick: () => setMode('managed'), type: "button", disabled: !managedAvailable, title: managedAvailable ? '' : 'Managed mode is not configured on this server', children: "Managed (paid)" })] }), activeError && _jsx("div", { className: "settings-error", children: activeError }), mode === 'byok' ? (_jsxs("div", { className: "settings-body", children: [_jsxs("label", { className: "settings-field", children: [_jsx("span", { children: "Provider" }), _jsx("select", { value: provider, onChange: (e) => setProvider(e.target.value), children: byokProviders.map((p) => (_jsx("option", { value: p, children: PROVIDER_LABELS[p] }, p))) })] }), _jsxs("label", { className: "settings-field", children: [_jsx("span", { children: "Model" }), _jsx("input", { type: "text", value: model, onChange: (e) => setModel(e.target.value), placeholder: PROVIDER_HINTS[provider] })] }), _jsxs("label", { className: "settings-field", children: [_jsx("span", { children: "API key" }), _jsx("input", { type: "password", value: apiKey, onChange: (e) => setApiKey(e.target.value), placeholder: "sk-...", autoComplete: "off", spellCheck: false })] }), provider === 'openai-compatible' && (_jsxs(_Fragment, { children: [_jsxs("label", { className: "settings-field", children: [_jsx("span", { children: "Base URL" }), _jsx("input", { type: "text", value: baseURL, onChange: (e) => setBaseURL(e.target.value), placeholder: "https://openrouter.ai/api/v1" })] }), _jsxs("p", { className: "settings-hint", children: ["Examples: OpenRouter (", _jsx("code", { children: "https://openrouter.ai/api/v1" }), "), or a local LLM exposed via a tunnel \u2014 e.g. run ", _jsx("code", { children: "ollama serve" }), " then ", _jsx("code", { children: "ngrok http 11434" }), " and paste the ngrok URL + ", _jsx("code", { children: "/v1" }), ". For a local backend, ", _jsx("code", { children: "http://localhost:11434/v1" }), " works directly."] })] })), provider === 'azure' && (_jsxs(_Fragment, { children: [_jsxs("label", { className: "settings-field", children: [_jsx("span", { children: "Azure resource name" }), _jsx("input", { type: "text", value: azureResourceName, onChange: (e) => setAzureResourceName(e.target.value) })] }), _jsxs("label", { className: "settings-field", children: [_jsx("span", { children: "Azure deployment" }), _jsx("input", { type: "text", value: azureDeployment, onChange: (e) => setAzureDeployment(e.target.value) })] }), _jsxs("label", { className: "settings-field", children: [_jsx("span", { children: "Azure API version" }), _jsx("input", { type: "text", value: azureApiVersion, onChange: (e) => setAzureApiVersion(e.target.value) })] })] })), _jsx("p", { className: "settings-hint", children: "Your key is stored only in this browser (chrome.storage.local) and sent to your backend over WebSocket. It never leaves your machine unless your backend forwards it." })] })) : (_jsxs("div", { className: "settings-body", children: [!managedAvailable && (_jsx("p", { className: "settings-hint settings-warn", children: "Managed mode is not configured on the connected backend. Ask the operator to set MANAGED_LICENSE_KEYS, MANAGED_API_KEY and MANAGED_MODELS." })), _jsxs("label", { className: "settings-field", children: [_jsx("span", { children: "License key" }), _jsx("input", { type: "password", value: licenseKey, onChange: (e) => setLicenseKey(e.target.value), placeholder: "Paste your license key", autoComplete: "off", spellCheck: false, disabled: !managedAvailable })] }), _jsxs("label", { className: "settings-field", children: [_jsx("span", { children: "Model" }), _jsx("select", { value: managedModel, onChange: (e) => setManagedModel(e.target.value), disabled: !managedAvailable || managedModels.length === 0, children: managedModels.length === 0 ? (_jsx("option", { value: "", children: "(no models offered)" })) : (managedModels.map((m) => (_jsx("option", { value: m.id, children: m.label }, m.id)))) })] }), _jsx("p", { className: "settings-hint", children: "Managed mode uses the backend's API credentials. You only pay (and only see models) when your license key is valid." })] })), _jsxs("div", { className: "settings-actions", children: [_jsx("button", { className: "settings-cancel", onClick: onClose, type: "button", children: "Cancel" }), _jsx("button", { className: "settings-save", onClick: handleSave, type: "button", children: "Save" })] })] })] }));
}
