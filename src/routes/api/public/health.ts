import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        if (!url || !key) {
          return Response.json(
            { ok: false, service: "muno", database: "not_configured", invitations: "unavailable" },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }

        const client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error } = await client.rpc("get_org_invite_preview", { _token: "health-check" });
        const ready = !error;
        return Response.json(
          {
            ok: ready,
            service: "muno",
            database: ready ? "connected" : "unavailable",
            invitations: ready ? "ready" : "migration_required",
            time: new Date().toISOString(),
          },
          { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
