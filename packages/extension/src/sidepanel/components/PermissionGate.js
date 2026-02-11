import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function PermissionGate({ permission, onApprove, onDeny, }) {
    const formatCommand = () => {
        const { command } = permission;
        switch (command.type) {
            case 'navigate':
                return `Navigate to: ${command.url}`;
            case 'click':
                return `Click element: ${command.selector}`;
            case 'type':
                return `Type "${command.text}" into: ${command.selector}`;
            case 'extract':
                return `Extract content from: ${command.selector}`;
            case 'snapshot':
                return 'Take page snapshot';
            default:
                return 'Unknown command';
        }
    };
    return (_jsxs("div", { className: "permission-gate", children: [_jsx("div", { className: "permission-overlay" }), _jsxs("div", { className: "permission-modal", children: [_jsxs("div", { className: "permission-header", children: [_jsx("h3", { children: "Action Required" }), _jsx("p", { children: "The AI wants to perform this action:" })] }), _jsxs("div", { className: "permission-details", children: [_jsx("div", { className: "command-type", children: permission.command.type.toUpperCase() }), _jsx("div", { className: "command-description", children: formatCommand() }), permission.description && (_jsxs("div", { className: "permission-reason", children: [_jsx("strong", { children: "Reason:" }), " ", permission.description] }))] }), _jsxs("div", { className: "permission-actions", children: [_jsx("button", { onClick: onDeny, className: "deny-button", children: "Deny" }), _jsx("button", { onClick: onApprove, className: "approve-button", children: "Approve" })] })] })] }));
}
