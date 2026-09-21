# Mobile optimization plan

## Goal
Make MUNO comfortable to use on phones, starting at the current 394×720 view, without changing desktop behavior or business logic.

## Confirmed mobile issues
- The top navigation is a long horizontal strip with important destinations off-screen and no clear menu affordance.
- The Post Creator is 592px wide on a 394px viewport, causing horizontal overflow and clipped primary actions.
- Posts and Team use desktop tables; columns and row actions are clipped on phones.
- Calendar controls compete for one row, the page title truncates, and month cells are too narrow for useful content.
- Several page headers truncate subtitles or crowd primary actions.

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

## Verification
- Test every public and signed-in screen at 360×640, 394×720, and 430×932, plus one desktop viewport.
- Confirm no unintended page-level horizontal overflow; only explicitly scrollable tables/calendar regions may scroll sideways.
- Exercise navigation, Post Creator actions and preview, filters, calendar modes/dialog, templates, media upload, team roles, exports, and server controls.
- Check the preview for runtime errors and confirm the project builds successfully.

## Technical scope
Frontend layout and presentation only. Existing permissions, Discord delivery, data storage, exports, authentication, and desktop workflows remain unchanged.
