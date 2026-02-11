import { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '@shared/types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  disabled?: boolean;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  disabled = false,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;

    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="chat-interface">
      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>Ask the AI to help you automate browser tasks</p>
            <div className="examples">
              <p className="examples-title">Try asking:</p>
              <ul>
                <li>"Navigate to google.com and search for AI agents"</li>
                <li>"Click the first search result"</li>
                <li>"Extract the page title"</li>
              </ul>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message message-${message.role}`}>
              <div className="message-role">
                {message.role === 'user' ? 'You' : message.role === 'agent' ? 'AI' : 'System'}
              </div>
              <div className="message-content">{message.content}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={disabled ? 'Connecting...' : 'Type a message...'}
          disabled={disabled}
          className="message-input"
        />
        <button type="submit" disabled={disabled || !input.trim()} className="send-button">
          Send
        </button>
      </form>
    </div>
  );
}
