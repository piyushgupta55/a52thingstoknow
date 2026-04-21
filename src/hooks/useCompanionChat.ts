import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type Msg = { role: 'user' | 'assistant'; content: string };

export interface CompanionEdit {
  summary: string;
  field: 'reference_text' | 'wisdom_content';
}

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

  const send = useCallback(
    async (input: string) => {
      if (!bookId || !input.trim()) return;
      const trimmedInput = input.trim();

      const userMsg: Msg = { role: 'user', content: trimmedInput };
      setMessages(prev => [...prev, userMsg]);
      setIsLoading(true);

      try {
        abortRef.current = new AbortController();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Not authenticated');
        }

        const resp = await fetch(CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
            bookId,
            chapterId,
            currentContent,
            currentReferenceText,
          }),
          signal: abortRef.current.signal,
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: 'Something went wrong' }));
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: err.error || "Something went wrong. Let's try again in a moment." },
          ]);
          return;
        }

        const data = await resp.json();

        if (data.type === 'edit') {
          const field: CompanionEdit['field'] = data.field === 'reference_text' ? 'reference_text' : 'wisdom_content';
          const summary: string = data.summary || 'Updated the chapter.';

          let nextContent: string | undefined;
          if (data.action === 'full_replace' && typeof data.content === 'string') {
            nextContent = data.content;
          } else if (data.action === 'replace' && typeof data.find === 'string' && typeof data.replace === 'string') {
            const source = field === 'reference_text' ? (currentReferenceText ?? '') : (currentContent ?? '');
            nextContent = source.replace(data.find, data.replace);
          }

          if (nextContent !== undefined && onApplyEdit) {
            await onApplyEdit(nextContent, { summary, field });
          }
          setMessages(prev => [...prev, { role: 'assistant', content: summary }]);
          return;
        }

        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.text || "Tell me a bit more — what feels off?" },
        ]);
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error('Companion chat error:', e);
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: "Something went wrong on my end. Let's try that again." },
          ]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [bookId, chapterId, messages, onApplyEdit, currentContent, currentReferenceText],
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, isLoading, send, clearMessages };
}
