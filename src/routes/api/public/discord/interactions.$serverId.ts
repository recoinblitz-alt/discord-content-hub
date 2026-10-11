import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/discord/interactions/$serverId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const body = await request.text();
        if (!/^[0-9a-f-]{36}$/i.test(params.serverId)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("discord_bot_settings")
          .select("*")
          .eq("server_id", params.serverId)
          .maybeSingle();
        if (!settings?.public_key) return new Response("Not configured", { status: 401 });

        const { verifyDiscordSignature, handleInteraction } = await import(
          "@/lib/discord-interactions.server"
        );
        const valid = await verifyDiscordSignature(
          settings.public_key,
          request.headers.get("x-signature-ed25519"),
          request.headers.get("x-signature-timestamp"),
          body,
        );
        if (!valid) return new Response("Invalid request signature", { status: 401 });

        let interaction: Record<string, unknown>;
        try {
          interaction = JSON.parse(body);
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        try {
          return await handleInteraction(interaction, settings as never);
        } catch (err) {
          console.error("Discord interaction failed", err);
          return Response.json({
            type: 4,
            data: { content: "⚠️ Something went wrong. Try again in a moment.", flags: 64 },
          });
        }
      },
    },
  },
});
