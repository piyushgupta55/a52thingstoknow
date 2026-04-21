import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ContentEntry {
  id: string;
  type: 'verse' | 'quote' | 'memory';
  text: string;
  source: string | null;
  translation: string | null;
  topic_tags: string[];
}

interface EditContentDialogProps {
  entry: ContentEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: { text: string; source: string | null; translation: string | null; topic_tags: string[] }) => Promise<void>;
}

const EditContentDialog = ({ entry, open, onOpenChange, onSave }: EditContentDialogProps) => {
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [translation, setTranslation] = useState('');
  const [topicTags, setTopicTags] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setText(entry.text);
      setSource(entry.source || '');
      setTranslation(entry.translation || '');
      setTopicTags(entry.topic_tags.join(', '));
    }
  }, [entry]);

  const handleSave = async () => {
    if (!entry) return;
    setSaving(true);
    const tags = topicTags.split(',').map(t => t.trim()).filter(Boolean);
    await onSave(entry.id, {
      text,
      source: source || null,
      translation: translation || null,
      topic_tags: tags,
    });
    setSaving(false);
    onOpenChange(false);
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Text</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="mt-1" />
          </div>
          <div>
            <Label>Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} className="mt-1" placeholder="Bible reference or attribution" />
          </div>
          {entry.type === 'verse' && (
            <div>
              <Label>Translation</Label>
              <Input value={translation} onChange={(e) => setTranslation(e.target.value)} className="mt-1" placeholder="e.g. NIV, NLT, NKJV" />
            </div>
          )}
          <div>
            <Label>Topic Tags (comma-separated)</Label>
            <Input value={topicTags} onChange={(e) => setTopicTags(e.target.value)} className="mt-1" placeholder="Forgiveness, Love" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !text.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditContentDialog;
