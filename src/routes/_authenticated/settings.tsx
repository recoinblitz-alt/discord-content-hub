import { createFileRoute } from "@tanstack/react-router";
import { Plus, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Servers & bots — Relaystack" },
      {
        name: "description",
        content:
          "Connect Discord bots or webhooks, list channels and choose which channels require approval.",
      },
      { property: "og:title", content: "Servers & bots — Relaystack" },
      {
        property: "og:description",
        content: "Configure Discord bot tokens, webhooks and per-channel approval policies.",
      },
    ],
  }),
  component: Settings,
});

function Settings() {
  const {
    currentOrg,
    orgServers,
    channelsOfServer,
    updateServer,
    toggleChannelApproval,
    addChannel,
    permissions,
  } = useStore();
  const [newChannel, setNewChannel] = useState<Record<string, string>>({});

  if (!permissions.configureServers) {
    return (
      <AppShell title="Servers & bots" subtitle="Restricted">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-surface p-8 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-warning" />
          <h2 className="mt-3 font-display text-lg font-semibold">Admin access required</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only Admins and Super Admins can configure servers, bots and approval policies.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Servers & bots"
      subtitle={`${orgServers.length} Discord servers connected to ${currentOrg.name}`}
    >
      <div className="space-y-6">
        {orgServers.map((s) => (
          <section key={s.id} className="rounded-xl border border-border bg-surface">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
              <img src={s.icon} alt="" className="h-10 w-10 rounded-xl bg-muted" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base font-semibold">{s.name}</h2>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[0.625rem] font-medium ${
                      s.connected
                        ? "border-success/40 bg-success/15 text-success"
                        : "border-destructive/40 bg-destructive/15 text-destructive"
                    }`}
                  >
                    {s.connected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {s.memberCount.toLocaleString()} members · bot {s.botName}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={s.connected}
                  onCheckedChange={(v) => {
                    updateServer(s.id, { connected: v });
                    toast.success(v ? `${s.name} connected` : `${s.name} disconnected`);
                  }}
                />
                Enabled
              </label>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <Label className="mb-1.5 block text-xs">Connection method</Label>
                  <select
                    value={s.connection}
                    onChange={(e) =>
                      updateServer(s.id, {
                        connection: e.target.value as "bot_token" | "webhook",
                      })
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="bot_token">Bot token</option>
                    <option value="webhook">Channel webhook</option>
                  </select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">
                    {s.connection === "bot_token" ? "Bot token" : "Webhook URL"}
                  </Label>
                  <Input
                    value={s.credential}
                    onChange={(e) => updateServer(s.id, { credential: e.target.value })}
                    placeholder={s.connection === "bot_token" ? "MTA5…" : "https://discord.com/api/webhooks/…"}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Stored per organization. Never shared across organizations.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5 block text-xs">Bot display name</Label>
                    <Input
                      value={s.botName}
                      onChange={(e) => updateServer(s.id, { botName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Bot avatar URL</Label>
                    <Input
                      value={s.botAvatar}
                      onChange={(e) => updateServer(s.id, { botAvatar: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-2 block text-xs">Channels & approval policy</Label>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {channelsOfServer(s.id).map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="flex-1 text-sm">
                        #{c.name}
                        <span className="ml-2 text-[0.625rem] uppercase text-muted-foreground">
                          {c.type}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.requiresApproval ? "Approval required" : "Direct publish"}
                      </span>
                      <Switch
                        checked={c.requiresApproval}
                        onCheckedChange={() => toggleChannelApproval(c.id)}
                      />
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="new-channel-name"
                    value={newChannel[s.id] ?? ""}
                    onChange={(e) => setNewChannel((n) => ({ ...n, [s.id]: e.target.value }))}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const name = (newChannel[s.id] ?? "").trim();
                      if (!name) return;
                      addChannel(s.id, name.replace(/\s+/g, "-").toLowerCase(), "text");
                      setNewChannel((n) => ({ ...n, [s.id]: "" }));
                      toast.success(`#${name} added`);
                    }}
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
