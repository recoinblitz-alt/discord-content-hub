# Go live: real accounts, real Discord bot, empty workspace

Turn the demo into a real working product: you sign in, add your own Discord bot, and posts actually get delivered to your server.

## What changes for you

1. **Sign in with email and password.** The first account to sign up becomes the owner (Super Admin) of a new, empty workspace. You invite teammates by email and set each one's role: Admin, Approver, or Normal User. The role switcher goes away — what you can do now depends on your real role.
2. **Empty workspace.** No sample posts, servers, templates, media, or people. Every screen starts with a short "add your first..." prompt instead of demo rows.
3. **Add your Discord bot.** On Servers & Bots you paste your bot token. The app verifies it against Discord, shows the bot's name and avatar, pulls in the servers it has joined and the real channels in each one, and lets you mark which channels require approval. Tokens are stored encrypted and are never shown back in full.
4. **Real delivery.** Publishing now sends the message to Discord for real. Approved posts with a schedule get delivered automatically at the chosen time; there is also a "Publish now" and a "Send test to this channel" button so you can confirm the bot works in under a minute. If Discord rejects a send, the post is marked Failed with Discord's reason and a Retry button.
5. **Everything is shared and saved.** Posts, approvals, comments, the audit trail, templates, and media live in the cloud, so your teammates see the same data and nothing is lost on refresh.
6. **Smoother feel.** Saving, approving, and publishing update instantly with clear toasts, skeleton loaders while data arrives, and no full-page reloads between screens.

## Order of work

1. Enable the backend and email sign-in; add sign-up / sign-in / password-reset pages and gate the app behind them.
2. Create the data model and access rules; drop all seed data and the local-storage store.
3. Rebuild each screen against live data with loading and empty states.
4. Bot setup: token verification, server and channel import, encrypted storage, test send.
5. Delivery: publish now, scheduled publishing, failure handling and retry.
6. Team invites and role management; permissions enforced on the server, not just hidden in the UI.

## Technical notes

- Lovable Cloud (Postgres + Auth) as the backend. Tables: `organizations`, `org_members` (role per user per org), `servers`, `channels`, `posts` (embed JSON, status, schedule, timezone), `post_audit`, `templates`, `media_assets`, `invites`. Roles live in `org_members` only, read through a `has_org_role` security-definer function; every table gets RLS scoped to org membership plus explicit grants.
- Bot tokens are never exposed to the browser: stored in a server-only `server_secrets` table (encrypted at rest, no anon/authenticated select) and only read inside server functions. All Discord REST calls (`/users/@me`, `/users/@me/guilds`, `/guilds/{id}/channels`, `/channels/{id}/messages`) run in `createServerFn` handlers with `requireSupabaseAuth`, which re-check the caller's role before acting.
- Embed builder output maps directly to Discord's embed payload; link buttons send as an action-row component. Attachments/images use URLs, so media assets stay URL-based.
- Scheduled publishing: a `pg_cron` job hits a signed `/api/public/publish-due` route every minute, which claims due posts with a status guard (no double sends), calls Discord, and writes `published`/`failed` plus the message ID into the audit trail.
- Auth: email/password enabled via Cloud, protected screens under `_authenticated`, session-aware header, and TanStack Query for all reads with optimistic mutations for the snappy feel.

## What I need from you

Your Discord bot token, once the Servers & Bots screen is ready — I will ask for it through the secure secret form at that point, not in chat. The bot needs to already be invited to your server with permission to send messages and embeds.
