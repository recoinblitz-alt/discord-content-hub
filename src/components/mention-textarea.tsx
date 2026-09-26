import { Hash, Megaphone, Shield } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Textarea } from "@/components/ui/textarea";

export interface MentionDirectory {
  channels: { id: string; name: string }[];
  roles: { id: string; name: string; color: string }[];
  members: { id: string; name: string; username: string; avatar: string }[];
  note?: string | null;
  serverChosen: boolean;
}

type Item =
  | { kind: "channel"; id: string; label: string }
  | { kind: "role"; id: string; label: string; color: string }
  | { kind: "member"; id: string; label: string; sub: string; avatar: string }
  | { kind: "special"; id: string; label: string };

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Raw Discord syntax -> readable text shown in the editor. */
export function toDisplay(raw: string, dir: MentionDirectory) {
  const ch = new Map(dir.channels.map((c) => [c.id, c.name]));
  const ro = new Map(dir.roles.map((r) => [r.id, r.name]));
  const us = new Map(dir.members.map((m) => [m.id, m.name]));
  return raw
    .replace(/<#(\d+)>/g, (m, id: string) => (ch.has(id) ? `#${ch.get(id)}` : m))
    .replace(/<@&(\d+)>/g, (m, id: string) => (ro.has(id) ? `@${ro.get(id)}` : m))
    .replace(/<@!?(\d+)>/g, (m, id: string) => (us.has(id) ? `@${us.get(id)}` : m));
}

/** Readable text -> raw Discord syntax that is saved and sent. */
export function toRaw(text: string, dir: MentionDirectory) {
  const entries: { token: string; raw: string }[] = [
    ...dir.channels.map((c) => ({ token: `#${c.name}`, raw: `<#${c.id}>` })),
    ...dir.roles.map((r) => ({ token: `@${r.name}`, raw: `<@&${r.id}>` })),
    ...dir.members.map((m) => ({ token: `@${m.name}`, raw: `<@${m.id}>` })),
  ].sort((a, b) => b.token.length - a.token.length);
  let out = text;
  for (const e of entries) {
    out = out.replace(new RegExp(`${reEsc(e.token)}(?![\\w-])`, "g"), e.raw);
  }
  return out;
}

interface Props extends Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange"> {
  value: string;
  onChange: (raw: string) => void;
  directory: MentionDirectory;
}

export function MentionTextarea({ value, onChange, directory, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [trigger, setTrigger] = useState<{ char: "@" | "#"; query: string; start: number } | null>(
    null,
  );
  const [active, setActive] = useState(0);
  const display = useMemo(() => toDisplay(value, directory), [value, directory]);

  const items = useMemo<Item[]>(() => {
    if (!trigger) return [];
    const q = trigger.query.toLowerCase();
    const hit = (s: string) => s.toLowerCase().includes(q);
    if (trigger.char === "#") {
      return directory.channels
        .filter((c) => hit(c.name))
        .slice(0, 25)
        .map((c) => ({ kind: "channel", id: c.id, label: c.name }));
    }
    const specials: Item[] = ["everyone", "here"]
      .filter(hit)
      .map((s) => ({ kind: "special", id: s, label: s }));
    const roles: Item[] = directory.roles
      .filter((r) => hit(r.name))
      .slice(0, 10)
      .map((r) => ({ kind: "role", id: r.id, label: r.name, color: r.color }));
    const members: Item[] = directory.members
      .filter((m) => hit(m.name) || hit(m.username))
      .slice(0, 15)
      .map((m) => ({ kind: "member", id: m.id, label: m.name, sub: m.username, avatar: m.avatar }));
    return [...specials, ...roles, ...members].slice(0, 25);
  }, [trigger, directory]);

  const detect = (text: string, caret: number) => {
    const m = /(^|\s)([@#])([^\s@#]*)$/.exec(text.slice(0, caret));
    if (m) {
      setTrigger({ char: m[2] as "@" | "#", query: m[3] ?? "", start: caret - (m[3]?.length ?? 0) - 1 });
      setActive(0);
    } else setTrigger(null);
  };

  const pick = (item: Item) => {
    const el = ref.current;
    if (!el || !trigger) return;
    const caret = el.selectionStart;
    const prefix = trigger.char === "#" ? "#" : "@";
    const insert = `${prefix}${item.label} `;
    const next = display.slice(0, trigger.start) + insert + display.slice(caret);
    onChange(toRaw(next, directory));
    setTrigger(null);
    const pos = trigger.start + insert.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const open = trigger !== null;

  return (
    <div className="relative">
      <Textarea
        {...rest}
        ref={ref}
        value={display}
        onChange={(e) => {
          onChange(toRaw(e.target.value, directory));
          detect(e.target.value, e.target.selectionStart);
        }}
        onClick={(e) => detect(display, e.currentTarget.selectionStart)}
        onBlur={() => setTimeout(() => setTrigger(null), 150)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "Escape") {
            e.preventDefault();
            setTrigger(null);
          } else if (items.length && e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % items.length);
          } else if (items.length && e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + items.length) % items.length);
          } else if (items.length && (e.key === "Enter" || e.key === "Tab")) {
            e.preventDefault();
            const it = items[active];
            if (it) pick(it);
          }
        }}
      />
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          <p className="px-2 pb-1 pt-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {trigger.char === "#" ? "Channels" : "Members & roles"}
            {trigger.query && ` matching ${trigger.char}${trigger.query}`}
          </p>
          {!directory.serverChosen ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Pick a server first.</p>
          ) : items.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No matches</p>
          ) : (
            items.map((it, i) => (
              <button
                key={`${it.kind}-${it.id}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(it);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                  i === active ? "bg-accent" : ""
                }`}
              >
                {it.kind === "channel" && <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />}
                {it.kind === "special" && (
                  <Megaphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                {it.kind === "role" && (
                  <Shield
                    className="h-4 w-4 shrink-0"
                    style={{ color: it.color !== "#000000" ? it.color : undefined }}
                  />
                )}
                {it.kind === "member" && (
                  <img src={it.avatar} alt="" className="h-5 w-5 shrink-0 rounded-full" />
                )}
                <span
                  className="min-w-0 flex-1 truncate"
                  style={
                    it.kind === "role" && it.color !== "#000000" ? { color: it.color } : undefined
                  }
                >
                  {it.kind === "channel" ? it.label : `@${it.label}`}
                </span>
                {it.kind === "member" && (
                  <span className="shrink-0 text-xs text-muted-foreground">{it.sub}</span>
                )}
                {it.kind === "role" && (
                  <span className="shrink-0 text-xs text-muted-foreground">role</span>
                )}
              </button>
            ))
          )}
          {directory.note && trigger.char === "@" && (
            <p className="border-t border-border px-2 pt-1.5 text-[0.6875rem] text-muted-foreground">
              {directory.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
