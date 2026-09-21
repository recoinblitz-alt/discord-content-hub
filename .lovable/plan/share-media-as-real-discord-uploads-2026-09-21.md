# Share media as real Discord uploads

Right now, pictures you add to a post are sent to Discord as *links* — Discord has to
fetch them from your app to show them. That works only while the picture address is
reachable, and it always renders inside a coloured embed card.

The examples you shared are a different thing: the picture is **uploaded into Discord
itself**, so it sits under the message as a native image, loads instantly, and stays
forever even if the app is offline.

## What changes

**In the post creator, the Media section gets a choice:**

- **Upload to Discord (recommended)** — the picture file is sent with the message, exactly
  like the examples. Big native image under your text, no dependency on a link.
- **Show inside the embed card** — current behaviour, kept for people who want the
  picture framed inside the coloured embed.

The live preview reflects the chosen mode, so what you see matches what lands in Discord.

**Everything that sends a post honours the choice:** Publish now, Send test to channel,
and scheduled auto-delivery.

**Rules and limits shown in the UI:**
- Up to 10 pictures per message.
- Each file up to 8 MB (Discord's limit for normal servers); larger files fall back to the
  link method with a clear note.
- Pictures pasted as an external link (not uploaded to your Media library) can't be
  uploaded to Discord and keep using the embed-image method automatically.

Existing posts keep working unchanged; they default to the current embed-image behaviour.

## Technical notes

- `posts` gets a `media_mode` column (`'upload' | 'embed'`, default `'embed'` so existing
  rows are untouched); `Post` type, mappers and `postToRow` carry it through.
- `discord.server.ts`:
  - `buildDiscordPayload` takes the mode; in `upload` mode attachments are excluded from
    embeds and referenced as `attachment://<filename>` only if the user placed one in the
    embed image slot.
  - New `sendDiscordMessageWithFiles(token, channelId, payload, files)` posts
    `multipart/form-data` with `payload_json` plus `files[n]`, replacing the JSON-only call
    when files are present.
  - Files are read server-side from the private `media` storage bucket via `supabaseAdmin`
    (`storage.from('media').download(storagePath)`), so nothing depends on a public URL.
    Attachments whose `media_assets` row has no `storage_path` (external links) stay on the
    link path.
- `deliverPost` and `sendTestMessage` resolve the attachment URLs back to
  `media_assets.storage_path` rows scoped to the post's org before downloading.
- Composer: segmented control bound to `post.mediaMode`; `DiscordPreview` renders native
  attachment style (image below the message, no embed frame) when mode is `upload`.
