import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface PreviewSets {
  website_samples: string[];
  trial_readable: string[];
  trial_editable: string[];
}

const EMPTY: PreviewSets = {
  website_samples: [],
  trial_readable: [],
  trial_editable: [],
};

export const normalizeTitle = (s: string | null | undefined): string =>
  (s || "")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D"']/g, "")
    .replace(/[\u2026]/g, "...")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function isInSet(title: string | null | undefined, list: string[]): boolean {
  if (!title || !list?.length) return false;
  const n = normalizeTitle(title);
  return list.some((t) => normalizeTitle(t) === n);
}

let cache: { sets: PreviewSets; at: number } | null = null;

export async function fetchPreviewSets(force = false): Promise<PreviewSets> {
  if (!force && cache && Date.now() - cache.at < 30_000) return cache.sets;
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "preview_sets")
    .maybeSingle();
  const value = (data?.value ?? {}) as Partial<PreviewSets>;
  const sets: PreviewSets = {
    website_samples: value.website_samples ?? [],
    trial_readable: value.trial_readable ?? [],
    trial_editable: value.trial_editable ?? [],
  };
  cache = { sets, at: Date.now() };
  return sets;
}

export function invalidatePreviewSetsCache() {
  cache = null;
}

export function usePreviewSets() {
  const [sets, setSets] = useState<PreviewSets>(cache?.sets ?? EMPTY);
  const [loading, setLoading] = useState(!cache);
  useEffect(() => {
    let cancelled = false;
    fetchPreviewSets().then((s) => {
      if (!cancelled) {
        setSets(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { sets, loading };
}
