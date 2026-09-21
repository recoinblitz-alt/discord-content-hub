import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarPlus, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ChannelPicker } from "@/components/channel-picker";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fullDate } from "@/lib/format";
import { useWorkspace } from "@/lib/store";
import {
  DISCORD_COLORS,
  STATUS_LABELS,
  TIMEZONES,
  type OrgEvent,
  type Post,
  type PostStatus,
} from "@/lib/types";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Content calendar — MUNO" },
      {
        name: "description",
        content:
          "Month, week and list views of every scheduled post plus shared team events for the whole workspace.",
      },
      { property: "og:title", content: "Content calendar — MUNO" },
      {
        property: "og:description",
        content: "Scheduled Discord posts and shared team events across servers and channels.",
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

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface EventDraft {
  id?: string;
  title: string;
  description: string;
  startsAt: string;
  timezone: string;
  color: string;
}

const blankDraft = (): EventDraft => ({
  title: "",
  description: "",
  startsAt: toLocalInput(new Date().toISOString()),
  timezone: "UTC",
  color: "#5865F2",
});

function CalendarPage() {
  const {
    orgPosts,
    orgServers,
    orgChannels,
    orgEvents,
    channelsOfServer,
    serverOf,
    channelOf,
    permissions,
    saveEvent,
    removeEvent,
  } = useWorkspace();
  const [view, setView] = useState<"month" | "week" | "list">(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? "list" : "month",
  );
  const [cursor, setCursor] = useState(() => new Date());
  const [serverId, setServerId] = useState("all");
  const [channelId, setChannelId] = useState("all");
  const [status, setStatus] = useState<PostStatus | "all">("all");
  const [show, setShow] = useState<"all" | "posts" | "events">("all");
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const canManageEvents = permissions.configureServers;

  const posts =
    show === "events"
      ? []
      : orgPosts
          .filter((p) => p.scheduledAt || p.publishedAt)
          .filter((p) => (serverId === "all" ? true : p.serverId === serverId))
          .filter((p) => (channelId === "all" ? true : p.channelId === channelId))
          .filter((p) => (status === "all" ? true : p.status === status));

  const events = show === "posts" ? [] : orgEvents;

  const dateOf = (p: Post) => new Date(p.publishedAt ?? p.scheduledAt ?? "");
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

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

  const openEdit = (event: OrgEvent) =>
    setDraft({
      id: event.id,
      title: event.title,
      description: event.description,
      startsAt: toLocalInput(event.startsAt),
      timezone: event.timezone,
      color: event.color,
    });

  const submitDraft = async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast.error("Give the event a title");
      return;
    }
    setBusy(true);
    try {
      await saveEvent({
        ...(draft.id ? { id: draft.id } : {}),
        title: draft.title.trim(),
        description: draft.description,
        startsAt: new Date(draft.startsAt).toISOString(),
        endsAt: null,
        timezone: draft.timezone,
        color: draft.color,
      });
      toast.success(draft.id ? "Event updated" : "Event added for the whole workspace");
      setDraft(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the event");
    } finally {
      setBusy(false);
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      await removeEvent(id);
      toast.success("Event removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the event");
    }
  };

  const PostChip = ({ p }: { p: Post }) => (
    <Link
      to="/composer"
      search={{ postId: p.id }}
      className="block truncate rounded px-1.5 py-1 text-[0.6875rem] leading-tight transition hover:brightness-110"
      style={{ backgroundColor: `${p.embed.color}26`, borderLeft: `3px solid ${p.embed.color}` }}
      title={`${p.title} · ${STATUS_LABELS[p.status]}`}
    >
      <span className="font-medium">{time(dateOf(p))}</span> {p.title}
    </Link>
  );

  const EventChip = ({ e }: { e: OrgEvent }) => (
    <button
      type="button"
      onClick={() => canManageEvents && openEdit(e)}
      className="block w-full truncate rounded border border-dashed px-1.5 py-1 text-left text-[0.6875rem] leading-tight transition hover:brightness-110"
      style={{ borderColor: e.color, color: e.color }}
      title={`${e.title}${e.description ? ` — ${e.description}` : ""}`}
    >
      <span className="font-medium">{time(new Date(e.startsAt))}</span> {e.title}
    </button>
  );

  const dayContent = (d: Date) => (
    <>
      {posts.filter((p) => sameDay(dateOf(p), d)).map((p) => (
        <PostChip key={p.id} p={p} />
      ))}
      {events.filter((e) => sameDay(new Date(e.startsAt), d)).map((e) => (
        <EventChip key={e.id} e={e} />
      ))}
    </>
  );

  return (
    <AppShell
      title="Content calendar"
      subtitle={`${posts.length} posts · ${events.length} team events`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {canManageEvents && (
            <Button size="sm" onClick={() => setDraft(blankDraft())}>
              <CalendarPlus className="mr-1.5 h-4 w-4" /> Add event
            </Button>
          )}
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
        </div>
      }
    >
      <div className="mb-4 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
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
        </div>

        <div className="grid grid-cols-3 items-center gap-1 rounded-lg border border-border p-0.5 sm:ml-auto sm:flex">
          {(["all", "posts", "events"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setShow(s)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition ${
                show === s ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:contents">
        <select
          value={serverId}
          onChange={(e) => {
            setServerId(e.target.value);
            setChannelId("all");
          }}
          className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All servers</option>
          {orgServers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="min-w-0 sm:w-48">
          <ChannelPicker
            channels={serverId === "all" ? orgChannels : channelsOfServer(serverId)}
            value={channelId}
            onChange={setChannelId}
            allowAll
            allLabel="All channels"
            serverNameOf={(id) => serverOf(id)?.name}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PostStatus | "all")}
          className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABELS) as PostStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        </div>
      </div>

      {view === "month" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <div className="min-w-[700px]">
          <div className="grid grid-cols-7 border-b border-border bg-surface-2 text-xs font-semibold text-muted-foreground">
            {DAYS.map((d) => (
              <div key={d} className="px-2 py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells().map((d, i) => {
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
                  {dayContent(d)}
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="grid gap-3 md:grid-cols-7">
          {weekCells().map((d, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-3">
              <div className="mb-2 text-xs font-semibold text-muted-foreground">
                {DAYS[i]} {d.getDate()}
              </div>
              <div className="space-y-1.5">{dayContent(d)}</div>
            </div>
          ))}
        </div>
      )}

      {view === "list" && (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {events
            .slice()
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
            .map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <span className="h-8 w-1 rounded-full" style={{ backgroundColor: e.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Team event · {fullDate(e.startsAt)} {e.timezone}
                    {e.description ? ` · ${e.description}` : ""}
                  </div>
                </div>
                {canManageEvents && (
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => void deleteEvent(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          {posts
            .slice()
            .sort((a, b) => dateOf(a).getTime() - dateOf(b).getTime())
            .map((p) => (
              <Link
                key={p.id}
                to="/composer"
                search={{ postId: p.id }}
                className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition hover:bg-accent/40"
              >
                <span className="h-8 w-1 rounded-full" style={{ backgroundColor: p.embed.color }} />
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
          {posts.length === 0 && events.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing scheduled with these filters.
            </p>
          )}
        </div>
      )}

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit team event" : "Add team event"}</DialogTitle>
            <DialogDescription>
              Everyone in this workspace sees this event on the calendar.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">Title</Label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Season 4 kickoff stream"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Details (optional)</Label>
                <Textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs">Date and time</Label>
                  <DateTimeField
                    value={draft.startsAt}
                    onChange={(next) => setDraft({ ...draft, startsAt: next })}
                  />

                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Timezone</Label>
                  <select
                    value={draft.timezone}
                    onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Colour</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DISCORD_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setDraft({ ...draft, color: c.hex })}
                      title={c.name}
                      className={`h-6 w-6 rounded-md border-2 transition ${
                        draft.color === c.hex ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {draft?.id && (
              <Button
                variant="outline"
                onClick={async () => {
                  if (!draft.id) return;
                  await deleteEvent(draft.id);
                  setDraft(null);
                }}
              >
                Delete
              </Button>
            )}
            <Button disabled={busy} onClick={() => void submitDraft()}>
              {draft?.id ? "Save event" : "Add event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
