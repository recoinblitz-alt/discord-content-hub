const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Base URL that outside services (Discord, browsers) can reach.
 *
 * The editor preview hosts (`<id>.lovableproject.com`, `id-preview--<id>.lovable.app`)
 * require a signed-in workspace member, so image links built from them are refused
 * with 401. The stable `project--<id>-dev.lovable.app` host is public.
 */
export function publicBaseUrl(): string {
  const configured = import.meta.env["VITE_PUBLIC_SITE_URL"];
  if (configured) return String(configured).replace(/\/+$/, "");

  if (typeof window === "undefined") return "";
  const host = window.location.hostname;

  const gated =
    new RegExp(`^(${UUID})\\.lovableproject\\.com$`, "i").exec(host) ??
    new RegExp(`^id-preview--(${UUID})\\.lovable\\.app$`, "i").exec(host) ??
    new RegExp(`^(?:.*--)?(${UUID})\\.lovableproject\\.com$`, "i").exec(host);

  if (gated?.[1]) return `https://project--${gated[1].toLowerCase()}-dev.lovable.app`;

  return window.location.origin;
}

/** Public URL for a stored library image. */
export function publicMediaUrl(storagePath: string): string {
  return `${publicBaseUrl()}/api/public/media/${storagePath}`;
}
