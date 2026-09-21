import { createFileRoute } from "@tanstack/react-router";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/**
 * Serves a library image from private storage at a stable public URL so Discord
 * (and browsers) can fetch it. Only paths registered in media_assets are served.
 */
export const Route = createFileRoute("/api/public/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = decodeURIComponent(String((params as { _splat?: string })._splat ?? ""));
        if (!path || path.includes("..") || !/^[0-9a-f-]{36}\/[\w.-]+$/i.test(path)) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: asset } = await supabaseAdmin
          .from("media_assets")
          .select("id")
          .eq("storage_path", path)
          .maybeSingle();
        if (!asset) return new Response("Not found", { status: 404 });

        const { data: file, error } = await supabaseAdmin.storage.from("media").download(path);
        if (error || !file) return new Response("Not found", { status: 404 });

        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        return new Response(await file.arrayBuffer(), {
          headers: {
            "Content-Type": CONTENT_TYPES[ext] ?? file.type ?? "application/octet-stream",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
