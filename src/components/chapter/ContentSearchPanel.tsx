import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface LibraryItem {
  id: string;
  text: string;
  attribution: string;
  translation?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  type: 'verse' | 'quote';
  defaultTopic: string;
  onSelect: (item: LibraryItem) => void;
  excludeText?: string;
  bookId?: string;
}

const ContentSearchPanel = ({ open, onClose, type, defaultTopic, onSelect, excludeText, bookId }: Props) => {
  const [searchTerm, setSearchTerm] = useState(defaultTopic);
  const [results, setResults] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'verse' | 'quote'>(type);
  const panelRef = useRef<HTMLDivElement>(null);

  // Manual entry state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualSource, setManualSource] = useState('');
  const [manualTranslation, setManualTranslation] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  useEffect(() => {
    if (open) {
      setSearchTerm(defaultTopic);
      setActiveFilter(type);
      setShowManualEntry(false);
      setManualText('');
      setManualSource('');
      setManualTranslation('');
    }
  }, [open, defaultTopic, type]);

  useEffect(() => {
    if (!open) return;
    const search = async () => {
      setLoading(true);
      const tag = searchTerm.trim();
      
      let query = supabase
        .from('content_pool')
        .select('id, text, source, translation, type')
        .eq('type', activeFilter)
        .eq('status', 'approved');

      if (tag) {
        query = query.contains('topic_tags', [tag]);
      }

      const { data } = await query.order('created_at', { ascending: true });

      const items: LibraryItem[] = (data || [])
        .filter((row: any) => !excludeText || row.text !== excludeText)
        .map((row: any) => ({
          id: row.id,
          text: row.text,
          attribution: row.source || '',
          translation: row.translation,
        }));

      setResults(items);
      setLoading(false);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [open, searchTerm, activeFilter, excludeText]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const handleManualSave = async () => {
    if (!manualText.trim()) return;
    setSavingManual(true);

    const { data, error } = await supabase.from('content_pool').insert({
      type: activeFilter,
      text: manualText.trim(),
      source: manualSource.trim() || null,
      translation: activeFilter === 'verse' ? (manualTranslation.trim() || null) : null,
      topic_tags: [defaultTopic],
      status: 'approved',
      origin: 'author_written',
    }).select('id, text, source, translation').single();

    setSavingManual(false);

    if (!error && data) {
      onSelect({
        id: data.id,
        text: data.text,
        attribution: data.source || '',
        translation: data.translation,
      });
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop — click to dismiss; pointer-events-none ensures it never traps clicks
          intended for higher-stacking-context elements like the floating chat panel. */}
      <div
        className="fixed inset-0 z-40 bg-black/20 pointer-events-auto"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 z-50 h-full w-[40%] min-w-[320px] max-w-[480px] bg-background border-l border-[hsl(var(--devotional-border))] shadow-xl flex flex-col"
        style={{
          animation: 'slideInRight 0.25s ease-out',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--devotional-border))]">
          <h2 className="text-sm font-semibold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>
            {activeFilter === 'verse' ? 'Swap Verse' : 'Find Another Quote'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by topic..."
              className="pl-9 text-sm h-9 bg-muted/30 border-border/50"
            />
          </div>
        </div>

        {/* Filter toggles */}
        <div className="px-5 pb-3 flex gap-2">
          <button
            onClick={() => setActiveFilter('verse')}
            className={`px-3 py-1.5 rounded-sm text-[0.65rem] uppercase tracking-wider transition-colors ${
              activeFilter === 'verse'
                ? 'bg-[#C9A84C]/15 text-[#C9A84C] font-semibold border border-[#C9A84C]/30'
                : 'text-muted-foreground/50 hover:text-muted-foreground border border-transparent'
            }`}
          >
            Verses
          </button>
          <button
            onClick={() => setActiveFilter('quote')}
            className={`px-3 py-1.5 rounded-sm text-[0.65rem] uppercase tracking-wider transition-colors ${
              activeFilter === 'quote'
                ? 'bg-primary/10 text-primary font-semibold border border-primary/30'
                : 'text-muted-foreground/50 hover:text-muted-foreground border border-transparent'
            }`}
          >
            Quotes
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <p className="text-sm text-muted-foreground/50 text-center py-8">Searching…</p>
          ) : results.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground/50">No {activeFilter === 'verse' ? 'verses' : 'quotes'} found.</p>
              <p className="text-xs text-muted-foreground/30 mt-1">Try a different topic keyword.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map(item => (
                <div
                  key={item.id}
                  className="border border-[hsl(var(--devotional-border))] rounded-sm p-4 hover:border-[#C9A84C]/40 transition-colors"
                >
                  <p
                    className="text-[0.85rem] italic leading-relaxed text-foreground/75"
                    style={{ fontFamily: 'var(--font-devotional)' }}
                  >
                    "{item.text}"
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground/50">
                        — {item.attribution}
                      </p>
                      {item.translation && (
                        <span className="text-[0.55rem] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground/40">
                          {item.translation}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onSelect(item)}
                      className="text-xs h-7 text-primary hover:text-primary hover:bg-primary/10"
                    >
                      Use this
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Manual Entry Section */}
          <div className="mt-6 border-t border-border/30 pt-5">
            {!showManualEntry ? (
              <button
                onClick={() => setShowManualEntry(true)}
                className="flex items-center gap-2 w-full justify-center py-3 px-4 rounded-sm border border-[#C9A84C]/40 bg-[#C9A84C]/10 text-[#C9A84C] hover:bg-[#C9A84C]/20 hover:border-[#C9A84C]/60 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span className="uppercase tracking-wider text-[0.7rem] font-semibold">
                  {activeFilter === 'verse' ? 'Enter your own verse' : 'Enter your own quote'}
                </span>
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground/50 font-semibold">
                  {activeFilter === 'verse' ? 'Add your own verse' : 'Add your own quote'}
                </p>
                <Textarea
                  placeholder={activeFilter === 'verse' ? 'Enter the verse text…' : 'Enter the quote…'}
                  value={manualText}
                  onChange={e => setManualText(e.target.value)}
                  rows={3}
                  className="text-sm resize-none bg-muted/20 border-border/40"
                  style={{ fontFamily: 'var(--font-devotional)' }}
                  autoFocus
                />
                <Input
                  placeholder={activeFilter === 'verse' ? 'Bible reference (e.g. Proverbs 3:5)' : 'Attributed to (e.g. "Maya Angelou")'}
                  value={manualSource}
                  onChange={e => setManualSource(e.target.value)}
                  className="text-sm h-9 bg-muted/20 border-border/40"
                />
                {activeFilter === 'verse' && (
                  <Input
                    placeholder="Translation (e.g. NIV, NLT, ESV)"
                    value={manualTranslation}
                    onChange={e => setManualTranslation(e.target.value)}
                    className="text-sm h-9 bg-muted/20 border-border/40"
                  />
                )}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleManualSave}
                    disabled={!manualText.trim() || savingManual}
                    className="text-xs h-8 gap-1.5"
                  >
                    <Plus className="h-3 w-3" />
                    {savingManual ? 'Saving…' : 'Add & Use This'}
                  </Button>
                  <button
                    onClick={() => setShowManualEntry(false)}
                    className="text-[0.65rem] uppercase tracking-wider text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ContentSearchPanel;
