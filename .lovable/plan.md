# Upload images from your computer in the Media library

Right now the Media library only accepts an image address you paste in. This adds real uploading from your device.

## What changes for you

- The "Add asset" panel gets two ways to add an image: **Upload from computer** or **Paste a link**.
- Uploading: click the drop zone or drag an image onto it. You can also pick several images at once — each becomes its own library asset.
- The file name is used as the asset name automatically; you can edit it before saving.
- You see the picture straight away, plus a progress indicator while it uploads and a clear message if the file is too large or not an image.
- Only images up to 10 MB (PNG, JPG, GIF, WebP) are accepted, which keeps them inside Discord's own limits.
- Uploaded pictures get a permanent public web address, so they work in Discord embeds exactly like linked images.
- Removing an asset from the library also deletes the uploaded file, so nothing is left behind.
- Each workspace's uploads are kept separate; anyone in the workspace can add images, and admins or the person who uploaded it can delete.

## Technical notes

- New public storage bucket `media` (10 MB per-file limit), created with the storage bucket tool.
- RLS on `storage.objects` for that bucket, with the object path prefixed by the workspace id (`<org_id>/<uuid>.<ext>`):
  - public `SELECT` so Discord can fetch the image;
  - `INSERT`/`UPDATE`/`DELETE` restricted to authenticated users who are members of the workspace named in the first path segment, via the existing `is_org_member` helper.
- Upload happens in the browser with `supabase.storage.from('media').upload(...)`, then `getPublicUrl` feeds the existing `addMedia` action, so no new server function is needed.
- `media_assets` gains a nullable `storage_path` column so deletion can remove the stored object; assets added by link leave it empty and are unaffected.
- `removeMedia` in the store deletes the storage object first when a path exists, then the row.
- Client-side validation on MIME type and size before upload, with per-file toasts on failure and a batch summary on success.
