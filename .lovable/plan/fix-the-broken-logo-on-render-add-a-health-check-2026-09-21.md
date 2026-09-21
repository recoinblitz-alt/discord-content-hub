# Fix the broken logo on Render + add a health check

## Why the logo is broken

The logo is not stored with the app. It points to an address that only exists on Lovable's own hosting (`/__l5e/assets-v1/...`). On your Render site that address returns nothing, so the browser shows the broken-image placeholder with the "MUNO" alt text — exactly what your screenshot shows. The small tab icons work because those are real files inside the project.

## What I'll change

1. **Ship the logo as a real file in the app.**
   - Save the octopus logo as a real image file inside the project (a compact PNG, trimmed to the logo, no giant 1.3 MB original).
   - Update the shared logo component to use that file so it renders identically on the preview, Render, and any future host.
   - Remove the Lovable-hosted pointer so nothing can fall back to it.
   - Affected places, all via the one shared component: landing page, sign-in page, sidebar, mobile header, legal pages.

2. **Add a health check endpoint.**
   - New endpoint `GET /api/public/health` returning a small JSON payload (`{"ok":true,...}` with a timestamp) and HTTP 200.
   - It will not render any page, so Render's checks answer instantly and stop triggering the "SSR stream transform exceeded maximum lifetime" cleanup notices you saw in the logs.
   - Update the Render blueprint's health check path to this endpoint, and note it in the README.
   - You will also need to set **Health Check Path** to `/api/public/health` in your Render service settings (the blueprint value only applies to blueprint-created services).

## Verification

- Confirm the logo image loads (HTTP 200) and renders on the landing, sign-in, and legal pages in the preview.
- Call `/api/public/health` and confirm it returns 200 JSON.
- Typecheck and build clean.

## Technical notes

- `src/components/brand-logo.tsx` switches from the `.asset.json` pointer to a bundled asset import so Vite emits a hashed file into the build output.
- Health route: `src/routes/api/public/health.ts` using `createFileRoute` with a `server.handlers.GET` returning `Response.json(...)` plus `cache-control: no-store`; under `api/public/*` so it needs no auth.
- `render.yaml`: `healthCheckPath: /api/public/health`.
