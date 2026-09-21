# Fix roles and the complete invitation journey

## What's happening

The invitation-acceptance step in the database does exist and the app is allowed to call it — I verified both directly against the database. The current journey nevertheless breaks in several confirmed places:

- The backend API can serve a stale schema listing and reject `accept_org_invite` even though it exists.
- A signed-out invite opens the ordinary sign-in/create-account screen. That screen describes creating a workspace, its confirmation link returns to the site root, and it does not preserve the invite URL reliably.
- The invite page asks for only a password, not the member's name. It shows password setup only when `?invited=1` survives the email redirect.
- Email delivery uses the account-invitation API. It can reject an existing account instead of emailing that person their workspace link.
- The current permission matrix matches the requested role labels, but each screen and write action still needs an end-to-end check against the exact role responsibilities.

## The fix

1. Restore reliable invite acceptance:
   - Nudge the backend API to refresh its schema listing so the invitation function becomes callable.
   - Retry the acceptance call once after a short pause if the error is the "function not found" class.
   - If it still fails, show a clear message ("We couldn't complete your invitation, please try again in a moment") instead of a raw technical error.
   - Keep a visible Try again action and never discard the pending invite after a failed attempt.
2. Replace the split sign-up/invite journey with one dedicated invitation flow:
   - Opening an invite never asks the person to create a workspace.
   - New members enter their name and new password on the invitation page, verify their invited email, then join automatically.
   - Existing members sign in on the invitation page and join immediately.
   - Preserve the invite token across email verification, sign-in, refresh, and redirects.
   - Validate that the signed-in email exactly matches the invited email before membership is added.
3. Make invitation email delivery work for both new and existing accounts:
   - Keep the secure account invitation email for a new address.
   - If the address already has an account, send a workspace invitation email containing the same one-time link rather than treating it as an error.
   - Show the admin whether email was sent; retain Copy link as the fallback.
4. Enforce the requested roles consistently:
   - **Super Admin:** all access, including organizations and other Super Admins.
   - **Admin:** create/edit, approve/reject, publish/schedule, servers/bots, invitations, and non-Super-Admin team management.
   - **Approver:** create/edit and review pending posts only.
   - **Normal User:** create/edit own posts and submit them for review only.
   - Apply these rules in navigation, pages, buttons, server actions, and database enforcement so hidden controls cannot be bypassed.
5. Re-test complete journeys: each role's allowed/blocked actions; new-user and existing-user email invitations; copied invite links; password/name setup; direct entry into the invited workspace; one membership and one workspace entry after link reuse.

## Technical details

- Verified: `public.accept_org_invite(_token text)` exists, owned by `postgres`, `EXECUTE` granted to `authenticated`, revoked from `anon`. The client call in `src/lib/invites.functions.ts` passes the matching `_token` argument, and `src/integrations/supabase/types.ts` already declares it. So the code and grants are correct; only PostgREST's schema cache is behind.
- Cache reload: apply a no-op migration that issues `NOTIFY pgrst, 'reload schema';` (plus a `COMMENT ON FUNCTION public.accept_org_invite(text)` so the migration carries a DDL statement and re-triggers cache invalidation).
- `acceptInvite` in `src/lib/invites.functions.ts`: detect PostgREST codes `PGRST202` / `42883` (or message matching "Could not find the function"), wait ~750 ms, retry the RPC once, then return a friendly `{ ok: false, message }`.
- Add a safe invite lookup that reveals only workspace name, invited email, and whether the account already exists; do not expose the invite table publicly.
- `src/routes/invite.$token.tsx`: own the full name/password/sign-in/verification/acceptance state machine and friendly retry state.
- `src/routes/auth.tsx` and the authenticated gate: preserve and prioritize a pending invite, bypass workspace creation, and return to the exact invite after authentication.
- Email: use the existing auth invitation for new users and a server-sent workspace email for existing users. If the current email service cannot send the second type, add the required transactional-email connection rather than silently claiming success.
- Role enforcement: audit composer, approvals, templates, team, settings, calendar events, post mutations, and database policies/triggers. Keep role changes server-validated and prohibit Admins from modifying Super Admins.
- Add these invitation and role corrections to the project roadmap immediately after approval, before implementation.
- Verification: test 4 role accounts plus new/existing invite recipients; confirm the accepted membership has the invited role and the sidebar contains the workspace exactly once.
