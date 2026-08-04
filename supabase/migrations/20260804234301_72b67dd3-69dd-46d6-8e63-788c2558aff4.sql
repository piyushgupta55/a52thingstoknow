UPDATE public.chapters
SET
  content = regexp_replace(
    regexp_replace(COALESCE(content, ''), '<\/?mark\b[^>]*>', '', 'gi'),
    '&lt;\/?mark\b.*?&gt;', '', 'gi'
  ),
  reference_text = regexp_replace(
    regexp_replace(COALESCE(reference_text, ''), '<\/?mark\b[^>]*>', '', 'gi'),
    '&lt;\/?mark\b.*?&gt;', '', 'gi'
  )
WHERE COALESCE(content, '') ~* '(<\/?mark\b|&lt;\/?mark\b)'
   OR COALESCE(reference_text, '') ~* '(<\/?mark\b|&lt;\/?mark\b)';