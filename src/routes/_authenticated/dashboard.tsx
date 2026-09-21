import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  CheckCheck,
  FileText,
  PenSquare,
  Send,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { fullDate, relative } from "@/lib/format";
import { useWorkspace } from "@/lib/store";
import { STATUS_LABELS, type PostStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Relaystack Discord content ops" },
      {
        name: "description",
        content:
          "Pipeline overview of Discord drafts, approvals, scheduled announcements and delivery health.",
      },
      { property: "og:title", content: "Dashboard — Relaystack Discord content ops" },
      {
        property: "og:description",
        content: "Pipeline overview of Discord drafts, approvals and scheduled announcements.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { currentOrg, currentUser, orgPosts, state, serverOf, channelOf, memberOf, permissions } =
    useWorkspace();

  const count = (s: PostStatus) => orgPosts.filter((p) => p.status === s).length;
  const pending = orgPosts.filter((p) => p.status === "pending");
  const upcoming = orgPosts
    .filter((p) => (p.status === "scheduled" || p.status === "approved") && p.scheduledAt)
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
    .slice(0, 5);
  const mine = orgPosts.filter((p) => p.authorId === currentUser.id);
  const activity = state.audit
    .filter((a) => orgPosts.some((p) => p.id === a.postId))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const stats = [
    { label: "Pending approval", value: count("pending"), icon: CheckCheck, tone: "text-warning" },
    { label: "Scheduled", value: count("scheduled"), icon: CalendarClock, tone: "text-blurple" },
    { label: "Published", value: count("published"), icon: Send, tone: "text-success" },
    {
      label: "Needs attention",
      value: count("changes_requested") + count("failed") + count("rejected"),
      icon: AlertTriangle,
      tone: "text-destructive",
    },
  ];

  return (
    <AppShell
      title={`${currentOrg.name} workspace`}
      subtitle={`${orgPosts.length} posts · ${state.servers.filter((s) => s.orgId === currentOrg.id).length} connected servers`}
      actions={
        <Button asChild size="sm">
          <Link to="/composer">
            <PenSquare className="h-4 w-4" /> New post
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.tone}`} />
            </div>
            <div className="mt-2 font-display text-3xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-surface lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">Approval queue</h2>
            {permissions.approve && (
              <Link to="/approvals" className="text-xs text-primary hover:underline">
                Review all
              </Link>
            )}
          </div>
          <div className="divide-y divide-border">
            {pending.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nothing waiting on review.
              </p>
            )}
            {pending.map((p) => (
              <Link
                key={p.id}
                to="/composer"
                search={{ postId: p.id }}
                className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-accent/40"
              >
                <img
                  src={memberOf(p.authorId)?.avatar}
                  alt=""
                  className="h-8 w-8 rounded-full bg-muted"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {serverOf(p.serverId)?.name} · #{channelOf(p.channelId)?.name} · by{" "}
                    {memberOf(p.authorId)?.name} · {relative(p.updatedAt)}
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">Up next</h2>
          </div>
          <div className="divide-y divide-border">
            {upcoming.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No scheduled posts.
              </p>
            )}
            {upcoming.map((p) => (
              <div key={p.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{p.title}</span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {fullDate(p.scheduledAt)} {p.timezone} · #{channelOf(p.channelId)?.name}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-surface lg:col-span-2">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">Recent activity</h2>
          </div>
          {activity.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nothing has happened yet. Create your first post to start the trail.
            </p>
          )}
          <ol className="divide-y divide-border">
            {activity.map((a) => {
              const post = orgPosts.find((p) => p.id === a.postId);
              const avatar = memberOf(a.actorId)?.avatar;
              return (
                <li key={a.id} className="flex gap-3 px-5 py-3">
                  {avatar ? (
                    <img src={avatar} alt="" className="mt-0.5 h-7 w-7 rounded-full bg-muted" />
                  ) : (
                    <span className="mt-0.5 h-7 w-7 rounded-full bg-muted" />
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{memberOf(a.actorId)?.name}</span>{" "}
                    <span className="text-muted-foreground">
                      {a.action.replace(/_/g, " ")} · {post?.title}
                    </span>
                    {a.note && <p className="mt-0.5 text-xs text-muted-foreground">“{a.note}”</p>}
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {relative(a.at)}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold">Your work</h2>
          </div>
          <div className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">
              {mine.length} posts authored by you in this organization.
            </p>
            <div className="space-y-1.5">
              {(
                [
                  "draft",
                  "changes_requested",
                  "pending",
                  "scheduled",
                  "published",
                ] as PostStatus[]
              ).map((s) => (
                <div key={s} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{STATUS_LABELS[s]}</span>
                  <span className="font-medium">{mine.filter((p) => p.status === s).length}</span>
                </div>
              ))}
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/posts">
                <FileText className="h-4 w-4" /> Open post list
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
