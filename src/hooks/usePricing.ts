import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Pricing {
  book_cents: number;
  extra_copy_cents: number;
}

let cache: Pricing | null = null;
let inflight: Promise<Pricing | null> | null = null;

async function loadPricing(): Promise<Pricing | null> {
  if (cache) return cache;
  if (!inflight) {
    inflight = supabase
      .from("app_settings")
      .select("value")
      .eq("key", "pricing")
      .maybeSingle()
      .then(({ data }) => {
        const v = (data?.value ?? null) as Partial<Pricing> | null;
        if (v && Number.isFinite(v.book_cents)) {
          cache = {
            book_cents: v.book_cents as number,
            extra_copy_cents: Number.isFinite(v.extra_copy_cents) ? (v.extra_copy_cents as number) : 0,
          };
        }
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * Single source of truth for displayed prices. Values come from the admin
 * pricing setting — never hardcode a price in a component.
 */
export function usePricing() {
  const [pricing, setPricing] = useState<Pricing | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let cancelled = false;
    loadPricing().then((p) => {
      if (cancelled) return;
      setPricing(p);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { pricing, loading };
}

export function formatUSD(cents: number) {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars.toFixed(0) : dollars.toFixed(2)}`;
}
