import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { fetchPreviewSets, invalidatePreviewSetsCache, normalizeTitle, type PreviewSets } from "@/lib/previewSets";
import { Save } from "lucide-react";

interface TemplateRow {
  id: string;
  chapter_number: number;
  title: string;
  gender: string;
  is_photo_chapter: boolean;
}

type Field = keyof PreviewSets;

const FIELD_LABELS: Record<Field, string> = {
  website_samples: "Website sample",
  trial_readable: "Trial — readable",
  trial_editable: "Trial — editable",
};

const FIELD_HELP: Record<Field, string> = {
  website_samples: "Publicly readable on marketing site — no signup required.",
  trial_readable: "Unlocked to read for signed-up trial users (one per topic group is a good default).",
  trial_editable: "Fully editable during trial — front-load the 'this is easy' moment.",
};

const emptySets: PreviewSets = { website_samples: [], trial_readable: [], trial_editable: [] };

export default function PreviewSetsManager() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [sets, setSets] = useState<PreviewSets>(emptySets);
  const [initial, setInitial] = useState<PreviewSets>(emptySets);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: tpls }, s] = await Promise.all([
        supabase
          .from("chapter_templates")
          .select("id, chapter_number, title, gender, is_photo_chapter")
          .order("chapter_number"),
        fetchPreviewSets(true),
      ]);
      // Deduplicate templates by title (across gender variants) so the admin
      // toggles a single row per chapter.
      const seen = new Map<string, TemplateRow>();
      for (const t of (tpls || []) as TemplateRow[]) {
        const key = normalizeTitle(t.title);
        if (!seen.has(key) || t.gender === "female") seen.set(key, t);
      }
      setTemplates(Array.from(seen.values()).sort((a, b) => a.chapter_number - b.chapter_number));
      setSets(s);
      setInitial(s);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeTitle(filter);
    if (!q) return templates;
    return templates.filter((t) => normalizeTitle(t.title).includes(q));
  }, [templates, filter]);

  const isChecked = (field: Field, title: string): boolean => {
    const n = normalizeTitle(title);
    return sets[field].some((t) => normalizeTitle(t) === n);
  };

  const toggle = (field: Field, title: string) => {
    const n = normalizeTitle(title);
    setSets((prev) => {
      const existing = prev[field];
      const has = existing.some((t) => normalizeTitle(t) === n);
      return {
        ...prev,
        [field]: has ? existing.filter((t) => normalizeTitle(t) !== n) : [...existing, title],
      };
    });
  };

  const dirty = JSON.stringify(sets) !== JSON.stringify(initial);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "preview_sets", value: sets as any }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    invalidatePreviewSetsCache();
    setInitial(sets);
    toast({ title: "Preview sets saved", description: "Changes take effect immediately." });
  };

  const counts: Record<Field, number> = {
    website_samples: sets.website_samples.length,
    trial_readable: sets.trial_readable.length,
    trial_editable: sets.trial_editable.length,
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Preview sets</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Control which chapters are shown before purchase. Website samples are public (no login). Trial sets apply to signed-up users who
          haven't paid yet. Changes take effect immediately for new page loads.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.keys(FIELD_LABELS) as Field[]).map((f) => (
          <div key={f} className="rounded-lg border bg-card p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{FIELD_LABELS[f]}</div>
            <div className="text-2xl font-semibold">{counts[f]}</div>
            <div className="text-xs text-muted-foreground mt-1">{FIELD_HELP[f]}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Input
          placeholder="Filter chapters…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={save} disabled={!dirty || saving} className="gap-1.5">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-2 w-12">#</th>
              <th className="p-2">Chapter</th>
              <th className="p-2 w-24 text-center">Photo?</th>
              {(Object.keys(FIELD_LABELS) as Field[]).map((f) => (
                <th key={f} className="p-2 w-32 text-center">{FIELD_LABELS[f]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t hover:bg-muted/20">
                <td className="p-2 text-muted-foreground">{t.chapter_number}</td>
                <td className="p-2 font-medium">{t.title}</td>
                <td className="p-2 text-center text-xs text-muted-foreground">{t.is_photo_chapter ? "yes" : ""}</td>
                {(Object.keys(FIELD_LABELS) as Field[]).map((f) => (
                  <td key={f} className="p-2 text-center">
                    <Checkbox
                      checked={isChecked(f, t.title)}
                      onCheckedChange={() => toggle(f, t.title)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
