
-- Allow users to read their own book-specific content_pool rows (any status)
CREATE POLICY "Users can view their own book content"
ON public.content_pool FOR SELECT
TO authenticated
USING (
  book_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = content_pool.book_id
      AND books.user_id = auth.uid()
  )
);

-- Allow admins to revoke roles
CREATE POLICY "Admins can revoke roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
