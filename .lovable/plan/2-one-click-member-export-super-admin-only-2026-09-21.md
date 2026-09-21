

## 2. One-click member export (super admin only )

A new **Members export** card on the Servers & Bots screen, visible only to the workspace
owner (Super Admin):

- Pick a server, click **Export members**, and get a downloadable CSV with: Discord user
ID, username, display name, bot flag, join date, and their roles (names + role IDs).
- A second file lists the server's roles: role ID, name, colour, position, member count.
- Progress shown while it pages through large servers (1,000 members per request).
- The app's own workspace members can be exported too: name, email, role, joined date.

Important: Discord only reveals the member list if the bot has the **Server Members
Intent** switched on in the Discord Developer Portal. If it's off, the export stops with a
clear message telling you exactly which switch to turn on, instead of failing silently.

## 3. Terms, Privacy and other legal pages

Public pages linked from the landing page footer and the app's sidebar footer:

- **Terms & Conditions** — use of the service, acceptable use, Discord's own terms,
accounts and workspaces, content ownership, suspension, liability limits, changes.
- **Privacy Policy** — what's stored (email, name, workspace, posts, uploaded pictures,
bot token kept encrypted), why, who processes it (hosting, database, Discord), how long,
your rights, and how to request deletion.
- **Cookie notice** — the sign-in session and theme preference only.
- **Support / Contact** page with your contact email.

These will be written as clear generic drafts. They'll contain a placeholder company name
and contact email — tell me the real ones and I'll drop them in; otherwise please review
before publishing, as I can't invent legally binding details for you.

## Technical notes

- New server fns in `src/lib/discord.functions.ts`, gated to `super_admin`:
`exportGuildMembers({ serverId })` — paginates `GET /guilds/{id}/members?limit=1000&after=`
with the stored bot token, joins role IDs to `GET /guilds/{id}/roles`, returns rows;
`exportGuildRoles({ serverId })`. A 403 with code 50001/missing intent maps to the
"enable Server Members Intent" message.
- CSV is assembled client-side from the returned rows and downloaded via a Blob URL, so no
storage writes are needed. Workspace-member export reads existing store data.
- New public routes `src/routes/terms.tsx`, `privacy.tsx`, `cookies.tsx`, `support.tsx`,  
each with its own `head()` meta; footer links added in `index.tsx` and `app-shell.tsx`.