import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
export default function ConnectionStatus({ connected, onReconnect, }) {
    return (_jsxs("header", { className: "flex items-center gap-2.5 border-b border-border px-3.5 py-2.5", children: [_jsx("div", { className: "flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground", children: _jsx(Sparkles, { className: "size-4" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("h1", { className: "text-[13.5px] font-semibold leading-tight tracking-tight", children: "Browser Assist" }), _jsxs("div", { className: "mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground", children: [_jsx("span", { className: cn('size-1.5 rounded-full', connected ? 'bg-success' : 'bg-destructive'), "aria-hidden": true }), connected ? 'Connected' : 'Disconnected'] })] }), !connected && (_jsxs(Button, { variant: "outline", size: "sm", onClick: onReconnect, className: "ml-auto", children: [_jsx(RefreshCw, {}), "Reconnect"] }))] }));
}
