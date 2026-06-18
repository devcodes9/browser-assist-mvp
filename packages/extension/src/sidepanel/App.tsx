import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  ChatMessage,
  AgentMessageToExtension,
  AgentStatusMessage,
  ClientConfig,
  ConfigStateMessage,
  AgentProvider,
  ManagedModelOption,
} from '@shared/types';
import ChatInterface from './components/ChatInterface';
import ConnectionStatus from './components/ConnectionStatus';
import Settings from './components/Settings';

const STORAGE_KEY = 'browserAssist.clientConfig';

function App() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tabId, setTabId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentToolCall, setCurrentToolCall] = useState<string | null>(null);

  const [clientConfig, setClientConfig] = useState<ClientConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [byokProviders, setByokProviders] = useState<AgentProvider[]>([
    'anthropic',
    'openai',
    'azure',
    'openai-compatible',
  ]);
  const [managedAvailable, setManagedAvailable] = useState(false);
  const [managedModels, setManagedModels] = useState<ManagedModelOption[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | undefined>();

  // Track latest config in a ref so the connect handler always sends the current one
  const clientConfigRef = useRef<ClientConfig | null>(null);
  useEffect(() => {
    clientConfigRef.current = clientConfig;
  }, [clientConfig]);

  // Load persisted config + tab id on mount
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) setTabId(tab.id);
    });

    chrome.storage.local.get(STORAGE_KEY).then((res) => {
      const saved = res[STORAGE_KEY] as ClientConfig | undefined;
      if (saved) setClientConfig(saved);
    });

    chrome.runtime.sendMessage({ type: 'sidepanel:ready' }).then((response) => {
      if (response?.connected) setConnected(true);
    });
  }, []);

  const sendClientConfig = useCallback((config: ClientConfig | null) => {
    if (!config) return;
    chrome.runtime.sendMessage({ type: 'config:set', config });
  }, []);

  // Listen for messages from background
  useEffect(() => {
    const handleMessage = (message: any) => {
      switch (message.type) {
        case 'backend:connected':
          setConnected(true);
          addSystemMessage('Connected to AI backend');
          // Re-send config so the backend has it for this connection
          sendClientConfig(clientConfigRef.current);
          break;

        case 'backend:disconnected':
          setConnected(false);
          setIsProcessing(false);
          setCurrentToolCall(null);
          addSystemMessage('Disconnected from AI backend');
          break;

        case 'agent:message':
          handleAgentMessage(message);
          break;

        case 'agent:status':
          handleAgentStatus(message);
          break;

        case 'config:state':
          handleConfigState(message);
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [sendClientConfig]);

  const handleAgentMessage = (message: AgentMessageToExtension) => {
    if (message.done) {
      setIsProcessing(false);
      setCurrentToolCall(null);
    }

    if (message.streaming) {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'agent' && !message.done) {
          return [
            ...prev.slice(0, -1),
            { ...last, content: message.content },
          ];
        }
        return [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'agent',
            content: message.content,
            timestamp: Date.now(),
          },
        ];
      });
    } else if (message.content) {
      addAgentMessage(message.content);
    }
  };

  const handleAgentStatus = (message: AgentStatusMessage) => {
    switch (message.status) {
      case 'thinking':
        setIsProcessing(true);
        setCurrentToolCall(null);
        break;
      case 'tool_call':
        setIsProcessing(true);
        setCurrentToolCall(message.summary || message.toolName || null);
        if (message.summary) {
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.role === 'status') {
              return [
                ...prev.slice(0, -1),
                {
                  id: Date.now().toString(),
                  role: 'status' as const,
                  content: message.summary!,
                  timestamp: Date.now(),
                  toolName: message.toolName,
                  status: 'tool_call' as const,
                },
              ];
            }
            return [
              ...prev,
              {
                id: Date.now().toString(),
                role: 'status' as const,
                content: message.summary!,
                timestamp: Date.now(),
                toolName: message.toolName,
                status: 'tool_call' as const,
              },
            ];
          });
        }
        break;
      case 'idle':
        setIsProcessing(false);
        setCurrentToolCall(null);
        break;
      case 'error':
        setIsProcessing(false);
        setCurrentToolCall(null);
        break;
    }
  };

  const handleConfigState = (message: ConfigStateMessage) => {
    setByokProviders(message.byokProviders);
    setManagedAvailable(message.managedAvailable);
    setManagedModels(message.managedModels);
    if (message.active) {
      setActiveModel(`${message.active.provider}/${message.active.model}`);
      setConfigError(undefined);
    }
    if (message.error) {
      setConfigError(message.error);
      addSystemMessage(`Config error: ${message.error}`);
    }
  };

  const addAgentMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'agent',
        content,
        timestamp: Date.now(),
      },
    ]);
  };

  const addSystemMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'system',
        content,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const handleSendMessage = async (content: string) => {
    if (!tabId) {
      addSystemMessage('Error: No active tab');
      return;
    }
    if (!clientConfig) {
      addSystemMessage('No model configured. Open Settings (gear icon).');
      setSettingsOpen(true);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
      },
    ]);

    setIsProcessing(true);

    let pageUrl = '';
    let pageTitle = '';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        pageUrl = tab.url || '';
        pageTitle = tab.title || '';
      }
    } catch {
      // ignore
    }

    chrome.runtime.sendMessage({
      type: 'user:message',
      content,
      tabId,
      pageUrl,
      pageTitle,
    });
  };

  const handleStop = () => {
    if (!tabId) return;
    chrome.runtime.sendMessage({ type: 'user:stop', tabId });
  };

  const handleClearConversation = () => {
    setMessages([]);
    setIsProcessing(false);
    setCurrentToolCall(null);
    chrome.runtime.sendMessage({ type: 'conversation:clear' });
    addSystemMessage('Conversation cleared');
  };

  const handleReconnect = () => {
    chrome.runtime.sendMessage({ type: 'connect:backend' });
  };

  const handleSettingsSave = (config: ClientConfig) => {
    setClientConfig(config);
    chrome.storage.local.set({ [STORAGE_KEY]: config });
    sendClientConfig(config);
    setSettingsOpen(false);
  };

  return (
    <div className="app">
      <ConnectionStatus
        connected={connected}
        onReconnect={handleReconnect}
        onClear={handleClearConversation}
        onOpenSettings={() => setSettingsOpen(true)}
        activeModel={activeModel}
        messageCount={messages.filter((m) => m.role !== 'system' && m.role !== 'status').length}
      />

      <ChatInterface
        messages={messages}
        onSendMessage={handleSendMessage}
        onStop={handleStop}
        disabled={!connected}
        isProcessing={isProcessing}
        currentToolCall={currentToolCall}
      />

      {settingsOpen && (
        <Settings
          initial={clientConfig}
          byokProviders={byokProviders}
          managedAvailable={managedAvailable}
          managedModels={managedModels}
          activeError={configError}
          onSave={handleSettingsSave}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
