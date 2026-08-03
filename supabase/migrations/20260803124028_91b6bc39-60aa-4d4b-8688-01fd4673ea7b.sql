ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS review_note text;

INSERT INTO public.app_settings (key, value)
VALUES ('memory_invite_chapters', '[24,35,41,23,8,22,40]'::jsonb)
ON CONFLICT (key) DO NOTHING;