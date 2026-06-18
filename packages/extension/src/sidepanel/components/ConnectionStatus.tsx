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
    <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
      <div className="status-indicator" />
      <span>{connected ? 'Connected' : 'Disconnected'}</span>
      {activeModel && <span className="active-model" title={activeModel}>{activeModel}</span>}

      <div className="header-actions">
        {messageCount > 0 && (
          <button onClick={onClear} className="clear-button" title="Clear conversation">
            Clear
          </button>
        )}
        {!connected && (
          <button onClick={onReconnect} className="reconnect-button">
            Reconnect
          </button>
        )}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="settings-button"
            title="Settings"
            aria-label="Settings"
          >
            &#9881;
          </button>
        )}
      </div>
    </div>
  );
}
