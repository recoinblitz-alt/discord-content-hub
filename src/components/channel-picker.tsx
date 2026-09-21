import { Check, ChevronsUpDown, Hash, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Channel } from "@/lib/types";

interface ChannelPickerProps {
  channels: Channel[];
  value: string;
  onChange: (channelId: string) => void;
  placeholder?: string;
  serverNameOf?: (serverId: string) => string | undefined;
  allowAll?: boolean;
  allLabel?: string;
  disabled?: boolean;
  emptyHint?: React.ReactNode;
}

/** Searchable channel selector — handles workspaces with hundreds of channels. */
export function ChannelPicker({
  channels,
  value,
  onChange,
  placeholder = "Select a channel",
  serverNameOf,
  allowAll = false,
  allLabel = "All channels",
  disabled = false,
  emptyHint,
}: ChannelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = channels.find((c) => c.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, query]);

  const label = allowAll && value === "all" ? allLabel : selected ? `#${selected.name}` : placeholder;

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={`truncate ${selected || value === "all" ? "" : "text-muted-foreground"}`}>
            {label}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search channels…"
            className="h-7 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {allowAll && (
            <button
              type="button"
              onClick={() => pick("all")}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-accent"
            >
              <span className="w-4">{value === "all" && <Check className="h-3.5 w-3.5" />}</span>
              {allLabel}
            </button>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-accent"
            >
              <span className="w-4">{c.id === value && <Check className="h-3.5 w-3.5" />}</span>
              <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              {serverNameOf?.(c.serverId) && (
                <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
                  {serverNameOf(c.serverId)}
                </span>
              )}
              {c.requiresApproval && (
                <span className="shrink-0 rounded bg-warning/15 px-1.5 py-0.5 text-[0.625rem] font-medium text-warning">
                  approval
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {channels.length === 0 ? emptyHint ?? "No channels yet" : "No channels match"}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
