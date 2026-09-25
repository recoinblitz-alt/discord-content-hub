# MUNO

Discord content planning, approval, scheduling, and bot delivery built with TanStack Start, React, and Supabase.

## Local development

```sh
bun install
cp .env.example .env.local
bun run dev
```

## Deploy to Render with Supabase

1. Create a Supabase project and copy `.env.example` values into Render's environment settings. Keep `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_DB_MIGRATION_URL`, and `PUBLISH_CRON_SECRET` private.
2. Generate one strong random `PUBLISH_CRON_SECRET`. Enter the identical value for the web service and cron service.
3. Connect this repository in Render and choose **Blueprint**. Render reads `render.yaml`, migrates the database, builds the Node server, and creates the scheduled publisher.
4. Set the cron service's `APP_URL` to the final Render web-service URL, for example `https://relaystack.onrender.com`.
5. In Supabase Authentication URL settings, set the Site URL to the Render URL and add these redirect URLs:
   - `https://YOUR-SERVICE.onrender.com/auth`
   - `https://YOUR-SERVICE.onrender.com/reset-password`
   - `https://YOUR-SERVICE.onrender.com/invite/**`
6. Deploy again after changing any `VITE_` value because those values are embedded during the browser build.

The Blueprint uses:

- Build: `npm install && npm run build:render`
- Migration: `npm run db:migrate`
- Start: `npm run start`
- Health check: `/api/public/health` (returns `{"ok":true,...}`)
- Scheduled publishing: `POST /api/public/publish-due` every minute

### cron-job.org setup

If cron-job.org runs the publisher instead of Render's cron service, configure one job with:

- URL: `https://muno-pea2.onrender.com/api/public/publish-due`
- Method: `POST`
- Schedule: every minute
- Header name: `Authorization`
- Header value: `Bearer YOUR_RENDER_PUBLISH_CRON_SECRET`
- Body: empty

`YOUR_RENDER_PUBLISH_CRON_SECRET` must be the exact value saved as `PUBLISH_CRON_SECRET` on the Render web service. A missing or different value returns `401 Unauthorized`. This is an independent shared secret, not a Lovable API key.

Render's Blueprint uses Node.js and npm, so no Bun runtime is required in production.

## Manual production commands

```sh
npm run db:migrate
npm run build:render
npm run start
```

The server respects Render's `PORT` automatically. Never expose the service-role key or scheduler secret with a `VITE_` prefix.