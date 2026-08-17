import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompanionChat, type CompanionEdit } from '@/hooks/useCompanionChat';
import ReactMarkdown from 'react-markdown';

const FIRST_RUN_KEY = 'companion52_first_run_v1';

const STARTER_PROMPTS = [
  'Make it more personal',
  'Add a short story here',
  'Shorten this chapter',
];

interface Props {
  bookId: string;
  chapterId: string;
  chapterTitle?: string;
  onRequestEdit?: () => void;
  variant?: 'floating' | 'badge';
  forceOpen?: boolean;
  onClose?: () => void;
  currentContent?: string;
  currentReferenceText?: string;
  onApplyEdit?: (nextContent: string, edit: CompanionEdit) => Promise<void> | void;
  onRevert?: () => void;
  prefillInput?: string;
  prefillHint?: string;
}

const CompanionBubble = ({
  bookId,
  chapterId,
  chapterTitle,
  onRequestEdit,
  variant = 'floating',
  forceOpen,
  onClose,
  currentContent,
  currentReferenceText,
  onApplyEdit,
  onRevert,
  prefillInput,
  prefillHint,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [showPrefillHint, setShowPrefillHint] = useState(Boolean(prefillInput?.trim()));
  const { messages, isLoading, send, clearMessages, applyPending, retryLast } = useCompanionChat(bookId, chapterId, {
    currentContent,
    currentReferenceText,
    reviewNote: prefillInput,
    onApplyEdit,
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [hasPulsed, setHasPulsed] = useState<Set<string>>(new Set());
  const [shouldPulse, setShouldPulse] = useState(false);

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const onDragMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      const panelW = panelRef.current?.offsetWidth ?? 380;
      const panelH = panelRef.current?.offsetHeight ?? 520;
      const newX = Math.max(8, Math.min(window.innerWidth - panelW - 8, dragState.current.origX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - panelH - 8, dragState.current.origY + dy));
      setPosition({ x: newX, y: newY });
    };

    const onUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  // Pre-fill 52's input with a review note when the chapter is opened from a
  // flagged state. We only set the text; the author must press send.
  useEffect(() => {
    if (prefillInput?.trim()) {
      setInput(prefillInput.trim());
      setShowPrefillHint(true);
    } else {
      setShowPrefillHint(false);
    }
  }, [prefillInput]);

  // First run per user: open 52 once so authors discover it, then remember.
  useEffect(() => {
    try {
      if (localStorage.getItem(FIRST_RUN_KEY)) return;
      localStorage.setItem(FIRST_RUN_KEY, '1');
      setOpen(true);
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    clearMessages();
  }, [chapterId, clearMessages]);

  useEffect(() => {
    if (!hasPulsed.has(chapterId)) {
      setShouldPulse(true);
      const timer = setTimeout(() => {
        setShouldPulse(false);
        setHasPulsed(prev => new Set(prev).add(chapterId));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [chapterId, hasPulsed]);

  const handleOpen = () => {
    if (onRequestEdit) onRequestEdit();
    setOpen(true);
  };

  const handleSend = () => {
    console.log('[CompanionBubble] handleSend called', {
      input,
      isLoading,
      bookId,
      chapterId,
      hasSend: typeof send,
    });
    if (!input.trim() || isLoading) return;
    send(input);
    setInput('');
    setShowPrefillHint(false);
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const FiftyTwoIcon = ({ size = 'lg' }: { size?: 'sm' | 'lg' }) => (
    <span
      className="font-bold select-none"
      style={{
        fontFamily: "'Merriweather', Georgia, serif",
        fontSize: size === 'lg' ? '28px' : '20px',
        color: '#C4788A',
        letterSpacing: '-0.5px',
      }}
    >
      52
    </span>
  );

  if (variant === 'badge') {
    return (
      <>
        {!open && (
          <button
            onClick={handleOpen}
            className={`cursor-pointer flex items-center justify-center rounded-full shadow-lg transition-all hover:scale-110 active:scale-95 ${shouldPulse ? 'animate-pulse' : ''}`}
            style={{
              width: '72px',
              height: '72px',
              background: '#FFFFFF',
              border: '3px solid #C4788A',
            }}
          >
            <FiftyTwoIcon size="lg" />
          </button>
        )}
        {open && renderChatPanel()}
      </>
    );
  }

  function renderChatPanel() {
    const positionStyle: React.CSSProperties = position
      ? { top: `${position.y}px`, left: `${position.x}px` }
      : { bottom: '24px', right: '24px' };

    return createPortal(
      <div
        ref={panelRef}
        className="fixed z-[9999] flex flex-col rounded-2xl shadow-2xl border border-border overflow-hidden"
        style={{
          width: '380px',
          maxWidth: 'calc(100vw - 48px)',
          height: '520px',
          maxHeight: 'calc(100vh - 120px)',
          background: 'hsl(var(--card))',
          ...positionStyle,
        }}
      >
        <div
          onMouseDown={onDragMouseDown}
          className="flex items-center justify-between px-4 py-3 border-b border-border cursor-move select-none"
          style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold" style={{ fontFamily: "'Merriweather', Georgia, serif", fontSize: '14px' }}>52</span>
            <span className="font-medium text-sm" style={{ fontFamily: 'var(--font-body)' }}>
              — {chapterTitle || 'Companion'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {onRevert && (
              <button
                onClick={onRevert}
                className="hover:opacity-80 transition-opacity p-1 flex items-center gap-1 text-xs font-medium"
                title="Revert to last saved"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Revert</span>
              </button>
            )}
            <button onClick={() => { setOpen(false); onClose?.(); }} className="hover:opacity-70 transition-opacity p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-6 space-y-3">
              <p
                className="text-sm leading-relaxed"
                style={{ fontFamily: 'var(--font-body)', color: 'hsl(var(--foreground))' }}
              >
                I'm 52 — tell me what you want and I'll write it for you.
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{ fontFamily: 'var(--font-body)', color: 'hsl(var(--muted-foreground))' }}
              >
                Keep the parts you like and change the rest. Rewrite just one section. Or start the chapter over from the points that matter to you. Add a story about a trip, work in a Bible verse, say it the way you'd say it out loud, make it shorter or warmer or more like you. Anything at all — tell me in your own words and we'll get it right together.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
                }`}
                style={{
                  fontFamily: 'var(--font-body)',
                  background: msg.role === 'user'
                    ? 'hsl(var(--primary))'
                    : 'hsl(var(--secondary))',
                  color: msg.role === 'user'
                    ? 'hsl(var(--primary-foreground))'
                    : 'hsl(var(--foreground))',
                }}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {msg.pendingEdit && (
                      <>
                        <div
                          className="mt-2 rounded-lg border p-2 text-xs whitespace-pre-wrap"
                          style={{
                            background: 'hsl(var(--card))',
                            borderColor: 'hsl(var(--border))',
                            fontFamily: 'var(--font-body)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                          }}
                        >
                          {msg.pendingEdit.nextContent}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={msg.pendingEdit.applied || isLoading}
                            onClick={() => applyPending(i)}
                          >
                            {msg.pendingEdit.applied ? 'Added' : 'Add to chapter'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => retryLast()}
                          >
                            Try again
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div
                className="rounded-2xl rounded-bl-md px-3.5 py-2.5"
                style={{ background: 'hsl(var(--secondary))' }}
              >
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t border-border px-3 py-2.5">
          {showPrefillHint && prefillHint && (
            <p
              className="mb-2 text-xs leading-relaxed"
              style={{ fontFamily: 'var(--font-body)', color: 'hsl(var(--muted-foreground))' }}
            >
              {prefillHint}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                const ta = e.target;
                ta.style.height = 'auto';
                ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="Tell me what's on your mind..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground overflow-y-auto"
              style={{
                fontFamily: 'var(--font-body)',
                maxHeight: '200px',
                color: 'hsl(var(--foreground))',
              }}
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              disabled={!input.trim() || isLoading}
              className="shrink-0 h-8 w-8"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </div>,
      document.body,
    );
  }

  return (
    <>
      {!open && (
        <button
          onClick={handleOpen}
          className={`flex items-center justify-center rounded-full shadow-lg transition-all hover:scale-110 active:scale-95 ${shouldPulse ? 'animate-pulse' : ''}`}
          style={{
            width: '72px',
            height: '72px',
            background: '#FFFFFF',
            border: '3px solid #C4788A',
          }}
        >
          <FiftyTwoIcon size="lg" />
        </button>
      )}
      {open && renderChatPanel()}
    </>
  );
};

export default CompanionBubble;
