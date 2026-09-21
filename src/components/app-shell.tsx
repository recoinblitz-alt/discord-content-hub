import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCheck,
  FileText,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
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

import { LegalFooter } from "@/components/legal-page";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  const [menuOpen, setMenuOpen] = useState(false);

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
            <BrandLogo className="h-10 w-10" />
            <div className="leading-tight">
              <div className="font-display text-sm font-semibold">MUNO</div>
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
                (item.to === "/team" && !permissions.manageTeam) ||
                (item.to === "/approvals" && !permissions.approve);
              if (hidden) return null;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  preload="intent"
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
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2 font-display text-sm font-semibold">
                <BrandLogo className="h-6 w-6" /> MUNO
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={toggle} title="Change theme">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void signOut()} title="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Open navigation">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="flex w-[88vw] max-w-sm flex-col p-0">
                    <SheetHeader className="border-b border-border px-5 py-5 text-left">
                      <SheetTitle className="flex items-center gap-2">
                        <BrandLogo className="h-8 w-8" /> MUNO
                      </SheetTitle>
                      <SheetDescription>{ROLE_LABELS[currentUser.role]} · {currentOrg.name}</SheetDescription>
                    </SheetHeader>
                    <div className="border-b border-border p-4">
                      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Workspace</label>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <select value={currentOrg.id} onChange={(e) => setOrg(e.target.value)} className="min-w-0 rounded-lg border border-input bg-background px-3 py-2.5 text-sm">
                          {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                        </select>
                        {permissions.manageOrganizations && <Button size="icon" variant="outline" onClick={() => void newWorkspace()}><Plus className="h-4 w-4" /></Button>}
                      </div>
                    </div>
                    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                      {nav.filter((item) => !((item.to === "/settings" && !permissions.configureServers) || (item.to === "/team" && !permissions.manageTeam) || (item.to === "/approvals" && !permissions.approve))).map((item) => (
                        <SheetClose asChild key={item.to}>
                          <Link to={item.to} preload="intent" className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm ${pathname.startsWith(item.to) ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground"}`}>
                            <item.icon className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.to === "/approvals" && pendingCount > 0 && <span className="rounded-full bg-warning px-2 py-0.5 text-xs text-warning-foreground">{pendingCount}</span>}
                          </Link>
                        </SheetClose>
                      ))}
                    </nav>
                  </SheetContent>
                </Sheet>
              </div>
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
      <header className="sticky top-[61px] z-20 border-b border-border bg-background/85 backdrop-blur lg:top-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 md:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-semibold">{title}</h1>
            {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="col-span-2 flex max-w-full flex-wrap items-center justify-start gap-2 sm:col-span-1 sm:shrink-0 sm:justify-end">{actions}</div>
        </div>
      </header>
      <div className="overflow-hidden px-4 py-5 md:px-8 md:py-6">{children}</div>
      <LegalFooter className="border-t border-border px-4 py-5 md:px-8" />
    </div>
  );
}
