import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function ConnectionStatus({ connected, onReconnect, }) {
    if (connected) {
        return (_jsxs("div", { className: "connection-status connected", children: [_jsx("div", { className: "status-indicator" }), _jsx("span", { children: "Connected" })] }));
    }
    return (_jsxs("div", { className: "connection-status disconnected", children: [_jsx("div", { className: "status-indicator" }), _jsx("span", { children: "Disconnected" }), _jsx("button", { onClick: onReconnect, className: "reconnect-button", children: "Reconnect" })] }));
}
