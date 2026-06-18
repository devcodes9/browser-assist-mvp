import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 bg-foreground/40 backdrop-blur-[1px]", onClick: onDeny }), _jsxs("div", { className: "relative w-full max-w-sm animate-fade-in rounded-lg border border-border bg-card p-5 shadow-xl", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground", children: _jsx(ShieldAlert, { className: "size-4" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-[15px] font-semibold tracking-tight", children: "Action required" }), _jsx("p", { className: "mt-0.5 text-[13px] text-muted-foreground", children: "The assistant wants to perform this action." })] })] }), _jsxs("div", { className: "mt-4 overflow-hidden rounded-md border border-border", children: [_jsx("div", { className: "flex items-center gap-2 bg-muted/60 px-3 py-2", children: _jsx(Badge, { variant: "outline", className: "font-mono uppercase", children: permission.command.type }) }), _jsx("div", { className: "border-t border-border px-3 py-2.5 font-mono text-[12px] leading-relaxed text-foreground", children: formatCommand() }), permission.description && (_jsxs("div", { className: "border-t border-border px-3 py-2.5 text-[12px] text-muted-foreground", children: [_jsx("span", { className: "font-medium text-foreground", children: "Reason: " }), permission.description] }))] }), _jsxs("div", { className: "mt-5 flex justify-end gap-2", children: [_jsx(Button, { variant: "secondary", onClick: onDeny, children: "Deny" }), _jsx(Button, { onClick: onApprove, children: "Approve" })] })] })] }));
}
