import { createFileRoute, Link } from "@tanstack/react-router";
import { PenSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fullDate, relative } from "@/lib/format";
import { useStore } from "@/lib/store";
import { STATUS_LABELS, type PostStatus } from "@/lib/types";

export const Route = createFileRoute("/posts")({
  head: () => ({
    meta: [
      { title: "All posts — Relaystack" },
      {
        name: "description",
        content: "Every Discord draft, submission, scheduled and published post in one filterable list.",
      },
      { property: "og:title", content: "All posts — Relaystack" },
      {
        property: "og:description",
        content: "Filter Discord posts by server, channel and lifecycle status.",
      },
    ],
  }),
  component: Posts,
});

function Posts() {
  const { orgPosts, orgServers, channelsOfServer, serverOf, channelOf, memberOf, deletePost } =
    useStore();
  const [status, setStatus] = useState<PostStatus | "all">("all");
  const [serverId, setServerId] = useState("all");
  const [channelId, setChannelId] = useState("all");
  const [q, setQ] = useState("");

  const filtered = orgPosts
    .filter((p) => (status === "all" ? true : p.status === status))
    .filter((p) => (serverId === "all" ? true : p.serverId === serverId))
    .filter((p) => (channelId === "all" ? true : p.channelId === channelId))
    .filter((p) =>
      q.trim() ? `${p.title} ${p.content} ${p.embed.title}`.toLowerCase().includes(q.toLowerCase()) : true,
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <AppShell
      title="Posts"
      subtitle={`${filtered.length} of ${orgPosts.length} posts`}
      actions={
        <Button asChild size="sm">
          <Link to="/composer">
            <PenSquare className="h-4 w-4" /> New post
          </Link>
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Search posts…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56"
        />
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
        <select
          value={serverId}
          onChange={(e) => {
            setServerId(e.target.value);
            setChannelId("all");
          }}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
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
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          disabled={serverId === "all"}
        >
          <option value="all">All channels</option>
          {serverId !== "all" &&
            channelsOfServer(serverId).map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Post</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Author</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Scheduled</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-accent/30">
                <td className="max-w-72 px-4 py-3">
                  <Link
                    to="/composer"
                    search={{ postId: p.id }}
                    className="block truncate font-medium hover:underline"
                  >
                    {p.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {p.kind === "embed" ? "Rich embed" : "Standard message"} · rev {p.revision}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {serverOf(p.serverId)?.name}
                  <br />
                  <span className="text-xs">#{channelOf(p.channelId)?.name}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{memberOf(p.authorId)?.name}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {fullDate(p.scheduledAt)}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{relative(p.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      deletePost(p.id);
                      toast.success("Post deleted");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No posts match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
