import { Sparkles, RefreshCw, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  connected: boolean;
  onReconnect: () => void;
  onClear: () => void;
  onOpenSettings?: () => void;
  activeModel?: string | null;
  messageCount: number;
}

export default function ConnectionStatus({
  connected,
  onReconnect,
  onClear,
  onOpenSettings,
  activeModel,
  messageCount,
}: ConnectionStatusProps) {
  return (
    <header className="flex items-center gap-2.5 border-b border-border px-3.5 py-2.5">
      <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Sparkles className="size-4" />
      </div>

      <div className="min-w-0">
        <h1 className="text-[13.5px] font-semibold leading-tight tracking-tight">
          Browser Assist
        </h1>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              connected ? 'bg-success' : 'bg-destructive'
            )}
            aria-hidden
          />
          {connected ? 'Connected' : 'Disconnected'}
          {activeModel && (
            <span className="truncate" title={activeModel}>
              · {activeModel}
            </span>
          )}
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {messageCount > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <Trash2 />
          </Button>
        )}
        {!connected && (
          <Button variant="outline" size="sm" onClick={onReconnect}>
            <RefreshCw />
            Reconnect
          </Button>
        )}
        {onOpenSettings && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenSettings}
            title="Settings"
            aria-label="Settings"
          >
            <Settings />
          </Button>
        )}
      </div>
    </header>
  );
}
