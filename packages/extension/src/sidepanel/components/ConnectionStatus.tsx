interface ConnectionStatusProps {
  connected: boolean;
  onReconnect: () => void;
}

export default function ConnectionStatus({
  connected,
  onReconnect,
}: ConnectionStatusProps) {
  if (connected) {
    return (
      <div className="connection-status connected">
        <div className="status-indicator" />
        <span>Connected</span>
      </div>
    );
  }

  return (
    <div className="connection-status disconnected">
      <div className="status-indicator" />
      <span>Disconnected</span>
      <button onClick={onReconnect} className="reconnect-button">
        Reconnect
      </button>
    </div>
  );
}
