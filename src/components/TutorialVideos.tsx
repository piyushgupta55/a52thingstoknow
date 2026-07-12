import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { normalizeLoomUrl } from '@/lib/loom';

type SlotKey = 'gettingStarted' | 'firstChapter' | 'memories';

const SLOTS: { key: SlotKey; title: string; description: string }[] = [
  { key: 'gettingStarted', title: 'Getting Started', description: 'A 2-minute overview of how your book works.' },
  { key: 'firstChapter', title: 'Writing Your First Chapter', description: 'How to use the editor, word count, and page 2.' },
  { key: 'memories', title: 'Adding Memories', description: 'How to capture and place memories in your chapters.' },
];

interface Props {
  heading?: string;
  subheading?: string;
}

const TutorialVideos = ({ heading = 'How It Works', subheading = 'Short tutorials to help you make the most of your book.' }: Props) => {
  const [urls, setUrls] = useState<Record<SlotKey, string>>({ gettingStarted: '', firstChapter: '', memories: '' });

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'tutorial_videos')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const v = data.value as Partial<Record<SlotKey, string>>;
          setUrls({
            gettingStarted: normalizeLoomUrl(v.gettingStarted || ''),
            firstChapter: normalizeLoomUrl(v.firstChapter || ''),
            memories: normalizeLoomUrl(v.memories || ''),
          });
        }
      });
  }, []);

  return (
    <section className="mb-10">
      <div className="mb-5">
        <h2 className="font-heading text-2xl font-bold text-foreground">{heading}</h2>
        {subheading && <p className="text-sm text-muted-foreground mt-1">{subheading}</p>}
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {SLOTS.map((v) => {
          const embedUrl = urls[v.key];
          return (
            <div key={v.title} className="bg-card rounded-xl border border-border overflow-hidden shadow-sm flex flex-col">
              <div className="relative aspect-video bg-gradient-to-br from-muted to-secondary flex items-center justify-center">
                {embedUrl ? (
                  <iframe
                    src={embedUrl}
                    title={v.title}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="h-14 w-14 rounded-full bg-background/80 border border-border flex items-center justify-center shadow-sm">
                      <Play className="h-6 w-6 text-primary ml-0.5" fill="currentColor" />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wide">Video coming soon</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-heading text-base font-bold text-foreground">{v.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{v.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default TutorialVideos;
