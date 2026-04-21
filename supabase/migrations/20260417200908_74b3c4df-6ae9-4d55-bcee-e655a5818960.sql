
-- 1. Lock down chapter-photos storage mutations to book owners
DROP POLICY IF EXISTS "Authenticated users can upload chapter photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update chapter photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete chapter photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload chapter photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update chapter photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete chapter photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own book folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own chapter photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chapter photos" ON storage.objects;

-- Path convention: {book_id}/{chapter_id}/{file}
CREATE POLICY "Users can upload to their own book folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chapter-photos'
  AND EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id::text = (storage.foldername(name))[1]
      AND books.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own chapter photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chapter-photos'
  AND EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id::text = (storage.foldername(name))[1]
      AND books.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'chapter-photos'
  AND EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id::text = (storage.foldername(name))[1]
      AND books.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own chapter photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chapter-photos'
  AND EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id::text = (storage.foldername(name))[1]
      AND books.user_id = auth.uid()
  )
);

-- 2. Remove privilege escalation: drop bootstrap policy, restrict role grants to admins
DROP POLICY IF EXISTS "Bootstrap first admin" ON public.user_roles;

CREATE POLICY "Admins can grant roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
