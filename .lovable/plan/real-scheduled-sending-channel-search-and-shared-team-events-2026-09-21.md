# Real scheduled sending, channel search, and shared team events

## What I checked first

- One Discord server is connected with a saved bot token and 79 imported channels.
- The every-minute scheduled job is already running and reaching the delivery endpoint successfully (it replies "ok, 0 posts processed") — there are simply no posts in the workspace yet, so nothing has ever been sent.
- The channel picker in the post creator is a plain dropdown listing all 79 channels with no search.
- The calendar only shows posts; there is no concept of a team event.

So delivery is wired but unproven, and the job currently points at the preview address only.

## 1. Prove and harden scheduled delivery

- Run a real end-to-end test: create a post, schedule it a minute out, and confirm the message lands in the Discord channel, with the post flipping to Published and the message recorded in history.
- Make the scheduled run safe and honest:
  - Claim each due post before sending so a slow send can never be delivered twice.
  - On a Discord rejection, mark the post Failed with Discord's own reason and show a Retry button on the post.
  - Skip and flag posts whose channel or bot connection has gone away, with a clear reason instead of silence.
- Add a second schedule pointing at the live Render address so sending keeps working once deployed, and document both addresses.
- Surface delivery clearly in the UI: scheduled posts show the exact send time and timezone; published posts show which channel received them; failed posts show why.

## 2. Searchable channel picker in the post creator

- Replace the Channel dropdown with a searchable picker: type to filter by channel name, keyboard navigable, showing the server it belongs to and an "approval required" marker.
- Show the currently selected channel as `#name` on the closed control.
- Handle the empty case ("no channels match") and the no-server-connected case with a link to Servers & Bots.
- Apply the same searchable picker to the calendar's channel filter, which has the same long list problem.

## 3. Shared team events on the calendar

- Admins and Super Admins can add an event: title, optional description, date and time, timezone, and a colour tag.
- Events appear on the calendar for everyone in the workspace, in month, week and list views, visually distinct from posts.
- Creators and approvers see events read-only; admins can edit or delete them.
- A filter toggle to show posts only, events only, or both.
- Events are workspace-wide and saved in the cloud, so everyone sees the same schedule.

## Technical notes

- New `org_events` table (org_id, title, description, starts_at, ends_at, timezone, color, created_by) with grants and RLS: read for any org member via `is_org_member`, insert/update/delete restricted to `has_org_role(..., ['super_admin','admin'])`. Events are loaded as their own cached query rather than joining the existing workspace fetch.
- Delivery claiming: the due-posts step updates `status` from `scheduled` to an in-flight state with a conditional update so only one run can pick up a row; the existing `deliverPost` then writes `published`/`failed` plus the Discord message id and an audit row.
- Retry calls the existing authenticated publish server function, which re-checks the caller's role.
- The searchable picker uses the existing command/popover primitives already in the project.
- The current `pg_cron` job targets the preview domain; a matching job for the published Render domain is added with the same shared secret so the live site sends on time. Both run once a minute because a post scheduled for 14:05 must go out at 14:05; that is 1440 checks a day and keeps the database awake, which adds a small recurring cost — the alternative is accepting a coarser delay.
