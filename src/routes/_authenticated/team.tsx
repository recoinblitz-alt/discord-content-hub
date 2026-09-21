import { createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { useStore } from "@/lib/store";
import { ROLE_LABELS, permissionsFor, type Role } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team & roles — Relaystack" },
      {
        name: "description",
        content:
          "Manage Super Admin, Admin, Approver and Normal User permissions and simulate any role.",
      },
      { property: "og:title", content: "Team & roles — Relaystack" },
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
  const { orgMembers, currentOrg, currentUser, setUser, setRole, permissions, orgPosts } =
    useStore();
  const roles: Role[] = ["super_admin", "admin", "approver", "user"];

  return (
    <AppShell
      title="Team & roles"
      subtitle={`${orgMembers.length} members in ${currentOrg.name}`}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
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
                      disabled={!permissions.manageTeam}
                      onChange={(e) => setRole(m.id, e.target.value as Role)}
                      className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-60"
                    >
                      {roles.map((r) => (
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
                    <button
                      onClick={() => setUser(m.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                        currentUser.id === m.id
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {currentUser.id === m.id ? "Acting as" : "Simulate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Permission matrix
          </div>
          <table className="w-full text-sm">
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
    </AppShell>
  );
}
