import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { MessageCircleHeart, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchMemoryInviteChapters, saveMemoryInviteChapters } from '@/lib/memoryChapters';

interface ChapterTemplate {
  id: string;
  chapter_number: number;
  gender: string;
  title: string;
}

const MemoryChapterManager = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ChapterTemplate[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [viewGender, setViewGender] = useState<'female' | 'male'>('female');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data: tpls }, chapterNumbers] = await Promise.all([
        supabase.from('chapter_templates').select('id, chapter_number, gender, title').order('chapter_number'),
        fetchMemoryInviteChapters(),
      ]);
      setTemplates((tpls || []) as ChapterTemplate[]);
      setSelected(chapterNumbers);
      setLoading(false);
    };
    load();
  }, []);

  const visible = templates.filter(t => t.gender === viewGender);

  const toggle = (chapterNumber: number) => {
    setSelected(prev =>
      prev.includes(chapterNumber) ? prev.filter(n => n !== chapterNumber) : [...prev, chapterNumber].sort((a, b) => a - b),
    );
  };

  const save = async () => {
    setSaving(true);
    const error = await saveMemoryInviteChapters(selected);
    if (error) toast({ title: 'Error', description: error, variant: 'destructive' });
    else toast({ title: 'Memory chapters saved' });
    setSaving(false);
  };

  if (loading) return <div className="text-muted-foreground text-sm py-4">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-serif text-foreground">Memory Invitation Chapters</h2>
        <div className="flex rounded-md border border-border overflow-hidden">
          {(['female', 'male'] as const).map(g => (
            <button
              key={g}
              onClick={() => setViewGender(g)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                viewGender === g ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {g} book
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 p-4 rounded-lg border bg-card">
        <span className="text-sm text-muted-foreground flex-1">
          These chapters show a soft “this would be a beautiful place for a memory” invitation in the book overview.
          Selection applies to every book version. {selected.length} selected.
        </span>
        <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {visible.map(t => {
          const on = selected.includes(t.chapter_number);
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.chapter_number)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md border text-left text-sm transition-all ${
                on ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20'
              }`}
            >
              <MessageCircleHeart className={`h-4 w-4 flex-shrink-0 ${on ? 'text-primary' : 'text-muted-foreground/30'}`} />
              <span className="text-muted-foreground/50 w-5 text-right flex-shrink-0">{t.chapter_number}</span>
              <span className={`truncate ${on ? 'text-foreground font-medium' : 'text-foreground/60'}`}>{t.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MemoryChapterManager;
