import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { fullDate } from "@/lib/format";
import { useWorkspace } from "@/lib/store";
import { STATUS_LABELS, type Post, type PostStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Content calendar — Relaystack" },
      {
        name: "description",
        content:
          "Month, week and list views of every scheduled and published Discord announcement per server and channel.",
      },
      { property: "og:title", content: "Content calendar — Relaystack" },
      {
        property: "og:description",
        content: "See scheduled and published Discord posts across servers and channels.",
      },
    ],
  }),
  component: CalendarPage,
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(d: Date) {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function CalendarPage() {
  const { orgPosts, orgServers, channelsOfServer, serverOf, channelOf } = useWorkspace();
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [serverId, setServerId] = useState("all");
  const [channelId, setChannelId] = useState("all");
  const [status, setStatus] = useState<PostStatus | "all">("all");

  const events = orgPosts
    .filter((p) => p.scheduledAt || p.publishedAt)
    .filter((p) => (serverId === "all" ? true : p.serverId === serverId))
    .filter((p) => (channelId === "all" ? true : p.channelId === channelId))
    .filter((p) => (status === "all" ? true : p.status === status));

  const dateOf = (p: Post) => new Date(p.publishedAt ?? p.scheduledAt ?? "");
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  const shift = (dir: number) => {
    const next = new Date(cursor);
    if (view === "week") next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setCursor(next);
  };

  const monthCells = () => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const weekCells = () => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const EventChip = ({ p }: { p: Post }) => (
    <Link
      to="/composer"
      search={{ postId: p.id }}
      className="block truncate rounded px-1.5 py-1 text-[0.6875rem] leading-tight transition hover:brightness-110"
      style={{ backgroundColor: `${p.embed.color}26`, borderLeft: `3px solid ${p.embed.color}` }}
      title={`${p.title} · ${STATUS_LABELS[p.status]}`}
    >
      <span className="font-medium">
        {dateOf(p).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </span>{" "}
      {p.title}
    </Link>
  );

  return (
    <AppShell
      title="Content calendar"
      subtitle={`${events.length} scheduled or published posts`}
      actions={
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {(["month", "week", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" onClick={() => shift(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="outline" onClick={() => shift(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="mr-2 font-display text-base font-semibold">
          {view === "week"
            ? `Week of ${startOfWeek(cursor).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
            : cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setCursor(new Date())}>
          Today
        </Button>

        <select
          value={serverId}
          onChange={(e) => {
            setServerId(e.target.value);
            setChannelId("all");
          }}
          className="ml-auto rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All servers</option>
          {orgServers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          disabled={serverId === "all"}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All channels</option>
          {serverId !== "all" &&
            channelsOfServer(serverId).map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PostStatus | "all")}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABELS) as PostStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {view === "month" && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="grid grid-cols-7 border-b border-border bg-surface-2 text-xs font-semibold text-muted-foreground">
            {DAYS.map((d) => (
              <div key={d} className="px-2 py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells().map((d, i) => {
              const dayEvents = events.filter((p) => sameDay(dateOf(p), d));
              const inMonth = d.getMonth() === cursor.getMonth();
              const today = sameDay(d, new Date());
              return (
                <div
                  key={i}
                  className={`min-h-28 space-y-1 border-b border-r border-border p-1.5 ${
                    inMonth ? "" : "bg-surface-2/50 opacity-60"
                  }`}
                >
                  <div
                    className={`mb-1 text-xs ${today ? "font-bold text-primary" : "text-muted-foreground"}`}
                  >
                    {d.getDate()}
                  </div>
                  {dayEvents.map((p) => (
                    <EventChip key={p.id} p={p} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="grid gap-3 md:grid-cols-7">
          {weekCells().map((d, i) => {
            const dayEvents = events.filter((p) => sameDay(dateOf(p), d));
            return (
              <div key={i} className="rounded-xl border border-border bg-surface p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  {DAYS[i]} {d.getDate()}
                </div>
                <div className="space-y-1.5">
                  {dayEvents.map((p) => (
                    <EventChip key={p.id} p={p} />
                  ))}
                  {dayEvents.length === 0 && (
                    <p className="text-[0.6875rem] text-muted-foreground">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "list" && (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {events
            .slice()
            .sort((a, b) => dateOf(a).getTime() - dateOf(b).getTime())
            .map((p) => (
              <Link
                key={p.id}
                to="/composer"
                search={{ postId: p.id }}
                className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition hover:bg-accent/40"
              >
                <span
                  className="h-8 w-1 rounded-full"
                  style={{ backgroundColor: p.embed.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {serverOf(p.serverId)?.name} · #{channelOf(p.channelId)?.name} ·{" "}
                    {fullDate(p.publishedAt ?? p.scheduledAt)} {p.timezone}
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </Link>
            ))}
          {events.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing scheduled with these filters.
            </p>
          )}
        </div>
      )}
    </AppShell>
  );
}
