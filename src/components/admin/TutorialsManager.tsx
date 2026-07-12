import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { normalizeLoomUrl } from '@/lib/loom';

const SLOTS = [
  { key: 'gettingStarted', title: 'Getting Started' },
  { key: 'firstChapter', title: 'Writing Your First Chapter' },
  { key: 'memories', title: 'Adding Memories' },
] as const;

type SlotKey = typeof SLOTS[number]['key'];
type Urls = Record<SlotKey, string>;

const empty: Urls = { gettingStarted: '', firstChapter: '', memories: '' };

const TutorialsManager = () => {
  const { toast } = useToast();
  const [urls, setUrls] = useState<Urls>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'tutorial_videos')
        .maybeSingle();
      if (data?.value) setUrls({ ...empty, ...(data.value as Partial<Urls>) });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const normalized: Urls = {
      gettingStarted: normalizeLoomUrl(urls.gettingStarted),
      firstChapter: normalizeLoomUrl(urls.firstChapter),
      memories: normalizeLoomUrl(urls.memories),
    };
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key: 'tutorial_videos', value: normalized, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      setUrls(normalized);
      toast({ title: 'Tutorials updated', description: 'New videos are live on the dashboard.' });
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-serif text-xl font-bold text-foreground">Tutorial Videos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Paste the Loom share or embed URL for each video. Leave blank to show
          the "Video coming soon" placeholder. Share links (loom.com/share/…)
          are converted to embeds automatically.
        </p>
      </div>

      <div className="space-y-4 bg-card border rounded-xl p-6 shadow-sm">
        {SLOTS.map((slot) => (
          <div key={slot.key}>
            <Label htmlFor={slot.key}>{slot.title}</Label>
            <Input
              id={slot.key}
              placeholder="https://www.loom.com/share/…"
              value={urls[slot.key]}
              onChange={(e) => setUrls((u) => ({ ...u, [slot.key]: e.target.value }))}
              className="mt-1 font-mono text-xs"
            />
            {urls[slot.key] && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                Preview URL: {normalizeLoomUrl(urls[slot.key])}
              </p>
            )}
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save tutorials'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TutorialsManager;
