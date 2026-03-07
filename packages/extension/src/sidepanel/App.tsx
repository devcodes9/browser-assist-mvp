import { useState, useEffect, useCallback } from 'react';
import type {
  ChatMessage,
  PendingPermission,
  AgentMessageToExtension,
  AgentStatusMessage,
  PermissionRequestMessage,
  PlanRequestMessage,
} from '@shared/types';
import ChatInterface from './components/ChatInterface';
import PermissionGate from './components/PermissionGate';
import PlanApproval from './components/PlanApproval';
import ConnectionStatus from './components/ConnectionStatus';

interface PendingPlan {
  planId: string;
  plan: string[];
  summary: string;
}

function App() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentToolCall, setCurrentToolCall] = useState<string | null>(null);

  // Get current tab ID on mount
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        setTabId(tab.id);
      }
    });

    chrome.runtime.sendMessage({ type: 'sidepanel:ready' }).then((response) => {
      if (response?.connected) {
        setConnected(true);
      }
    });
  }, []);

  // Listen for messages from background
  useEffect(() => {
    const handleMessage = (message: any) => {
      switch (message.type) {
        case 'backend:connected':
          setConnected(true);
          addSystemMessage('Connected to AI backend');
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

        case 'permission:request':
          handlePermissionRequest(message);
          break;

        case 'plan:request':
          handlePlanRequest(message);
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

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
        // Add a status message for tool visibility
        if (message.summary) {
          setMessages((prev) => {
            // Replace previous status message if exists
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

  const handlePermissionRequest = (message: PermissionRequestMessage) => {
    setPendingPermission({
      id: message.command.id,
      command: message.command,
      description: message.description,
    });
  };

  const handlePlanRequest = (message: PlanRequestMessage) => {
    setPendingPlan({
      planId: message.planId,
      plan: message.plan,
      summary: message.summary,
    });
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

    // Add user message to UI
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

    // Get current page info
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

  const handlePermissionResponse = (approved: boolean) => {
    if (!pendingPermission || !tabId) return;

    chrome.runtime.sendMessage({
      type: 'permission:response',
      commandId: pendingPermission.id,
      approved,
      tabId,
    });

    if (approved) {
      addSystemMessage(`Approved: ${pendingPermission.description}`);
    } else {
      addSystemMessage(`Denied: ${pendingPermission.description}`);
    }

    setPendingPermission(null);
  };

  const handlePlanResponse = (approved: boolean, feedback?: string) => {
    if (!pendingPlan || !tabId) return;

    chrome.runtime.sendMessage({
      type: 'plan:response',
      planId: pendingPlan.planId,
      approved,
      feedback,
      tabId,
    });

    if (approved) {
      addSystemMessage(`Plan approved: ${pendingPlan.summary}`);
    } else {
      addSystemMessage('Plan cancelled');
    }

    setPendingPlan(null);
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

  return (
    <div className="app">
      <ConnectionStatus
        connected={connected}
        onReconnect={handleReconnect}
        onClear={handleClearConversation}
        messageCount={messages.filter((m) => m.role !== 'system' && m.role !== 'status').length}
      />

      {pendingPlan && (
        <PlanApproval
          plan={pendingPlan}
          onApprove={() => handlePlanResponse(true)}
          onReject={(feedback) => handlePlanResponse(false, feedback)}
        />
      )}

      {pendingPermission && (
        <PermissionGate
          permission={pendingPermission}
          onApprove={() => handlePermissionResponse(true)}
          onDeny={() => handlePermissionResponse(false)}
        />
      )}

      <ChatInterface
        messages={messages}
        onSendMessage={handleSendMessage}
        disabled={!connected}
        isProcessing={isProcessing}
        currentToolCall={currentToolCall}
      />
    </div>
  );
}

export default App;
