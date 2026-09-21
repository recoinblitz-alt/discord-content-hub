import { createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { createInvite } from "@/lib/invites.functions";
import { useWorkspace } from "@/lib/store";
import { ROLE_LABELS, permissionsFor, type Role } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team & roles — MUNO" },
      {
        name: "description",
        content:
          "Manage Super Admin, Admin, Approver and Normal User permissions and simulate any role.",
      },
      { property: "og:title", content: "Team & roles — MUNO" },
      {
        property: "og:description",
        content: "Role-based permissions for Discord content creation and approval.",
      },
    ],
  }),
  component: Team,
});

const PERMISSION_ROWS = [
  { key: "createPost", label: "Create and edit posts" },
  { key: "approve", label: "Review, approve and reject" },
  { key: "publishDirectly", label: "Publish / schedule directly" },
  { key: "configureServers", label: "Configure servers and bots" },
  { key: "manageTeam", label: "Manage team members" },
  { key: "manageOrganizations", label: "Manage organizations" },
] as const;

function Team() {
  const {
    orgMembers,
    currentOrg,
    currentUser,
    setMemberRole,
    removeMember,
    permissions,
    orgPosts,
  } = useWorkspace();
  const roles: Role[] = ["super_admin", "admin", "approver", "user"];
  const assignableRoles: Role[] = currentUser.role === "super_admin" ? roles : ["admin", "approver", "user"];
  const roleOptions = (memberRole: Role): Role[] =>
    memberRole === "super_admin" && !assignableRoles.includes("super_admin")
      ? ["super_admin"]
      : assignableRoles;

  if (!permissions.manageTeam) {
    return (
      <AppShell title="Team & roles" subtitle="Restricted">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          Only Super Admins and Admins can view members or manage roles.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Team & roles"
      subtitle={`${orgMembers.length} members in ${currentOrg.name}`}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="space-y-3 md:hidden">
            {orgMembers.map((m) => (
              <article key={m.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex min-w-0 items-center gap-3">
                  {m.avatar ? <img src={m.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full bg-muted" /> : <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />}
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{m.name}</div><div className="truncate text-xs text-muted-foreground">{m.email}</div></div>
                </div>
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border pt-3">
                  <select value={m.role} disabled={currentUser.id === m.id || (currentUser.role === "admin" && m.role === "super_admin")} onChange={(e) => void setMemberRole(m.id, e.target.value as Role).catch((error) => toast.error(error instanceof Error ? error.message : "Could not change role"))} className="min-w-0 rounded-lg border border-input bg-background px-2 py-2 text-sm disabled:opacity-60">
                    {roleOptions(m.role).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  {currentUser.id === m.id ? <span className="rounded-lg border border-primary bg-primary/15 px-3 py-2 text-xs text-primary">You</span> : !(currentUser.role === "admin" && m.role === "super_admin") && <Button size="sm" variant="ghost" onClick={() => void removeMember(m.id).catch((error) => toast.error(error instanceof Error ? error.message : "Could not remove member"))}>Remove</Button>}
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Posts</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orgMembers.map((m) => (
                <tr key={m.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={m.avatar} alt="" className="h-9 w-9 rounded-full bg-muted" />
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={m.role}
                      disabled={currentUser.id === m.id || (currentUser.role === "admin" && m.role === "super_admin")}
                      onChange={(e) => {
                        void setMemberRole(m.id, e.target.value as Role).catch((error) =>
                          toast.error(error instanceof Error ? error.message : "Could not change role"),
                        );
                      }}
                      className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-60"
                    >
                      {roleOptions(m.role).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {orgPosts.filter((p) => p.authorId === m.id).length}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {currentUser.id === m.id ? (
                      <span className="rounded-lg border border-primary bg-primary/15 px-3 py-1.5 text-xs text-primary">
                        You
                      </span>
                    ) : (
                        permissions.manageTeam && !(currentUser.role === "admin" && m.role === "super_admin") && (
                        <button
                          onClick={() => void removeMember(m.id).catch((error) => toast.error(error instanceof Error ? error.message : "Could not remove member"))}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        >
                          Remove
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="space-y-6">
        {permissions.manageTeam && <InvitePanel orgId={currentOrg.id} />}

        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Permission matrix
          </div>
          <table className="min-w-[470px] w-full text-sm">
            <thead className="bg-surface-2 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Capability</th>
                {roles.map((r) => (
                  <th key={r} className="px-2 py-2">
                    {ROLE_LABELS[r].split(" ")[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PERMISSION_ROWS.map((row) => (
                <tr key={row.key}>
                  <td className="px-3 py-2 text-muted-foreground">{row.label}</td>
                  {roles.map((r) => (
                    <td key={r} className="px-2 py-2 text-center">
                      {permissionsFor(r)[row.key] ? (
                        <Check className="mx-auto h-4 w-4 text-success" />
                      ) : (
                        <X className="mx-auto h-4 w-4 text-muted-foreground/50" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </AppShell>
  );
}

function InvitePanel({ orgId }: { orgId: string }) {
  const { currentUser } = useWorkspace();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    try {
      const result = await createInvite({ data: { orgId, email, role, origin: window.location.origin } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setLink(`${window.location.origin}/invite/${result.token}`);
      setEmail("");
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the invite");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">Invite a teammate</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Share the link you get back. They join with the role you pick as soon as they sign in with
        that email.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-lg border border-input bg-background px-2 py-2 text-sm"
        >
          {(currentUser.role === "super_admin"
            ? (["super_admin", "admin", "approver", "user"] as Role[])
            : (["admin", "approver", "user"] as Role[])
          ).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <Button onClick={() => void send()} disabled={busy || !email}>
          {busy ? "Creating…" : "Create invite"}
        </Button>
      </div>
      {link && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
          <code className="flex-1 truncate text-xs">{link}</code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Link copied");
            }}
          >
            Copy
          </Button>
        </div>
      )}
    </div>
  );
}
