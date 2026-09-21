export type Role = "super_admin" | "admin" | "approver" | "user";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  approver: "Approver",
  user: "Normal User",
};

export type PostStatus =
  | "draft"
  | "pending"
  | "changes_requested"
  | "rejected"
  | "approved"
  | "scheduled"
  | "published"
  | "failed"
  | "cancelled";

export const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Draft",
  pending: "Pending Approval",
  changes_requested: "Changes Requested",
  rejected: "Rejected",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
};

export interface Organization {
  id: string;
  name: string;
  tag: string;
  plan: string;
}

export interface Member {
  id: string;
  orgIds: string[];
  name: string;
  handle: string;
  role: Role;
  avatar: string;
  email: string;
}

export interface Channel {
  id: string;
  serverId: string;
  discordId: string;
  name: string;
  type: "text" | "announcement";
  requiresApproval: boolean;
}

export interface DiscordServer {
  id: string;
  orgId: string;
  name: string;
  guildId: string;
  icon: string;
  botName: string;
  botAvatar: string;
  connected: boolean;
}

export interface EmbedField {
  id: string;
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedButton {
  id: string;
  label: string;
  url: string;
  style: "primary" | "secondary" | "success" | "danger" | "link";
}

export interface DiscordEmbed {
  authorName: string;
  authorIcon: string;
  title: string;
  titleUrl: string;
  description: string;
  color: string;
  thumbnail: string;
  image: string;
  fields: EmbedField[];
  footerText: string;
  footerIcon: string;
  showTimestamp: boolean;
}

export type AuditAction =
  | "created"
  | "updated"
  | "submitted"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "resubmitted"
  | "scheduled"
  | "published"
  | "failed"
  | "cancelled"
  | "comment";

export interface AuditEntry {
  id: string;
  postId: string;
  actorId: string;
  action: AuditAction;
  note?: string;
  at: string;
}

export interface Post {
  id: string;
  orgId: string;
  serverId: string;
  channelId: string;
  authorId: string;
  title: string;
  kind: "message" | "embed";
  content: string;
  embed: DiscordEmbed;
  buttons: EmbedButton[];
  attachments: string[];
  /** "upload" sends files to Discord natively; "embed" links them inside the embed card. */
  mediaMode: "upload" | "embed";
  status: PostStatus;
  scheduledAt: string | null;
  timezone: string;
  publishedAt: string | null;
  deliveryNote: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  orgId: string;
  name: string;
  category: string;
  description: string;
  kind: "message" | "embed";
  content: string;
  embed: DiscordEmbed;
  buttons: EmbedButton[];
  uses: number;
}

export interface MediaAsset {
  id: string;
  orgId: string;
  name: string;
  url: string;
  kind: "banner" | "thumbnail" | "icon";
  tags: string[];
  addedAt: string;
  createdBy: string | null;
  /** Set when the file was uploaded from a device; empty for linked images. */
  storagePath: string | null;
}

export const DISCORD_COLORS: { name: string; hex: string }[] = [
  { name: "Blurple", hex: "#5865F2" },
  { name: "Green", hex: "#57F287" },
  { name: "Yellow", hex: "#FEE75C" },
  { name: "Fuchsia", hex: "#EB459E" },
  { name: "Red", hex: "#ED4245" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Black", hex: "#23272A" },
  { name: "Greyple", hex: "#99AAB5" },
  { name: "Dark But Not Black", hex: "#2C2F33" },
  { name: "Aqua", hex: "#1ABC9C" },
  { name: "Gold", hex: "#F1C40F" },
  { name: "Purple", hex: "#9B59B6" },
];

export const emptyEmbed = (): DiscordEmbed => ({
  authorName: "",
  authorIcon: "",
  title: "",
  titleUrl: "",
  description: "",
  color: "#5865F2",
  thumbnail: "",
  image: "",
  fields: [],
  footerText: "",
  footerIcon: "",
  showTimestamp: true,
});

export interface Permissions {
  createPost: boolean;
  approve: boolean;
  configureServers: boolean;
  manageTeam: boolean;
  manageOrganizations: boolean;
  publishDirectly: boolean;
}

export function permissionsFor(role: Role): Permissions {
  switch (role) {
    case "super_admin":
      return {
        createPost: true,
        approve: true,
        configureServers: true,
        manageTeam: true,
        manageOrganizations: true,
        publishDirectly: true,
      };
    case "admin":
      return {
        createPost: true,
        approve: true,
        configureServers: true,
        manageTeam: true,
        manageOrganizations: false,
        publishDirectly: true,
      };
    case "approver":
      return {
        createPost: true,
        approve: true,
        configureServers: false,
        manageTeam: false,
        manageOrganizations: false,
        publishDirectly: false,
      };
    default:
      return {
        createPost: true,
        approve: false,
        configureServers: false,
        manageTeam: false,
        manageOrganizations: false,
        publishDirectly: false,
      };
  }
}

export const TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
];

export type MediaAssetKind = MediaAsset["kind"];

/** Workspace-wide calendar event, visible to every member, managed by admins. */
export interface OrgEvent {
  id: string;
  orgId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  color: string;
  createdBy: string | null;
}
