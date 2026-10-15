import { discordFetch } from "./discord.server";

const EPHEMERAL = 64;
const ADMINISTRATOR = 8n;

type Json = any;

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

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function localToUtc(y: number, mo: number, d: number, h: number, mi: number, timeZone: string) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  return guess - tzOffsetMs(guess, timeZone);
}

function todayIn(timeZone: string): [number, number, number] {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date())
    .split("-")
    .map(Number) as [number, number, number];
}

/** "18:30", "6pm", "6:30 pm", "10am" → [h, m] */
function parseClock(text: string): [number, number] | null {
  const m = text.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2] ?? 0);
  const ap = m[3]?.toLowerCase();
  if (!ap && m[2] === undefined) return null; // bare number is ambiguous
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === "pm" && h !== 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
  }
  if (h > 23 || mi > 59) return null;
  return [h, mi];
}

/**
 * Friendly times in the server timezone:
 * now · 10m · 2h · 1h30m · in 15 mins · 18:30 · 6pm · today 8pm · tomorrow 10am ·
 * 15 oct 7pm · 15/10 18:30 · 2026-10-15 18:30
 */
export function parseScheduleTime(input: string, timeZone: string): Date | null {
  let text = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return null;
  if (["now", "asap", "right now", "immediately"].includes(text)) return new Date(Date.now() + 60_000);

  // relative: 10m, 2h, 1h30m, in 15 mins, 1 day
  const rel = text.replace(/^in /, "");
  const relRe = /(\d+)\s*(d|day|days|h|hr|hrs|hour|hours|m|min|mins|minute|minutes)(?=\d|\s|$)/g;
  if (/^(\d+\s*[a-z]+\s*)+$/.test(rel)) {
    let ms = 0;
    let matched = "";
    for (const m of rel.matchAll(relRe)) {
      const n = Number(m[1]);
      const u = m[2]!;
      ms += u.startsWith("d") ? n * 86_400_000 : u.startsWith("h") ? n * 3_600_000 : n * 60_000;
      matched += m[0];
    }
    if (ms > 0 && matched.replace(/\s/g, "") === rel.replace(/\s/g, "")) return new Date(Date.now() + ms);
  }

  const [ty, tmo, td] = todayIn(timeZone);
  let dayShift = 0;
  let date: [number, number, number] | null = null;
  let explicitDay = false;

  if (text.startsWith("today")) {
    text = text.slice(5).trim();
    explicitDay = true;
  } else if (text.startsWith("tomorrow") || text.startsWith("tmrw") || text.startsWith("tmr")) {
    text = text.replace(/^(tomorrow|tmrw|tmr)/, "").trim();
    dayShift = 1;
    explicitDay = true;
  }

  let m: RegExpMatchArray | null;
  if ((m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ t]?(.*)$/))) {
    date = [Number(m[1]), Number(m[2]), Number(m[3])];
    text = m[4]!.trim();
  } else if ((m = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\s+(.*)$/))) {
    const yr = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : ty;
    date = [yr, Number(m[2]), Number(m[1])]; // day/month (India-style)
    text = m[4]!.trim();
  } else if ((m = text.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3})[a-z]*\s*(.*)$/))) {
    const mo = MONTHS.indexOf(m[2]!) + 1;
    if (mo) {
      date = [ty, mo, Number(m[1])];
      text = m[3]!.trim();
    }
  } else if ((m = text.match(/^([a-z]{3})[a-z]* (\d{1,2})(?:st|nd|rd|th)?\s*(.*)$/))) {
    const mo = MONTHS.indexOf(m[1]!) + 1;
    if (mo) {
      date = [ty, mo, Number(m[2])];
      text = m[3]!.trim();
    }
  }
  text = text.replace(/^at /, "");

  const clock = parseClock(text || (explicitDay || date ? "9:00" : ""));
  if (!clock) return null;
  const [h, mi] = clock;

  if (date) {
    const [y, mo, d] = date;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    let ts = localToUtc(y, mo, d, h, mi, timeZone);
    // "15 oct" without a year that already passed → next year
    if (ts <= Date.now() && !/^\d{4}/.test(input.trim())) ts = localToUtc(y + 1, mo, d, h, mi, timeZone);
    return new Date(ts);
  }
  let ts = localToUtc(ty, tmo, td, h, mi, timeZone) + dayShift * 86_400_000;
  if (!explicitDay && ts <= Date.now()) ts += 86_400_000; // "6pm" after 6pm means tomorrow
  return new Date(ts);
}

const TIME_HELP =
  "Try `now`, `10m`, `2h`, `6pm`, `18:30`, `tomorrow 10am`, `15 oct 7pm` or `2026-10-15 18:30`.";

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
        description: String(post.content || (post.use_embed ? "(embed only)" : "(no text)")).slice(0, 3500),
        fields: [
          { name: "Submitted by", value: author, inline: true },
          { name: "Posts to", value: `#${channelName}`, inline: true },
          { name: "When", value: formatWhen(post.scheduled_at, timeZone), inline: false },
        ],
        footer: { text: `MUNO · ${post.id}` },
      },
      ...(post.use_embed && post.embed ? [previewEmbed(post.embed)] : []),
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

function previewEmbed(e: Json) {
  const out: Json = { color: Number.parseInt(String(e.color ?? "#5865F2").replace("#", ""), 16) || 0x5865f2 };
  if (e.title) out.title = String(e.title).slice(0, 256);
  if (e.description) out.description = String(e.description).slice(0, 4000);
  if (e.authorName) out.author = { name: e.authorName, ...(e.authorIcon ? { icon_url: e.authorIcon } : {}) };
  if (e.image) out.image = { url: e.image };
  if (e.thumbnail) out.thumbnail = { url: e.thumbnail };
  if (e.footerText) out.footer = { text: e.footerText };
  const fields = (e.fields ?? []).filter((f: Json) => f.name && f.value).slice(0, 25);
  if (fields.length) out.fields = fields.map((f: Json) => ({ name: f.name, value: f.value, inline: !!f.inline }));
  return out;
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
  source: Extracted,
): Promise<string> {
  const db = await admin();
  const when = parseScheduleTime(timeText, settings.timezone);
  if (!when) return `⚠️ I couldn't read the time "${timeText}". ${TIME_HELP}`;
  if (when.getTime() <= Date.now() + 30_000) return `⚠️ That time has already passed. ${TIME_HELP}`;
  const text = source.content.trim();
  const embed = source.embed ?? null;
  if (!text && !embed) return "⚠️ The message is empty.";
  if (text.length > 2000) return "⚠️ Discord messages can be at most 2000 characters.";

  const { data: channel } = await db
    .from("channels")
    .select("id, name")
    .eq("server_id", settings.server_id)
    .eq("discord_id", channelDiscordId)
    .maybeSingle();
  if (!channel) return "⚠️ That channel isn't synced in MUNO yet. Ask an admin to press **Sync channels** in MUNO.";

  const { data: org } = await db.from("organizations").select("created_by").eq("id", settings.org_id).single();
  if (!org) return "⚠️ Workspace not found.";

  const who = userTag(interaction);
  const { data: post, error } = await db
    .from("posts")
    .insert({
      org_id: settings.org_id,
      server_id: settings.server_id,
      channel_id: channel.id,
      title: `Discord request from ${who.name}`.slice(0, 200),
      content: text,
      use_embed: !!embed,
      ...(embed ? { embed: embed as never } : {}),
      status: "pending",
      scheduled_at: when.toISOString(),
      timezone: settings.timezone,
      created_by: org.created_by,
    })
    .select("*")
    .single();
  if (error || !post) return `⚠️ Couldn't save the request: ${error?.message ?? "unknown error"}`;

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
  return `✅ Sent for approval — posts to #${channel.name} at ${formatWhen(post.scheduled_at ?? when.toISOString(), settings.timezone)} once approved.${cardNote}`;
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
    const late = !post.scheduled_at || new Date(post.scheduled_at).getTime() <= Date.now();
    const sendAt = late ? new Date().toISOString() : post.scheduled_at!;
    const { data: updated } = await db
      .from("posts")
      .update({ status: "scheduled", scheduled_at: sendAt, updated_at: new Date().toISOString() })
      .eq("id", postId)
      .eq("status", "pending")
      .select("id");
    if (!updated?.length) return { ok: false, message: "ℹ️ Someone else already handled this post." };
    await db.from("post_audit").insert({
      post_id: postId,
      org_id: post.org_id,
      actor_id: null,
      action: "approved",
      note: late
        ? `Approved in Discord by ${who.name} (${who.id}) after the requested time — posting now`
        : `Approved in Discord by ${who.name} (${who.id}) and scheduled`,
    });
    const line = late
      ? `✅ Approved by <@${who.id}> — the time had passed, so it's posting right now`
      : `✅ Approved by <@${who.id}> — scheduled for ${formatWhen(sendAt, post.timezone)}`;
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

/* ---------------- deferred replies & message lookup ---------------- */

/** Answer Discord instantly ("thinking…"), then finish the work and edit that reply. */
function deferred(interaction: Json, work: () => Promise<string>) {
  const appId = String(interaction.application_id ?? "");
  const token = String(interaction.token ?? "");
  const finish = async () => {
    let content: string;
    try {
      content = await work();
    } catch (err) {
      console.error("Discord deferred interaction failed", err);
      content = "⚠️ Something went wrong. Try again in a moment.";
    }
    await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 2000), allowed_mentions: { parse: [] } }),
    }).catch((err) => console.error("Could not update Discord reply", err));
  };
  void finish();
  return Response.json({ type: 5, data: { flags: EPHEMERAL } });
}

async function fetchMessage(token: string, channelId: string, messageId: string) {
  try {
    return (await discordFetch(token, `/channels/${channelId}/messages/${messageId}`)) as Json;
  } catch {
    return null;
  }
}

export interface Extracted {
  content: string;
  embed?: Record<string, unknown> | null;
}

const hex = (n: unknown) =>
  typeof n === "number" ? `#${n.toString(16).padStart(6, "0").toUpperCase()}` : "#5865F2";

/** Converts a Discord message embed into MUNO's embed format (text, fields, colour, images). */
function toMunoEmbed(e: Json): Record<string, unknown> | null {
  if (!e || typeof e !== "object") return null;
  const embed = {
    authorName: String(e.author?.name ?? ""),
    authorIcon: String(e.author?.icon_url ?? ""),
    title: String(e.title ?? ""),
    titleUrl: String(e.url ?? ""),
    description: String(e.description ?? ""),
    color: hex(e.color),
    thumbnail: String(e.thumbnail?.url ?? ""),
    image: String(e.image?.url ?? e.image?.proxy_url ?? ""),
    fields: (Array.isArray(e.fields) ? e.fields : []).map((f: Json, i: number) => ({
      id: `f${i}`,
      name: String(f?.name ?? ""),
      value: String(f?.value ?? ""),
      inline: f?.inline === true,
    })),
    footerText: String(e.footer?.text ?? ""),
    footerIcon: String(e.footer?.icon_url ?? ""),
    showTimestamp: Boolean(e.timestamp),
  };
  const has = embed.title || embed.description || embed.fields.length || embed.image || embed.thumbnail || embed.authorName;
  return has ? embed : null;
}

function messageText(msg: Json): Extracted {
  const parts = [String(msg?.content ?? "")];
  for (const a of msg?.attachments ?? []) if (a?.url) parts.push(String(a.url));
  const rich = (msg?.embeds ?? []).find((e: Json) => !e?.type || e.type === "rich");
  return { content: parts.filter(Boolean).join("\n").slice(0, 2000), embed: toMunoEmbed(rich) };
}

/**
 * The text to post: typed text, a pasted message link, or (when left empty)
 * the person's latest message in this channel.
 */
async function resolveMessageText(
  interaction: Json,
  settings: BotSettings,
  typed: string,
): Promise<{ ok: true; msg: Extracted } | { ok: false; error: string }> {
  const text = typed.trim();
  const link = text.match(/^https?:\/\/(?:\w+\.)?discord(?:app)?\.com\/channels\/\d+\/(\d+)\/(\d+)\/?$/);
  if (text && !link) return { ok: true, msg: { content: text } };
  const token = await botToken(settings.server_id);
  if (!token) return { ok: false, error: "⚠️ The bot isn't connected in MUNO." };
  if (link) {
    const msg = await fetchMessage(token, link[1]!, link[2]!);
    if (!msg) return { ok: false, error: "⚠️ I couldn't open that message link. Make sure the bot can see that channel." };
    return { ok: true, msg: messageText(msg) };
  }
  const me = userTag(interaction).id;
  let recent: Json[] = [];
  try {
    recent = (await discordFetch(token, `/channels/${interaction.channel_id}/messages?limit=50`)) as Json[];
  } catch {
    return { ok: false, error: "⚠️ I can't read this channel. Give the bot **Read Message History** here, or type the message." };
  }
  const mine = recent.find((m) => m?.author?.id === me && (m.content || m.attachments?.length || m.embeds?.length));
  if (!mine)
    return {
      ok: false,
      error: "⚠️ I couldn't find a recent message from you here. Send your announcement first, then run `/schedule` without a message.",
    };
  return { ok: true, msg: messageText(mine) };
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
        return deferred(interaction, async () => {
          const text = await resolveMessageText(interaction, settings, opts["message"] ?? "");
          if (!text.ok) return text.error;
          return createSubmission(interaction, settings, opts["channel"] ?? "", opts["time"] ?? "", text.msg);
        });
      }
      const targetId = String(interaction.data?.target_id ?? "");
      return Response.json({
        type: 9,
        data: {
          custom_id: `muno:schedmodal:${interaction.channel_id}:${targetId}`,
          title: "Schedule this message",
          components: [
            { type: 1, components: [{ type: 4, custom_id: "channel", label: "Post to channel (name)", style: 1, required: true, max_length: 100, placeholder: "announcements" }] },
            { type: 1, components: [{ type: 4, custom_id: "time", label: `When? (${settings.timezone})`, style: 1, required: true, max_length: 40, placeholder: "6pm · tomorrow 10am · 2h · now" }] },
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
    if (id.startsWith("muno:schedmodal")) {
      const [, , srcChannel, srcMessage] = id.split(":");
      return deferred(interaction, async () => {
        const db = await admin();
        const wanted = (values["channel"] ?? "").trim().toLowerCase().replace(/^#/, "");
        const { data: channels } = await db
          .from("channels")
          .select("discord_id, name")
          .eq("server_id", settings.server_id);
        const match =
          (channels ?? []).find((c) => c.discord_id === wanted || wanted === `<${c.discord_id}>`) ??
          (channels ?? []).find((c) => c.name.toLowerCase() === wanted) ??
          (channels ?? []).find((c) => c.name.toLowerCase().includes(wanted));
        if (!wanted || !match) return `⚠️ I couldn't find a channel called "${values["channel"]}".`;
        let content: Extracted = { content: values["message"] ?? "" };
        if (!content.content && srcChannel && srcMessage) {
          const token = await botToken(settings.server_id);
          const msg = token ? await fetchMessage(token, srcChannel, srcMessage) : null;
          if (!msg) return "⚠️ I couldn't read that message. Make sure the bot can see this channel.";
          content = messageText(msg);
        }
        return createSubmission(interaction, settings, match.discord_id, values["time"] ?? "", content);
      });
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
      { type: 3, name: "time", description: "now · 10m · 2h · 6pm · tomorrow 10am · 15 oct 7pm", required: true, max_length: 40 },
      {
        type: 3,
        name: "message",
        description: "Leave empty to use your last message here, or paste a message link",
        required: false,
        max_length: 2000,
      },
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
