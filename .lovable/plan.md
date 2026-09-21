# Fix: "Upload to Discord" silently falls back to the embed card

## What's happening

Your 20K post was set to **Upload to Discord**, and it did send — but the picture
arrived as the old framed embed image instead of a real Discord upload.

Reason: the app refuses to upload any picture bigger than 8 MB, and your picture is
10.4 MB. When a picture is too big it quietly switches back to the embed method, so
nothing tells you why the result looks wrong.

Discord's real limit for normal servers is 10 MiB (10,485,760 bytes) — your picture
fits. The 8 MB cut-off in the app is simply out of date.

## What I'll change

1. Raise the upload size limit to Discord's actual 10 MiB, so pictures like yours are
   sent as real uploads.
2. Stop the silent fallback: if a picture genuinely can't be uploaded (too big, or it
   was added as an outside link), the post still sends but you get a clear note saying
   which picture fell back and why — shown on the post and in its history.
3. Keep the Media library limit aligned with Discord's, and show the correct limit in
   the post creator's hint (currently says 8 MB).
4. Re-send your existing 20K post as a test so we can confirm the picture lands as a
   native Discord image, like your reference screenshot.

## Technical notes

- `MAX_UPLOAD_BYTES` in `src/lib/discord.server.ts`: `8 * 1024 * 1024` → `10 * 1024 * 1024`
  (10 MiB, Discord's unboosted per-message limit).
- `resolveUploadFiles` returns a `skipped: { url, reason }[]` alongside `files`/`leftovers`,
  distinguishing "no stored file (external link)", "too large", and "download failed".
- `deliverPost` appends those reasons to `failure_reason` / the `post_audit` note on
  success, e.g. `Delivered to #bot-test — 1 picture sent as embed image (over 10 MB)`.
- Composer media hint text and `media.tsx` client-side validation both use one shared
  constant so the UI and server agree.
- Verify by calling `publishPost` for post `08e4c9ec-…` and inspecting the delivered
  Discord message for `attachments[]` rather than `embeds[].image`.
