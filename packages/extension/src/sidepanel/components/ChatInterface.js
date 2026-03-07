import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
export default function ChatInterface({ messages, onSendMessage, disabled = false, isProcessing = false, currentToolCall = null, }) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isProcessing, currentToolCall]);
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim() || disabled || isProcessing)
            return;
        onSendMessage(input.trim());
        setInput('');
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };
    return (_jsxs("div", { className: "chat-interface", children: [_jsxs("div", { className: "messages", children: [messages.length === 0 ? (_jsxs("div", { className: "empty-state", children: [_jsx("div", { className: "empty-icon", children: "\u25C8" }), _jsx("p", { children: "Browser Assist AI" }), _jsxs("div", { className: "examples", children: [_jsx("p", { className: "examples-title", children: "Try asking:" }), _jsxs("ul", { children: [_jsx("li", { children: "\"Go to google.com and search for AI agents\"" }), _jsx("li", { children: "\"Find the pricing section on this page\"" }), _jsx("li", { children: "\"Fill out the contact form\"" }), _jsx("li", { children: "\"Extract all links from this page\"" })] })] })] })) : (messages.map((message) => (_jsx("div", { className: `message message-${message.role}`, children: message.role === 'status' ? (_jsxs("div", { className: "status-chip", children: [_jsx("span", { className: "status-dot" }), message.content] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "message-role", children: message.role === 'user' ? 'You' : message.role === 'agent' ? 'AI' : 'System' }), _jsx("div", { className: "message-content", children: message.content })] })) }, message.id)))), isProcessing && (_jsxs("div", { className: "thinking-indicator", children: [_jsxs("div", { className: "thinking-dots", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }), _jsx("span", { className: "thinking-label", children: currentToolCall || 'Thinking...' })] })), _jsx("div", { ref: messagesEndRef })] }), _jsxs("form", { className: "input-form", onSubmit: handleSubmit, children: [_jsx("textarea", { value: input, onChange: (e) => setInput(e.target.value), onKeyDown: handleKeyDown, placeholder: !disabled
                            ? isProcessing
                                ? 'Agent is working...'
                                : 'Type a message...'
                            : 'Connecting...', disabled: disabled, className: "message-input", rows: 1 }), _jsx("button", { type: "submit", disabled: disabled || !input.trim() || isProcessing, className: "send-button", children: isProcessing ? '...' : 'Send' })] })] }));
}
