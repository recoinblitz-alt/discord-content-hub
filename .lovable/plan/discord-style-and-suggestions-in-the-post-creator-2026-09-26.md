# Discord-style @ and # suggestions in the post creator

## What you'll get
- While writing a post, typing `#` opens a small list of channels from the selected Discord server, filtered as you keep typing (e.g. `#pol` shows `#📻┃police-wireless`).
- Typing `@` opens a list with `@everyone`, `@here`, the server's roles (in their Discord colour) and server members (avatar + name), filtered as you type.
- Use arrow keys and Enter/Tab to pick, or tap on mobile; Esc closes the list.
- The picked item appears in the text as a readable tag (`#police-wireless`, `@Moderator`, `@Abhishek`) and is sent to Discord as a real, clickable mention.
- The live preview shows mentions the same way Discord does: highlighted blue pills with the real names.
- Works in both the plain message box and the embed description and field values.

## How it behaves
- Suggestions come from the server chosen in the post's destination; if none is chosen, the list asks you to pick a server first.
- Roles and members load once when you open the composer and are cached; a large server shows the top matches (up to 25) as you type.
- If the bot can't read members (Discord's member permission is off), roles and channels still work and the list shows a short note.

## Technical details
- New server function `getMentionDirectory(serverId)` (auth + org membership check) calling Discord via the saved bot token: `GET /guilds/{id}/roles` and `GET /guilds/{id}/members/search?query=` for members; channels come from the existing synced `channels` list.
- New `MentionTextarea` component wrapping the composer textareas: detects the trigger token before the caret, shows a positioned popover, inserts the choice.
- Storage format: text keeps Discord syntax (`<#id>`, `<@&roleId>`, `<@userId>`), so delivery needs no change; the editor displays friendly names by mapping ids.
- Update `renderMarkdown` in the preview to resolve `<#id>`, `<@&id>`, `<@id>` to named `dc-mention` pills (role pills tinted with role colour).
- Mention results cached per server with TanStack Query; member search debounced.
