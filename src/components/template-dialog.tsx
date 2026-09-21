import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DiscordPreview } from "@/components/discord-preview";
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
import { DISCORD_COLORS, emptyEmbed, type Template } from "@/lib/types";

export type TemplateDraft = Omit<Template, "id" | "orgId" | "uses">;

export const TEMPLATE_CATEGORIES = [
  "Tournament",
  "Giveaway",
  "Patch Notes",
  "Event",
  "AMA",
  "General",
];

export function emptyTemplateDraft(): TemplateDraft {
  return {
    name: "",
    description: "",
    category: "General",
    kind: "embed",
    content: "",
    embed: emptyEmbed(),
    buttons: [],
  };
}

export function templateDraftFrom(source: {
  kind: Template["kind"];
  content: string;
  embed: Template["embed"];
  buttons: Template["buttons"];
  name?: string;
  description?: string;
  category?: string;
}): TemplateDraft {
  return {
    name: source.name ?? "",
    description: source.description ?? "",
    category: source.category ?? "General",
    kind: source.kind,
    content: source.content,
    embed: structuredClone(source.embed),
    buttons: structuredClone(source.buttons),
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: TemplateDraft | null;
  /** When true only name / description / category are editable (capture from editor). */
  metaOnly?: boolean;
  title: string;
  botName: string;
  botAvatar: string;
  onSave: (draft: TemplateDraft) => Promise<void>;
}

export function TemplateDialog({
  open,
  onOpenChange,
  draft,
  metaOnly = false,
  title,
  botName,
  botAvatar,
  onSave,
}: Props) {
  const [value, setValue] = useState<TemplateDraft>(draft ?? emptyTemplateDraft());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setValue(draft ?? emptyTemplateDraft());
  }, [open, draft]);

  const setEmbed = <K extends keyof TemplateDraft["embed"]>(
    key: K,
    next: TemplateDraft["embed"][K],
  ) => setValue((v) => ({ ...v, embed: { ...v.embed, [key]: next } }));

  const submit = async () => {
    if (!value.name.trim()) {
      toast.error("Give the template a name");
      return;
    }
    setBusy(true);
    try {
      await onSave({ ...value, name: value.name.trim(), description: value.description.trim() });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the template");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Everyone in this workspace can use the template. Wrap placeholders in double braces,
            like {"{{prize}}"}, and fill them in when building a post.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={value.name}
                placeholder="Weekend tournament announcement"
                onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">Short description</Label>
              <Input
                id="tpl-desc"
                value={value.description}
                placeholder="When and where the next tournament runs"
                onChange={(e) => setValue((v) => ({ ...v, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-cat">Category</Label>
              <Input
                id="tpl-cat"
                list="tpl-categories"
                value={value.category}
                onChange={(e) => setValue((v) => ({ ...v, category: e.target.value }))}
              />
              <datalist id="tpl-categories">
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {!metaOnly && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Message type</span>
                  {(["message", "embed"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setValue((v) => ({ ...v, kind: k }))}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        value.kind === k
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent/40"
                      }`}
                    >
                      {k === "message" ? "Standard message" : "Rich embed"}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tpl-content">Message text</Label>
                  <Textarea
                    id="tpl-content"
                    rows={3}
                    value={value.content}
                    placeholder="@everyone the {{event}} starts at {{time}}!"
                    onChange={(e) => setValue((v) => ({ ...v, content: e.target.value }))}
                  />
                </div>

                {value.kind === "embed" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="tpl-title">Embed title</Label>
                      <Input
                        id="tpl-title"
                        value={value.embed.title}
                        onChange={(e) => setEmbed("title", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tpl-embed-desc">Embed description</Label>
                      <Textarea
                        id="tpl-embed-desc"
                        rows={5}
                        value={value.embed.description}
                        onChange={(e) => setEmbed("description", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Colour</Label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {DISCORD_COLORS.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            title={c.name}
                            onClick={() => setEmbed("color", c.hex)}
                            style={{ background: c.hex }}
                            className={`h-6 w-6 rounded-md border transition ${
                              value.embed.color.toLowerCase() === c.hex.toLowerCase()
                                ? "border-foreground"
                                : "border-transparent"
                            }`}
                          />
                        ))}
                        <Input
                          value={value.embed.color}
                          onChange={(e) => setEmbed("color", e.target.value)}
                          className="h-8 w-28"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tpl-footer">Footer</Label>
                      <Input
                        id="tpl-footer"
                        value={value.embed.footerText}
                        onChange={(e) => setEmbed("footerText", e.target.value)}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="md:sticky md:top-0 md:self-start">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Live preview
            </h3>
            <DiscordPreview
              botName={botName}
              botAvatar={botAvatar}
              kind={value.kind}
              content={value.content}
              embed={value.embed}
              buttons={value.buttons}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
