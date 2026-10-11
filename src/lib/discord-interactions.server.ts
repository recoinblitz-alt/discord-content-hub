import { discordFetch } from "./discord.server";

const EPHEMERAL = 64;
const ADMINISTRATOR = 8n;

type Json = Record<string, any>;

export interface BotSettings {
  server_id: string;
  org_id: string;
  public_key: string;
  command_channel_id: string | null;
  approval_channel_id: string | null;
  submit_role_ids: string[];
  approve_role_ids: string[];
  timezone: string;
}

/* ---------------- signature ---------------- */

const hexToBytes = (hex: string) => {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
};

export async function verifyDiscordSignature(
  publicKey: string,
  signature: string | null,
  timestamp: string | null,
  body: string,
) {
  if (!publicKey || !signature || !timestamp || !/^[0-9a-f]{64}$/i.test(publicKey.trim())) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      hexToBytes(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      hexToBytes(signature),
      new TextEncoder().encode(timestamp + body),
    );
  } catch {
    return false;
  }
}

/* ---------------- time ---------------- */

function tzOffsetMs(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}

/** Accepts "YYYY-MM-DD HH:mm" or "HH:mm" (today, or tomorrow if already past) in the given timezone. */
export function parseScheduleTime(input: string, timeZone: string): Date | null {
  const text = input.trim();
  let y: number, mo: number, d: number, h: number, mi: number;
  const full = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})$/);
  const short = text.match(/^(\d{1,2}):(\d{2})$/);
  if (full) {
    [y, mo, d, h, mi] = full.slice(1).map(Number) as [number, number, number, number, number];
  } else if (short) {
    const nowParts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .format(new Date())
      .split("-")
      .map(Number) as [number, number, number];
    [y, mo, d] = nowParts;
    [h, mi] = short.slice(1).map(Number) as [number, number];
  } else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let result = guess - tzOffsetMs(guess, timeZone);
  if (short && result <= Date.now()) result += 24 * 60 * 60 * 1000;
  return new Date(result);
}

const formatWhen = (iso: string, timeZone: string) =>
  `<t:${Math.floor(new Date(iso).getTime() / 1000)}:F> (${timeZone})`;

/* ---------------- helpers ---------------- */

const reply = (content: string) =>
  Response.json({ type: 4, data: { content, flags: EPHEMERAL, allowed_mentions: { parse: [] } } });

function memberRoles(interaction: Json): string[] {
  return (interaction.member?.roles as string[] | undefined) ?? [];
}
function isDiscordAdmin(interaction: Json) {
  try {
    return (BigInt(interaction.member?.permissions ?? "0") & ADMINISTRATOR) === ADMINISTRATOR;
  } catch {
    return false;
  }
}
function canApprove(interaction: Json, settings: BotSettings) {
  return isDiscordAdmin(interaction) || memberRoles(interaction).some((r) => settings.approve_role_ids.includes(r));
}
function canSubmit(interaction: Json, settings: BotSettings) {
  return (
    canApprove(interaction, settings) ||
    memberRoles(interaction).some((r) => settings.submit_role_ids.includes(r))
  );
}
const userTag = (interaction: Json) => {
  const u = interaction.member?.user ?? interaction.user ?? {};
  return { id: String(u.id ?? ""), name: String(u.global_name ?? u.username ?? "someone") };
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function botToken(serverId: string) {
  const db = await admin();
  const { data } = await db.from("server_secrets").select("bot_token").eq("server_id", serverId).maybeSingle();
  return data?.bot_token ?? null;
}

function modalValues(interaction: Json) {
  const values: Record<string, string> = {};
  for (const row of interaction.data?.components ?? []) {
    for (const c of row.components ?? []) values[c.custom_id] = String(c.value ?? "");
  }
  return values;
}

/* ---------------- review card ---------------- */

function reviewCard(post: Json, channelName: string, author: string, timeZone: string) {
  return {
    content: "",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: "📋 New post waiting for approval",
        color: 0x5865f2,
        description: String(post.content || "(no text)").slice(0, 3500),
        fields: [
          { name: "Submitted by", value: author, inline: true },
          { name: "Posts to", value: `#${channelName}`, inline: true },
          { name: "When", value: formatWhen(post.scheduled_at, timeZone), inline: false },
        ],
        footer: { text: `MUNO · ${post.id}` },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 3, label: "Approve & schedule", custom_id: `muno:approve:${post.id}` },
          { type: 2, style: 4, label: "Reject", custom_id: `muno:reject:${post.id}` },
        ],
      },
    ],
  };
}

function decidedCard(original: Json | undefined, line: string, color: number) {
  const embed = { ...(original?.embeds?.[0] ?? { title: "MUNO post" }), color };
  embed.fields = [...(embed.fields ?? []), { name: "Decision", value: line.slice(0, 1000) }];
  return { embeds: [embed], components: [], allowed_mentions: { parse: [] } };
}

/* ---------------- submission ---------------- */

async function createSubmission(
  interaction: Json,
  settings: BotSettings,
  channelDiscordId: string,
  timeText: string,
  content: string,
) {
  const db = await admin();
  const when = parseScheduleTime(timeText, settings.timezone);
  if (!when) return reply("⚠️ I couldn't read that time. Use `YYYY-MM-DD HH:mm` (e.g. `2026-10-15 18:30`) or `HH:mm`.");
  if (when.getTime() <= Date.now() + 30_000) return reply("⚠️ That time has already passed. Pick a time in the future.");
  const text = content.trim();
  if (!text) return reply("⚠️ The message is empty.");
  if (text.length > 2000) return reply("⚠️ Discord messages can be at most 2000 characters.");

  const { data: channel } = await db
    .from("channels")
    .select("id, name")
    .eq("server_id", settings.server_id)
    .eq("discord_id", channelDiscordId)
    .maybeSingle();
  if (!channel) return reply("⚠️ That channel isn't synced in MUNO yet. Ask an admin to re-sync channels.");

  const { data: org } = await db.from("organizations").select("created_by").eq("id", settings.org_id).single();
  if (!org) return reply("⚠️ Workspace not found.");

  const who = userTag(interaction);
  const { data: post, error } = await db
    .from("posts")
    .insert({
      org_id: settings.org_id,
      server_id: settings.server_id,
      channel_id: channel.id,
      title: `Discord request from ${who.name}`.slice(0, 200),
      content: text,
      use_embed: false,
      status: "pending",
      scheduled_at: when.toISOString(),
      timezone: settings.timezone,
      created_by: org.created_by,
    })
    .select("*")
    .single();
  if (error || !post) return reply(`⚠️ Couldn't save the request: ${error?.message ?? "unknown error"}`);

  await db.from("post_audit").insert({
    post_id: post.id,
    org_id: settings.org_id,
    actor_id: null,
    action: "submitted",
    note: `Submitted from Discord by ${who.name} (${who.id})`,
  });

  let cardNote = "";
  const token = await botToken(settings.server_id);
  if (token && settings.approval_channel_id) {
    try {
      const msg = (await discordFetch(token, `/channels/${settings.approval_channel_id}/messages`, {
        method: "POST",
        body: JSON.stringify(reviewCard(post, channel.name, `<@${who.id}>`, settings.timezone)),
      })) as { id: string };
      await db.from("posts").update({ discord_review_message_id: msg.id }).eq("id", post.id);
    } catch (err) {
      cardNote = `\n(Couldn't post the approval card: ${err instanceof Error ? err.message : "error"})`;
    }
  } else {
    cardNote = "\nAdmins will review it in MUNO.";
  }
  return reply(
    `✅ Sent for approval — posts to #${channel.name} at ${formatWhen(post.scheduled_at, settings.timezone)} once approved.${cardNote}`,
  );
}

/* ---------------- decisions ---------------- */

async function decide(
  interaction: Json,
  settings: BotSettings,
  postId: string,
  decision: "approve" | "reject",
  reason?: string,
): Promise<{ ok: boolean; message: string; line?: string }> {
  const db = await admin();
  const { data: post } = await db
    .from("posts")
    .select("id, org_id, status, scheduled_at, timezone")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.org_id !== settings.org_id) return { ok: false, message: "⚠️ Post not found." };
  if (post.status !== "pending") return { ok: false, message: `ℹ️ Already handled — this post is now **${post.status}**.` };
  const who = userTag(interaction);

  if (decision === "approve") {
    if (!post.scheduled_at || new Date(post.scheduled_at).getTime() <= Date.now())
      return { ok: false, message: "⚠️ The requested time has passed — this post can only be rejected." };
    const { data: updated } = await db
      .from("posts")
      .update({ status: "scheduled", updated_at: new Date().toISOString() })
      .eq("id", postId)
      .eq("status", "pending")
      .select("id");
    if (!updated?.length) return { ok: false, message: "ℹ️ Someone else already handled this post." };
    await db.from("post_audit").insert({
      post_id: postId,
      org_id: post.org_id,
      actor_id: null,
      action: "approved",
      note: `Approved in Discord by ${who.name} (${who.id}) and scheduled`,
    });
    const line = `✅ Approved by <@${who.id}> — scheduled for ${formatWhen(post.scheduled_at, post.timezone)}`;
    return { ok: true, message: line, line };
  }

  const { data: updated } = await db
    .from("posts")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("status", "pending")
    .select("id");
  if (!updated?.length) return { ok: false, message: "ℹ️ Someone else already handled this post." };
  await db.from("post_audit").insert({
    post_id: postId,
    org_id: post.org_id,
    actor_id: null,
    action: "rejected",
    note: `Rejected in Discord by ${who.name} (${who.id})${reason ? `: ${reason}` : ""}`,
  });
  const line = `❌ Rejected by <@${who.id}>${reason ? ` — ${reason}` : ""}`;
  return { ok: true, message: line, line };
}

async function updateCard(settings: BotSettings, messageId: string | null, line: string, color: number) {
  if (!messageId || !settings.approval_channel_id) return;
  const token = await botToken(settings.server_id);
  if (!token) return;
  try {
    const original = (await discordFetch(token, `/channels/${settings.approval_channel_id}/messages/${messageId}`)) as Json;
    await discordFetch(token, `/channels/${settings.approval_channel_id}/messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify(decidedCard(original, line, color)),
    });
  } catch {
    /* card may be gone; decision is already saved */
  }
}

const rejectModal = (postId: string) =>
  Response.json({
    type: 9,
    data: {
      custom_id: `muno:rejectmodal:${postId}`,
      title: "Reject post",
      components: [
        {
          type: 1,
          components: [
            { type: 4, custom_id: "reason", label: "Reason (optional)", style: 2, required: false, max_length: 500 },
          ],
        },
      ],
    },
  });

async function postIdFromReviewMessage(messageId: string) {
  const db = await admin();
  const { data } = await db.from("posts").select("id").eq("discord_review_message_id", messageId).maybeSingle();
  return data?.id ?? null;
}

/* ---------------- entry ---------------- */

export async function handleInteraction(interaction: Json, settings: BotSettings): Promise<Response> {
  if (interaction.type === 1) return Response.json({ type: 1 });
  if (!interaction.guild_id) return reply("Use this inside the server.");

  // Slash + context menu commands
  if (interaction.type === 2) {
    const name = String(interaction.data?.name ?? "");
    const channelOk = !settings.command_channel_id || interaction.channel_id === settings.command_channel_id;

    if (name === "schedule" || name === "Schedule this message") {
      if (!canSubmit(interaction, settings)) return reply("🚫 You don't have a role that can request posts.");
      if (!channelOk) return reply(`🚫 Use this in <#${settings.command_channel_id}>.`);
      if (name === "schedule") {
        const opts: Record<string, string> = {};
        for (const o of interaction.data?.options ?? []) opts[o.name] = String(o.value ?? "");
        return createSubmission(interaction, settings, opts["channel"] ?? "", opts["time"] ?? "", opts["message"] ?? "");
      }
      const targetId = String(interaction.data?.target_id ?? "");
      const msg = interaction.data?.resolved?.messages?.[targetId];
      return Response.json({
        type: 9,
        data: {
          custom_id: "muno:schedmodal",
          title: "Schedule this message",
          components: [
            { type: 1, components: [{ type: 4, custom_id: "channel", label: "Post to channel (name)", style: 1, required: true, max_length: 100, placeholder: "announcements" }] },
            { type: 1, components: [{ type: 4, custom_id: "time", label: `Time (${settings.timezone})`, style: 1, required: true, max_length: 20, placeholder: "2026-10-15 18:30" }] },
            { type: 1, components: [{ type: 4, custom_id: "message", label: "Message", style: 2, required: true, max_length: 2000, value: String(msg?.content ?? "").slice(0, 2000) }] },
          ],
        },
      });
    }

    if (name === "Approve post" || name === "Reject post") {
      if (!canApprove(interaction, settings)) return reply("🚫 Only approvers can do that.");
      const targetId = String(interaction.data?.target_id ?? "");
      const postId = await postIdFromReviewMessage(targetId);
      if (!postId) return reply("⚠️ That message isn't a MUNO approval card.");
      if (name === "Reject post") return rejectModal(postId);
      const result = await decide(interaction, settings, postId, "approve");
      if (result.ok && result.line) await updateCard(settings, targetId, result.line, 0x23a55a);
      return reply(result.message);
    }
    return reply("Unknown command.");
  }

  // Buttons
  if (interaction.type === 3) {
    const [, action, postId] = String(interaction.data?.custom_id ?? "").split(":");
    if (!postId) return reply("Unknown button.");
    if (!canApprove(interaction, settings)) return reply("🚫 Only approvers can do that.");
    if (action === "reject") return rejectModal(postId);
    if (action === "approve") {
      const result = await decide(interaction, settings, postId, "approve");
      if (!result.ok) return reply(result.message);
      return Response.json({ type: 7, data: decidedCard(interaction.message, result.line!, 0x23a55a) });
    }
    return reply("Unknown button.");
  }

  // Modals
  if (interaction.type === 5) {
    const id = String(interaction.data?.custom_id ?? "");
    const values = modalValues(interaction);
    if (id === "muno:schedmodal") {
      if (!canSubmit(interaction, settings)) return reply("🚫 You don't have a role that can request posts.");
      const wanted = (values["channel"] ?? "").trim().replace(/^#/, "").toLowerCase();
      const db = await admin();
      const { data: channels } = await db
        .from("channels")
        .select("discord_id, name")
        .eq("server_id", settings.server_id);
      const match =
        (channels ?? []).find((c) => c.discord_id === wanted || wanted === `<${c.discord_id}>`) ??
        (channels ?? []).find((c) => c.name.toLowerCase() === wanted) ??
        (channels ?? []).find((c) => c.name.toLowerCase().includes(wanted));
      if (!wanted || !match) return reply(`⚠️ I couldn't find a channel called "${values["channel"]}".`);
      return createSubmission(interaction, settings, match.discord_id, values["time"] ?? "", values["message"] ?? "");
    }
    if (id.startsWith("muno:rejectmodal:")) {
      if (!canApprove(interaction, settings)) return reply("🚫 Only approvers can do that.");
      const postId = id.split(":")[2] ?? "";
      const reason = (values["reason"] ?? "").trim() || undefined;
      const result = await decide(interaction, settings, postId, "reject", reason);
      if (!result.ok) return reply(result.message);
      if (interaction.message?.id && interaction.message?.components?.length) {
        return Response.json({ type: 7, data: decidedCard(interaction.message, result.line!, 0xda373c) });
      }
      const db = await admin();
      const { data } = await db.from("posts").select("discord_review_message_id").eq("id", postId).maybeSingle();
      await updateCard(settings, data?.discord_review_message_id ?? null, result.line!, 0xda373c);
      return reply(result.message);
    }
  }
  return reply("Unsupported interaction.");
}

/* ---------------- command registration ---------------- */

export const COMMANDS = [
  {
    name: "schedule",
    description: "Request a scheduled post (needs approval)",
    type: 1,
    options: [
      { type: 7, name: "channel", description: "Channel to post in", required: true, channel_types: [0, 5] },
      { type: 3, name: "time", description: "YYYY-MM-DD HH:mm or HH:mm", required: true, max_length: 20 },
      { type: 3, name: "message", description: "What to post", required: true, max_length: 2000 },
    ],
  },
  { name: "Schedule this message", type: 3 },
  { name: "Approve post", type: 3 },
  { name: "Reject post", type: 3 },
];

export async function registerGuildCommands(token: string, appId: string, guildId: string) {
  await discordFetch(token, `/applications/${appId}/guilds/${guildId}/commands`, {
    method: "PUT",
    body: JSON.stringify(COMMANDS),
  });
}
