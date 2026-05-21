import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface CompanionEdit {
  summary: string;
  field: 'reference_text' | 'wisdom_content';
}

export interface PendingEdit extends CompanionEdit {
  nextContent: string;
  applied?: boolean;
}

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  pendingEdit?: PendingEdit;
};

interface UseCompanionChatOptions {
  currentContent?: string;
  currentReferenceText?: string;
  onApplyEdit?: (nextContent: string, edit: CompanionEdit) => Promise<void> | void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/companion-chat`;

export function useCompanionChat(
  bookId: string | undefined,
  chapterId: string | undefined,
  options: UseCompanionChatOptions = {},
) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { onApplyEdit, currentContent, currentReferenceText } = options;

  const currentContentRef = useRef(currentContent);
  const currentReferenceTextRef = useRef(currentReferenceText);
  const onApplyEditRef = useRef(onApplyEdit);
  currentContentRef.current = currentContent;
  currentReferenceTextRef.current = currentReferenceText;
  onApplyEditRef.current = onApplyEdit;

  const sendInternal = useCallback(
    async (trimmedInput: string, baseMessages: Msg[]) => {
      if (!bookId) return;
      const liveContent = currentContentRef.current ?? '';
      const liveReferenceText = currentReferenceTextRef.current ?? '';
      setIsLoading(true);

      try {
        abortRef.current = new AbortController();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Not authenticated');

        const resp = await fetch(CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: baseMessages.map(m => ({ role: m.role, content: m.content })),
            bookId,
            chapterId,
            currentContent: liveContent,
            currentReferenceText: liveReferenceText,
          }),
          signal: abortRef.current.signal,
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: 'Something went wrong' }));
          setMessages(prev => [...prev, { role: 'assistant', content: err.error || "Something went wrong. Let's try again in a moment." }]);
          return;
        }

        const data = await resp.json();

        if (data.type === 'edit') {
          const field: CompanionEdit['field'] = data.field === 'reference_text' ? 'reference_text' : 'wisdom_content';
          const summary: string = data.summary || 'Here is a suggested revision.';

          let nextContent: string | undefined;
          if (data.action === 'full_replace' && typeof data.content === 'string') {
            nextContent = data.content;
          } else if (data.action === 'replace' && typeof data.find === 'string' && typeof data.replace === 'string') {
            const source = field === 'reference_text' ? liveReferenceText : liveContent;
            nextContent = source.replace(data.find, data.replace);
          }

          if (nextContent !== undefined) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: summary,
              pendingEdit: { summary, field, nextContent: nextContent! },
            }]);
            return;
          }
        }

        setMessages(prev => [...prev, { role: 'assistant', content: data.text || "Tell me a bit more — what feels off?" }]);
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error('Companion chat error:', e);
          setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong on my end. Let's try that again." }]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [bookId, chapterId],
  );

  const send = useCallback(
    async (input: string) => {
      if (!input.trim()) return;
      const trimmedInput = input.trim();
      const userMsg: Msg = { role: 'user', content: trimmedInput };
      let baseMessages: Msg[] = [];
      setMessages(prev => {
        baseMessages = [...prev, userMsg];
        return baseMessages;
      });
      // small defer so state above is committed before send
      await Promise.resolve();
      await sendInternal(trimmedInput, baseMessages);
    },
    [sendInternal],
  );

  const retryLast = useCallback(async () => {
    let baseMessages: Msg[] = [];
    let lastUser: string | undefined;
    setMessages(prev => {
      // Drop trailing assistant messages back to last user message
      const idx = [...prev].reverse().findIndex(m => m.role === 'user');
      if (idx === -1) { baseMessages = prev; return prev; }
      const cutAt = prev.length - idx; // keep through last user
      const trimmed = prev.slice(0, cutAt);
      lastUser = trimmed[trimmed.length - 1]?.content;
      baseMessages = trimmed;
      return trimmed;
    });
    await Promise.resolve();
    if (lastUser) {
      const retryPrompt = `${lastUser}\n\n[Retry instruction: The author was not satisfied with the previous suggestion. Please try a completely different approach — do not repeat or lightly tweak the prior suggestion. Use a different angle, structure, or wording.]`;
      const retryMessages = baseMessages.slice(0, -1).concat({ role: 'user', content: retryPrompt });
      await sendInternal(retryPrompt, retryMessages);
    }
  }, [sendInternal]);

  const applyPending = useCallback(async (index: number) => {
    const msg = messages[index];
    if (!msg?.pendingEdit || msg.pendingEdit.applied) return;
    const edit = msg.pendingEdit;
    if (onApplyEditRef.current) {
      await onApplyEditRef.current(edit.nextContent, { summary: edit.summary, field: edit.field });
    }
    setMessages(prev => prev.map((m, i) => i === index && m.pendingEdit
      ? { ...m, pendingEdit: { ...m.pendingEdit, applied: true } }
      : m));
  }, [messages]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, isLoading, send, clearMessages, applyPending, retryLast };
}
