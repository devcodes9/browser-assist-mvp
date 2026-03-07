import { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '@shared/types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  isProcessing?: boolean;
  currentToolCall?: string | null;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  disabled = false,
  isProcessing = false,
  currentToolCall = null,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing, currentToolCall]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled || isProcessing) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-interface">
      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">&#9672;</div>
            <p>Browser Assist AI</p>
            <div className="examples">
              <p className="examples-title">Try asking:</p>
              <ul>
                <li>"Go to google.com and search for AI agents"</li>
                <li>"Find the pricing section on this page"</li>
                <li>"Fill out the contact form"</li>
                <li>"Extract all links from this page"</li>
              </ul>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message message-${message.role}`}>
              {message.role === 'status' ? (
                <div className="status-chip">
                  <span className="status-dot" />
                  {message.content}
                </div>
              ) : (
                <>
                  <div className="message-role">
                    {message.role === 'user' ? 'You' : message.role === 'agent' ? 'AI' : 'System'}
                  </div>
                  <div className="message-content">{message.content}</div>
                </>
              )}
            </div>
          ))
        )}

        {isProcessing && (
          <div className="thinking-indicator">
            <div className="thinking-dots">
              <span />
              <span />
              <span />
            </div>
            <span className="thinking-label">
              {currentToolCall || 'Thinking...'}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="input-form" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            !disabled
              ? isProcessing
                ? 'Agent is working...'
                : 'Type a message...'
              : 'Connecting...'
          }
          disabled={disabled}
          className="message-input"
          rows={1}
        />
        <button
          type="submit"
          disabled={disabled || !input.trim() || isProcessing}
          className="send-button"
        >
          {isProcessing ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
