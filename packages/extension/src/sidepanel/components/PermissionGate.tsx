import type { PendingPermission } from '@shared/types';

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
    <div className="permission-gate">
      <div className="permission-overlay" />
      <div className="permission-modal">
        <div className="permission-header">
          <h3>Action Required</h3>
          <p>The AI wants to perform this action:</p>
        </div>

        <div className="permission-details">
          <div className="command-type">{permission.command.type.toUpperCase()}</div>
          <div className="command-description">{formatCommand()}</div>
          {permission.description && (
            <div className="permission-reason">
              <strong>Reason:</strong> {permission.description}
            </div>
          )}
        </div>

        <div className="permission-actions">
          <button onClick={onDeny} className="deny-button">
            Deny
          </button>
          <button onClick={onApprove} className="approve-button">
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
