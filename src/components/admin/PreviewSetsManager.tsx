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

interface TopicRow {
  slotKey: string;
  displayNumber: number;
  titles: string[]; // all gender variants for this topic
  anyPhoto: boolean;
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

// Step-version books shift chapters by +1 (they open with "I Got You").
// Group templates into one row per TOPIC by aligning slot numbers across
// the 4 gender variants so every version toggles together.
const isStep = (g: string) => g === "stepdaughter" || g === "stepson";
const slotFor = (t: TemplateRow): string => {
  if (isStep(t.gender) && t.chapter_number === 1) return "step-intro"; // "I Got You"
  const n = isStep(t.gender) ? t.chapter_number - 1 : t.chapter_number;
  return `slot-${n}`;
};
const slotSortValue = (key: string): number =>
  key === "step-intro" ? 0.5 : Number(key.replace("slot-", ""));

export default function PreviewSetsManager() {
  const { toast } = useToast();
  const [topics, setTopics] = useState<TopicRow[]>([]);
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
      const groups = new Map<string, TopicRow>();
      for (const t of (tpls || []) as TemplateRow[]) {
        const key = slotFor(t);
        const existing = groups.get(key);
        const displayNumber =
          key === "step-intro"
            ? 0
            : isStep(t.gender)
            ? t.chapter_number - 1
            : t.chapter_number;
        if (!existing) {
          groups.set(key, {
            slotKey: key,
            displayNumber,
            titles: [t.title],
            anyPhoto: t.is_photo_chapter,
          });
        } else {
          if (!existing.titles.some((x) => normalizeTitle(x) === normalizeTitle(t.title))) {
            existing.titles.push(t.title);
          }
          existing.anyPhoto = existing.anyPhoto || t.is_photo_chapter;
        }
      }
      setTopics(
        Array.from(groups.values()).sort(
          (a, b) => slotSortValue(a.slotKey) - slotSortValue(b.slotKey),
        ),
      );
      setSets(s);
      setInitial(s);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeTitle(filter);
    if (!q) return topics;
    return topics.filter((row) =>
      row.titles.some((t) => normalizeTitle(t).includes(q)),
    );
  }, [topics, filter]);

  const isChecked = (field: Field, row: TopicRow): boolean => {
    // Scope the display check to the row's own slot/topic (headline title).
    // Using only the primary title prevents adjacent step-book rows from
    // appearing checked when they happen to share a variant title.
    const ownTitle = row.titles[0];
    if (!ownTitle) return false;
    const n = normalizeTitle(ownTitle);
    return sets[field].some((x) => normalizeTitle(x) === n);
  };

  const toggle = (field: Field, titles: string[]) => {
    setSets((prev) => {
      const existing = prev[field];
      const normalizedVariants = new Set(titles.map(normalizeTitle));
      const alreadyIn = existing.some((x) => normalizedVariants.has(normalizeTitle(x)));
      const stripped = existing.filter((x) => !normalizedVariants.has(normalizeTitle(x)));
      // The public /samples list isn't gender-aware, so the website set stores
      // only the headline title per topic. Other sets keep group behaviour.
      const added = field === "website_samples" ? titles.slice(0, 1) : titles;
      const next = alreadyIn ? stripped : [...stripped, ...added];
      return { ...prev, [field]: next };
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
    website_samples: topics.filter((r) => isChecked("website_samples", r)).length,
    trial_readable: topics.filter((r) => isChecked("trial_readable", r)).length,
    trial_editable: topics.filter((r) => isChecked("trial_editable", r)).length,
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Preview sets</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          One row per topic. Toggling a topic applies to all book versions (daughter, son, stepdaughter, stepson) — each
          reader sees their own matching chapter title. Changes take effect immediately for new page loads.
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
          placeholder="Filter topics…"
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
              <th className="p-2">Topic (all version titles)</th>
              <th className="p-2 w-24 text-center">Photo?</th>
              {(Object.keys(FIELD_LABELS) as Field[]).map((f) => (
                <th key={f} className="p-2 w-32 text-center">{FIELD_LABELS[f]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.slotKey} className="border-t hover:bg-muted/20 align-top">
                <td className="p-2 text-muted-foreground">
                  {row.slotKey === "step-intro" ? "—" : row.displayNumber}
                </td>
                <td className="p-2">
                  {row.titles.length === 1 ? (
                    <span className="font-medium">{row.titles[0]}</span>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="font-medium">{row.titles[0]}</div>
                      <div className="text-xs text-muted-foreground">
                        also: {row.titles.slice(1).join(" · ")}
                      </div>
                    </div>
                  )}
                </td>
                <td className="p-2 text-center text-xs text-muted-foreground">{row.anyPhoto ? "yes" : ""}</td>
                {(Object.keys(FIELD_LABELS) as Field[]).map((f) => (
                  <td key={f} className="p-2 text-center">
                    <Checkbox
                      checked={isChecked(f, row)}
                      onCheckedChange={() => toggle(f, row.titles)}
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
