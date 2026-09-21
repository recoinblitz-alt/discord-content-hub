import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Hash,
  Loader2,
  Megaphone,
  Plug,
  RefreshCw,
  Send,
  ShieldCheck,
  Download,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { downloadCsv, slug, toCsv } from "@/lib/csv";
import {
  connectServer,
  exportGuildMembers,
  inspectBotToken,
  sendTestMessage,
  syncChannels,
} from "@/lib/discord.functions";
import { fullDate } from "@/lib/format";
import { useWorkspace } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Servers & Bots — Relaystack" },
      {
        name: "description",
        content:
          "Connect your Discord bot, import servers and channels, and choose which channels need approval.",
      },
      { property: "og:title", content: "Servers & Bots — Relaystack" },
      {
        property: "og:description",
        content: "Connect a Discord bot and set per-channel approval rules.",
      },
    ],
  }),
  component: Settings,
});

interface BotGuild {
  id: string;
  name: string;
  iconUrl: string;
}

function Settings() {
  const {
    currentOrg,
    orgServers,
    channelsOfServer,
    toggleChannelApproval,
    refresh,
    permissions,
  } = useWorkspace();

  const inspect = useServerFn(inspectBotToken);
  const connect = useServerFn(connectServer);
  const sync = useServerFn(syncChannels);
  const test = useServerFn(sendTestMessage);

  const [token, setToken] = useState("");
  const [bot, setBot] = useState<{ name: string; avatar: string } | null>(null);
  const [guilds, setGuilds] = useState<BotGuild[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const verify = async () => {
    if (!token.trim()) {
      toast.error("Paste your bot token first");
      return;
    }
    setBusy("verify");
    try {
      const result = await inspect({ data: { orgId: currentOrg.id, botToken: token.trim() } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setBot({ name: result.bot.username, avatar: result.bot.avatarUrl });
      setGuilds(result.guilds);
      toast.success(`Connected to ${result.bot.username}`);
      if (result.guilds.length === 0) {
        toast.error("This bot isn't in any server yet — invite it, then verify again");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Discord rejected that token");
    } finally {
      setBusy(null);
    }
  };

  const importGuild = async (guildId: string) => {
    setBusy(guildId);
    try {
      const result = await connect({
        data: { orgId: currentOrg.id, botToken: token.trim(), guildId },
      });
      await refresh();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import that server");
    } finally {
      setBusy(null);
    }
  };

  const resync = async (serverId: string) => {
    setBusy(serverId);
    try {
      const result = await sync({ data: { serverId } });
      await refresh();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refresh channels");
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async (channelId: string) => {
    setBusy(channelId);
    try {
      const result = await test({ data: { channelId } });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Discord refused the test message");
    } finally {
      setBusy(null);
    }
  };

  if (!permissions.configureServers) {
    return (
      <AppShell title="Servers & bots" subtitle="Ask an admin for access">
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          Only admins and owners can connect bots or change channel rules.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Servers & bots"
      subtitle={
        orgServers.length
          ? `${orgServers.length} connected · ${currentOrg.name}`
          : "Connect your first Discord bot"
      }
    >
      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
              <Plug className="h-4 w-4 text-blurple" /> Connect a bot
            </div>
            <div className="space-y-3 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="token">Bot token</Label>
                <Input
                  id="token"
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste from the Discord Developer Portal"
                />
                <p className="text-xs text-muted-foreground">
                  Stored encrypted on the server and never shown again. Invite the bot to your
                  server with permission to send messages and embed links first.
                </p>
              </div>
              <Button className="w-full" onClick={() => void verify()} disabled={busy === "verify"}>
                {busy === "verify" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Verify with Discord
              </Button>

              {bot && (
                <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/10 px-3 py-2.5">
                  {bot.avatar ? (
                    <img src={bot.avatar} alt="" className="h-9 w-9 rounded-full" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-muted" />
                  )}
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-sm font-medium">{bot.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {guilds.length} server{guilds.length === 1 ? "" : "s"} available
                    </div>
                  </div>
                  <CheckCircle2 className="ml-auto h-4 w-4 text-success" />
                </div>
              )}
            </div>
          </div>

          {guilds.length > 0 && (
            <div className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-4 py-3 text-sm font-semibold">
                Import a server
              </div>
              <ul className="divide-y divide-border">
                {guilds.map((g) => {
                  const already = orgServers.some((s) => s.guildId === g.id);
                  return (
                    <li key={g.id} className="flex items-center gap-3 px-4 py-3">
                      {g.iconUrl ? (
                        <img src={g.iconUrl} alt="" className="h-8 w-8 rounded-lg" />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-muted" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">{g.name}</span>
                      <Button
                        size="sm"
                        variant={already ? "outline" : "default"}
                        disabled={busy === g.id}
                        onClick={() => void importGuild(g.id)}
                      >
                        {busy === g.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        {already ? "Re-sync" : "Import"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <MembersExport />
        </div>

        <div className="space-y-4">
          {orgServers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
              <Plug className="mx-auto h-6 w-6 text-muted-foreground" />
              <h2 className="mt-3 font-display text-base font-semibold">No servers yet</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                Verify a bot token on the left, then import the server you want to post to. Its
                channels come across automatically.
              </p>
            </div>
          ) : (
            orgServers.map((server) => {
              const channels = channelsOfServer(server.id);
              return (
                <div key={server.id} className="rounded-xl border border-border bg-surface">
                  <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
                    {server.icon ? (
                      <img src={server.icon} alt="" className="h-9 w-9 rounded-lg" />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{server.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {server.botName ? `Bot: ${server.botName}` : "Bot connected"} ·{" "}
                        {channels.length} channels
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        server.connected
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {server.connected ? "Connected" : "Disconnected"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === server.id}
                      onClick={() => void resync(server.id)}
                    >
                      {busy === server.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Sync channels
                    </Button>
                  </div>

                  <ul className="divide-y divide-border">
                    {channels.length === 0 && (
                      <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No text channels found — check the bot's permissions and sync again.
                      </li>
                    )}
                    {channels.map((channel) => (
                      <li key={channel.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        {channel.type === "announcement" ? (
                          <Megaphone className="h-4 w-4 text-warning" />
                        ) : (
                          <Hash className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm">{channel.name}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          Approval required
                          <Switch
                            checked={channel.requiresApproval}
                            onCheckedChange={() => void toggleChannelApproval(channel.id)}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === channel.id}
                          onClick={() => void sendTest(channel.id)}
                        >
                          {busy === channel.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Test
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}

function MembersExport() {
  const { currentOrg, currentUser, orgServers, orgMembers } = useWorkspace();
  const runExport = useServerFn(exportGuildMembers);
  const [serverId, setServerId] = useState("");
  const [busy, setBusy] = useState(false);

  if (currentUser.role !== "super_admin") return null;

  const selected = serverId || orgServers[0]?.id || "";

  const exportDiscord = async () => {
    if (!selected) {
      toast.error("Connect a server first");
      return;
    }
    setBusy(true);
    const pending = toast.loading("Reading members from Discord…");
    try {
      const result = await runExport({ data: { serverId: selected } });
      if (!result.ok) {
        toast.error(result.message, { id: pending, duration: 10000 });
        return;
      }
      const base = slug(result.serverName);
      downloadCsv(
        `${base}-members.csv`,
        toCsv(
          [
            "discord_user_id",
            "username",
            "global_name",
            "display_name",
            "is_bot",
            "joined_at",
            "role_ids",
            "role_names",
          ],
          result.members.map((m) => [
            m.userId,
            m.username,
            m.globalName,
            m.displayName,
            m.isBot ? "yes" : "no",
            m.joinedAt,
            m.roleIds.join(" | "),
            m.roleNames.join(" | "),
          ]),
        ),
      );
      downloadCsv(
        `${base}-roles.csv`,
        toCsv(
          ["role_id", "role_name", "colour", "position", "member_count"],
          result.roles.map((r) => [r.id, r.name, r.color, r.position, r.memberCount]),
        ),
      );
      toast.success(`${result.members.length} members exported`, { id: pending });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed", { id: pending });
    } finally {
      setBusy(false);
    }
  };

  const exportWorkspace = () => {
    downloadCsv(
      `${slug(currentOrg.name)}-workspace-members.csv`,
      toCsv(
        ["name", "handle", "email", "role", "joined"],
        orgMembers.map((m) => [m.name, m.handle, m.email ?? "", m.role, fullDate(new Date().toISOString())]),
      ),
    );
    toast.success("Workspace member list downloaded");
  };

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
        <Users className="h-4 w-4 text-blurple" /> Members export
        <span className="ml-auto rounded-full bg-blurple/15 px-2 py-0.5 text-[0.625rem] font-medium uppercase text-blurple">
          Owner only
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="export-server">Discord server</Label>
          <select
            id="export-server"
            value={selected}
            onChange={(e) => setServerId(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            disabled={orgServers.length === 0}
          >
            {orgServers.length === 0 && <option value="">No servers connected</option>}
            {orgServers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          className="w-full"
          onClick={() => void exportDiscord()}
          disabled={busy || orgServers.length === 0}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export members
        </Button>
        <p className="text-xs text-muted-foreground">
          Downloads two spreadsheets: every member with their user ID, username, display name, join
          date and roles (names and IDs), plus the server&rsquo;s full role list with member counts.
          Discord only reveals the member list if &ldquo;Server Members Intent&rdquo; is switched on
          for this bot in the Discord Developer Portal.
        </p>
        <Button variant="outline" className="w-full" onClick={exportWorkspace}>
          <Download className="h-4 w-4" /> Export this workspace&rsquo;s team
        </Button>
      </div>
    </div>
  );
}
