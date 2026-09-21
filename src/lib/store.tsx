import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { buildSeed } from "./seed";
import {
  permissionsFor,
  type AppState,
  type AuditAction,
  type AuditEntry,
  type Channel,
  type DiscordServer,
  type MediaAsset,
  type Post,
  type PostStatus,
  type Role,
} from "./types";

const STORAGE_KEY = "discord-cms-state-v1";

export const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

interface StoreValue {
  state: AppState;
  currentOrg: AppState["organizations"][number];
  currentUser: AppState["members"][number];
  permissions: ReturnType<typeof permissionsFor>;
  orgServers: DiscordServer[];
  orgChannels: Channel[];
  orgPosts: Post[];
  orgMembers: AppState["members"];
  orgTemplates: AppState["templates"];
  orgMedia: MediaAsset[];
  setOrg: (id: string) => void;
  setUser: (id: string) => void;
  setRole: (memberId: string, role: Role) => void;
  channelsOfServer: (serverId: string) => Channel[];
  serverOf: (id: string) => DiscordServer | undefined;
  channelOf: (id: string) => Channel | undefined;
  memberOf: (id: string) => AppState["members"][number] | undefined;
  auditOf: (postId: string) => AuditEntry[];
  savePost: (post: Post, note?: string) => void;
  createPost: (post: Post) => void;
  deletePost: (id: string) => void;
  transition: (postId: string, status: PostStatus, action: AuditAction, note?: string) => void;
  comment: (postId: string, note: string) => void;
  publishNow: (postId: string) => void;
  updateServer: (id: string, patch: Partial<DiscordServer>) => void;
  toggleChannelApproval: (channelId: string) => void;
  addChannel: (serverId: string, name: string, type: Channel["type"]) => void;
  addMedia: (asset: Omit<MediaAsset, "id" | "addedAt" | "orgId">) => void;
  removeMedia: (id: string) => void;
  bumpTemplate: (id: string) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => buildSeed());
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw) as AppState);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, [state]);

  const log = useCallback(
    (postId: string, action: AuditAction, actorId: string, note?: string): AuditEntry => ({
      id: uid("a"),
      postId,
      actorId,
      action,
      ...(note ? { note } : {}),
      at: new Date().toISOString(),
    }),
    [],
  );

  const value = useMemo<StoreValue>(() => {
    const currentOrg =
      state.organizations.find((o) => o.id === state.currentOrgId) ?? state.organizations[0]!;
    const currentUser =
      state.members.find((m) => m.id === state.currentUserId) ?? state.members[0]!;
    const orgServers = state.servers.filter((s) => s.orgId === currentOrg.id);
    const serverIds = new Set(orgServers.map((s) => s.id));
    const orgChannels = state.channels.filter((c) => serverIds.has(c.serverId));

    const push = (updater: (prev: AppState) => AppState) => setState(updater);

    return {
      state,
      currentOrg,
      currentUser,
      permissions: permissionsFor(currentUser.role),
      orgServers,
      orgChannels,
      orgPosts: state.posts.filter((p) => p.orgId === currentOrg.id),
      orgMembers: state.members.filter((m) => m.orgIds.includes(currentOrg.id)),
      orgTemplates: state.templates.filter((t) => t.orgId === currentOrg.id),
      orgMedia: state.media.filter((m) => m.orgId === currentOrg.id),
      setOrg: (id) =>
        push((prev) => {
          const eligible = prev.members.find(
            (m) => m.id === prev.currentUserId && m.orgIds.includes(id),
          );
          return {
            ...prev,
            currentOrgId: id,
            currentUserId: eligible
              ? prev.currentUserId
              : (prev.members.find((m) => m.orgIds.includes(id))?.id ?? prev.currentUserId),
          };
        }),
      setUser: (id) => push((prev) => ({ ...prev, currentUserId: id })),
      setRole: (memberId, role) =>
        push((prev) => ({
          ...prev,
          members: prev.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
        })),
      channelsOfServer: (serverId) => state.channels.filter((c) => c.serverId === serverId),
      serverOf: (id) => state.servers.find((s) => s.id === id),
      channelOf: (id) => state.channels.find((c) => c.id === id),
      memberOf: (id) => state.members.find((m) => m.id === id),
      auditOf: (postId) =>
        state.audit
          .filter((a) => a.postId === postId)
          .sort((a, b) => a.at.localeCompare(b.at)),
      createPost: (post) =>
        push((prev) => ({
          ...prev,
          posts: [post, ...prev.posts],
          audit: [...prev.audit, log(post.id, "created", prev.currentUserId)],
        })),
      savePost: (post, note) =>
        push((prev) => ({
          ...prev,
          posts: prev.posts.map((p) =>
            p.id === post.id ? { ...post, updatedAt: new Date().toISOString() } : p,
          ),
          audit: [...prev.audit, log(post.id, "updated", prev.currentUserId, note)],
        })),
      deletePost: (id) =>
        push((prev) => ({ ...prev, posts: prev.posts.filter((p) => p.id !== id) })),
      transition: (postId, status, action, note) =>
        push((prev) => ({
          ...prev,
          posts: prev.posts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  status,
                  revision: action === "resubmitted" ? p.revision + 1 : p.revision,
                  updatedAt: new Date().toISOString(),
                }
              : p,
          ),
          audit: [...prev.audit, log(postId, action, prev.currentUserId, note)],
        })),
      comment: (postId, note) =>
        push((prev) => ({
          ...prev,
          audit: [...prev.audit, log(postId, "comment", prev.currentUserId, note)],
        })),
      publishNow: (postId) =>
        push((prev) => {
          const post = prev.posts.find((p) => p.id === postId);
          const channel = prev.channels.find((c) => c.id === post?.channelId);
          const now = new Date().toISOString();
          const note = `Delivered to #${channel?.name ?? "channel"} · ${
            post?.kind === "embed" ? "1 message, 1 embed" : "1 message"
          }`;
          return {
            ...prev,
            posts: prev.posts.map((p) =>
              p.id === postId
                ? { ...p, status: "published", publishedAt: now, deliveryNote: note, updatedAt: now }
                : p,
            ),
            audit: [...prev.audit, log(postId, "published", prev.currentUserId, note)],
          };
        }),
      updateServer: (id, patch) =>
        push((prev) => ({
          ...prev,
          servers: prev.servers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),
      toggleChannelApproval: (channelId) =>
        push((prev) => ({
          ...prev,
          channels: prev.channels.map((c) =>
            c.id === channelId ? { ...c, requiresApproval: !c.requiresApproval } : c,
          ),
        })),
      addChannel: (serverId, name, type) =>
        push((prev) => ({
          ...prev,
          channels: [
            ...prev.channels,
            { id: uid("ch"), serverId, name, type, requiresApproval: type === "announcement" },
          ],
        })),
      addMedia: (asset) =>
        push((prev) => ({
          ...prev,
          media: [
            { ...asset, id: uid("m"), orgId: prev.currentOrgId, addedAt: new Date().toISOString() },
            ...prev.media,
          ],
        })),
      removeMedia: (id) => push((prev) => ({ ...prev, media: prev.media.filter((m) => m.id !== id) })),
      bumpTemplate: (id) =>
        push((prev) => ({
          ...prev,
          templates: prev.templates.map((t) => (t.id === id ? { ...t, uses: t.uses + 1 } : t)),
        })),
      resetDemo: () => setState(buildSeed()),
    };
  }, [state, log]);

  return (
    <StoreContext.Provider value={value}>
      {mounted ? (
        children
      ) : (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blurple border-t-transparent" />
        </div>
      )}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
