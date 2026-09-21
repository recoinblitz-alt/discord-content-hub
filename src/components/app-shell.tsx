import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCheck,
  FileText,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Moon,
  PenSquare,
  Plus,
  Server,
  Sun,
  Users,
  Zap,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/store";
import { useTheme } from "@/lib/use-theme";
import { ROLE_LABELS } from "@/lib/types";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
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

export function AppFrame({ children }: { children: ReactNode }) {
  const {
    organizations,
    currentOrg,
    currentUser,
    orgPosts,
    orgChannels,
    setOrg,
    createWorkspace,
    signOut,
    permissions,
  } = useWorkspace();
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [creating, setCreating] = useState(false);

  const approvalChannels = new Set(
    orgChannels.filter((c) => c.requiresApproval).map((c) => c.id),
  );
  const pendingCount = orgPosts.filter(
    (p) => p.status === "pending" && approvalChannels.has(p.channelId),
  ).length;

  const newWorkspace = async () => {
    const name = window.prompt("Name the new workspace");
    if (!name?.trim()) return;
    setCreating(true);
    try {
      await createWorkspace(name.trim(), "Workspace");
      toast.success("Workspace created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the workspace");
    } finally {
      setCreating(false);
    }
  };

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
              Workspace
            </label>
            <div className="flex gap-1.5">
              <select
                value={currentOrg.id}
                onChange={(e) => setOrg(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-sidebar-border bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void newWorkspace()}
                disabled={creating}
                title="New workspace"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">
              {currentOrg.tag} · {currentOrg.plan} plan
            </p>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
            {nav.map((item) => {
              const active = pathname.startsWith(item.to);
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
            <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-2">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt="" className="h-7 w-7 rounded-full bg-muted" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-muted" />
              )}
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-xs font-medium">{currentUser.name}</div>
                <div className="text-[0.6875rem] text-muted-foreground">
                  {ROLE_LABELS[currentUser.role]}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={toggle}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark" ? "Light" : "Discord"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void signOut()} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2 font-display text-sm font-semibold">
                <Zap className="h-4 w-4 text-blurple" /> Relaystack
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={toggle} title="Change theme">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void signOut()} title="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  preload="intent"
                  className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

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
  return (
    <div className="page-enter">
      <header className="sticky top-[105px] z-20 border-b border-border bg-background/85 backdrop-blur lg:top-0">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 md:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-semibold">{title}</h1>
            {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      </header>
      <div className="px-5 py-6 md:px-8">{children}</div>
    </div>
  );
}
