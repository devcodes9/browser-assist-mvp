import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowUp, Square, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
const SUGGESTIONS = [
    'Summarize this page',
    'Find the pricing',
    'Extract all links',
    'Search Google for AI agents',
];
export default function ChatInterface({ messages, onSendMessage, onStop, disabled = false, isProcessing = false, currentToolCall = null, }) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);
    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isProcessing, currentToolCall]);
    const send = () => {
        const value = input.trim();
        if (!value || disabled || isProcessing)
            return;
        onSendMessage(value);
        setInput('');
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        send();
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };
    const fillSuggestion = (text) => {
        if (disabled || isProcessing)
            return;
        setInput(text);
    };
    return (_jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsxs("div", { className: "flex-1 overflow-y-auto", children: [messages.length === 0 ? (_jsxs("div", { className: "flex h-full flex-col items-center justify-center px-6 text-center", children: [_jsx("div", { className: "mb-3.5 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground", children: _jsx(Sparkles, { className: "size-[21px]" }) }), _jsx("h2", { className: "text-[17px] font-semibold tracking-tight", children: "How can I help with this page?" }), _jsx("p", { className: "mt-2 max-w-[17rem] text-[13px] leading-relaxed text-muted-foreground", children: "Describe a task and the assistant carries it out on the tab you are viewing." }), _jsx("div", { className: "mt-6 flex flex-wrap justify-center gap-2", children: SUGGESTIONS.map((s) => (_jsx("button", { type: "button", disabled: disabled || isProcessing, onClick: () => fillSuggestion(s), className: "rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50", children: s }, s))) })] })) : (_jsxs("div", { className: "flex flex-col gap-3.5 p-3.5", children: [messages.map((message) => (_jsx(MessageRow, { message: message }, message.id))), isProcessing && _jsx(ThinkingIndicator, { label: currentToolCall })] })), _jsx("div", { ref: messagesEndRef })] }), _jsx("div", { className: "border-t border-border p-3.5", children: _jsxs("form", { onSubmit: handleSubmit, className: "rounded-2xl border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15", children: [_jsx(Textarea, { value: input, onChange: (e) => setInput(e.target.value), onKeyDown: handleKeyDown, placeholder: disabled
                                ? 'Connecting...'
                                : isProcessing
                                    ? 'Agent is working — press Stop to interrupt'
                                    : 'Ask Browser Assist to act on this page', disabled: disabled || isProcessing, rows: 1, className: "max-h-24 px-3.5 pb-1 pt-3" }), _jsxs("div", { className: "flex items-center px-2 pb-2 pt-1", children: [_jsx("span", { className: "px-1 text-[10.5px] text-muted-foreground", children: isProcessing ? 'Working…' : 'Enter to send' }), isProcessing ? (_jsx(Button, { type: "button", size: "round", variant: "destructive", onClick: onStop, disabled: !onStop, "aria-label": "Stop", title: "Stop the agent", className: "ml-auto", children: _jsx(Square, {}) })) : (_jsx(Button, { type: "submit", size: "round", disabled: disabled || !input.trim(), "aria-label": "Send", className: "ml-auto", children: _jsx(ArrowUp, {}) }))] })] }) })] }));
}
function ThinkingIndicator({ label }) {
    return (_jsxs("div", { className: "flex items-center gap-2 px-1 text-[12.5px] text-muted-foreground", children: [_jsxs("span", { className: "flex gap-1", "aria-hidden": true, children: [_jsx("span", { className: "size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" }), _jsx("span", { className: "size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" }), _jsx("span", { className: "size-1.5 animate-bounce rounded-full bg-muted-foreground/70" })] }), _jsx("span", { className: "truncate", children: label || 'Thinking…' })] }));
}
function MessageRow({ message }) {
    if (message.role === 'system') {
        return (_jsx("div", { className: "px-1 py-0.5 text-center text-xs italic text-muted-foreground", children: message.content }));
    }
    if (message.role === 'status') {
        return (_jsxs("div", { className: "flex items-center gap-2 self-start rounded-full border border-border bg-muted px-2.5 py-1 text-[11.5px] text-muted-foreground", children: [_jsx("span", { className: "size-1.5 rounded-full bg-muted-foreground/70", "aria-hidden": true }), _jsx("span", { className: "truncate", children: message.content })] }));
    }
    const isUser = message.role === 'user';
    return (_jsxs("div", { className: cn('flex gap-2.5', isUser && 'flex-row-reverse'), children: [_jsx("div", { className: cn('flex size-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', isUser
                    ? 'border border-border bg-muted text-foreground'
                    : 'bg-primary text-primary-foreground'), "aria-hidden": true, children: isUser ? (_jsx(User, { className: "size-3.5" })) : (_jsx(Sparkles, { className: "size-3.5" })) }), _jsx("div", { className: cn('max-w-[84%] whitespace-pre-wrap break-words text-[13.5px] leading-relaxed', isUser
                    ? 'rounded-2xl border border-border bg-muted px-3 py-2 text-foreground'
                    : 'pt-0.5 text-foreground'), children: message.content })] }));
}
