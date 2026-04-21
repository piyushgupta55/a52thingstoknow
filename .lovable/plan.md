
## Phase 1 — Templates + Memory Foundation

### Database Changes
1. **Add `chapter_template` column** to `chapters` table (TEXT, default `'all_words'`, values: `all_words`, `photo_top`, `photo_second`, `memories`)
2. **Create `memories` table** — `id`, `book_id`, `chapter_id` (nullable), `contributor_name`, `memory_text`, `size_tag` (auto: small/medium/full), `status` (pending/approved/placed), `created_at`
3. Keep `photo_urls` column (still needed for photo templates)
4. Drop reliance on `is_photo_chapter` and `photo_layout` — new `chapter_template` field replaces both

### UI Changes
5. **Template selector** — 4 small visual cards replacing the Photo Chapter toggle in the toolbar area
6. **Photo chapter limit** — query book's chapters to count photo templates, disable photo options at 15
7. **Layout per template** — reorder Page 1 / Page 2 content blocks based on selected template
8. **Memory placeholder** — when body text < 150 words, show styled placeholder (Caveat font, warm tint, gold ✦)
9. **Add Caveat Google Font**

### What's NOT in Phase 1
- AI memory trimming
- Memory collection flows / contributor links
- System suggestion ("This page has room…")
- Standalone memory request links
