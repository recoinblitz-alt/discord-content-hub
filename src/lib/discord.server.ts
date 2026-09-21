const API = "https://discord.com/api/v10";

export interface DiscordError extends Error {
  status?: number;
}

async function discordFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = await res.text();
    try {
      const parsed = JSON.parse(detail) as { message?: string };
      if (parsed.message) detail = parsed.message;
    } catch {
      /* keep raw text */
    }
    const error = new Error(detail || `Discord error ${res.status}`) as DiscordError;
    error.status = res.status;
    throw error;
  }
  return res.status === 204 ? null : ((await res.json()) as unknown);
}

export interface BotIdentity {
  id: string;
  username: string;
  avatarUrl: string;
}

export interface BotGuild {
  id: string;
  name: string;
  iconUrl: string;
}

export interface BotChannel {
  id: string;
  name: string;
  type: number;
}

export async function fetchBotIdentity(token: string): Promise<BotIdentity> {
  const me = (await discordFetch(token, "/users/@me")) as {
    id: string;
    username: string;
    avatar: string | null;
  };
  return {
    id: me.id,
    username: me.username,
    avatarUrl: me.avatar
      ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/0.png`,
  };
}

export async function fetchBotGuilds(token: string): Promise<BotGuild[]> {
  const guilds = (await discordFetch(token, "/users/@me/guilds")) as {
    id: string;
    name: string;
    icon: string | null;
  }[];
  return guilds.map((g) => ({
    id: g.id,
    name: g.name,
    iconUrl: g.icon
      ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`
      : "",
  }));
}

/** Text-like channels the bot can post in: text (0), announcement (5), thread-capable forums excluded. */
export async function fetchGuildChannels(token: string, guildId: string): Promise<BotChannel[]> {
  const channels = (await discordFetch(token, `/guilds/${guildId}/channels`)) as {
    id: string;
    name: string;
    type: number;
  }[];
  return channels
    .filter((c) => c.type === 0 || c.type === 5)
    .map((c) => ({ id: c.id, name: c.name, type: c.type }));
}

const colorToInt = (hex: string) => {
  const clean = hex.replace("#", "").trim();
  const value = Number.parseInt(clean.length === 3 ? clean.repeat(2).slice(0, 6) : clean, 16);
  return Number.isNaN(value) ? 0x5865f2 : value;
};

const BUTTON_STYLE: Record<string, number> = {
  primary: 1,
  secondary: 2,
  success: 3,
  danger: 4,
  link: 5,
};

export interface PostLike {
  content: string;
  use_embed: boolean;
  embed: Record<string, unknown> | null;
  buttons: unknown;
  attachments: unknown;
  media_mode?: string | null;
}

export function buildDiscordPayload(post: PostLike) {
  const payload: Record<string, unknown> = {};
  const content = (post.content ?? "").trim();
  if (content) payload["content"] = content;

  if (post.use_embed && post.embed) {
    const e = post.embed as Record<string, any>;
    const embed: Record<string, unknown> = { color: colorToInt(String(e["color"] ?? "#5865F2")) };
    if (e["title"]) embed["title"] = e["title"];
    if (e["titleUrl"]) embed["url"] = e["titleUrl"];
    if (e["description"]) embed["description"] = e["description"];
    if (e["authorName"]) {
      embed["author"] = {
        name: e["authorName"],
        ...(e["authorIcon"] ? { icon_url: e["authorIcon"] } : {}),
      };
    }
    if (e["thumbnail"]) embed["thumbnail"] = { url: e["thumbnail"] };
    if (e["image"]) embed["image"] = { url: e["image"] };
    if (e["footerText"]) {
      embed["footer"] = {
        text: e["footerText"],
        ...(e["footerIcon"] ? { icon_url: e["footerIcon"] } : {}),
      };
    }
    if (e["showTimestamp"]) embed["timestamp"] = new Date().toISOString();
    const fields = Array.isArray(e["fields"]) ? e["fields"] : [];
    const usable = fields
      .filter((f: Record<string, unknown>) => f["name"] && f["value"])
      .map((f: Record<string, unknown>) => ({
        name: String(f["name"]),
        value: String(f["value"]),
        inline: f["inline"] === true,
      }));
    if (usable.length) embed["fields"] = usable;
    const hasContent =
      embed["title"] || embed["description"] || embed["fields"] || embed["image"] || embed["author"];
    if (hasContent) payload["embeds"] = [embed];
  }

  // In "upload" mode the files travel with the message as real Discord uploads,
  // so they must not be referenced as embed images here.
  // Otherwise attachments render as embed images: fill the main embed's image slot
  // when free, then add extra image-only embeds (Discord allows up to 10 per message).
  const attachments = (Array.isArray(post.attachments) ? (post.attachments as string[]) : [])
    .filter((url) => typeof url === "string" && /^https?:\/\//i.test(url));
  if (attachments.length && post.media_mode !== "upload") {
    const embeds = (payload["embeds"] as Record<string, unknown>[] | undefined) ?? [];
    const queue = [...attachments];
    const first = embeds[0];
    if (first && !first["image"] && queue[0]) {
      first["image"] = { url: queue.shift() };
    }
    for (const url of queue) {
      if (embeds.length >= 10) break;
      embeds.push({ image: { url } });
    }
    if (embeds.length) payload["embeds"] = embeds;
  }

  const buttons = Array.isArray(post.buttons) ? (post.buttons as Record<string, string>[]) : [];
  const links = buttons.filter((b) => b["label"] && b["url"]);
  if (links.length) {
    payload["components"] = [
      {
        type: 1,
        components: links.slice(0, 5).map((b) => ({
          type: 2,
          style: 5,
          label: String(b["label"]).slice(0, 80),
          url: b["url"],
        })),
      },
    ];
  }

  if (!payload["content"] && !payload["embeds"]) {
    payload["content"] = "(empty message)";
  }
  return payload;
}

export async function sendDiscordMessage(
  token: string,
  channelDiscordId: string,
  payload: Record<string, unknown>,
) {
  const message = (await discordFetch(token, `/channels/${channelDiscordId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  })) as { id: string };
  return message.id;
}

export interface OutgoingFile {
  filename: string;
  blob: Blob;
}

/** Discord's per-message file limit for servers without boosts (10 MiB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Posts a message with real file uploads (multipart/form-data), so images appear
 * as native Discord attachments instead of fetched links.
 */
export async function sendDiscordMessageWithFiles(
  token: string,
  channelDiscordId: string,
  payload: Record<string, unknown>,
  files: OutgoingFile[],
) {
  const form = new FormData();
  form.append("payload_json", JSON.stringify(payload));
  files.slice(0, 10).forEach((file, index) => {
    form.append(`files[${index}]`, file.blob, file.filename);
  });

  const res = await fetch(`${API}/channels/${channelDiscordId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}` },
    body: form,
  });
  if (!res.ok) {
    let detail = await res.text();
    try {
      const parsed = JSON.parse(detail) as { message?: string };
      if (parsed.message) detail = parsed.message;
    } catch {
      /* keep raw text */
    }
    const error = new Error(detail || `Discord error ${res.status}`) as DiscordError;
    error.status = res.status;
    throw error;
  }
  const message = (await res.json()) as { id: string };
  return message.id;
}

/**
 * Turns saved attachment URLs into downloadable files from the private media bucket.
 * URLs without a stored file (external links) or files above Discord's limit are
 * returned as `leftovers` and fall back to the embed-image method.
 */
export async function resolveUploadFiles(orgId: string, urls: string[]) {
  const files: OutgoingFile[] = [];
  const leftovers: string[] = [];
  const skipped: { url: string; reason: string }[] = [];
  if (!urls.length) return { files, leftovers, skipped };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: assets } = await supabaseAdmin
    .from("media_assets")
    .select("url, name, storage_path")
    .eq("org_id", orgId)
    .in("url", urls);

  const fallback = (url: string, reason: string) => {
    leftovers.push(url);
    skipped.push({ url, reason });
  };

  for (const url of urls) {
    const asset = assets?.find((a) => a.url === url);
    if (!asset?.storage_path) {
      fallback(url, "added as a link, not an uploaded file");
      continue;
    }
    if (files.length >= 10) {
      fallback(url, "more than 10 pictures in one message");
      continue;
    }
    const { data: blob, error } = await supabaseAdmin.storage
      .from("media")
      .download(asset.storage_path);
    if (error || !blob) {
      fallback(url, "the stored file could not be read");
      continue;
    }
    if (blob.size > MAX_UPLOAD_BYTES) {
      fallback(url, "over Discord's 10 MB limit");
      continue;
    }
    const ext = asset.storage_path.split(".").pop() ?? "png";
    const base = (asset.name || "image").replace(/[^a-z0-9._-]+/gi, "-").slice(0, 60);
    const filename = base.toLowerCase().endsWith(`.${ext.toLowerCase()}`) ? base : `${base}.${ext}`;
    files.push({ filename, blob });
  }
  return { files, leftovers, skipped };
}

export interface GuildRole {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface GuildMemberRow {
  userId: string;
  username: string;
  globalName: string;
  displayName: string;
  isBot: boolean;
  joinedAt: string;
  roleIds: string[];
  roleNames: string[];
}

const MEMBERS_INTENT_HINT =
  "Discord refused the member list. Open the Discord Developer Portal, pick this bot, and switch on \"Server Members Intent\" under Bot → Privileged Gateway Intents, then try again.";

export async function fetchGuildRoles(token: string, guildId: string): Promise<GuildRole[]> {
  const roles = (await discordFetch(token, `/guilds/${guildId}/roles`)) as {
    id: string;
    name: string;
    color: number;
    position: number;
  }[];
  return roles
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: `#${(r.color ?? 0).toString(16).padStart(6, "0")}`,
      position: r.position,
    }))
    .sort((a, b) => b.position - a.position);
}

/** Pages through every member of a guild (1000 per request). */
export async function fetchGuildMembers(token: string, guildId: string) {
  const roles = await fetchGuildRoles(token, guildId);
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const members: GuildMemberRow[] = [];
  let after = "0";

  try {
    for (let page = 0; page < 200; page += 1) {
      const batch = (await discordFetch(
        token,
        `/guilds/${guildId}/members?limit=1000&after=${after}`,
      )) as {
        user: { id: string; username: string; global_name?: string | null; bot?: boolean };
        nick?: string | null;
        joined_at: string;
        roles: string[];
      }[];
      if (!Array.isArray(batch) || batch.length === 0) break;
      for (const m of batch) {
        members.push({
          userId: m.user.id,
          username: m.user.username,
          globalName: m.user.global_name ?? "",
          displayName: m.nick || m.user.global_name || m.user.username,
          isBot: m.user.bot === true,
          joinedAt: m.joined_at,
          roleIds: m.roles ?? [],
          roleNames: (m.roles ?? []).map((id) => roleName.get(id) ?? id),
        });
      }
      const last = batch[batch.length - 1];
      if (!last) break;
      after = last.user.id;
      if (batch.length < 1000) break;
    }
  } catch (err) {
    const status = (err as DiscordError).status;
    if (status === 403 || status === 401) throw new Error(MEMBERS_INTENT_HINT);
    throw err;
  }

  return { members, roles };
}

export { BUTTON_STYLE };

/**
 * Sends a stored post to Discord and records the outcome.
 * Used by the manual publish server function and the scheduled publisher.
 */
export async function deliverPost(postId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: post, error } = await supabaseAdmin
    .from("posts")
    .select("*")
    .eq("id", postId)
    .single();
  if (error || !post) return { ok: false, message: "Post not found" };
  if (!post.channel_id) return { ok: false, message: "No channel selected" };

  const { data: channel } = await supabaseAdmin
    .from("channels")
    .select("discord_id, name, server_id")
    .eq("id", post.channel_id)
    .single();
  if (!channel) return { ok: false, message: "Channel is no longer connected" };

  const { data: secret } = await supabaseAdmin
    .from("server_secrets")
    .select("bot_token")
    .eq("server_id", channel.server_id)
    .single();
  if (!secret?.bot_token) return { ok: false, message: "This server has no bot token saved" };

  try {
    const urls = Array.isArray(post.attachments) ? (post.attachments as string[]) : [];
    const wantsUpload = (post as { media_mode?: string | null }).media_mode === "upload";
    const { files, leftovers, skipped } = wantsUpload
      ? await resolveUploadFiles(post.org_id, urls)
      : { files: [] as OutgoingFile[], leftovers: urls, skipped: [] as { url: string; reason: string }[] };
    const skipNote = skipped.length
      ? ` — ${skipped.length} picture${skipped.length > 1 ? "s" : ""} sent as embed image instead (${[
          ...new Set(skipped.map((s) => s.reason)),
        ].join("; ")})`
      : "";

    // Anything that couldn't be uploaded still shows up as an embed image.
    const payload = buildDiscordPayload({
      ...(post as Record<string, unknown>),
      attachments: leftovers,
      media_mode: "embed",
    } as unknown as PostLike);

    const messageId = files.length
      ? await sendDiscordMessageWithFiles(secret.bot_token, channel.discord_id, payload, files)
      : await sendDiscordMessage(secret.bot_token, channel.discord_id, payload);
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("posts")
      .update({
        status: "published",
        published_at: now,
        discord_message_id: messageId,
        failure_reason: `Delivered to #${channel.name}`,
        updated_at: now,
      })
      .eq("id", postId);
    await supabaseAdmin.from("post_audit").insert({
      post_id: postId,
      org_id: post.org_id,
      action: "published",
      note: `Delivered to #${channel.name} (message ${messageId})`,
    });
    return { ok: true, message: `Delivered to #${channel.name}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discord rejected the message";
    await supabaseAdmin
      .from("posts")
      .update({ status: "failed", failure_reason: message, updated_at: new Date().toISOString() })
      .eq("id", postId);
    await supabaseAdmin.from("post_audit").insert({
      post_id: postId,
      org_id: post.org_id,
      action: "failed",
      note: message,
    });
    return { ok: false, message };
  }
}
