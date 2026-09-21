import {
  emptyEmbed,
  type AuditEntry,
  type Channel,
  type DiscordEmbed,
  type DiscordServer,
  type EmbedButton,
  type MediaAsset,
  type Member,
  type OrgEvent,
  type Organization,
  type Post,
  type Role,
  type Template,
} from "./types";

type Row = Record<string, unknown>;

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);

export function toEmbed(value: unknown): DiscordEmbed {
  const base = emptyEmbed();
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;
  return {
    ...base,
    ...v,
    fields: Array.isArray(v["fields"]) ? (v["fields"] as DiscordEmbed["fields"]) : [],
  } as DiscordEmbed;
}

export function toButtons(value: unknown): EmbedButton[] {
  return Array.isArray(value) ? (value as EmbedButton[]) : [];
}

export function mapOrganization(row: Row): Organization {
  return {
    id: str(row["id"]),
    name: str(row["name"]),
    tag: str(row["kind"], "Workspace"),
    plan: str(row["plan"], "Free"),
  };
}

export function mapMember(row: Row, orgIds: string[]): Member {
  const profile = (row["profile"] ?? {}) as Row;
  const email = str(profile["email"]);
  const name = str(profile["display_name"]) || email.split("@")[0] || "Member";
  return {
    id: str(row["user_id"]),
    orgIds,
    name,
    handle: (email.split("@")[0] ?? name).toLowerCase(),
    role: str(row["role"], "user") as Role,
    avatar:
      str(profile["avatar_url"]) ||
      `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}`,
    email,
  };
}

export function mapServer(row: Row): DiscordServer {
  return {
    id: str(row["id"]),
    orgId: str(row["org_id"]),
    name: str(row["name"]),
    guildId: str(row["guild_id"]),
    icon: str(row["icon_url"]),
    botName: str(row["bot_name"], "Bot"),
    botAvatar: str(row["bot_avatar_url"]),
    connected: row["connected"] === true,
  };
}

export function mapChannel(row: Row): Channel {
  const name = str(row["name"]);
  return {
    id: str(row["id"]),
    serverId: str(row["server_id"]),
    discordId: str(row["discord_id"]),
    name,
    type: /announce|news/i.test(name) ? "announcement" : "text",
    requiresApproval: row["requires_approval"] === true,
  };
}

export function mapPost(row: Row): Post {
  return {
    id: str(row["id"]),
    orgId: str(row["org_id"]),
    serverId: str(row["server_id"]),
    channelId: str(row["channel_id"]),
    authorId: str(row["created_by"]),
    title: str(row["title"], "Untitled post"),
    kind: row["use_embed"] === false ? "message" : "embed",
    content: str(row["content"]),
    embed: toEmbed(row["embed"]),
    buttons: toButtons(row["buttons"]),
    attachments: Array.isArray(row["attachments"]) ? (row["attachments"] as string[]) : [],
    status: str(row["status"], "draft") as Post["status"],
    scheduledAt: typeof row["scheduled_at"] === "string" ? row["scheduled_at"] : null,
    timezone: str(row["timezone"], "UTC"),
    publishedAt: typeof row["published_at"] === "string" ? row["published_at"] : null,
    deliveryNote: typeof row["failure_reason"] === "string" ? row["failure_reason"] : null,
    revision: typeof row["revision"] === "number" ? row["revision"] : 1,
    createdAt: str(row["created_at"]),
    updatedAt: str(row["updated_at"]),
  };
}

export function postToRow(post: Post) {
  return {
    org_id: post.orgId,
    server_id: post.serverId || null,
    channel_id: post.channelId || null,
    title: post.title,
    content: post.content,
    use_embed: post.kind === "embed",
    embed: post.embed as unknown as never,
    buttons: post.buttons as unknown as never,
    attachments: post.attachments as unknown as never,
    status: post.status,
    scheduled_at: post.scheduledAt,
    timezone: post.timezone,
  };
}

export function mapAudit(row: Row): AuditEntry {
  const note = typeof row["note"] === "string" && row["note"] ? row["note"] : undefined;
  return {
    id: str(row["id"]),
    postId: str(row["post_id"]),
    actorId: str(row["actor_id"]),
    action: str(row["action"], "updated") as AuditEntry["action"],
    ...(note ? { note } : {}),
    at: str(row["created_at"]),
  };
}

export function mapTemplate(row: Row): Template {
  return {
    id: str(row["id"]),
    orgId: str(row["org_id"]),
    name: str(row["name"]),
    category: str(row["category"], "General"),
    description: str(row["description"]),
    kind: row["use_embed"] === false ? "message" : "embed",
    content: str(row["content"]),
    embed: toEmbed(row["embed"]),
    buttons: toButtons(row["buttons"]),
    uses: typeof row["uses"] === "number" ? row["uses"] : 0,
  };
}

export function mapMedia(row: Row): MediaAsset {
  return {
    id: str(row["id"]),
    orgId: str(row["org_id"]),
    name: str(row["name"]),
    url: str(row["url"]),
    kind: str(row["kind"], "banner") as MediaAsset["kind"],
    tags: [],
    addedAt: str(row["created_at"]),
  };
}

export function mapEvent(row: Row): OrgEvent {
  return {
    id: str(row["id"]),
    orgId: str(row["org_id"]),
    title: str(row["title"], "Untitled event"),
    description: str(row["description"]),
    startsAt: str(row["starts_at"]),
    endsAt: row["ends_at"] ? str(row["ends_at"]) : null,
    timezone: str(row["timezone"], "UTC"),
    color: str(row["color"], "#5865F2"),
    createdBy: row["created_by"] ? str(row["created_by"]) : null,
  };
}
