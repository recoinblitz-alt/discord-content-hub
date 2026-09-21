import { createFileRoute, Link } from "@tanstack/react-router";
import { Link2, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fullDate } from "@/lib/format";
import { useWorkspace } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/media")({
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

const ACCEPTED = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

function Media() {
  const { orgMedia, addMedia, removeMedia, uploadMedia } = useWorkspace();
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<"banner" | "thumbnail" | "icon">("banner");
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!name.trim() || !url.trim()) {
      toast.error("Name and image URL are required");
      return;
    }
    try {
      await addMedia({ name: name.trim(), url: url.trim(), kind });
      setName("");
      setUrl("");
      setTags("");
      toast.success("Asset added to the library");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add that asset");
    }
  };

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    let added = 0;
    try {
      for (const file of files) {
        if (!ACCEPTED.includes(file.type)) {
          toast.error(`${file.name}: only PNG, JPG, GIF or WebP images`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: larger than 10 MB`);
          continue;
        }
        try {
          const { url: publicUrl, storagePath } = await uploadMedia(file);
          const label = file.name.replace(/\.[^.]+$/, "");
          await addMedia({
            name: (files.length === 1 && name.trim()) || label,
            url: publicUrl,
            kind,
            storagePath,
          });
          added += 1;
        } catch (error) {
          toast.error(
            `${file.name}: ${error instanceof Error ? error.message : "upload failed"}`,
          );
        }
      }
      if (added) {
        setName("");
        setTags("");
        toast.success(added === 1 ? "Image added to the library" : `${added} images added`);
      }
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
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

          <div className="mt-3 flex items-center gap-1 rounded-lg border border-border p-0.5">
            {(
              [
                ["upload", "Upload from computer", Upload],
                ["link", "Paste a link", Link2],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                  mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <Label className="mb-1.5 block text-xs">
                Name {mode === "upload" && <span className="text-muted-foreground">(optional)</span>}
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={mode === "upload" ? "Defaults to the file name" : ""}
              />
            </div>
            {mode === "link" && (
              <div>
                <Label className="mb-1.5 block text-xs">Image URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
              </div>
            )}
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
