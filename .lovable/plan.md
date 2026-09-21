# Fix normal-user access to Team and admin information

## Confirmed cause

The screenshot shows the signed-in account marked **Normal User** in the member table while the sidebar treats the same session as **Super Admin**. The workspace membership query currently reads every membership visible in the organization, deduplicates by workspace, and takes the first row’s role instead of filtering to the signed-in user. The database policy allows every organization member to read all membership rows, and the profile policy currently allows every signed-in user to read every profile, including email addresses.

## Changes

1. **Derive identity only from the signed-in user**
   - Filter the workspace membership lookup by the authenticated user ID.
   - Never calculate the current role from another member’s row.
   - Keep workspace deduplication without allowing row order to determine permissions.

2. **Separate safe member display from team management data**
   - Normal Users and Approvers receive only the limited author information needed on posts and audit entries: display name and avatar.
   - Emails, roles, invitations, and the complete member roster are returned only to Super Admins and Admins through an authenticated, server-verified action.
   - Do not expose another member’s email through the general profile query.

3. **Tighten database access**
   - Replace the broad organization-member read policy with self-read plus Admin/Super Admin roster access.
   - Replace the global profile read policy with self-read and verified organization-admin access.
   - Add a narrowly scoped safe-directory function for shared display names if needed by post and audit screens; it will not return emails or roles.
   - Preserve existing server-side protections that prevent Normal Users and Approvers from changing roles or removing members.

4. **Lock the Team page and navigation**
   - Hide **Team & Roles** for Normal Users and Approvers.
   - Block direct `/team` access with a restricted screen or dashboard redirect.
   - Ensure role selectors, removal controls, invitation controls, and the permission matrix never render for unauthorized roles.

5. **Verify the security boundary**
   - Test as a Normal User: sidebar reports Normal User, Team is absent, `/team` is blocked, admin email/role data cannot be queried, and role-change calls are denied.
   - Test as an Approver with the same restrictions.
   - Test as Admin: member management works except changes to Super Admin accounts.
   - Test as Super Admin: full team management remains available.
   - Confirm ordinary post and audit screens still show safe author names without exposing email addresses.

## Technical details

- Keep authorization based on the authenticated session subject, never a client-supplied user ID.
- Use an additive database migration for policies/functions and refresh generated database types.
- Re-run the database security scan, build checks, and signed-in desktop/mobile route tests after the change.
