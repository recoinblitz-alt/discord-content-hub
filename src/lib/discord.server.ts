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

interface PostLike {
  content: string;
  use_embed: boolean;
  embed: Record<string, unknown> | null;
  buttons: unknown;
  attachments: unknown;
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

  // Attachments render as real images: fill the main embed's image slot when it's
  // free, then add extra image-only embeds (Discord allows up to 10 per message).
  const attachments = (Array.isArray(post.attachments) ? (post.attachments as string[]) : [])
    .filter((url) => typeof url === "string" && /^https?:\/\//i.test(url));
  if (attachments.length) {
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
    const messageId = await sendDiscordMessage(
      secret.bot_token,
      channel.discord_id,
      buildDiscordPayload(post as never),
    );
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
