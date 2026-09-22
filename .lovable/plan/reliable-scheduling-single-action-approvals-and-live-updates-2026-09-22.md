# Reliable scheduling, single-action approvals, and live updates

## Goal
Make scheduling dependable on mobile and desktop, prevent duplicate actions, update every screen automatically, and enforce expiry rules consistently for every role.

## Changes

### 1. Make approval a single atomic action
- Replace the separate post update and audit insert with one authenticated database function that validates the current status, changes it once, and writes one audit entry in the same transaction.
- Require the row to still be `pending`; a second click or another reviewer’s simultaneous click becomes a harmless “already reviewed” result.
- Disable all review buttons immediately while a decision is running and show one clear success/error message.
- Apply the same in-flight protection to save, submit, schedule, publish, reject, and request-changes controls.

### 2. Enforce valid future scheduling
- Require a complete date and time before submission or scheduling.
- Set the mobile date control’s minimum to today and validate the combined local date/time before every save, submit, or schedule action.
- Reject past timestamps in the database too, so browser manipulation or stale tabs cannot bypass the rule.
- Show an inline message explaining that the selected time must be in the future.

### 3. Lock posts when their posting time arrives
- Treat a pending post whose requested time has passed as expired.
- In the approval queue, hide Approve and Request Changes for expired items; show only Reject, with a required reason.
- Enforce the same rule in the database so an expired post cannot be approved from another tab or an older app version.
- Lock editing and scheduling after the posting time has arrived, and keep published posts permanently read-only.

### 4. Keep every screen current without refreshing
- Subscribe to workspace changes for posts, audit history, events, channels, templates, media, and membership updates.
- Update or invalidate the relevant cached data immediately when a change arrives.
- Keep a slower fallback refresh for reconnection resilience, but remove the visible 20-second stale window.
- Use optimistic removal in the approval queue so a reviewed item disappears immediately.

### 5. Repair independent scheduled delivery
- Keep `PUBLISH_CRON_SECRET` as an independent Render secret; no Lovable API key will be used.
- Preserve Bearer-token validation on `/api/public/publish-due` and improve unauthorized diagnostics without exposing the secret.
- Document the exact cron-job.org request setup: POST request plus `Authorization: Bearer <the exact Render PUBLISH_CRON_SECRET>`.
- Verify that one due post is claimed once, delivered once, and transitions from Scheduled to Published.

## Database safeguards
- Add an idempotent migration containing the atomic review function and trigger checks for future scheduling, expired reviews, and immutable due/published posts.
- Keep existing role rules: Admin and Super Admin may approve their own posts; Approvers may review other members’ pending posts; normal users submit their own work.
- Preserve the existing delivery claim protection to prevent two schedulers from sending the same Discord message.

## Verification
- Test mobile and desktop date/time entry, including past dates and boundary times.
- Double-click each action and simulate two reviewers acting together; confirm one state change and one audit record.
- Confirm expired pending posts expose Reject only and cannot be approved through direct database calls.
- Confirm changes appear in two open browser sessions without refreshing.
- Call the Render delivery endpoint with missing, wrong, and correct credentials; then verify a due Discord post becomes Published exactly once.
