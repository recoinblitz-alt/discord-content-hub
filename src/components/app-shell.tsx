import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCheck,
  FileText,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  Moon,
  PenSquare,
  RotateCcw,
  Server,
  Sun,
  Users,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/use-theme";
import { ROLE_LABELS, type Role } from "@/lib/types";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/composer", label: "Post Creator", icon: PenSquare },
  { to: "/posts", label: "Posts", icon: FileText },
  { to: "/approvals", label: "Approval Queue", icon: CheckCheck },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/templates", label: "Templates", icon: Zap },
  { to: "/media", label: "Media Library", icon: ImageIcon },
  { to: "/history", label: "Audit Trail", icon: History },
  { to: "/team", label: "Team & Roles", icon: Users },
  { to: "/settings", label: "Servers & Bots", icon: Server },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const {
    state,
    currentOrg,
    currentUser,
    orgMembers,
    orgPosts,
    orgChannels,
    setOrg,
    setUser,
    setRole,
    resetDemo,
    permissions,
  } = useStore();
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const approvalChannels = new Set(
    orgChannels.filter((c) => c.requiresApproval).map((c) => c.id),
  );
  const pendingCount = orgPosts.filter(
    (p) => p.status === "pending" && approvalChannels.has(p.channelId),
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blurple text-blurple-foreground">
              <Zap className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-sm font-semibold">Relaystack</div>
              <div className="text-xs text-muted-foreground">Discord content ops</div>
            </div>
          </div>

          <div className="px-4 pb-3">
            <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Organization
            </label>
            <select
              value={currentOrg.id}
              onChange={(e) => setOrg(e.target.value)}
              className="w-full rounded-lg border border-sidebar-border bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {state.organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">
              {currentOrg.tag} · {currentOrg.plan} plan
            </p>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
            {nav.map((item) => {
              const active =
                item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              const hidden =
                (item.to === "/settings" && !permissions.configureServers) ||
                (item.to === "/approvals" && !permissions.approve);
              if (hidden) return null;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  {item.to === "/approvals" && pendingCount > 0 && (
                    <span className="rounded-full bg-warning px-1.5 py-0.5 text-[0.625rem] font-bold text-warning-foreground">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-2 border-t border-sidebar-border px-4 py-4">
            <label className="block text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Simulate member
            </label>
            <select
              value={currentUser.id}
              onChange={(e) => setUser(e.target.value)}
              className="w-full rounded-lg border border-sidebar-border bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {orgMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {ROLE_LABELS[m.role]}
                </option>
              ))}
            </select>
            <select
              value={currentUser.role}
              onChange={(e) => setRole(currentUser.id, e.target.value as Role)}
              className="w-full rounded-lg border border-sidebar-border bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  Act as {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={toggle}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark" ? "Light" : "Discord"}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetDemo} title="Reset demo data">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3 px-5 py-4 md:px-8">
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-display text-xl font-semibold">{title}</h1>
                {subtitle && (
                  <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2">{actions}</div>
              <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1.5">
                <img src={currentUser.avatar} alt="" className="h-7 w-7 rounded-full bg-muted" />
                <div className="hidden leading-tight sm:block">
                  <div className="text-xs font-medium">{currentUser.name}</div>
                  <div className="text-[0.6875rem] text-muted-foreground">
                    {ROLE_LABELS[currentUser.role]}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 lg:hidden">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </header>
          <div className="px-5 py-6 md:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
