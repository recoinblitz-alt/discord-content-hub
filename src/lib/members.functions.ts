import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { Role } from "@/lib/types";

async function membershipRole(
  supabase: SupabaseClient<Database>,
  orgId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role as Role | undefined;
}

export const getOrgMemberRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => input)
  .handler(async ({ data, context }) => {
    const callerRole = await membershipRole(context.supabase, data.orgId, context.userId);
    if (callerRole !== "super_admin" && callerRole !== "admin") {
      throw new Error("Owner or admin access required");
    }

    const { data: members, error } = await context.supabase
      .from("org_members")
      .select("user_id, role, profile:profiles(email, display_name, avatar_url)")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return members ?? [];
  });

export const changeMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; userId: string; role: Role }) => input)
  .handler(async ({ data, context }) => {
    const callerRole = await membershipRole(context.supabase, data.orgId, context.userId);
    if (callerRole !== "super_admin" && callerRole !== "admin") throw new Error("Owner or admin access required");
    if (data.userId === context.userId) throw new Error("You cannot change your own role");

    const targetRole = await membershipRole(context.supabase, data.orgId, data.userId);
    if (!targetRole) throw new Error("Member not found");
    if (callerRole === "admin" && (targetRole === "super_admin" || data.role === "super_admin")) {
      throw new Error("Only a Super Admin can manage Super Admin access");
    }

    if (targetRole === "super_admin" && data.role !== "super_admin") {
      const { count } = await context.supabase
        .from("org_members")
        .select("id", { count: "exact", head: true })
        .eq("org_id", data.orgId)
        .eq("role", "super_admin");
      if ((count ?? 0) <= 1) throw new Error("Every workspace must keep at least one Super Admin");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("org_members")
      .update({ role: data.role })
      .eq("org_id", data.orgId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removeOrgMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; userId: string }) => input)
  .handler(async ({ data, context }) => {
    const callerRole = await membershipRole(context.supabase, data.orgId, context.userId);
    if (callerRole !== "super_admin" && callerRole !== "admin") throw new Error("Owner or admin access required");
    if (data.userId === context.userId) throw new Error("You cannot remove yourself from the workspace");

    const targetRole = await membershipRole(context.supabase, data.orgId, data.userId);
    if (!targetRole) throw new Error("Member not found");
    if (targetRole === "super_admin") throw new Error("Super Admins must be demoted by another Super Admin before removal");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("org_members")
      .delete()
      .eq("org_id", data.orgId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });