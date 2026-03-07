import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import ChatInterface from './components/ChatInterface';
import PermissionGate from './components/PermissionGate';
import PlanApproval from './components/PlanApproval';
import ConnectionStatus from './components/ConnectionStatus';
function App() {
    const [connected, setConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const [pendingPermission, setPendingPermission] = useState(null);
    const [pendingPlan, setPendingPlan] = useState(null);
    const [tabId, setTabId] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentToolCall, setCurrentToolCall] = useState(null);
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
        const handleMessage = (message) => {
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
    const handleAgentMessage = (message) => {
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
        }
        else if (message.content) {
            addAgentMessage(message.content);
        }
    };
    const handleAgentStatus = (message) => {
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
                                    role: 'status',
                                    content: message.summary,
                                    timestamp: Date.now(),
                                    toolName: message.toolName,
                                    status: 'tool_call',
                                },
                            ];
                        }
                        return [
                            ...prev,
                            {
                                id: Date.now().toString(),
                                role: 'status',
                                content: message.summary,
                                timestamp: Date.now(),
                                toolName: message.toolName,
                                status: 'tool_call',
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
    const handlePermissionRequest = (message) => {
        setPendingPermission({
            id: message.command.id,
            command: message.command,
            description: message.description,
        });
    };
    const handlePlanRequest = (message) => {
        setPendingPlan({
            planId: message.planId,
            plan: message.plan,
            summary: message.summary,
        });
    };
    const addAgentMessage = (content) => {
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
    const addSystemMessage = useCallback((content) => {
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
    const handleSendMessage = async (content) => {
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
        }
        catch {
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
    const handlePermissionResponse = (approved) => {
        if (!pendingPermission || !tabId)
            return;
        chrome.runtime.sendMessage({
            type: 'permission:response',
            commandId: pendingPermission.id,
            approved,
            tabId,
        });
        if (approved) {
            addSystemMessage(`Approved: ${pendingPermission.description}`);
        }
        else {
            addSystemMessage(`Denied: ${pendingPermission.description}`);
        }
        setPendingPermission(null);
    };
    const handlePlanResponse = (approved, feedback) => {
        if (!pendingPlan || !tabId)
            return;
        chrome.runtime.sendMessage({
            type: 'plan:response',
            planId: pendingPlan.planId,
            approved,
            feedback,
            tabId,
        });
        if (approved) {
            addSystemMessage(`Plan approved: ${pendingPlan.summary}`);
        }
        else {
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
    return (_jsxs("div", { className: "app", children: [_jsx(ConnectionStatus, { connected: connected, onReconnect: handleReconnect, onClear: handleClearConversation, messageCount: messages.filter((m) => m.role !== 'system' && m.role !== 'status').length }), pendingPlan && (_jsx(PlanApproval, { plan: pendingPlan, onApprove: () => handlePlanResponse(true), onReject: (feedback) => handlePlanResponse(false, feedback) })), pendingPermission && (_jsx(PermissionGate, { permission: pendingPermission, onApprove: () => handlePermissionResponse(true), onDeny: () => handlePermissionResponse(false) })), _jsx(ChatInterface, { messages: messages, onSendMessage: handleSendMessage, disabled: !connected, isProcessing: isProcessing, currentToolCall: currentToolCall })] }));
}
export default App;
