import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import { publicMediaUrl } from "@/lib/public-url";
import { changeMemberRole, getOrgMemberRoster, removeOrgMember } from "@/lib/members.functions";
import { publishPost } from "@/lib/discord.functions";
import {
  mapAudit,
  mapChannel,
  mapEvent,
  mapMedia,
  mapMember,
  mapOrganization,
  mapPost,
  mapServer,
  mapTemplate,
  postToRow,
} from "./mappers";
import {
  permissionsFor,
  type AuditAction,
  type AuditEntry,
  type Channel,
  type DiscordServer,
  type MediaAsset,
  type MediaAssetKind,
  type Member,
  type OrgEvent,
  type Organization,
  type Post,
  type PostStatus,
  type Role,
  type Template,
} from "./types";

export const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

interface OrgData {
  members: Member[];
  servers: DiscordServer[];
  channels: Channel[];
  posts: Post[];
  audit: AuditEntry[];
  templates: Template[];
  media: MediaAsset[];
}

const emptyOrgData: OrgData = {
  members: [],
  servers: [],
  channels: [],
  posts: [],
  audit: [],
  templates: [],
  media: [],
};

interface StoreValue {
  ready: boolean;
  loading: boolean;
  user: User | null;
  organizations: Organization[];
  currentOrg: Organization | null;
  currentUser: Member | null;
  permissions: ReturnType<typeof permissionsFor>;
  orgServers: DiscordServer[];
  orgChannels: Channel[];
  orgPosts: Post[];
  orgMembers: Member[];
  orgTemplates: Template[];
  orgMedia: MediaAsset[];
  orgEvents: OrgEvent[];
  state: {
    organizations: Organization[];
    members: Member[];
    servers: DiscordServer[];
    channels: Channel[];
    posts: Post[];
    templates: Template[];
    media: MediaAsset[];
    audit: AuditEntry[];
  };
  setOrg: (id: string) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  createWorkspace: (name: string, kind: string) => Promise<void>;
  setMemberRole: (userId: string, role: Role) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  channelsOfServer: (serverId: string) => Channel[];
  serverOf: (id: string) => DiscordServer | undefined;
  channelOf: (id: string) => Channel | undefined;
  memberOf: (id: string) => Member | undefined;
  auditOf: (postId: string) => AuditEntry[];
  createPost: (post: Post) => Promise<string>;
  savePost: (post: Post, note?: string) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  transition: (
    postId: string,
    status: PostStatus,
    action: AuditAction,
    note?: string,
  ) => Promise<void>;
  comment: (postId: string, note: string) => Promise<void>;
  publishNow: (postId: string) => Promise<{ ok: boolean; message: string }>;
  toggleChannelApproval: (channelId: string) => Promise<void>;
  addMedia: (asset: {
    name: string;
    url: string;
    kind: MediaAssetKind;
    storagePath?: string;
  }) => Promise<void>;
  uploadMedia: (file: File) => Promise<{ url: string; storagePath: string }>;
  removeMedia: (id: string) => Promise<void>;
  saveTemplate: (template: Omit<Template, "id" | "orgId" | "uses">) => Promise<void>;
  updateTemplate: (
    id: string,
    template: Omit<Template, "id" | "orgId" | "uses">,
  ) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  bumpTemplate: (id: string) => Promise<void>;
  saveEvent: (
    event: Omit<OrgEvent, "orgId" | "createdBy" | "id"> & { id?: string },
  ) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
}

type StoreGlobal = typeof globalThis & {
  __relaystackStoreContext?: Context<StoreValue | null>;
};

// Keep one context identity across Vite hot updates. Without this, a route can
// temporarily import a newer context while its mounted provider still uses the
// previous module instance, causing false "outside StoreProvider" crashes.
const storeGlobal = globalThis as StoreGlobal;
const StoreContext =
  storeGlobal.__relaystackStoreContext ?? createContext<StoreValue | null>(null);
storeGlobal.__relaystackStoreContext = StoreContext;
StoreContext.displayName = "RelaystackStore";
const ORG_KEY = "discord-cms-current-org";

export function StoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUser(session?.user ?? null);
      if (event === "SIGNED_OUT") {
        queryClient.clear();
      } else {
        void queryClient.invalidateQueries();
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const membershipQuery = useQuery({
    queryKey: ["memberships", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_members")
        .select("org_id, role, organizations(id, name, kind, plan)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? []).flatMap((row) => {
        const org = row.organizations as Record<string, unknown> | null;
        if (!org) return [];
        const mapped = mapOrganization(org);
        if (seen.has(mapped.id)) return [];
        seen.add(mapped.id);
        return [{ org: mapped, role: row.role as Role }];
      });
    },
  });

  const memberships = membershipQuery.data ?? [];
  const activeMembership = memberships.find((membership) => membership.org.id === orgId) ?? null;

  useEffect(() => {
    if (!memberships.length) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(ORG_KEY) : null;
    const valid = memberships.some((m) => m.org.id === orgId);
    if (valid) return;
    const next = memberships.find((m) => m.org.id === stored)?.org.id ?? memberships[0]!.org.id;
    setOrgId(next);
  }, [memberships, orgId]);

  const dataQuery = useQuery({
    queryKey: ["org-data", orgId, activeMembership?.role],
    enabled: Boolean(orgId && activeMembership),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<OrgData> => {
      const id = orgId!;
      const memberRequest =
        activeMembership?.role === "super_admin" || activeMembership?.role === "admin"
          ? getOrgMemberRoster({ data: { orgId: id } })
          : supabase.rpc("get_org_directory", { _org: id }).then(({ data: directory, error }) => {
              if (error) throw error;
              return (directory ?? []).map((entry) => ({
                user_id: entry.user_id,
                role: entry.user_id === user?.id ? activeMembership?.role ?? "user" : "user",
                profile: {
                  email: null,
                  display_name: entry.display_name,
                  avatar_url: entry.avatar_url,
                },
              }));
            });
      const [members, servers, channels, posts, audit, templates, media] = await Promise.all([
        memberRequest,
        supabase.from("servers").select("*").eq("org_id", id).order("created_at"),
        supabase.from("channels").select("*").eq("org_id", id).order("name"),
        supabase.from("posts").select("*").eq("org_id", id).order("updated_at", { ascending: false }),
        supabase.from("post_audit").select("*").eq("org_id", id).order("created_at"),
        supabase.from("templates").select("*").eq("org_id", id).order("created_at"),
        supabase.from("media_assets").select("*").eq("org_id", id).order("created_at", { ascending: false }),
      ]);
      const first = [servers, channels, posts, audit, templates, media].find(
        (r) => r.error,
      );
      if (first?.error) throw first.error;
      return {
        members: (Array.isArray(members) ? members : []).map((row) => mapMember(row as never, [id])),
        servers: (servers.data ?? []).map((row) => mapServer(row as never)),
        channels: (channels.data ?? []).map((row) => mapChannel(row as never)),
        posts: (posts.data ?? []).map((row) => mapPost(row as never)),
        audit: (audit.data ?? []).map((row) => mapAudit(row as never)),
        templates: (templates.data ?? []).map((row) => mapTemplate(row as never)),
        media: (media.data ?? []).map((row) => mapMedia(row as never)),
      };
    },
  });

  const data = dataQuery.data ?? emptyOrgData;

  const eventsQuery = useQuery({
    queryKey: ["org-events", orgId],
    enabled: Boolean(orgId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<OrgEvent[]> => {
      const { data: rows, error } = await supabase
        .from("org_events")
        .select("*")
        .eq("org_id", orgId!)
        .order("starts_at");
      if (error) throw error;
      return (rows ?? []).map((row) => mapEvent(row as never));
    },
  });

  const events = eventsQuery.data ?? [];

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["org-data"] });
    await queryClient.invalidateQueries({ queryKey: ["memberships"] });
  }, [queryClient]);

  const refreshEvents = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["org-events"] });
  }, [queryClient]);

  const logAudit = useCallback(
    async (postId: string, action: AuditAction, note?: string) => {
      if (!orgId || !user) return;
      await supabase.from("post_audit").insert({
        post_id: postId,
        org_id: orgId,
        actor_id: user.id,
        action,
        note: note ?? null,
      });
    },
    [orgId, user],
  );

  const value = useMemo<StoreValue>(() => {
    const currentMembership = memberships.find((m) => m.org.id === orgId) ?? null;
    const currentOrg = currentMembership?.org ?? null;
    const role = currentMembership?.role ?? "user";
    const currentUser: Member | null = user
      ? {
          id: user.id,
          orgIds: memberships.map((m) => m.org.id),
          name:
            (user.user_metadata?.["display_name"] as string | undefined) ||
            data.members.find((m) => m.id === user.id)?.name ||
            user.email?.split("@")[0] ||
            "You",
          handle: (user.email?.split("@")[0] ?? "you").toLowerCase(),
          role,
          avatar:
            data.members.find((m) => m.id === user.id)?.avatar ??
            `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(user.email ?? "you")}`,
          email: user.email ?? "",
        }
      : null;

    return {
      ready: authReady && (!user || !membershipQuery.isLoading),
      loading: dataQuery.isLoading || membershipQuery.isLoading,
      user,
      organizations: memberships.map((m) => m.org),
      currentOrg,
      currentUser,
      permissions: permissionsFor(role),
      orgServers: data.servers,
      orgChannels: data.channels,
      orgPosts: data.posts,
      orgMembers: data.members,
      orgTemplates: data.templates,
      orgMedia: data.media,
      orgEvents: events,
      state: {
        organizations: memberships.map((m) => m.org),
        members: data.members,
        servers: data.servers,
        channels: data.channels,
        posts: data.posts,
        templates: data.templates,
        media: data.media,
        audit: data.audit,
      },
      setOrg: (id) => {
        setOrgId(id);
        try {
          window.localStorage.setItem(ORG_KEY, id);
        } catch {
          /* ignore */
        }
      },
      refresh,
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
        navigate({ to: "/auth", replace: true });
      },
      createWorkspace: async (name, kind) => {
        if (!user) throw new Error("Not signed in");
        const { data: createdOrgId, error } = await supabase.rpc("create_workspace", {
          _name: name,
          _kind: kind,
        });
        if (error) throw error;
        setOrgId(createdOrgId);
        await refresh();
      },
      setMemberRole: async (userId, nextRole) => {
        if (!orgId) return;
        await changeMemberRole({ data: { orgId, userId, role: nextRole } });
        await refresh();
      },
      removeMember: async (userId) => {
        if (!orgId) return;
        await removeOrgMember({ data: { orgId, userId } });
        await refresh();
      },
      channelsOfServer: (serverId) => data.channels.filter((c) => c.serverId === serverId),
      serverOf: (id) => data.servers.find((s) => s.id === id),
      channelOf: (id) => data.channels.find((c) => c.id === id),
      memberOf: (id) => data.members.find((m) => m.id === id),
      auditOf: (postId) =>
        data.audit.filter((a) => a.postId === postId).sort((a, b) => a.at.localeCompare(b.at)),
      createPost: async (post) => {
        if (!orgId || !user) throw new Error("No workspace");
        const { data: row, error } = await supabase
          .from("posts")
          .insert({ ...postToRow({ ...post, orgId }), created_by: user.id })
          .select("id")
          .single();
        if (error) throw error;
        await logAudit(row.id, "created");
        await refresh();
        return row.id;
      },
      savePost: async (post, note) => {
        const { error } = await supabase
          .from("posts")
          .update({ ...postToRow(post), updated_at: new Date().toISOString() })
          .eq("id", post.id);
        if (error) throw error;
        await logAudit(post.id, "updated", note);
        await refresh();
      },
      deletePost: async (id) => {
        const { error } = await supabase.from("posts").delete().eq("id", id);
        if (error) throw error;
        await refresh();
      },
      transition: async (postId, status, action, note) => {
        const current = data.posts.find((p) => p.id === postId);
        const patch = {
          status,
          updated_at: new Date().toISOString(),
          ...(action === "resubmitted" && current ? { revision: current.revision + 1 } : {}),
        };
        const { error } = await supabase.from("posts").update(patch).eq("id", postId);
        if (error) throw error;
        await logAudit(postId, action, note);
        await refresh();
      },
      comment: async (postId, note) => {
        await logAudit(postId, "comment", note);
        await refresh();
      },
      publishNow: async (postId) => {
        const result = await publishPost({ data: { postId } });
        await refresh();
        return result;
      },
      toggleChannelApproval: async (channelId) => {
        const channel = data.channels.find((c) => c.id === channelId);
        if (!channel) return;
        const { error } = await supabase
          .from("channels")
          .update({ requires_approval: !channel.requiresApproval })
          .eq("id", channelId);
        if (error) throw error;
        await refresh();
      },
      addMedia: async ({ storagePath, ...asset }) => {
        if (!orgId || !user) return;
        const { error } = await supabase.from("media_assets").insert({
          ...asset,
          storage_path: storagePath ?? null,
          org_id: orgId,
          created_by: user.id,
        });
        if (error) throw error;
        await refresh();
      },
      uploadMedia: async (file) => {
        if (!orgId) throw new Error("No workspace");
        const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
        const storagePath = `${orgId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("media")
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        return {
          storagePath,
          url: publicMediaUrl(storagePath),
        };
      },
      removeMedia: async (id) => {
        const asset = data.media.find((m) => m.id === id);
        const { error } = await supabase.from("media_assets").delete().eq("id", id);
        if (error) throw error;
        if (asset?.storagePath) {
          await supabase.storage.from("media").remove([asset.storagePath]);
        }
        await refresh();
      },
      saveTemplate: async (template) => {
        if (!orgId || !user) return;
        const { error } = await supabase.from("templates").insert({
          org_id: orgId,
          name: template.name,
          description: template.description,
          category: template.category,
          content: template.content,
          use_embed: template.kind === "embed",
          embed: template.embed as unknown as never,
          buttons: template.buttons as unknown as never,
          created_by: user.id,
        });
        if (error) throw error;
        await refresh();
      },
      updateTemplate: async (id, template) => {
        const { error } = await supabase
          .from("templates")
          .update({
            name: template.name,
            description: template.description,
            category: template.category,
            content: template.content,
            use_embed: template.kind === "embed",
            embed: template.embed as unknown as never,
            buttons: template.buttons as unknown as never,
          })
          .eq("id", id);
        if (error) throw error;
        await refresh();
      },
      removeTemplate: async (id) => {
        const { error } = await supabase.from("templates").delete().eq("id", id);
        if (error) throw error;
        await refresh();
      },
      bumpTemplate: async (id) => {
        const template = data.templates.find((t) => t.id === id);
        if (!template) return;
        await supabase.from("templates").update({ uses: template.uses + 1 }).eq("id", id);
        await refresh();
      },
      saveEvent: async (event) => {
        if (!orgId || !user) throw new Error("No workspace");
        const row = {
          org_id: orgId,
          title: event.title,
          description: event.description,
          starts_at: event.startsAt,
          ends_at: event.endsAt,
          timezone: event.timezone,
          color: event.color,
          updated_at: new Date().toISOString(),
        };
        const { error } = event.id
          ? await supabase.from("org_events").update(row).eq("id", event.id)
          : await supabase.from("org_events").insert({ ...row, created_by: user.id });
        if (error) throw error;
        await refreshEvents();
      },
      removeEvent: async (id) => {
        const { error } = await supabase.from("org_events").delete().eq("id", id);
        if (error) throw error;
        await refreshEvents();
      },
    };
  }, [
    authReady,
    data,
    dataQuery.isLoading,
    events,
    logAudit,
    membershipQuery.isLoading,
    memberships,
    navigate,
    orgId,
    queryClient,
    refresh,
    refreshEvents,
    user,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

const placeholderOrg: Organization = { id: "", name: "Workspace", tag: "Workspace", plan: "Free" };
const placeholderMember: Member = {
  id: "",
  orgIds: [],
  name: "You",
  handle: "you",
  role: "user",
  avatar: "",
  email: "",
};

/**
 * Store scoped to a signed-in member with an active workspace. While the
 * workspace is still loading it returns safe placeholders instead of throwing.
 */
export function useWorkspace() {
  const store = useStore();
  return {
    ...store,
    currentOrg: store.currentOrg ?? placeholderOrg,
    currentUser: store.currentUser ?? placeholderMember,
  };
}
