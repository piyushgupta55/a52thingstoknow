-- Seed default photo chapter designations (15 chapters across both genders)
-- These are sensible defaults for chapters whose themes work well with a photo.
UPDATE public.chapter_templates
SET is_photo_chapter = true
WHERE chapter_number IN (1, 5, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 47, 50, 52);