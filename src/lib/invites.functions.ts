import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Role } from "@/lib/types";

const MANAGER_ROLES = ["super_admin", "admin"];

export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; email: string; role: Role }) => input)
  .handler(async ({ data, context }) => {
    const { data: membership } = await context.supabase
      .from("org_members")
      .select("role")
      .eq("org_id", data.orgId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!membership || !MANAGER_ROLES.includes(membership.role)) {
      return { ok: false as const, message: "Only owners and admins can invite people." };
    }

    const email = data.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { ok: false as const, message: "That email address does not look right." };
    }

    const { data: row, error } = await context.supabase
      .from("invites")
      .insert({ org_id: data.orgId, email, role: data.role, created_by: context.userId })
      .select("token")
      .single();
    if (error) return { ok: false as const, message: error.message };

    return { ok: true as const, token: row.token, email };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite } = await supabaseAdmin
      .from("invites")
      .select("id, org_id, email, role, accepted_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) return { ok: false as const, message: "This invite link is not valid." };
    if (invite.accepted_at) return { ok: false as const, message: "This invite was already used." };

    const inviteEmail = invite.email.toLowerCase();
    const userEmail = String(context.claims["email"] ?? "").toLowerCase();
    if (userEmail && inviteEmail !== userEmail) {
      return {
        ok: false as const,
        message: `This invite was sent to ${invite.email}. Sign in with that address to accept it.`,
      };
    }

    const { error } = await supabaseAdmin
      .from("org_members")
      .upsert(
        { org_id: invite.org_id, user_id: context.userId, role: invite.role },
        { onConflict: "org_id,user_id" },
      );
    if (error) return { ok: false as const, message: error.message };

    await supabaseAdmin
      .from("invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", invite.org_id)
      .maybeSingle();

    return { ok: true as const, orgId: invite.org_id, orgName: org?.name ?? "the workspace" };
  });
