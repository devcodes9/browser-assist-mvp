import { ShieldAlert } from 'lucide-react';
import type { PendingPermission } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PermissionGateProps {
  permission: PendingPermission;
  onApprove: () => void;
  onDeny: () => void;
}

export default function PermissionGate({
  permission,
  onApprove,
  onDeny,
}: PermissionGateProps) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px]"
        onClick={onDeny}
      />
      <div className="relative w-full max-w-sm animate-fade-in rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
            <ShieldAlert className="size-4" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">
              Action required
            </h3>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              The assistant wants to perform this action.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-md border border-border">
          <div className="flex items-center gap-2 bg-muted/60 px-3 py-2">
            <Badge variant="outline" className="font-mono uppercase">
              {permission.command.type}
            </Badge>
          </div>
          <div className="border-t border-border px-3 py-2.5 font-mono text-[12px] leading-relaxed text-foreground">
            {formatCommand()}
          </div>
          {permission.description && (
            <div className="border-t border-border px-3 py-2.5 text-[12px] text-muted-foreground">
              <span className="font-medium text-foreground">Reason: </span>
              {permission.description}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onDeny}>
            Deny
          </Button>
          <Button onClick={onApprove}>Approve</Button>
        </div>
      </div>
    </div>
  );
}
