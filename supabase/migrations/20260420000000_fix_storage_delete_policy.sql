-- Drop the original overly-permissive DELETE policy from the initial schema.
-- It only checked auth.role() = 'authenticated', allowing any user to delete
-- any photo. The correct ownership-scoped policy already exists from migration
-- 20260417200908 but Postgres ORs permissive policies, so the broken one wins
-- unless explicitly dropped.
DROP POLICY IF EXISTS "Users can delete own chapter photos" ON storage.objects;
