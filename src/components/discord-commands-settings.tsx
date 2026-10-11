import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getBotSettings,
  getMentionDirectory,
  registerBotCommands,
  saveBotSettings,
} from "@/lib/discord.functions";
import type { Channel } from "@/lib/types";

function RolePicker({
  roles,
  value,
  onChange,
}: {
  roles: { id: string; name: string; color: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  if (!roles.length) return <p className="text-xs text-muted-foreground">No roles loaded yet.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((r) => {
        const on = value.includes(r.id);
        return (
          <button
            type="button"
            key={r.id}
            onClick={() => onChange(on ? value.filter((x) => x !== r.id) : [...value, r.id])}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              on ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            @{r.name}
          </button>
        );
      })}
    </div>
  );
}

export function DiscordCommandsSettings({ serverId, channels }: { serverId: string; channels: Channel[] }) {
  const load = useServerFn(getBotSettings);
  const save = useServerFn(saveBotSettings);
  const register = useServerFn(registerBotCommands);
  const loadRoles = useServerFn(getMentionDirectory);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    publicKey: "",
    commandChannelId: "",
    approvalChannelId: "",
    submitRoleIds: [] as string[],
    approveRoleIds: [] as string[],
    timezone: "Asia/Kolkata",
  });
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const settings = useQuery({
    queryKey: ["bot-settings", serverId],
    queryFn: () => load({ data: { serverId } }),
    enabled: open,
  });
  const roles = useQuery({
    queryKey: ["mention-directory", serverId],
    queryFn: () => loadRoles({ data: { serverId } }),
    enabled: open,
    staleTime: 600_000,
  });
  useEffect(() => {
    if (settings.data) {
      const { registeredAt: _r, ...rest } = settings.data;
      setForm(rest);
    }
  }, [settings.data]);

  const url = `${origin}/api/public/discord/interactions/${serverId}`;

  const onSave = async (andRegister: boolean) => {
    setBusy(true);
    try {
      await save({ data: { serverId, ...form } });
      if (andRegister) {
        const r = await register({ data: { serverId } });
        if (r.ok) toast.success(r.message);
        else toast.error(r.message);
      } else toast.success("Saved");
      void settings.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="border-t border-border px-4 py-3">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Terminal className="h-4 w-4" /> Discord commands & approvals
        </Button>
      </div>
    );
  }

  const channelSelect = (id: string, value: string, onChange: (v: string) => void, empty: string) => (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
    >
      <option value="">{empty}</option>
      {channels.map((c) => (
        <option key={c.id} value={c.discordId}>
          #{c.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-4 border-t border-border px-4 py-4">
      <div>
        <h3 className="font-display text-sm font-semibold">Discord commands & approvals</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Members with the chosen roles use <b>/schedule</b> (or right-click a message → Apps → <b>Schedule this
          message</b>). Approvers get a card with <b>Approve</b> / <b>Reject</b> buttons, or right-click the card →
          Apps → <b>Approve post</b> / <b>Reject post</b>.
        </p>
      </div>
      {settings.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <div className="space-y-1.5">
            <Label>1. Interactions Endpoint URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button
                size="icon"
                variant="outline"
                aria-label="Copy URL"
                onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success("Copied"))}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Discord Developer Portal → your app → General Information. Paste this URL there after saving the
              public key below. Use your live site address (for example your Render URL).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`pk-${serverId}`}>2. Application Public Key</Label>
            <Input
              id={`pk-${serverId}`}
              value={form.publicKey}
              onChange={(e) => setForm({ ...form, publicKey: e.target.value })}
              placeholder="Found on the same General Information page"
              className="font-mono text-xs"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`cmd-${serverId}`}>Requests allowed in</Label>
              {channelSelect(`cmd-${serverId}`, form.commandChannelId, (v) => setForm({ ...form, commandChannelId: v }), "Any channel")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`apr-${serverId}`}>Send approval cards to</Label>
              {channelSelect(`apr-${serverId}`, form.approvalChannelId, (v) => setForm({ ...form, approvalChannelId: v }), "Don't send (review in MUNO)")}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Roles that can request posts</Label>
            <RolePicker roles={roles.data?.roles ?? []} value={form.submitRoleIds} onChange={(v) => setForm({ ...form, submitRoleIds: v })} />
          </div>
          <div className="space-y-1.5">
            <Label>Roles that can approve / reject</Label>
            <RolePicker roles={roles.data?.roles ?? []} value={form.approveRoleIds} onChange={(v) => setForm({ ...form, approveRoleIds: v })} />
            <p className="text-xs text-muted-foreground">Discord server administrators can always approve.</p>
          </div>
          <div className="space-y-1.5 sm:max-w-xs">
            <Label htmlFor={`tz-${serverId}`}>Timezone for typed times</Label>
            <Input id={`tz-${serverId}`} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={busy} onClick={() => void onSave(true)}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save & add commands to Discord
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void onSave(false)}>
              Save only
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            {settings.data?.registeredAt && (
              <span className="text-xs text-muted-foreground">Commands added ✓</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
