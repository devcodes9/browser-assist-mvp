import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  connected: boolean;
  onReconnect: () => void;
}

export default function ConnectionStatus({
  connected,
  onReconnect,
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
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className={cn(
              'size-1.5 rounded-full',
              connected ? 'bg-success' : 'bg-destructive'
            )}
            aria-hidden
          />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {!connected && (
        <Button
          variant="outline"
          size="sm"
          onClick={onReconnect}
          className="ml-auto"
        >
          <RefreshCw />
          Reconnect
        </Button>
      )}
    </header>
  );
}
