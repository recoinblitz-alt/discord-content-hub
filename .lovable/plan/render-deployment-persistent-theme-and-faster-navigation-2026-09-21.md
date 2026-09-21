# Render deployment, persistent theme, and faster navigation

## Goal
Prepare Relaystack for deployment as a Render web service connected to an external Supabase project, while preserving light mode and making authenticated page changes feel immediate and smooth.

## Implementation plan

### 1. Make the app Render-ready
- Configure the production build for Nitro's Node server output while preserving the existing local development workflow.
- Add a production start command that runs the generated server and respects Render's host and port.
- Add a Render Blueprint for:
  - the web service;
  - a scheduled worker that calls the protected publish-due endpoint every minute;
  - health checks and the required non-secret/public environment settings.
- Add a safe environment template and deployment guide listing the Supabase URL, publishable key, service-role key, database migration URL, public Vite variables, app URL, and shared scheduler secret. No real secrets will be committed.
- Add migration commands and instructions so the existing schema, row-level access rules, functions, and triggers can be installed in the external Supabase project.
- Document the required Supabase authentication redirect URLs for the Render domain and how to set the same scheduler secret on both Render services.

### 2. Fix light-mode persistence
- Replace the current dark-first theme initialization with a pre-paint theme bootstrap that reads the saved choice before React renders.
- Initialize the theme control from the same stored value so mounting a new page cannot overwrite light mode with dark mode.
- Keep the selected theme stable across internal navigation, refreshes, and browser tab changes without a dark flash.

### 3. Make tab switching fast and smooth
- Move the sidebar and shared navigation chrome into the authenticated parent layout so they remain mounted when changing pages.
- Convert each authenticated page to render only its page header and content inside that persistent layout, preserving its existing title, subtitle, and actions.
- Enable intent-based route preloading and retain preloaded route data briefly instead of treating it as immediately stale.
- Add a restrained page-content transition with reduced-motion support; the sidebar and header will not flicker or slide during navigation.
- Split the current all-in-one organization fetch into cacheable resource queries, or equivalent fine-grained cached slices, so a slow audit/media request does not block unrelated pages.
- Avoid full workspace refetches after small mutations by updating or invalidating only the affected cached resource.
- Fix the current empty image-source warning encountered in preview.

### 4. Verify the deployment path and experience
- Validate type safety and the production Node build output.
- Test direct loading and refreshes of authenticated routes using Render-style server startup.
- Verify light mode through navigation and refresh, and test rapid switching across all sidebar destinations at desktop and mobile widths.
- Confirm sign-in, workspace loading, bot configuration calls, server functions, and the protected scheduled-publishing endpoint use the external Supabase environment correctly.

## Technical notes
- Render will host the TanStack Start Node server; Supabase will provide authentication and the database.
- Public Supabase values are supplied to both the browser build and server. The service-role key and scheduler secret remain server-only.
- The existing Discord bot token storage remains database-backed and is never exposed to the browser.
- The actual external Supabase credentials and Render service URL must be entered in Render/Supabase settings after the code is prepared.
