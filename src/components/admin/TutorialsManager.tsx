import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { normalizeLoomUrl } from '@/lib/loom';
import { Plus, Trash2 } from 'lucide-react';

export interface TutorialVideo {
  title: string;
  url: string;
}

// Legacy format: { gettingStarted: url, firstChapter: url, memories: url }
const LEGACY_TITLES: Record<string, string> = {
  gettingStarted: 'Getting Started',
  firstChapter: 'Writing Your First Chapter',
  memories: 'Adding Memories',
};

export const parseTutorialVideos = (value: unknown): TutorialVideo[] => {
  if (Array.isArray(value)) {
    return (value as TutorialVideo[]).map((v) => ({
      title: v?.title || '',
      url: normalizeLoomUrl(v?.url || ''),
    }));
  }
  if (value && typeof value === 'object') {
    return Object.entries(LEGACY_TITLES)
      .filter(([key]) => (value as Record<string, string>)[key])
      .map(([key, title]) => ({
        title,
        url: normalizeLoomUrl((value as Record<string, string>)[key]),
      }));
  }
  return [];
};

const TutorialsManager = () => {
  const { toast } = useToast();
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'tutorial_videos')
        .maybeSingle();
      if (data?.value) setVideos(parseTutorialVideos(data.value));
      setLoading(false);
    })();
  }, []);

  const update = (index: number, patch: Partial<TutorialVideo>) => {
    setVideos((list) => list.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  };

  const addVideo = () => setVideos((list) => [...list, { title: '', url: '' }]);

  const removeVideo = (index: number) => setVideos((list) => list.filter((_, i) => i !== index));

  const save = async () => {
    setSaving(true);
    const cleaned = videos
      .map((v) => ({ title: v.title.trim(), url: normalizeLoomUrl(v.url.trim()) }))
      .filter((v) => v.title || v.url);
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key: 'tutorial_videos', value: cleaned, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      setVideos(cleaned);
      toast({ title: 'Tutorials updated', description: 'New videos are live on the dashboard.' });
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-serif text-xl font-bold text-foreground">Tutorial Videos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add a video for each tutorial you have. Paste the share or embed URL
          (share links like loom.com/share/… are converted to embeds automatically).
          Videos with no URL show a "Video coming soon" placeholder; videos with
          neither a title nor a URL are dropped on save.
        </p>
      </div>

      <div className="space-y-4">
        {videos.length === 0 && (
          <div className="bg-card border rounded-xl p-6 text-center text-sm text-muted-foreground">
            No tutorials yet — add your first video below.
          </div>
        )}
        {videos.map((video, i) => (
          <div key={i} className="bg-card border rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Video {i + 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeVideo(i)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" /> Remove
              </Button>
            </div>
            <div>
              <Label htmlFor={`title-${i}`}>Title</Label>
              <Input
                id={`title-${i}`}
                placeholder="e.g. Getting Started"
                value={video.title}
                onChange={(e) => update(i, { title: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`url-${i}`}>Video URL</Label>
              <Input
                id={`url-${i}`}
                placeholder="https://www.loom.com/share/…"
                value={video.url}
                onChange={(e) => update(i, { url: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
              {video.url && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  Preview URL: {normalizeLoomUrl(video.url)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={addVideo}>
          <Plus className="h-4 w-4 mr-1" /> Add video
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save tutorials'}
        </Button>
      </div>
    </div>
  );
};

export default TutorialsManager;
