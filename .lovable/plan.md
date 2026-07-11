# Family Contributions — Implementation Plan

Extends existing plumbing (`memories`, `memory_invites`, `submit_memory_via_invite`, MemoryManager). Nothing gets replaced.

## 1. Database migration

Additions to `memories`:
- `contributor_email TEXT NULL` — reliable grouping key
- `entry_type TEXT NULL` check in (`memory`,`wisdom`) — labeling
- `seen_by_author_at TIMESTAMPTZ NULL` — unseen indicator

New table `memory_invitees`:
- `id`, `book_id` (FK books), `invite_token` (FK memory_invites.token), `name`, `email`, `sent_at`, `last_sent_at`
- unique (book_id, lower(email))
- RLS: author of the book can select/insert/update; service_role all.
- GRANTs to authenticated + service_role.

RPC updates:
- New `submit_family_contributions(_token, _from_name, _from_email, _entries jsonb)` — inserts N rows in one call, each with `entry_type` and shared `contributor_email`. Keeps original `submit_memory_via_invite` for back-compat.

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.memories;` (if not already).

## 2. Email sending (Resend)

- Edge function `send-family-invite`: takes `{ book_id, name, email }`, loads book + author, renders the invitation copy from `family_invite_content.md` (Part 1) with `[Name]`, `[Author]`, `[Contributor first name]`, `[Link]`, optional `[Occasion]`, sends via Resend, then upserts a `memory_invitees` row.
- Requires `RESEND_API_KEY` secret — will prompt user via add_secret if not present.
- Reuse the existing per-book reusable token (or mint one if none exists).

## 3. Invite UI (author side) — `MemoryManager.tsx`

Replace the "Generate/copy invite link" card with an **Invite family** form:
- Fields: Name, Email → "Send invite" button → calls `send-family-invite`.
- Below: list of invitees with status `Sent · Responded` (join memory_invitees ↔ memories by email).
- Keep raw link visible as a fallback ("Or copy the link").

## 4. Public submission page — `MemoryInvite.tsx`

Rewrite per Part 2 of the copy spec:
- Name + Email (email new, required for grouping).
- Section: **Memories** — repeatable, "+ Add another memory", helper text + example.
- Section: **Wisdom or advice** — repeatable, "+ Add another", helper text + example.
- Both optional; at least one entry required to submit.
- 5000 chars per entry.
- Submit → `submit_family_contributions` RPC.
- Success screen unchanged in tone.

## 5. Dashboard "Family" hub

Rename existing "Emails" box on `Dashboard.tsx` to **Family** and repurpose:
- Header stats: `Sent: X · Responded: Y` across all the author's books.
- Grouped list: one card per contributor (group by `contributor_email` if present, else name), showing entry count and unseen badge.
- Unseen = any row with `seen_by_author_at IS NULL AND contributor_type='family'` — bold styling; dim once opened.
- Tap contributor → deep-link to that book's `MemoryManager` with the contributor pre-expanded. Mark that contributor's rows `seen_by_author_at = now()` on open.
- MemoryManager: group family pending items by contributor (email/name), show entry_type label chips (memory/wisdom), keep existing Approve/Decline.

## 6. Notifications — family-only

- **In-app realtime**: Dashboard subscribes to `postgres_changes` on `memories` filtered `contributor_type=eq.family`, matched to the author's books. New insert → toast + Family badge count bump.
- **Email**: DB trigger on `memories` insert where `contributor_type='family'` → invokes edge function `notify-author-family-contribution` (Resend). Subject: "[Contributor] shared something for [Name]'s book".
- Existing "any memory add" notifications (if any) are restricted to family only.

## 7. Files touched

**New**
- `supabase/functions/send-family-invite/index.ts`
- `supabase/functions/notify-author-family-contribution/index.ts`
- `src/components/family/InviteFamilyForm.tsx`
- `src/components/family/FamilyHub.tsx` (dashboard box)

**Modified**
- `src/pages/MemoryManager.tsx` — invite form + grouped family section + seen-marking
- `src/pages/MemoryInvite.tsx` — multi-entry guided form, per spec copy
- `src/pages/Dashboard.tsx` — Family hub, realtime subscription
- migration file (schema above)

## Open questions before I build

1. **Resend key** — is `RESEND_API_KEY` already available, or should I request it via add_secret?
2. **Email required on submission page?** Spec says group by email if present, fall back to name — I'll make email **required** (matches invite-by-email flow); confirm ok.
3. **Occasion token** — books have `occasion` already; I'll auto-fill when non-empty, skip line when empty. Ok?

Reply "go" (and answer 1–3) and I'll ship migration → edge functions → UI in that order.
