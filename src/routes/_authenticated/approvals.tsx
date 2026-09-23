import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, MessageSquare, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { DiscordPreview } from "@/components/discord-preview";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fullDate, relative } from "@/lib/format";
import { useWorkspace } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approval queue — MUNO" },
      {
        name: "description",
        content:
          "Review pending Discord submissions with the exact preview, then approve, reject or request changes.",
      },
      { property: "og:title", content: "Approval queue — MUNO" },
      {
        property: "og:description",
        content: "Approve, reject or request changes on pending Discord announcements.",
      },
    ],
  }),
  component: Approvals,
});

function Approvals() {
  const { orgPosts, serverOf, channelOf, memberOf, auditOf, transition, permissions, currentUser } = useWorkspace();
  const queue = orgPosts
    .filter((p) => p.status === "pending")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const [selectedId, setSelectedId] = useState<string | null>(queue[0]?.id ?? null);
  const [note, setNote] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => new Set());

  const visibleQueue = queue.filter((post) => !reviewedIds.has(post.id));
  const selected = visibleQueue.find((p) => p.id === selectedId) ?? visibleQueue[0];
  const canSelfApprove = currentUser.role === "super_admin" || currentUser.role === "admin";
  const canReviewSelected = Boolean(selected && (canSelfApprove || selected.authorId !== currentUser.id));
  const expired = Boolean(selected?.scheduledAt && new Date(selected.scheduledAt).getTime() <= Date.now());

  if (!permissions.approve) {
    return (
      <AppShell title="Approval queue" subtitle="Restricted">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-surface p-8 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-warning" />
          <h2 className="mt-3 font-display text-lg font-semibold">Approver access required</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Switch to an Approver, Admin or Super Admin in the sidebar to review submissions.
          </p>
        </div>
      </AppShell>
    );
  }

  const act = async (
    status: "approved" | "rejected" | "changes_requested",
    action: "approved" | "rejected" | "changes_requested",
  ) => {
    if (!selected || reviewingId) return;
    if (status !== "approved" && !note.trim()) {
      toast.error("Add a comment so the creator knows what to change");
      return;
    }
    // Approving a post that already carries a requested time schedules it straight away,
    // so nobody has to reopen the editor just to press "Schedule post".
    if (expired && status !== "rejected") {
      toast.error("The requested posting time has passed. Reject this post with a reason.");
      return;
    }
    const decisionNote =
      status === "approved" && !note.trim()
        ? `Approved and scheduled for ${fullDate(selected.scheduledAt)} ${selected.timezone}`
        : note.trim() || undefined;
    const activeId = selected.id;
    setReviewingId(activeId);
    try {
      await transition(activeId, status === "approved" ? "scheduled" : status, action, decisionNote);
      setReviewedIds((ids) => new Set(ids).add(activeId));
      setNote("");
      toast.success(
        status === "approved"
          ? `Approved and scheduled for ${fullDate(selected.scheduledAt)}`
          : status === "rejected"
            ? "Rejected with feedback"
            : "Changes requested",
      );
      const next = visibleQueue.find((p) => p.id !== activeId);
      setSelectedId(next?.id ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review failed");
    } finally {
      setReviewingId(null);
    }
  };


  return (
    <AppShell title="Approval queue" subtitle={`${visibleQueue.length} submissions awaiting review`}>
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-2">
          {visibleQueue.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                selected?.id === p.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface hover:bg-accent/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">{p.title}</span>
                <StatusBadge status={p.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {serverOf(p.serverId)?.name} · #{channelOf(p.channelId)?.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                by {memberOf(p.authorId)?.name} · {relative(p.updatedAt)} · rev {p.revision}
              </p>
            </button>
          ))}
          {visibleQueue.length === 0 && (
            <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
              Queue is clear. 🎉
            </div>
          )}
        </div>

        {selected && (
          <div className="space-y-5">
            <DiscordPreview
              botName={serverOf(selected.serverId)?.botName ?? "Bot"}
              botAvatar={serverOf(selected.serverId)?.botAvatar ?? ""}
              channelName={channelOf(selected.channelId)?.name}
              kind={selected.kind}
              content={selected.content}
              embed={selected.embed}
              buttons={selected.buttons}
              attachments={selected.attachments}
              timestamp={selected.scheduledAt}
            />

            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold">Review decision</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Requested slot: {fullDate(selected.scheduledAt)} {selected.timezone}
              </p>
              {expired && (
                <p className="mt-2 text-xs font-medium text-destructive">
                  This posting time has passed. Rejection with a reason is the only available decision.
                </p>
              )}
              <Textarea
                className="mt-3"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Comment for the creator (required when rejecting or requesting changes)"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {!expired && <Button disabled={!canReviewSelected || Boolean(reviewingId)} onClick={() => void act("approved", "approved")}>
                  <Check className="h-4 w-4" /> {reviewingId ? "Reviewing…" : "Approve"}
                </Button>}
                {!expired && <Button disabled={!canReviewSelected || Boolean(reviewingId)} variant="secondary" onClick={() => void act("changes_requested", "changes_requested")}>
                  <MessageSquare className="h-4 w-4" /> Request changes
                </Button>}
                <Button disabled={!canReviewSelected || Boolean(reviewingId)} variant="destructive" onClick={() => void act("rejected", "rejected")}>
                  <X className="h-4 w-4" /> Reject
                </Button>
                <Button asChild variant="outline" className="ml-auto">
                  <Link to="/composer" search={{ postId: selected.id }}>
                    Open in editor
                  </Link>
                </Button>
              </div>
              {!canReviewSelected && (
                <p className="mt-2 text-xs text-muted-foreground">Another reviewer must decide on your submission.</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-4 py-3 text-sm font-semibold">
                Audit history
              </div>
              <ol className="divide-y divide-border">
                {auditOf(selected.id)
                  .slice()
                  .reverse()
                  .map((h) => (
                    <li key={h.id} className="flex gap-3 px-4 py-3">
                      {memberOf(h.actorId)?.avatar ? (
                        <img
                          src={memberOf(h.actorId)?.avatar}
                          alt=""
                          className="mt-0.5 h-7 w-7 rounded-full bg-muted"
                        />
                      ) : (
                        <div className="mt-0.5 h-7 w-7 rounded-full bg-muted" />
                      )}
                      <div className="min-w-0 flex-1 text-sm">
                        <span className="font-medium">{memberOf(h.actorId)?.name}</span>{" "}
                        <span className="capitalize text-muted-foreground">
                          {h.action.replace(/_/g, " ")}
                        </span>
                        {h.note && <p className="text-xs text-muted-foreground">“{h.note}”</p>}
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {fullDate(h.at)}
                      </span>
                    </li>
                  ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
