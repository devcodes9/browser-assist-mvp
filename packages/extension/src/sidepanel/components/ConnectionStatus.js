import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function ConnectionStatus({ connected, onReconnect, onClear, messageCount, }) {
    return (_jsxs("div", { className: `connection-status ${connected ? 'connected' : 'disconnected'}`, children: [_jsx("div", { className: "status-indicator" }), _jsx("span", { children: connected ? 'Connected' : 'Disconnected' }), _jsxs("div", { className: "header-actions", children: [messageCount > 0 && (_jsx("button", { onClick: onClear, className: "clear-button", title: "Clear conversation", children: "Clear" })), !connected && (_jsx("button", { onClick: onReconnect, className: "reconnect-button", children: "Reconnect" }))] })] }));
}
