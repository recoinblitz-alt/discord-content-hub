import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/publish-due")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { deliverPost } = await import("@/lib/discord.server");

        const { data, error } = await supabaseAdmin
          .from("posts")
          .select("id")
          .eq("status", "scheduled")
          .lte("scheduled_at", new Date().toISOString())
          .limit(25);

        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const results = [];
        for (const row of data ?? []) {
          const result = await deliverPost(row.id);
          results.push({ id: row.id, ...result });
        }

        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});
