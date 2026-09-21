import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BookmarkPlus,
  CalendarClock,
  Image as ImageIcon,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ChannelPicker } from "@/components/channel-picker";
import { DateTimeField } from "@/components/date-time-field";
import { DiscordPreview } from "@/components/discord-preview";
import { StatusBadge } from "@/components/status-badge";
import {
  TemplateDialog,
  templateDraftFrom,
  type TemplateDraft,
} from "@/components/template-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fullDate } from "@/lib/format";
import { uid, useWorkspace } from "@/lib/store";
import {
  DISCORD_COLORS,
  TIMEZONES,
  emptyEmbed,
  type EmbedButton,
  type EmbedField,
  type Post,
} from "@/lib/types";

interface ComposerSearch {
  postId?: string;
  templateId?: string;
}

export const Route = createFileRoute("/_authenticated/composer")({
  validateSearch: (search: Record<string, unknown>): ComposerSearch => {
    const out: ComposerSearch = {};
    if (typeof search["postId"] === "string") out.postId = search["postId"];
    if (typeof search["templateId"] === "string") out.templateId = search["templateId"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Post Creator — MUNO" },
      {
        name: "description",
        content:
          "Build Discord messages and rich embeds with a pixel-accurate live preview, buttons and scheduling.",
      },
      { property: "og:title", content: "Post Creator — MUNO" },
      {
        property: "og:description",
        content: "Build Discord embeds with a live preview, buttons, media and scheduling.",
      },
    ],
  }),
  component: Composer,
});

const sectionClass = "rounded-xl border border-border bg-surface";
const headClass = "border-b border-border px-4 py-3 text-sm font-semibold";

function Composer() {
  const { postId, templateId } = Route.useSearch();
  const navigate = useNavigate();
  const {
    currentOrg,
    currentUser,
    orgServers,
    orgMedia,
    orgTemplates,
    channelsOfServer,
    channelOf,
    serverOf,
    memberOf,
    auditOf,
    createPost,
    savePost,
    transition,
    publishNow,
    bumpTemplate,
    saveTemplate,
    permissions,
    state,
  } = useWorkspace();

  const existing = postId ? state.posts.find((p) => p.id === postId) : undefined;
  const template = templateId ? state.templates.find((t) => t.id === templateId) : undefined;

  const [post, setPost] = useState<Post>(() => {
    if (existing) return structuredClone(existing);
    const server = orgServers[0];
    const channel = server ? channelsOfServer(server.id)[0] : undefined;
    const now = new Date().toISOString();
    return {
      id: uid("p"),
      orgId: currentOrg.id,
      serverId: server?.id ?? "",
      channelId: channel?.id ?? "",
      authorId: currentUser.id,
      title: template ? `${template.name} — draft` : "Untitled post",
      kind: template?.kind ?? "embed",
      content: template?.content ?? "",
      embed: template ? structuredClone(template.embed) : emptyEmbed(),
      buttons: template ? structuredClone(template.buttons) : [],
      attachments: [],
      mediaMode: "upload",
      status: "draft",
      scheduledAt: null,
      timezone: "UTC",
      publishedAt: null,
      deliveryNote: null,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
  });
  const [isNew, setIsNew] = useState(!existing);
  const [scheduleAt, setScheduleAt] = useState(
    post.scheduledAt ? post.scheduledAt.slice(0, 16) : "",
  );

  const channels = post.serverId ? channelsOfServer(post.serverId) : [];
  const server = serverOf(post.serverId);
  const channel = channelOf(post.channelId);
  const needsApproval = channel?.requiresApproval ?? false;
  const history = useMemo(() => auditOf(post.id), [auditOf, post.id]);
  const feedback = history.filter((h) => h.note).slice(-3).reverse();

  const set = <K extends keyof Post>(key: K, value: Post[K]) =>
    setPost((p) => ({ ...p, [key]: value }));
  const setEmbed = <K extends keyof Post["embed"]>(key: K, value: Post["embed"][K]) =>
    setPost((p) => ({ ...p, embed: { ...p.embed, [key]: value } }));

  const [busy, setBusy] = useState(false);

  const persist = async (next?: Partial<Post>) => {
    const merged = { ...post, ...next } as Post;
    setPost(merged);
    if (isNew) {
      const id = await createPost(merged);
      const saved = { ...merged, id };
      setPost(saved);
      setIsNew(false);
      navigate({ to: "/composer", search: { postId: id } });
      return saved;
    }
    await savePost(merged);
    return merged;
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = () =>
    run(async () => {
      await persist();
      toast.success("Draft saved");
    });

  const submit = () =>
    run(async () => {
      const merged = await persist({ status: "pending" });
      await transition(merged.id, "pending", history.length ? "resubmitted" : "submitted");
      toast.success(
        needsApproval
          ? `Submitted to the approval queue for #${channel?.name}`
          : "Submitted for review",
      );
    });

  const schedule = () =>
    run(async () => {
      if (!scheduleAt) {
        toast.error("Pick a date and time first");
        return;
      }
      const iso = new Date(scheduleAt).toISOString();
      const merged = await persist({ status: "scheduled", scheduledAt: iso });
      await transition(
        merged.id,
        "scheduled",
        "scheduled",
        `Scheduled for ${fullDate(iso)} ${post.timezone}`,
      );
      toast.success("Post scheduled — it will be sent automatically");
    });

  const publish = () =>
    run(async () => {
      const merged = await persist({});
      const result = await publishNow(merged.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });

  const applyTemplate = (id: string) => {
    const t = state.templates.find((x) => x.id === id);
    if (!t) return;
    setPost((p) => ({
      ...p,
      kind: t.kind,
      content: t.content,
      embed: structuredClone(t.embed),
      buttons: structuredClone(t.buttons),
      title: p.title === "Untitled post" ? `${t.name} — draft` : p.title,
    }));
    void bumpTemplate(id);
    toast.success(`Applied “${t.name}”`);
  };

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const templateDraft: TemplateDraft = templateDraftFrom({
    kind: post.kind,
    content: post.content,
    embed: post.embed,
    buttons: post.buttons,
    name: post.title === "Untitled post" ? "" : post.title,
  });

  const saveAsTemplate = async (value: TemplateDraft) => {
    await saveTemplate(value);
    toast.success("Saved to the template library for everyone in this workspace");
  };


  const canEdit =
    permissions.publishDirectly ||
    post.authorId === currentUser.id ||
    isNew;

  return (
    <AppShell
      title={isNew ? "New post" : post.title}
      subtitle={
        server
          ? `${server.name} · #${channel?.name ?? "no channel"} · ${needsApproval ? "approval required" : "direct publish channel"}`
          : "Pick a server to start"
      }
      actions={
        <>
          <StatusBadge status={post.status} />
          <Button size="sm" variant="outline" onClick={saveDraft} disabled={!canEdit}>
            <Save className="h-4 w-4" /> Save
          </Button>
          {permissions.configureServers && (
            <Button size="sm" variant="outline" onClick={() => setTemplateDialogOpen(true)}>
              <BookmarkPlus className="h-4 w-4" /> Save as template
            </Button>
          )}
          {(post.status === "draft" || post.status === "changes_requested" || post.status === "rejected") && (
            <Button size="sm" onClick={submit} disabled={!canEdit}>
              <Send className="h-4 w-4" />
              {post.status === "draft" ? "Submit for approval" : "Resubmit"}
            </Button>
          )}
          {(post.status === "approved" || !needsApproval) && post.status !== "published" && (
            <Button size="sm" variant="secondary" onClick={publish} disabled={!permissions.publishDirectly}>
              <Send className="h-4 w-4" /> Publish now
            </Button>
          )}
        </>
      }
    >
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        {/* ── Editor ─────────────────────────────── */}
        <fieldset disabled={!canEdit} className="min-w-0 space-y-5">
          {feedback.length > 0 && post.status === "changes_requested" && (
            <div className="rounded-xl border border-info/40 bg-info/10 p-4">
              <h3 className="text-sm font-semibold text-info">Changes requested</h3>
              <ul className="mt-2 space-y-2">
                {feedback.map((f) => (
                  <li key={f.id} className="text-sm">
                    <span className="font-medium">{memberOf(f.actorId)?.name}</span>{" "}
                    <span className="text-muted-foreground">— {f.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section className={sectionClass}>
            <div className={headClass}>Destination</div>
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block text-xs">Server</Label>
                 <select
                   disabled={!canEdit}
                  value={post.serverId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    const first = channelsOfServer(sid)[0];
                    setPost((p) => ({ ...p, serverId: sid, channelId: first?.id ?? "" }));
                  }}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  {orgServers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.connected ? "" : " (not connected)"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Channel</Label>
                <ChannelPicker
                  channels={channels}
                  value={post.channelId}
                  onChange={(id) => set("channelId", id)}
                  placeholder={post.serverId ? "Search channels…" : "Connect a server first"}
                  emptyHint="No channels imported yet"
                />
                {channel?.requiresApproval && (
                  <p className="mt-1 text-[0.6875rem] text-warning">
                    This channel requires approval before sending.
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs">Internal title</Label>
                 <Input disabled={!canEdit} value={post.title} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Message type</span>
                {(["message", "embed"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => set("kind", k)}
                     disabled={!canEdit}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      post.kind === k
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {k === "message" ? "Standard message" : "Rich embed"}
                  </button>
                ))}
                <div className="flex min-w-0 basis-full items-center gap-2 sm:ml-auto sm:basis-auto">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <select
                     disabled={!canEdit}
                    value=""
                    onChange={(e) => e.target.value && applyTemplate(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
                  >
                    <option value="">Apply template…</option>
                    {orgTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <div className={headClass}>Message content</div>
            <div className="p-4">
              <Textarea
                disabled={!canEdit}
                rows={3}
                value={post.content}
                onChange={(e) => set("content", e.target.value)}
                placeholder="Plain message text. Markdown: **bold** *italic* __underline__ ~~strike~~ `code` [link](url), @everyone, @here"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Markdown supported: **bold**, *italic*, __underline__, ~~strike~~, `code`,
                [label](https://link), @everyone / @here.
              </p>
            </div>
          </section>

          {post.kind === "embed" && (
            <section className={sectionClass}>
              <div className={headClass}>Embed builder</div>
              <div className="space-y-5 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5 block text-xs">Author name</Label>
                    <Input
                      value={post.embed.authorName}
                      onChange={(e) => setEmbed("authorName", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Author icon URL</Label>
                    <Input
                      value={post.embed.authorIcon}
                      onChange={(e) => setEmbed("authorIcon", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Title</Label>
                    <Input
                      value={post.embed.title}
                      onChange={(e) => setEmbed("title", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Title link</Label>
                    <Input
                      value={post.embed.titleUrl}
                      onChange={(e) => setEmbed("titleUrl", e.target.value)}
                      placeholder="https://"
                    />
                  </div>
                </div>

                <div>
                  <Label className="mb-1.5 block text-xs">Description (markdown)</Label>
                  <Textarea
                    rows={5}
                    value={post.embed.description}
                    onChange={(e) => setEmbed("description", e.target.value)}
                  />
                </div>

                <div>
                  <Label className="mb-2 block text-xs">Accent colour</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {DISCORD_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        title={c.name}
                        onClick={() => setEmbed("color", c.hex)}
                        className={`h-7 w-7 rounded-md border-2 transition ${
                          post.embed.color.toLowerCase() === c.hex.toLowerCase()
                            ? "border-foreground"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                    <input
                      type="color"
                      value={post.embed.color}
                      onChange={(e) => setEmbed("color", e.target.value)}
                      className="h-8 w-12 cursor-pointer rounded border border-input bg-background"
                    />
                    <Input
                      value={post.embed.color}
                      onChange={(e) => setEmbed("color", e.target.value)}
                      className="w-28"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5 block text-xs">Thumbnail URL</Label>
                    <Input
                      value={post.embed.thumbnail}
                      onChange={(e) => setEmbed("thumbnail", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Large image URL</Label>
                    <Input
                      value={post.embed.image}
                      onChange={(e) => setEmbed("image", e.target.value)}
                    />
                  </div>
                </div>

                {/* Fields */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="text-xs">Fields</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPost((p) => ({
                          ...p,
                          embed: {
                            ...p.embed,
                            fields: [
                              ...p.embed.fields,
                              { id: uid("f"), name: "New field", value: "Value", inline: true },
                            ],
                          },
                        }))
                      }
                    >
                      <Plus className="h-4 w-4" /> Add field
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {post.embed.fields.map((f: EmbedField) => (
                      <div key={f.id} className="rounded-lg border border-border bg-surface-2 p-3">
                        <div className="flex gap-2">
                          <Input
                            value={f.name}
                            placeholder="Field name"
                            onChange={(e) =>
                              setPost((p) => ({
                                ...p,
                                embed: {
                                  ...p.embed,
                                  fields: p.embed.fields.map((x) =>
                                    x.id === f.id ? { ...x, name: e.target.value } : x,
                                  ),
                                },
                              }))
                            }
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setPost((p) => ({
                                ...p,
                                embed: {
                                  ...p.embed,
                                  fields: p.embed.fields.filter((x) => x.id !== f.id),
                                },
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Textarea
                          className="mt-2"
                          rows={2}
                          value={f.value}
                          placeholder="Field value"
                          onChange={(e) =>
                            setPost((p) => ({
                              ...p,
                              embed: {
                                ...p.embed,
                                fields: p.embed.fields.map((x) =>
                                  x.id === f.id ? { ...x, value: e.target.value } : x,
                                ),
                              },
                            }))
                          }
                        />
                        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch
                            checked={f.inline}
                            onCheckedChange={(v) =>
                              setPost((p) => ({
                                ...p,
                                embed: {
                                  ...p.embed,
                                  fields: p.embed.fields.map((x) =>
                                    x.id === f.id ? { ...x, inline: v } : x,
                                  ),
                                },
                              }))
                            }
                          />
                          Inline (side by side)
                        </label>
                      </div>
                    ))}
                    {post.embed.fields.length === 0 && (
                      <p className="text-xs text-muted-foreground">No fields yet.</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5 block text-xs">Footer text</Label>
                    <Input
                      value={post.embed.footerText}
                      onChange={(e) => setEmbed("footerText", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Footer icon URL</Label>
                    <Input
                      value={post.embed.footerIcon}
                      onChange={(e) => setEmbed("footerIcon", e.target.value)}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={post.embed.showTimestamp}
                    onCheckedChange={(v) => setEmbed("showTimestamp", v)}
                  />
                  Show timestamp in footer
                </label>
              </div>
            </section>
          )}

          <section className={sectionClass}>
            <div className={headClass}>Link buttons</div>
            <div className="space-y-3 p-4">
              {post.buttons.map((b: EmbedButton) => (
                <div key={b.id} className="grid min-w-0 gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto_auto]">
                  <Input
                    className="w-full min-w-0"
                    value={b.label}
                    placeholder="Label"
                    onChange={(e) =>
                      setPost((p) => ({
                        ...p,
                        buttons: p.buttons.map((x) =>
                          x.id === b.id ? { ...x, label: e.target.value } : x,
                        ),
                      }))
                    }
                  />
                  <Input
                    className="w-full min-w-0"
                    value={b.url}
                    placeholder="https://"
                    onChange={(e) =>
                      setPost((p) => ({
                        ...p,
                        buttons: p.buttons.map((x) =>
                          x.id === b.id ? { ...x, url: e.target.value } : x,
                        ),
                      }))
                    }
                  />
                  <select
                    value={b.style}
                    onChange={(e) =>
                      setPost((p) => ({
                        ...p,
                        buttons: p.buttons.map((x) =>
                          x.id === b.id
                            ? { ...x, style: e.target.value as EmbedButton["style"] }
                            : x,
                        ),
                      }))
                    }
                    className="rounded-lg border border-input bg-background px-2 py-2 text-sm"
                  >
                    {["link", "primary", "secondary", "success", "danger"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setPost((p) => ({ ...p, buttons: p.buttons.filter((x) => x.id !== b.id) }))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setPost((p) => ({
                    ...p,
                    buttons: [
                      ...p.buttons,
                      { id: uid("b"), label: "Open link", url: "https://", style: "link" },
                    ],
                  }))
                }
              >
                <Plus className="h-4 w-4" /> Add button
              </Button>
            </div>
          </section>

          <section className={sectionClass}>
            <div className={headClass}>Media library</div>
            <div className="p-4">
              <div className="mb-4 rounded-lg border border-border p-3">
                <p className="text-xs font-medium">How should pictures be shared?</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      {
                        value: "upload" as const,
                        label: "Upload to Discord",
                        hint: "Big native image under your text. Recommended.",
                      },
                      {
                        value: "embed" as const,
                        label: "Show inside embed card",
                        hint: "Picture framed inside the coloured card.",
                      },
                    ]
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => set("mediaMode", option.value)}
                      className={`rounded-lg border p-2.5 text-left transition ${
                        post.mediaMode === option.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      <span className="block text-xs font-medium">{option.label}</span>
                      <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                        {option.hint}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[0.6875rem] text-muted-foreground">
                  Up to 10 pictures per message, each under 10 MB. Pictures added as a link (not
                  uploaded to your library) always use the embed method.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {orgMedia.map((m) => (
                  <div key={m.id} className="overflow-hidden rounded-lg border border-border">
                    <img src={m.url} alt={m.name} className="h-20 w-full object-cover" />
                    <div className="p-2">
                      <p className="truncate text-[0.6875rem] text-muted-foreground">{m.name}</p>
                      <div className="mt-1.5 flex gap-1">
                        <button
                          onClick={() => {
                            setEmbed("image", m.url);
                            toast.success("Set as embed image");
                          }}
                          className="rounded bg-secondary px-1.5 py-1 text-[0.625rem] hover:bg-accent"
                        >
                          Image
                        </button>
                        <button
                          onClick={() => {
                            setEmbed("thumbnail", m.url);
                            toast.success("Set as thumbnail");
                          }}
                          className="rounded bg-secondary px-1.5 py-1 text-[0.625rem] hover:bg-accent"
                        >
                          Thumb
                        </button>
                        <button
                          onClick={() =>
                            setPost((p) => ({
                              ...p,
                              attachments: p.attachments.includes(m.url)
                                ? p.attachments
                                : [...p.attachments, m.url],
                            }))
                          }
                          className="rounded bg-secondary px-1.5 py-1 text-[0.625rem] hover:bg-accent"
                        >
                          Attach
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {post.attachments.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {post.attachments.map((a) => (
                    <button
                      key={a}
                      onClick={() =>
                        setPost((p) => ({
                          ...p,
                          attachments: p.attachments.filter((x) => x !== a),
                        }))
                      }
                      className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                    >
                      <ImageIcon className="h-3 w-3" /> attachment <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </fieldset>

        {/* ── Preview + schedule ─────────────────── */}
        <div className="min-w-0 space-y-5 xl:sticky xl:top-28 xl:self-start">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Live Discord preview</h2>
              <span className="text-xs text-muted-foreground">
                {server?.botName ?? "Bot"} in #{channel?.name ?? "channel"}
              </span>
            </div>
            <DiscordPreview
              botName={server?.botName ?? "MUNO Bot"}
              botAvatar={server?.botAvatar ?? ""}
              channelName={channel?.name}
              kind={post.kind}
              content={post.content}
              embed={post.embed}
              buttons={post.buttons}
              attachments={post.attachments}
              mediaMode={post.mediaMode}
              timestamp={post.scheduledAt}
            />
          </div>

          <section className={sectionClass}>
            <div className={headClass}>Schedule</div>
            <div className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs">Date & time</Label>
                  <DateTimeField
                    disabled={!canEdit}
                    value={scheduleAt}
                    onChange={setScheduleAt}
                  />
                  {!permissions.publishDirectly && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Pick your preferred time — an admin confirms it when approving.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Timezone</Label>
                  <select
                    disabled={!canEdit}
                    value={post.timezone}
                    onChange={(e) => set("timezone", e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    {TIMEZONES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                className="w-full"
                variant="secondary"
                onClick={schedule}
                disabled={!permissions.publishDirectly || (needsApproval && post.status !== "approved")}
              >
                <CalendarClock className="h-4 w-4" />
                {!permissions.publishDirectly
                  ? "Admin access required to schedule"
                  : needsApproval && post.status !== "approved"
                  ? "Approval required before scheduling"
                  : "Schedule post"}
              </Button>
              {post.scheduledAt && (
                <p className="text-xs text-muted-foreground">
                  Currently set for {fullDate(post.scheduledAt)} ({post.timezone})
                </p>
              )}
            </div>
          </section>

          <section className={sectionClass}>
            <div className={headClass}>Audit history</div>
            <ol className="divide-y divide-border">
              {history.length === 0 && (
                <li className="px-4 py-4 text-xs text-muted-foreground">
                  Nothing recorded yet — save the draft to start the trail.
                </li>
              )}
              {history
                .slice()
                .reverse()
                .map((h) => (
                  <li key={h.id} className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{memberOf(h.actorId)?.name}</span>
                      <span className="text-xs text-muted-foreground">{fullDate(h.at)}</span>
                    </div>
                    <p className="text-xs capitalize text-muted-foreground">
                      {h.action.replace(/_/g, " ")}
                      {h.note ? ` — ${h.note}` : ""}
                    </p>
                  </li>
                ))}
            </ol>
          </section>
        </div>
      </div>
      <TemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        draft={templateDraft}
        metaOnly
        title="Save as template"
        botName={server?.botName ?? "MUNO Bot"}
        botAvatar={server?.botAvatar ?? ""}
        onSave={saveAsTemplate}
      />
    </AppShell>
  );
}
