# Mobile optimization plan

## Goal
Make MUNO comfortable to use on phones, enforce each role’s responsibilities at the database boundary, and provide secure email-based invitations without duplicate workspaces.

## Confirmed mobile issues
- The top navigation is a long horizontal strip with important destinations off-screen and no clear menu affordance.
- The Post Creator is 592px wide on a 394px viewport, causing horizontal overflow and clipped primary actions.
- Posts and Team use desktop tables; columns and row actions are clipped on phones.
- Calendar controls compete for one row, the page title truncates, and month cells are too narrow for useful content.
- Several page headers truncate subtitles or crowd primary actions.

## Confirmed access and invitation issues
- Team & Roles is reachable by Normal Users and Approvers even though they must not manage membership.
- The role selector is disabled in the screen for unauthorized users, but role updates are still performed directly from the browser; the database rule currently lets an Admin update any membership, including a Super Admin or their own role.
- Admins can currently assign `super_admin` because the same four-role list is shown to every manager.
- Invitation creation only returns a link; it does not send an email.
- Acceptance checks `accepted_at` and membership insertion in separate operations, so simultaneous reuse is not atomic.
- Invitation continuation depends on browser-local state. When an email opens on another browser/origin, the invite context can be lost and the new user can be prompted to create a separate workspace before joining.
- No custom sender domain is configured. Built-in account emails can use the default sender; branded MUNO email requires a domain owned by the project owner.

## Changes

### 1. Mobile app navigation and page headers
- Replace the horizontal mobile navigation strip with a compact menu/drawer containing all destinations, active state, workspace selector, user role, theme switch, and sign-out.
- Keep the MUNO logo and current page readily visible while reducing the sticky header height.
- Rework page title/action rows with a two-column mobile-safe grid, `min-w-0` text containers, and fixed-size actions; stack actions only when their labels cannot fit.
- Preserve the existing desktop sidebar at large widths.

### 2. Post Creator
- Remove the fixed/minimum widths causing horizontal overflow.
- Make Save, Save as template, Submit, and status controls fit through compact labels or an overflow action menu on narrow screens.
- Stack destination, message, embed, media, scheduling, and approval inputs cleanly at phone width.
- Keep the Discord preview full-width and place it after the editor on mobile while retaining the two-column desktop layout.
- Ensure field rows, button-link editors, colour controls, and media selectors wrap without clipping.

### 3. Data-heavy screens
- Render Posts as compact mobile cards with title, destination, author, status, schedule, delivery note, retry, edit, and delete actions; retain the table on wider screens.
- Render Team members as mobile cards and make the permission matrix horizontally scrollable with a visible first column; retain desktop tables.
- Check member export, server/channel management, audit entries, approvals, templates, and media actions for full-width controls and touch-friendly wrapping.

### 4. Calendar
- Stack date navigation, view switcher, content switcher, and filters into clear mobile rows.
- Default the phone presentation to the useful list view while preserving the user's selected Month/Week/List mode during the session.
- Make Month view intentionally horizontally scrollable with stable day widths rather than squeezing seven unreadable columns into the screen.
- Turn Week view into a vertical day agenda on phones.
- Make event dialogs fit the viewport with scrollable content and persistent save/cancel actions.

### 5. Shared mobile polish
- Use consistent 16–20px page gutters, 44px minimum touch targets, safe text wrapping, and stable control sizes.
- Prevent long workspace, server, channel, post, member, and template names from pushing controls off-screen.
- Keep legal links and empty states readable without excessive vertical gaps.
- Preserve reduced-motion preferences and use only short, smooth menu/view transitions.

### 6. Enforce roles and responsibilities
- Define one authoritative role matrix and use it consistently in navigation, page gates, actions, server functions, and database policies:
  - **Super Admin:** all capabilities; appoint/remove Admins and other Super Admins; manage organizations.
  - **Admin:** create, approve, publish, configure bots/channels, invite users, and manage Admin/Approver/Normal User memberships; cannot grant, demote, remove, or modify a Super Admin.
  - **Approver:** create/edit posts and review, approve, reject, or request changes; cannot publish directly, manage bots, members, roles, or organizations.
  - **Normal User:** create/edit their own drafts and submit for approval; cannot approve, publish directly, view Team & Roles, manage templates, bots, channels, members, roles, or organizations.
- Hide unauthorized navigation items and add hard page-level access gates so typing a protected URL does not reveal that screen.
- Replace direct browser role/removal writes with authenticated server actions that re-check the caller’s current role.
- Replace the broad membership update/delete policies so Admins cannot alter Super Admin rows, grant `super_admin`, change their own role, or remove themselves; protect the last Super Admin from demotion/removal.
- Restrict shared template creation/edit/delete to Admin and Super Admin at both the screen and database levels while keeping template use available to permitted post creators.
- Review post update/publish/approval paths so each status transition follows the matrix even when called outside the visible screen.

### 7. Email invitation and password setup
- Make Create invite send a real account invitation email to the entered address and still show a copyable fallback link.
- Carry the invitation token through the email callback itself instead of relying only on local browser storage.
- For a new invitee: open the invitation, verify the invited email, choose a new password, then accept the membership and enter the invited workspace.
- For an existing account: verify the signed-in email matches, accept once, and enter the workspace without creating another account.
- Never show the create-workspace screen while a valid invitation is being completed.
- Keep invite roles limited by inviter: Admins may invite Admin, Approver, or Normal User; only Super Admins may invite another Super Admin.
- Use the built-in account-email sender initially. If branded MUNO sender/from-address styling is required, complete sender-domain setup before adding branded templates.

### 8. Idempotent invite acceptance and duplicate cleanup
- Move invite consumption into one atomic database operation that locks/claims the invitation, verifies the exact authenticated email, upserts the membership, and marks the invite accepted once.
- Treat reopening an already accepted link by the same user as success and route to the existing workspace; reject reuse by any other account.
- Deduplicate organization entries by organization ID before rendering and invalidate membership data after acceptance.
- Add a safe one-time cleanup for any duplicate memberships or accidentally created empty personal workspaces only after identifying them; never merge or delete active organizations automatically.
- Show explicit states for expired, wrong-email, already-accepted, and successful invitations.

## Verification
- Test every public and signed-in screen at 360×640, 394×720, and 430×932, plus one desktop viewport.
- Confirm no unintended page-level horizontal overflow; only explicitly scrollable tables/calendar regions may scroll sideways.
- Exercise navigation, Post Creator actions and preview, filters, calendar modes/dialog, templates, media upload, team roles, exports, and server controls.
- Check the preview for runtime errors and confirm the project builds successfully.
- Test Super Admin, Admin, Approver, and Normal User accounts against both visible controls and direct protected actions.
- Confirm an Admin cannot modify a Super Admin, grant Super Admin, change their own role, or remove themselves; confirm the last Super Admin is protected.
- Send an invitation to a fresh address, verify the email, set a password, join the correct workspace, and confirm no extra workspace appears.
- Open the same invitation twice and concurrently; confirm one membership and one organization entry only.
- Test a wrong signed-in email and confirm it cannot accept the invitation.

## Technical scope
Frontend mobile layout plus authorization, membership policies, invitation onboarding, and account email delivery. Discord delivery, exports, existing content, and desktop workflows remain unchanged.
