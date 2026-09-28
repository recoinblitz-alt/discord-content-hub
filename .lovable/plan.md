# Edit posts after they are published

## Goal
Admins and Super Admins can fix a published post (typos, wrong link, wrong image). The fix updates the same message in Discord. No new message is posted.

## What users will see
- A published post opens read-only in the post creator, with an **Edit published post** button. Admins and Super Admins see it on the post page and in the Posts list.
- Clicking it unlocks the text, embed, buttons and images. Server, channel and schedule stay locked, because a message that has been sent can't move.
- **Update in Discord** saves the changes and edits the message in Discord straight away. The preview shows what the new version will look like.
- The post stays **Published** and gets an "Edited" label with the time.
- History records who edited it, when, and an optional reason.
- Normal users and Approvers can't edit published posts. They still see them read-only.
- If the message was deleted in Discord, or the bot has lost access, you get a clear error. The post then offers **Send again as a new message**.

## Rules
- You can only edit posts sent by MUNO. Each post keeps a link to its Discord message.
- The lock stays in place for everything else. The only change allowed on a published post is this admin edit, and every edit is recorded.
- The button is locked while an edit is running, so one click means one edit.

## Technical details
- New server function `editPublishedPost({ postId, patch, note })` (requireSupabaseAuth). It checks the user is admin or super_admin for the post's org, then loads the bot token and `discord_message_id`. It calls Discord `PATCH /channels/{channel}/messages/{message}` with the same payload builder used for delivery. Uploaded images go through a multipart edit using `attachments` and `files[n]`.
- Only after Discord returns 200, the post is updated with the service role: content, embed, buttons, attachments, `revision + 1`, and a new `edited_at` timestamp. It also writes a `post_audit` row with a new `edited` action.
- Migration: add `posts.edited_at timestamptz null`, add `edited` to the audit action check/enum, and have `enforce_post_timing_rules` allow this service-role update path only.
- UI: composer edit mode for published posts, an "Edited" badge in the posts list and history, and `AuditAction` gains `edited`.
- Errors: Discord 404 (Unknown Message) or 403 are shown with a message you can act on, and nothing changes in the database.

## Verification
- Publish a test post, edit its text and embed, and confirm the Discord message changes and no duplicate appears.
- Confirm a Normal User or Approver can't edit, from the screen or by calling the backend directly.
- Delete the message in Discord, then try to edit, and confirm the error and the resend option.
