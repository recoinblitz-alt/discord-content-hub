import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fullDate } from "@/lib/format";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/media")({
  head: () => ({
    meta: [
      { title: "Media library — Relaystack" },
      {
        name: "description",
        content: "Store, preview and reuse banners, thumbnails and brand marks across Discord posts.",
      },
      { property: "og:title", content: "Media library — Relaystack" },
      {
        property: "og:description",
        content: "Reusable banners and graphics for Discord announcements.",
      },
    ],
  }),
  component: Media,
});

function Media() {
  const { orgMedia, addMedia, removeMedia } = useStore();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<"banner" | "thumbnail" | "icon">("banner");
  const [tags, setTags] = useState("");

  const submit = () => {
    if (!name.trim() || !url.trim()) {
      toast.error("Name and image URL are required");
      return;
    }
    addMedia({
      name: name.trim(),
      url: url.trim(),
      kind,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setName("");
    setUrl("");
    setTags("");
    toast.success("Asset added to the library");
  };

  return (
    <AppShell title="Media library" subtitle={`${orgMedia.length} assets in this organization`}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {orgMedia.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-xl border border-border bg-surface">
              <img src={m.url} alt={m.name} className="h-36 w-full object-cover" />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{m.name}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[0.625rem] uppercase text-muted-foreground">
                    {m.kind}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.tags.join(" · ") || "untagged"} · added {fullDate(m.addedAt)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link to="/composer">Use in post</Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      removeMedia(m.id);
                      toast.success("Asset removed");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-28 lg:self-start">
          <h2 className="text-sm font-semibold">Add asset</h2>
          <div className="mt-3 space-y-3">
            <div>
              <Label className="mb-1.5 block text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Image URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Kind</Label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="banner">Banner</option>
                <option value="thumbnail">Thumbnail</option>
                <option value="icon">Icon</option>
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Tags (comma separated)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
            {url && (
              <img src={url} alt="" className="h-28 w-full rounded-lg border border-border object-cover" />
            )}
            <Button className="w-full" onClick={submit}>
              <Plus className="h-4 w-4" /> Add to library
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
