import { supabase } from '@/lib/supabase';

export const MEMORY_INVITE_SETTING_KEY = 'memory_invite_chapters';

/** Default memory-friendly chapters (by chapter number). */
export const DEFAULT_MEMORY_INVITE_CHAPTERS = [8, 22, 23, 24, 35, 40, 41];

const parse = (value: unknown): number[] => {
  if (Array.isArray(value)) return value.map(Number).filter(n => Number.isFinite(n));
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(Number).filter(n => Number.isFinite(n));
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_MEMORY_INVITE_CHAPTERS;
};

export async function fetchMemoryInviteChapters(): Promise<number[]> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', MEMORY_INVITE_SETTING_KEY)
    .maybeSingle();
  if (!data) return DEFAULT_MEMORY_INVITE_CHAPTERS;
  return parse(data.value);
}

export async function saveMemoryInviteChapters(chapterNumbers: number[]): Promise<string | null> {
  const value = Array.from(new Set(chapterNumbers)).sort((a, b) => a - b);
  const { error } = await supabase
    .from('app_settings')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', MEMORY_INVITE_SETTING_KEY);
  if (error) {
    const { error: insertErr } = await supabase
      .from('app_settings')
      .insert({ key: MEMORY_INVITE_SETTING_KEY, value });
    return insertErr?.message || null;
  }
  return null;
}
