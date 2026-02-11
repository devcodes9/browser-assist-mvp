import { useState, useEffect } from 'react';
import type {
  ChatMessage,
  PendingPermission,
  AgentMessageToExtension,
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
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(
    null
  );
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);

  // Get current tab ID on mount
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        setTabId(tab.id);
      }
    });

    // Notify background that sidepanel is ready
    chrome.runtime.sendMessage({ type: 'sidepanel:ready' }).then((response) => {
      if (response?.connected) {
        setConnected(true);
      }
    });
  }, []);

  // Listen for messages from background
  useEffect(() => {
    const handleMessage = (message: any) => {
      console.log('[Sidepanel] Received message:', message.type);

      switch (message.type) {
        case 'backend:connected':
          setConnected(true);
          addSystemMessage('Connected to AI backend');
          break;

        case 'backend:disconnected':
          setConnected(false);
          addSystemMessage('Disconnected from AI backend');
          break;

        case 'agent:message':
          handleAgentMessage(message);
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

  // Handle agent message
  const handleAgentMessage = (message: AgentMessageToExtension) => {
    if (message.streaming) {
      // Update last message if streaming
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
    } else {
      // Add complete message
      addAgentMessage(message.content);
    }
  };

  // Handle permission request
  const handlePermissionRequest = (message: PermissionRequestMessage) => {
    setPendingPermission({
      id: message.command.id,
      command: message.command,
      description: message.description,
    });
  };

  // Handle plan request
  const handlePlanRequest = (message: PlanRequestMessage) => {
    setPendingPlan({
      planId: message.planId,
      plan: message.plan,
      summary: message.summary,
    });
  };

  // Add message helpers
  const addUserMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
      },
    ]);
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

  const addSystemMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'system',
        content,
        timestamp: Date.now(),
      },
    ]);
  };

  // Handle user message send
  const handleSendMessage = async (content: string) => {
    if (!tabId) {
      addSystemMessage('Error: No active tab');
      return;
    }

    addUserMessage(content);

    // Get current page info for context
    let pageUrl = '';
    let pageTitle = '';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        pageUrl = tab.url || '';
        pageTitle = tab.title || '';
      }
    } catch (e) {
      console.error('Failed to get tab info:', e);
    }

    // Send to backend via background script with page context
    chrome.runtime.sendMessage({
      type: 'user:message',
      content,
      tabId,
      pageUrl,
      pageTitle,
    });
  };

  // Handle permission response
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

  // Handle plan response
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

  // Handle reconnect
  const handleReconnect = () => {
    chrome.runtime.sendMessage({ type: 'connect:backend' });
  };

  return (
    <div className="app">
      <ConnectionStatus connected={connected} onReconnect={handleReconnect} />

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
      />
    </div>
  );
}

export default App;
