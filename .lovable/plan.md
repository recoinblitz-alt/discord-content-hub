# Fix: uploaded images don't show up in Discord

## What's wrong

The picture link in your Discord post points at the editor preview address. That address is private — only signed-in workspace members can open it. When Discord tried to fetch the picture it got "not allowed", so instead of the image it showed that grey "Internal Lovable project — only available to authorized workspace members" card.

I confirmed it: the same picture opens fine on the app's stable public address, and is refused on the preview address.

A second, smaller thing: pictures added as "attachments" are sent as a plain link pasted at the end of the message text. Discord only turns that into a picture if it can fetch it, and it looks like a link either way. Putting the picture in the embed's image slot shows it properly inside the card.

## What I'll change

1. Uploaded pictures get a permanent public address that anyone (including Discord) can load, instead of the private preview address.
2. Existing library pictures that were saved with the private address get corrected automatically, so your current assets start working too.
3. In the post creator, choosing a picture from the library will fill the embed's image (or thumbnail) slot, and the attachment list will send images as proper embedded images rather than a bare link in the text.
4. After the change I'll re-send a test post to a channel and confirm the picture renders in Discord.

## Note on publishing

Until the app is published, the picture links use the stable preview address (`project--<id>-dev.lovable.app`), which is public and works. Once you publish, links will use the live address. Publishing is recommended so pictures keep working even if the preview build changes.

## Technical notes

- `uploadMedia` in `src/lib/store.tsx` builds the URL from `window.location.origin`; in the editor that is the auth-gated `*.lovableproject.com` host. Replace with a resolved public base: `VITE_PUBLIC_SITE_URL` when set, else `https://project--<VITE_SUPABASE-independent project id>-dev.lovable.app`, else `window.location.origin` for self-hosted/Render.
- Add a small one-time normalizer when mapping `media_assets`: if `storage_path` is set, always derive `url` from the public base + `/api/public/media/<storage_path>` rather than the stored column, so old rows self-heal without a data migration.
- `buildDiscordPayload` in `src/lib/discord.server.ts`: send `attachments` as additional embeds with `image.url` (or set `embed.image` when a single embed is used) instead of appending the URLs to `content`.
- Verification: `curl` the public URL for a 200 `image/png`, then `sendTestMessage` to a channel and check the delivered message.
