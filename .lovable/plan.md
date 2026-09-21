# Fix "Could not find the function accept_org_invite" on invite acceptance

## What's happening

The invitation-acceptance step in the database does exist and the app is allowed to call it — I verified both directly against the database. The failure is the backend's API layer serving a stale copy of its schema listing, so it does not yet know about the function that was added in a later migration. Result: anyone opening an invite link gets an error instead of joining the workspace.

## The fix

1. Nudge the backend API to refresh its schema listing so the invitation function becomes callable.
2. Make invite acceptance resilient so a stale cache can never block a user again:
   - Retry the acceptance call once after a short pause if the error is the "function not found" class.
   - If it still fails, show a clear message ("We couldn't complete your invitation, please try again in a moment") instead of a raw technical error.
3. Re-test an invite link end-to-end (open link, set password, land inside the correct workspace with the invited role) and confirm no duplicate workspace appears.

## Technical details

- Verified: `public.accept_org_invite(_token text)` exists, owned by `postgres`, `EXECUTE` granted to `authenticated`, revoked from `anon`. The client call in `src/lib/invites.functions.ts` passes the matching `_token` argument, and `src/integrations/supabase/types.ts` already declares it. So the code and grants are correct; only PostgREST's schema cache is behind.
- Cache reload: apply a no-op migration that issues `NOTIFY pgrst, 'reload schema';` (plus a `COMMENT ON FUNCTION public.accept_org_invite(text)` so the migration carries a DDL statement and re-triggers cache invalidation).
- `acceptInvite` in `src/lib/invites.functions.ts`: detect PostgREST codes `PGRST202` / `42883` (or message matching "Could not find the function"), wait ~750 ms, retry the RPC once, then return a friendly `{ ok: false, message }`.
- `src/routes/invite.$token.tsx`: surface the friendly message and keep a "Try again" action rather than dead-ending.
- Verification: Playwright run through the invite route with the managed session; confirm membership row and single workspace in the sidebar.
