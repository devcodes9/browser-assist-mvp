import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
export default function ChatInterface({ messages, onSendMessage, disabled = false, }) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);
    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim() || disabled)
            return;
        onSendMessage(input.trim());
        setInput('');
    };
    return (_jsxs("div", { className: "chat-interface", children: [_jsxs("div", { className: "messages", children: [messages.length === 0 ? (_jsxs("div", { className: "empty-state", children: [_jsx("p", { children: "Ask the AI to help you automate browser tasks" }), _jsxs("div", { className: "examples", children: [_jsx("p", { className: "examples-title", children: "Try asking:" }), _jsxs("ul", { children: [_jsx("li", { children: "\"Navigate to google.com and search for AI agents\"" }), _jsx("li", { children: "\"Click the first search result\"" }), _jsx("li", { children: "\"Extract the page title\"" })] })] })] })) : (messages.map((message) => (_jsxs("div", { className: `message message-${message.role}`, children: [_jsx("div", { className: "message-role", children: message.role === 'user' ? 'You' : message.role === 'agent' ? 'AI' : 'System' }), _jsx("div", { className: "message-content", children: message.content })] }, message.id)))), _jsx("div", { ref: messagesEndRef })] }), _jsxs("form", { className: "input-form", onSubmit: handleSubmit, children: [_jsx("input", { type: "text", value: input, onChange: (e) => setInput(e.target.value), placeholder: disabled ? 'Connecting...' : 'Type a message...', disabled: disabled, className: "message-input" }), _jsx("button", { type: "submit", disabled: disabled || !input.trim(), className: "send-button", children: "Send" })] })] }));
}
