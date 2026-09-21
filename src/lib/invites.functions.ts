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
    if (data.role === "super_admin" && membership.role !== "super_admin") {
      return { ok: false as const, message: "Only a Super Admin can invite another Super Admin." };
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

    const inviteUrl = `${data.origin}/invite/${row.token}?invited=1`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: emailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: inviteUrl,
      data: { invited_org_id: data.orgId, invited_role: data.role },
    });

    return {
      ok: true as const,
      token: row.token,
      email,
      emailSent: !emailError,
      message: emailError
        ? "Invite created. This address already has an account or email delivery was unavailable; share the link instead."
        : "Invitation email sent.",
    };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("accept_org_invite", {
      _token: data.token,
    });
    if (error) return { ok: false as const, message: error.message };
    return result as
      | { ok: true; orgId: string; orgName: string; alreadyAccepted: boolean }
      | { ok: false; message: string };
  });
