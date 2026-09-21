import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/publish-due")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PUBLISH_CRON_SECRET"];
        const provided = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { deliverPost } = await import("@/lib/discord.server");

        const now = new Date();
        const nowIso = now.toISOString();
        // Anything claimed more than 5 minutes ago never finished — allow a retry.
        const staleIso = new Date(now.getTime() - 5 * 60_000).toISOString();

        const { data, error } = await supabaseAdmin
          .from("posts")
          .select("id, claimed_at")
          .eq("status", "scheduled")
          .lte("scheduled_at", nowIso)
          .limit(25);

        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const results = [];
        for (const row of data ?? []) {
          // Claim the row: only one runner can flip claimed_at for this post.
          const claim = supabaseAdmin
            .from("posts")
            .update({ claimed_at: nowIso })
            .eq("id", row.id)
            .eq("status", "scheduled");
          const { data: claimed } = row.claimed_at
            ? await claim.lt("claimed_at", staleIso).select("id")
            : await claim.is("claimed_at", null).select("id");

          if (!claimed?.length) {
            results.push({ id: row.id, ok: false, message: "Already being delivered" });
            continue;
          }

          const result = await deliverPost(row.id);
          if (!result.ok) {
            // Release the claim so a retry is possible after the failure is fixed.
            await supabaseAdmin.from("posts").update({ claimed_at: null }).eq("id", row.id);
          }
          results.push({ id: row.id, ...result });
        }

        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});
