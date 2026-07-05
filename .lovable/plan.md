# Plan — 4-Gender Templates + `<review>` Editor Tag + Seed Capture

## Goal

Support 4 book genders (`female`, `male`, `stepdaughter`, `stepson`), consolidate template content into a single column, add an editor-only `<review>` tag, and capture per-chapter seed text at book creation for future change-measurement.

## 1. Database migration

### `chapter_templates`
- Add `reference_content TEXT`.
- Backfill: copy `reference_content_female` or `reference_content_male` into `reference_content` based on each row's `gender`.
- Drop `reference_content_female` and `reference_content_male`.
- Add unique constraint `(gender, chapter_number)`.
- `gender` stays TEXT — carries `female | male | stepdaughter | stepson`.

### `chapters`
- Add `seed_content TEXT` (nullable). Write-once at book creation, never touched again. Baseline for future harvest/measurement.

Existing books unaffected — chapter text already lives in `chapters`.

## 2. Gender codes (final)

`stepdaughter` / `stepson` (matches the CSV). No relabel needed.

`src/lib/genderMap.ts`:
```ts
export type BookGender = 'female' | 'male' | 'stepdaughter' | 'stepson';
export const toBookGender = (recipient_gender: string): BookGender => { ... }
export const isFeminine = (g: BookGender) => g === 'female' || g === 'stepdaughter';
```

## 3. Book creation UI (`src/pages/NewBook.tsx`)

Recipient Gender select becomes 4 options:
- Girl / Young Woman → `female`
- Boy / Young Man → `male`
- Stepdaughter → `stepdaughter`
- Stepson → `stepson`

Store canonical code in `books.gender`, human label in `books.recipient_gender`.

**Seeding:** template query returns `reference_content` for the book's gender. Each inserted chapter row gets:
- `content` = seed text (editable)
- `seed_content` = same seed text (frozen)

Applies to all 52 chapters and the Letter from the Author.

## 4. Replace the 2-way shortcut everywhere

Files: `NewBook.tsx`, `ChapterEditor.tsx`, `BookDashboard.tsx`, `PreviewBook.tsx`, `src/features/preview/types.ts`.

- Every `=== 'Girl/Young Woman' ? 'female' : 'male'` → `toBookGender(...)`.
- Template queries switch from `reference_content_female / _male` to `reference_content` filtered by 4-way `gender`.

## 5. Token replacer (`src/lib/tokenReplacer.ts`)

- `isFeminine(gender)` replaces the exact-string check.
- Stepdaughter/stepson get the same pronouns as daughter/son.
- `[SON_DAUGHTER]` returns `stepdaughter` / `stepson` for step books.

## 6. `<review>` editor tag

Editor-only markup. Distinct from `<mark>` (which stays the yellow Reading Reward).

### Rendering
- `src/components/chapter/ReviewCallout.tsx`.
- `ReferenceBlock` (and other body renderers) parse `<review>…</review>` and swap for the callout: amber-tinted inline highlight + top-right pill "Direct content — review" + Keep / Soften / Remove actions.
- Text stays freely editable in the textarea (tag stays in raw body).

### Persistence
```
chapter_review_flags(
  id, chapter_id, tag_index int,
  action text ('keep'|'soften'|'remove'),
  updated_at
)
```
- `tag_index` = ordinal of the `<review>` span in the chapter body.
- Default is `keep` if no row.

### PDF render (`backend/src/pdf`)
- Strip `<review>` / `</review>` wrappers before render.
- `remove` → drop wrapped text entirely.
- `soften` → Phase 1 same as remove (logged as "softened"; future AI rewrite in Phase 2).
- `keep` (default) → print inner text as plain prose.
- Child's book never sees tag, callout, or editor UI.

## 7. CSV import readiness

After migration + code changes ship:
- Upload 208-row CSV: `gender, chapter_number, title, reference_content, bible_verse_text, bible_verse_reference, quote_text, quote_attribution, is_photo_chapter`.
- Full-replace: TRUNCATE `chapter_templates`, insert 208 rows. No FKs point at this table.
- Test: create one book of each of the 4 gender types, open the two chapters with `<review>` tags, verify callout in editor + tag stripped in PDF preview.

## Out of scope (later batches — safe to defer)

- AI-powered "soften" rewrite.
- Admin UI for review-flag browsing.
- Tester tracking, share checkbox, harvest/consent UI.
- Migrating existing books' chapter text to new templates.
