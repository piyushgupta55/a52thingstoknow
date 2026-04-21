UPDATE public.chapters c
SET title = t.title,
    bible_verse_text = t.bible_verse_text,
    bible_verse_reference = t.bible_verse_reference,
    quote_text = t.quote_text,
    quote_attribution = t.quote_attribution
FROM public.chapter_templates t, public.books b
WHERE c.book_id = b.id
  AND c.chapter_number > 0
  AND t.chapter_number = c.chapter_number
  AND t.gender = b.gender;