import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutTemplate, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { DiscordPreview } from "@/components/discord-preview";
import {
  TemplateDialog,
  emptyTemplateDraft,
  templateDraftFrom,
  type TemplateDraft,
} from "@/components/template-dialog";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({
    meta: [
      { title: "Template library — MUNO" },
      {
        name: "description",
        content:
          "Reusable Discord announcement templates for tournaments, giveaways, patch notes, events and AMAs.",
      },
      { property: "og:title", content: "Template library — MUNO" },
      {
        property: "og:description",
        content: "Reusable Discord announcement templates ready to drop into a post.",
      },
    ],
  }),
  component: Templates,
});

function Templates() {
  const { orgTemplates, orgServers, permissions, saveTemplate, updateTemplate, removeTemplate } =
    useWorkspace();
  const [selectedId, setSelectedId] = useState("");
  const selected = orgTemplates.find((t) => t.id === selectedId) ?? orgTemplates[0];
  const bot = orgServers[0];
  const canManage = permissions.configureServers;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);

  const openNew = () => {
    setEditingId(null);
    setDraft(emptyTemplateDraft());
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const template = orgTemplates.find((t) => t.id === id);
    if (!template) return;
    setEditingId(id);
    setDraft(templateDraftFrom(template));
    setDialogOpen(true);
  };

  const save = async (value: TemplateDraft) => {
    if (editingId) {
      await updateTemplate(editingId, value);
      toast.success("Template updated");
    } else {
      await saveTemplate(value);
      toast.success("Template added — everyone in the workspace can use it");
    }
  };

  const remove = async (id: string, name: string) => {
    try {
      await removeTemplate(id);
      toast.success(`“${name}” deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the template");
    }
  };

  return (
    <AppShell
      title="Template library"
      subtitle={
        orgTemplates.length === 1
          ? "1 reusable announcement template"
          : `${orgTemplates.length} reusable announcement templates`
      }
      actions={
        canManage ? (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        ) : undefined
      }
    >
      {orgTemplates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <LayoutTemplate className="mx-auto h-7 w-7 text-muted-foreground" />
          <h2 className="mt-3 font-display text-base font-semibold">No templates yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            {canManage
              ? "Add a template once and your whole team can reuse it for tournaments, giveaways, patch notes and events. You can also build a post first and save it as a template from the Post Creator."
              : "Admins add templates for the workspace. Once one exists it shows up here and you can use it for your own posts."}
          </p>
          {canManage && (
            <Button className="mt-5" onClick={openNew}>
              <Plus className="h-4 w-4" /> New template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
          <div className="grid gap-4 sm:grid-cols-2">
            {orgTemplates.map((t) => (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(t.id)}
                onKeyDown={(e) => e.key === "Enter" && setSelectedId(t.id)}
                className={`cursor-pointer rounded-xl border p-4 text-left transition ${
                  selected?.id === t.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface hover:bg-accent/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{t.name}</span>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                    {t.category}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t.description}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[0.6875rem] text-muted-foreground">Used {t.uses}×</span>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(t.id);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            void remove(t.id, t.name);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <Link to="/composer" search={{ templateId: t.id }}>
                        <Sparkles className="h-3.5 w-3.5" /> Use
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selected && (
            <div className="lg:sticky lg:top-28 lg:self-start">
              <h2 className="mb-2 text-sm font-semibold">Preview — {selected.name}</h2>
              <DiscordPreview
                botName={bot?.botName ?? "MUNO Bot"}
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
      )}

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={draft}
        title={editingId ? "Edit template" : "New template"}
        botName={bot?.botName ?? "MUNO Bot"}
        botAvatar={bot?.botAvatar ?? ""}
        onSave={save}
      />
    </AppShell>
  );
}
