# Fix ID columns in the export + let admins create templates

## 1. Long IDs showing as 1.31287E+17

Discord user IDs and role IDs are 18-19 digit numbers. Spreadsheet apps guess
they are numbers and collapse them into scientific notation, which loses digits.

Fix: write every ID column in the exports as text so the full digits always
show — user IDs, role IDs, and the role-ID list. Opening the file in Excel,
Google Sheets or Numbers then shows `1312876...` in full. This applies to both
files (members and roles) and needs no re-export setup — just download again
after the change.

## 2. Templates: empty, and no way to add one

The Template library only displays templates; nothing can create them, so it
stays empty. Add creation restricted to Admin / Super Admin, with every member
of the workspace able to see and use whatever gets added.

**On the Template library screen**
- "New template" button, visible only to Admin and Super Admin.
- Dialog with: name, short description, category (Tournament, Giveaway, Patch
  Notes, Event, AMA, General — plus free text), message type (plain message or
  embed card), message text, and for embeds: title, description, colour,
  footer. Live Discord preview inside the dialog so the author sees the result.
- Edit and Delete on each card for Admin / Super Admin only.
- Creators and Approvers see the same list read-only with the existing "Use"
  button — no create/edit/delete controls.
- Friendly empty state explaining that admins add templates, instead of a blank
  grid.

**From the Post Creator**
- "Save as template" button (Admin / Super Admin only) that captures whatever
  is currently in the editor — text, embed, buttons — and asks only for a name,
  description and category. This is the fastest path to filling the library.

Placeholders in double braces (e.g. `{{prize}}`) keep working: they are stored
as written and filled in when someone builds a post from the template.

## Technical notes

- CSV: quote ID cells and prefix with a tab-free text guard in `src/lib/csv.ts`
  (per-column `asText` marking), used by the exports in
  `src/routes/_authenticated/settings.tsx`.
- Templates: `saveTemplate` / `removeTemplate` already exist in
  `src/lib/store.tsx`; add an `updateTemplate` action. Gate UI on
  `permissions.configureServers` (true for admin + super_admin only). Existing
  RLS already allows org members to read and admins/creators to write, so no
  migration is needed.
- New `src/components/template-dialog.tsx` shared by templates.tsx and
  composer.tsx.
