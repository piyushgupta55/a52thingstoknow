
CREATE POLICY "Users upload feedback screenshots to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own feedback screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feedback-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins read all feedback screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feedback-screenshots' AND public.has_role(auth.uid(), 'admin'));
