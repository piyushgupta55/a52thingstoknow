import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChapterTemplate {
  id: string;
  chapter_number: number;
  gender: string;
  title: string;
  is_photo_chapter: boolean;
}

const PhotoChapterManager = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ChapterTemplate[]>([]);
  const [viewGender, setViewGender] = useState<'female' | 'male'>('female');
  const [cap, setCap] = useState(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data: tpls }, { data: settings }] = await Promise.all([
        supabase.from('chapter_templates').select('id, chapter_number, gender, title, is_photo_chapter').order('chapter_number'),
        supabase.from('app_settings').select('*').eq('key', 'photo_chapter_cap').single(),
      ]);
      setTemplates(tpls || []);
      if (settings) setCap(Number(settings.value) || 15);
      setLoading(false);
    };
    load();
  }, []);

  const visibleTemplates = templates.filter(t => t.gender === viewGender);
  const photoCount = visibleTemplates.filter(t => t.is_photo_chapter).length;

  // Toggle photo chapter for BOTH genders of this chapter_number so designation stays in sync
  const togglePhotoChapter = async (chapterNumber: number, current: boolean) => {
    if (!current && photoCount >= cap) {
      toast({ title: 'Cap reached', description: `Maximum ${cap} photo chapters allowed.`, variant: 'destructive' });
      return;
    }
    const { error } = await supabase
      .from('chapter_templates')
      .update({ is_photo_chapter: !current })
      .eq('chapter_number', chapterNumber);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setTemplates(prev => prev.map(t => t.chapter_number === chapterNumber ? { ...t, is_photo_chapter: !current } : t));
    }
  };

  const saveCap = async () => {
    setSaving(true);
    const { error } = await supabase.from('app_settings').update({ value: cap, updated_at: new Date().toISOString() }).eq('key', 'photo_chapter_cap');
    if (error) {
      const { error: insertErr } = await supabase.from('app_settings').insert({ key: 'photo_chapter_cap', value: cap });
      if (insertErr) toast({ title: 'Error', description: insertErr.message, variant: 'destructive' });
      else toast({ title: 'Cap saved' });
    } else {
      toast({ title: 'Cap saved' });
    }
    setSaving(false);
  };

  if (loading) return <div className="text-muted-foreground text-sm py-4">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-serif text-foreground">Photo Chapter Settings</h2>
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

      {/* Cap setting */}
      <div className="flex items-center gap-3 mb-6 p-4 rounded-lg border bg-card">
        <label className="text-sm font-medium text-foreground whitespace-nowrap">Max photo chapters per book:</label>
        <Input
          type="number"
          min={1}
          max={52}
          value={cap}
          onChange={e => setCap(Number(e.target.value))}
          className="w-20"
        />
        <Button size="sm" onClick={saveCap} disabled={saving} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
        <span className="text-sm text-muted-foreground ml-2">{photoCount} of {cap} designated</span>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Toggling a chapter applies the photo designation to both the male and female versions of that chapter number.
      </p>

      {/* Chapter list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {visibleTemplates.map(t => (
          <button
            key={t.id}
            onClick={() => togglePhotoChapter(t.chapter_number, t.is_photo_chapter)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md border text-left text-sm transition-all ${
              t.is_photo_chapter
                ? 'border-primary/40 bg-primary/5'
                : 'border-border hover:border-primary/20'
            }`}
          >
            <Camera className={`h-4 w-4 flex-shrink-0 ${t.is_photo_chapter ? 'text-primary fill-primary/20' : 'text-muted-foreground/30'}`} />
            <span className="text-muted-foreground/50 w-5 text-right flex-shrink-0">{t.chapter_number}</span>
            <span className={`truncate ${t.is_photo_chapter ? 'text-foreground font-medium' : 'text-foreground/60'}`}>{t.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PhotoChapterManager;
