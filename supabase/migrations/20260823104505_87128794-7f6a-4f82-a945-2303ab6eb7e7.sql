ALTER TABLE public.chapter_templates_backup_20260823 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chapter_templates_backup_20260823 FROM anon, authenticated;
GRANT ALL ON public.chapter_templates_backup_20260823 TO service_role;