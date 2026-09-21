import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { fullDate } from "@/lib/format";
import { useWorkspace } from "@/lib/store";
import type { AuditAction } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Audit trail — MUNO" },
      {
        name: "description",
        content:
          "Full history of Discord post creation, revisions, approval decisions and simulated delivery results.",
      },
      { property: "og:title", content: "Audit trail — MUNO" },
      {
        property: "og:description",
        content: "Every creation, revision, approval and delivery event on your Discord posts.",
      },
    ],
  }),
  component: History,
});

const ACTIONS: (AuditAction | "all")[] = [
  "all",
  "created",
  "updated",
  "submitted",
  "resubmitted",
  "approved",
  "changes_requested",
  "rejected",
  "scheduled",
  "published",
  "failed",
  "cancelled",
  "comment",
];

function History() {
  const { state, orgPosts, memberOf, channelOf } = useWorkspace();
  const [action, setAction] = useState<AuditAction | "all">("all");
  const [actor, setActor] = useState("all");

  const entries = state.audit
    .filter((a) => orgPosts.some((p) => p.id === a.postId))
    .filter((a) => (action === "all" ? true : a.action === action))
    .filter((a) => (actor === "all" ? true : a.actorId === actor))
    .sort((a, b) => b.at.localeCompare(a.at));

  const deliveries = orgPosts.filter((p) => p.deliveryNote);

  return (
    <AppShell title="Audit trail" subtitle={`${entries.length} recorded events`}>
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as AuditAction | "all")}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a === "all" ? "All actions" : a.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All members</option>
          {state.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {entries.map((a) => {
            const post = orgPosts.find((p) => p.id === a.postId);
            return (
              <li key={a.id} className="flex gap-3 px-4 py-3.5">
                {memberOf(a.actorId)?.avatar ? (
                  <img
                    src={memberOf(a.actorId)?.avatar}
                    alt=""
                    className="mt-0.5 h-8 w-8 rounded-full bg-muted"
                  />
                ) : (
                  <div className="mt-0.5 h-8 w-8 rounded-full bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{memberOf(a.actorId)?.name}</span>{" "}
                    <span className="capitalize text-muted-foreground">
                      {a.action.replace(/_/g, " ")}
                    </span>{" "}
                    {post && (
                      <Link
                        to="/composer"
                        search={{ postId: post.id }}
                        className="font-medium hover:underline"
                      >
                        {post.title}
                      </Link>
                    )}
                  </p>
                  {a.note && <p className="mt-0.5 text-xs text-muted-foreground">“{a.note}”</p>}
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {fullDate(a.at)}
                </span>
              </li>
            );
          })}
          {entries.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              No events match these filters.
            </li>
          )}
        </ol>

        <div className="rounded-xl border border-border bg-surface lg:sticky lg:top-28 lg:self-start">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Delivery results
          </div>
          <ul className="divide-y divide-border">
            {deliveries.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{p.title}</span>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  #{channelOf(p.channelId)?.name} · {fullDate(p.publishedAt ?? p.scheduledAt)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{p.deliveryNote}</p>
              </li>
            ))}
            {deliveries.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No delivery attempts yet.
              </li>
            )}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
