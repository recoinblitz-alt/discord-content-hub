import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { DiscordPreview } from "@/components/discord-preview";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Template library — Relaystack" },
      {
        name: "description",
        content:
          "Reusable Discord announcement templates for tournaments, giveaways, patch notes, events and AMAs.",
      },
      { property: "og:title", content: "Template library — Relaystack" },
      {
        property: "og:description",
        content: "Reusable Discord announcement templates ready to drop into a post.",
      },
    ],
  }),
  component: Templates,
});

function Templates() {
  const { orgTemplates, orgServers } = useStore();
  const [selectedId, setSelectedId] = useState(orgTemplates[0]?.id ?? "");
  const selected = orgTemplates.find((t) => t.id === selectedId) ?? orgTemplates[0];
  const bot = orgServers[0];

  return (
    <AppShell
      title="Template library"
      subtitle={`${orgTemplates.length} reusable announcement templates`}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <div className="grid gap-4 sm:grid-cols-2">
          {orgTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`rounded-xl border p-4 text-left transition ${
                selected?.id === t.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface hover:bg-accent/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{t.name}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                  {t.category}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[0.6875rem] text-muted-foreground">Used {t.uses}×</span>
                <Button asChild size="sm" variant="outline">
                  <Link to="/composer" search={{ templateId: t.id }}>
                    <Sparkles className="h-3.5 w-3.5" /> Use
                  </Link>
                </Button>
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="mb-2 text-sm font-semibold">Preview — {selected.name}</h2>
            <DiscordPreview
              botName={bot?.botName ?? "Relaystack Bot"}
              botAvatar={bot?.botAvatar ?? ""}
              kind={selected.kind}
              content={selected.content}
              embed={selected.embed}
              buttons={selected.buttons}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Placeholders in double braces are replaced when you build the post.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
