import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DollarSign } from 'lucide-react';

interface Pricing {
  book_cents: number;
  extra_copy_cents: number;
  shipping_first_cents: number;
  shipping_extra_cents: number;
}

const DEFAULTS: Pricing = {
  book_cents: 8900,
  extra_copy_cents: 3400,
  shipping_first_cents: 1200,
  shipping_extra_cents: 400,
};

const centsToDollars = (c: number) => (c / 100).toFixed(2);
const dollarsToCents = (v: string) => Math.round(parseFloat(v || '0') * 100);

export default function PricingManager() {
  const { toast } = useToast();
  const [pricing, setPricing] = useState<Pricing>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'pricing')
        .maybeSingle();
      if (data?.value) setPricing({ ...DEFAULTS, ...(data.value as any) });
      setLoading(false);
    })();
  }, []);

  const update = (k: keyof Pricing, dollars: string) =>
    setPricing((p) => ({ ...p, [k]: dollarsToCents(dollars) }));

  const save = async () => {
    for (const [k, v] of Object.entries(pricing)) {
      if (!Number.isFinite(v) || v < 0) {
        toast({ title: 'Invalid price', description: `${k} must be a positive number`, variant: 'destructive' });
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'pricing', value: pricing as any, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pricing updated', description: 'New prices take effect on the next checkout.' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading pricing…
      </div>
    );
  }

  const row = (label: string, key: keyof Pricing, hint?: string) => (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 border-b last:border-b-0">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="relative w-32">
        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="number"
          step="0.01"
          min="0"
          className="pl-7"
          value={centsToDollars(pricing[key])}
          onChange={(e) => update(key, e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-1">Pricing</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Amounts charged at checkout are read from these settings at the moment of purchase.
        Changes take effect immediately — no Stripe dashboard edits required.
      </p>

      <div className="bg-white rounded-lg border p-5 mb-6">
        {row('Book unlock', 'book_cents', 'One-time charge to unlock the full book and receive the first printed copy.')}
        {row('Extra printed copy', 'extra_copy_cents', 'Per additional copy (no sleeve or gift box).')}
        {row('Shipping — first book', 'shipping_first_cents', 'USPS Ground Advantage, insured.')}
        {row('Shipping — each additional copy', 'shipping_extra_cents', 'Added on top of the first-book shipping.')}
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : 'Save pricing'}
      </Button>
    </div>
  );
}
