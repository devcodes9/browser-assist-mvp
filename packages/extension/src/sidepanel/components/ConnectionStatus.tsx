interface ConnectionStatusProps {
  connected: boolean;
  onReconnect: () => void;
  onClear: () => void;
  messageCount: number;
}

export default function ConnectionStatus({
  connected,
  onReconnect,
  onClear,
  messageCount,
}: ConnectionStatusProps) {
  return (
    <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
      <div className="status-indicator" />
      <span>{connected ? 'Connected' : 'Disconnected'}</span>

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
      </div>
    </div>
  );
}
