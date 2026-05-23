import { supabase as typedClient } from '../integrations/supabase/client.ts';

// Cast to any to work around empty generated types before schema sync
export const supabase = typedClient as any;
