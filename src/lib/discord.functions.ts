import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertRole(context: Ctx, orgId: string, roles: string[]) {
  const { data, error } = await context.supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error || !data) throw new Error("You are not a member of this workspace");
  if (!roles.includes(data.role as string)) throw new Error("Your role cannot do that");
  return data.role as string;
}

/** Verify a bot token and list the servers the bot has joined. */
export const inspectBotToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; botToken: string }) => input)
  .handler(async ({ data, context }) => {
    await assertRole(context as Ctx, data.orgId, ["super_admin", "admin"]);
    const { fetchBotIdentity, fetchBotGuilds } = await import("./discord.server");
    const token = data.botToken.trim().replace(/^Bot\s+/i, "");
    try {
      const bot = await fetchBotIdentity(token);
      const guilds = await fetchBotGuilds(token);
      return { ok: true as const, bot, guilds };
    } catch (err) {
      return {
        ok: false as const,
        message:
          err instanceof Error
            ? err.message === "401: Unauthorized"
              ? "Discord rejected that token"
              : err.message
            : "Could not reach Discord",
      };
    }
  });

/** Save a server + its channels using a verified bot token. */
export const connectServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; botToken: string; guildId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertRole(context as Ctx, data.orgId, ["super_admin", "admin"]);
    const { fetchBotIdentity, fetchBotGuilds, fetchGuildChannels } = await import(
      "./discord.server"
    );
    const token = data.botToken.trim().replace(/^Bot\s+/i, "");

    let bot, guilds, channels;
    try {
      bot = await fetchBotIdentity(token);
      guilds = await fetchBotGuilds(token);
      channels = await fetchGuildChannels(token, data.guildId);
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : "Could not reach Discord",
      };
    }
    const guild = guilds.find((g) => g.id === data.guildId);
    if (!guild) return { ok: false as const, message: "The bot is not in that server" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("servers")
      .select("id")
      .eq("org_id", data.orgId)
      .eq("guild_id", guild.id)
      .maybeSingle();

    let serverId = existing?.id;
    const payload = {
      org_id: data.orgId,
      name: guild.name,
      guild_id: guild.id,
      icon_url: guild.iconUrl,
      bot_name: bot.username,
      bot_avatar_url: bot.avatarUrl,
      bot_id: bot.id,
      connected: true,
    };
    if (serverId) {
      await supabaseAdmin.from("servers").update(payload).eq("id", serverId);
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("servers")
        .insert(payload)
        .select("id")
        .single();
      if (error) return { ok: false as const, message: error.message };
      serverId = inserted.id;
    }

    await supabaseAdmin
      .from("server_secrets")
      .upsert({ server_id: serverId, bot_token: token, updated_at: new Date().toISOString() });

    for (const channel of channels) {
      await supabaseAdmin.from("channels").upsert(
        {
          org_id: data.orgId,
          server_id: serverId,
          discord_id: channel.id,
          name: channel.name,
          requires_approval: channel.type === 5,
        },
        { onConflict: "server_id,discord_id", ignoreDuplicates: true },
      );
    }

    return {
      ok: true as const,
      message: `${guild.name} connected with ${channels.length} channels`,
      serverId,
    };
  });

/** Re-read the channel list for a saved server. */
export const syncChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: server } = await supabaseAdmin
      .from("servers")
      .select("id, org_id, guild_id")
      .eq("id", data.serverId)
      .single();
    if (!server?.guild_id) return { ok: false as const, message: "Server not found" };
    await assertRole(context as Ctx, server.org_id, ["super_admin", "admin"]);

    const { data: secret } = await supabaseAdmin
      .from("server_secrets")
      .select("bot_token")
      .eq("server_id", server.id)
      .single();
    if (!secret?.bot_token) return { ok: false as const, message: "No bot token saved" };

    const { fetchGuildChannels } = await import("./discord.server");
    try {
      const channels = await fetchGuildChannels(secret.bot_token, server.guild_id);
      for (const channel of channels) {
        await supabaseAdmin.from("channels").upsert(
          {
            org_id: server.org_id,
            server_id: server.id,
            discord_id: channel.id,
            name: channel.name,
          },
          { onConflict: "server_id,discord_id" },
        );
      }
      return { ok: true as const, message: `${channels.length} channels synced` };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : "Could not reach Discord",
      };
    }
  });

/** Send a one-off test message to a channel so the user can confirm the bot works. */
export const sendTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { channelId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: channel } = await supabaseAdmin
      .from("channels")
      .select("id, org_id, discord_id, name, server_id")
      .eq("id", data.channelId)
      .single();
    if (!channel) return { ok: false as const, message: "Channel not found" };
    await assertRole(context as Ctx, channel.org_id, ["super_admin", "admin"]);

    const { data: secret } = await supabaseAdmin
      .from("server_secrets")
      .select("bot_token")
      .eq("server_id", channel.server_id)
      .single();
    if (!secret?.bot_token) return { ok: false as const, message: "No bot token saved" };

    const { sendDiscordMessage } = await import("./discord.server");
    try {
      await sendDiscordMessage(secret.bot_token, channel.discord_id, {
        embeds: [
          {
            title: "Connection test",
            description: "Your bot can post here. Approvals and scheduling are live.",
            color: 0x5865f2,
            timestamp: new Date().toISOString(),
          },
        ],
      });
      return { ok: true as const, message: `Test message sent to #${channel.name}` };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : "Discord rejected the test",
      };
    }
  });

/** Publish a post to Discord right now. */
export const publishPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { data: post, error } = await ctx.supabase
      .from("posts")
      .select("id, org_id, status, created_by")
      .eq("id", data.postId)
      .single();
    if (error || !post) return { ok: false as const, message: "Post not found" };

    const role = await assertRole(ctx, post.org_id, [
      "super_admin",
      "admin",
      "approver",
      "user",
    ]);
    const privileged = role === "super_admin" || role === "admin";
    const canPublish = privileged;
    if (!canPublish) {
      return { ok: false as const, message: "This post needs approval before it can be sent" };
    }
    if (!["approved", "scheduled", "failed"].includes(post.status)) {
      return { ok: false as const, message: "This post is not ready to publish" };
    }

    const { deliverPost } = await import("./discord.server");
    return deliverPost(data.postId);
  });

/** Super-admin-only: export every member of a connected Discord server. */
export const exportGuildMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: server } = await supabaseAdmin
      .from("servers")
      .select("id, org_id, name, guild_id")
      .eq("id", data.serverId)
      .single();
    if (!server?.guild_id) return { ok: false as const, message: "Server is not connected" };
    await assertRole(context as Ctx, server.org_id, ["super_admin"]);

    const { data: secret } = await supabaseAdmin
      .from("server_secrets")
      .select("bot_token")
      .eq("server_id", server.id)
      .single();
    if (!secret?.bot_token) return { ok: false as const, message: "No bot token saved" };

    const { fetchGuildMembers } = await import("./discord.server");
    try {
      const { members, roles } = await fetchGuildMembers(secret.bot_token, server.guild_id);
      const counts = new Map<string, number>();
      for (const m of members) for (const id of m.roleIds) counts.set(id, (counts.get(id) ?? 0) + 1);
      return {
        ok: true as const,
        serverName: server.name,
        members,
        roles: roles.map((r) => ({ ...r, memberCount: counts.get(r.id) ?? 0 })),
      };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : "Discord refused the request",
      };
    }
  });

/** Roles and members for @mention suggestions in the post creator. Any workspace member. */
export const getMentionDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { serverId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: server } = await supabaseAdmin
      .from("servers")
      .select("id, org_id, guild_id")
      .eq("id", data.serverId)
      .single();
    if (!server?.guild_id) return { roles: [], members: [], note: "Server is not connected" };
    await assertRole(context as Ctx, server.org_id, ["super_admin", "admin", "approver", "user"]);
    const { data: secret } = await supabaseAdmin
      .from("server_secrets")
      .select("bot_token")
      .eq("server_id", server.id)
      .single();
    if (!secret?.bot_token) return { roles: [], members: [], note: "No bot token saved" };

    const { fetchGuildRoles, fetchMentionMembers } = await import("./discord.server");
    let roles: { id: string; name: string; color: string }[] = [];
    let members: { id: string; name: string; username: string; avatar: string }[] = [];
    let note: string | null = null;
    try {
      roles = (await fetchGuildRoles(secret.bot_token, server.guild_id))
        .filter((r) => r.name !== "@everyone")
        .map(({ id, name, color }) => ({ id, name, color }));
    } catch {
      note = "Couldn't load roles";
    }
    try {
      members = await fetchMentionMembers(secret.bot_token, server.guild_id);
    } catch {
      note = "Members unavailable — switch on Server Members Intent for the bot";
    }
    return { roles, members, note };
  });
