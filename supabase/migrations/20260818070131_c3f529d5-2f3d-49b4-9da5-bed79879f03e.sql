CREATE TABLE public.chapters_status_backup_20260818 AS
SELECT id AS chapter_id, book_id, chapter_number, status, now() AS backed_up_at
FROM public.chapters;

GRANT ALL ON public.chapters_status_backup_20260818 TO service_role;
GRANT SELECT ON public.chapters_status_backup_20260818 TO authenticated;

ALTER TABLE public.chapters_status_backup_20260818 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read chapter status backup"
ON public.chapters_status_backup_20260818
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));