
-- Create the chapter-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chapter-photos', 'chapter-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Chapter photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'chapter-photos');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload chapter photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chapter-photos');

-- Authenticated users can update their uploads
CREATE POLICY "Authenticated users can update chapter photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chapter-photos');

-- Authenticated users can delete their uploads
CREATE POLICY "Authenticated users can delete chapter photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chapter-photos');
