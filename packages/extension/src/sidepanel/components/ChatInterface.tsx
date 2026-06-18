import { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowUp, User } from 'lucide-react';
import type { ChatMessage } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  disabled?: boolean;
}

const SUGGESTIONS = [
  'Summarize this page',
  'Find the pricing',
  'Extract all links',
  'Search Google for AI agents',
];

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

  const send = () => {
    const value = input.trim();
    if (!value || disabled) return;
    onSendMessage(value);
    setInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const fillSuggestion = (text: string) => {
    if (disabled) return;
    setInput(text);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-3.5 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-[21px]" />
            </div>
            <h2 className="text-[17px] font-semibold tracking-tight">
              How can I help with this page?
            </h2>
            <p className="mt-2 max-w-[17rem] text-[13px] leading-relaxed text-muted-foreground">
              Describe a task and the assistant carries it out on the tab you
              are viewing.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={disabled}
                  onClick={() => fillSuggestion(s)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5 p-3.5">
            {messages.map((message) => (
              <MessageRow key={message.id} message={message} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border p-3.5">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled ? 'Connecting...' : 'Ask Browser Assist to act on this page'
            }
            disabled={disabled}
            rows={1}
            className="max-h-24 px-3.5 pb-1 pt-3"
          />
          <div className="flex items-center px-2 pb-2 pt-1">
            <span className="px-1 text-[10.5px] text-muted-foreground">
              Enter to send
            </span>
            <Button
              type="submit"
              size="round"
              disabled={disabled || !input.trim()}
              aria-label="Send"
              className="ml-auto"
            >
              <ArrowUp />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  if (message.role === 'system') {
    return (
      <div className="px-1 py-0.5 text-center text-xs italic text-muted-foreground">
        {message.content}
      </div>
    );
  }

  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex size-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
          isUser
            ? 'border border-border bg-muted text-foreground'
            : 'bg-primary text-primary-foreground'
        )}
        aria-hidden
      >
        {isUser ? (
          <User className="size-3.5" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
      </div>
      <div
        className={cn(
          'max-w-[84%] whitespace-pre-wrap break-words text-[13.5px] leading-relaxed',
          isUser
            ? 'rounded-2xl border border-border bg-muted px-3 py-2 text-foreground'
            : 'pt-0.5 text-foreground'
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
