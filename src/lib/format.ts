import type { PostStatus } from "./types";

export function discordTime(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today at ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })} ${time}`;
}

export function fullDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60)
    return `${mins <= 0 ? "in " : ""}${Math.abs(mins)}m${mins > 0 ? " ago" : ""}`;
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return `${hrs <= 0 ? "in " : ""}${Math.abs(hrs)}h${hrs > 0 ? " ago" : ""}`;
  const days = Math.round(hrs / 24);
  return `${days <= 0 ? "in " : ""}${Math.abs(days)}d${days > 0 ? " ago" : ""}`;
}

export const statusStyles: Record<PostStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  pending: "bg-warning/15 text-warning border-warning/30",
  changes_requested: "bg-info/15 text-info border-info/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  approved: "bg-success/15 text-success border-success/30",
  scheduled: "bg-blurple/15 text-blurple border-blurple/30",
  published: "bg-success/20 text-success border-success/40",
  failed: "bg-destructive/20 text-destructive border-destructive/40",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export interface MentionNames {
  channels: Map<string, string>;
  roles: Map<string, { name: string; color: string }>;
  users: Map<string, string>;
}

let mentionNames: MentionNames = { channels: new Map(), roles: new Map(), users: new Map() };

/** Lets the preview show real names for <#id>, <@&id> and <@id> mentions. */
export function setMentionNames(names: MentionNames) {
  mentionNames = names;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Minimal Discord-flavoured markdown to safe HTML. */
export function renderMarkdown(input: string): string {
  const html = renderBase(input);
  return html
    .replace(/&lt;#(\d{5,})&gt;/g, (_, id: string) => {
      const n = mentionNames.channels.get(id);
      return `<span class="dc-mention">#${esc(n ?? "unknown-channel")}</span>`;
    })
    .replace(/&lt;@&amp;(\d{5,})&gt;/g, (_, id: string) => {
      const r = mentionNames.roles.get(id);
      if (!r) return '<span class="dc-mention">@unknown-role</span>';
      const c = r.color !== "#000000" ? r.color : "";
      const style = c ? ` style="color:${c};background:${c}26"` : "";
      return `<span class="dc-mention"${style}>@${esc(r.name)}</span>`;
    })
    .replace(/&lt;@!?(\d{5,})&gt;/g, (_, id: string) => {
      const n = mentionNames.users.get(id);
      return `<span class="dc-mention">@${esc(n ?? "unknown-user")}</span>`;
    });
}

function renderBase(input: string): string {
  const escaped = input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return escaped
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    )
    .replace(/```([\s\S]*?)```/g, "<code>$1</code>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/__([^_]+)__/g, "<u>$1</u>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/(@everyone|@here)/g, '<span class="dc-mention">$1</span>')
    .replace(/&lt;#([a-z0-9-]+)&gt;/gi, '<span class="dc-mention">#$1</span>')
    .replace(/\n/g, "<br/>");
}
