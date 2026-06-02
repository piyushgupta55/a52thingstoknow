# Project Structure

## Frontend

- `src/pages/` route-level pages (`ChapterEditor`, `PreviewBook`, `Dashboard`, etc.)
- `src/components/` reusable UI and chapter/admin components
- `src/features/preview/geometry.ts` preview/book geometry constants used by preview page
- `src/features/preview/types.ts` preview page data contracts and spread types
- `src/features/chapter-editor/constants.ts` chapter editor budgets and labels
- `src/features/chapter-editor/textSplit.ts` chapter text split/merge helpers
- `src/features/chapter-editor/photoValidation.ts` chapter photo validation helpers
- `src/lib/` shared utilities (Supabase client wrapper, token replacement, counters)
- `src/hooks/` custom React hooks
- `src/contexts/` app-wide context providers

## Backend (PDF)

- `backend/src/server.ts` Express entrypoint (`/health`, `/generate-pdf`)
- `backend/src/pdf/engines/` PDF engines (Puppeteer/Prince)
- `backend/src/pdf/templates/shared/layout.ts` HTML template and pagination splitting
- `backend/src/pdf/styles/` print CSS
- `backend/debug/html/` generated debug HTML outputs (latest pass files)

## Supabase

- `supabase/functions/` edge functions (`companion-chat`, `book-review`)
- `supabase/migrations/` schema, RLS policies, SQL functions

## Notes

- Generated debug HTML should stay in `backend/debug/html/`.
- Do not write generated debug files into `public/` or repo root.
