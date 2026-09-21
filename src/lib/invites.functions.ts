import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Role } from "@/lib/types";

const MANAGER_ROLES = ["super_admin", "admin"];

function publicAuthClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; email: string; role: Role; origin: string }) => input)
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

    const { data: pendingInvite, error: pendingError } = await context.supabase
      .from("invites")
      .select("token")
      .eq("org_id", data.orgId)
      .eq("email", email)
      .is("accepted_at", null)
      .maybeSingle();
    if (pendingError) return { ok: false as const, message: pendingError.message };

    const inviteWrite = pendingInvite
      ? context.supabase
          .from("invites")
          .update({ role: data.role, created_by: context.userId })
          .eq("org_id", data.orgId)
          .eq("token", pendingInvite.token)
          .select("token")
          .single()
      : context.supabase
          .from("invites")
          .insert({ org_id: data.orgId, email, role: data.role, created_by: context.userId })
          .select("token")
          .single();
    const { data: row, error } = await inviteWrite;
    if (error) return { ok: false as const, message: error.message };

    const origin = new URL(data.origin).origin;
    const inviteUrl = `${origin}/invite/${row.token}?invited=1`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: accountInviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: inviteUrl,
      data: { invited_org_id: data.orgId, invited_role: data.role },
    });

    let emailError = accountInviteError;
    if (accountInviteError) {
      const authClient = publicAuthClient();
      if (authClient) {
        const fallback = await authClient.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: inviteUrl, shouldCreateUser: false },
        });
        emailError = fallback.error;
      }
    }

    return {
      ok: true as const,
      token: row.token,
      email,
      emailSent: !emailError,
      reused: Boolean(pendingInvite),
      message: emailError
        ? "The invite link is ready, but email delivery failed. Copy and share the link below."
        : pendingInvite
          ? "The existing invitation was updated and emailed again."
          : "Invitation email sent.",
    };
  });

export const inspectInvite = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const authClient = publicAuthClient();
    if (!authClient) {
      return {
        valid: false as const,
        reason: "configuration" as const,
        message: "Invitations are not configured on this deployment. Ask an administrator to check the deployment settings.",
      };
    }
    const { data: result, error } = await authClient.rpc("get_org_invite_preview", { _token: data.token });
    if (error) {
      const unavailable =
        ["PGRST202", "42883"].includes(error.code ?? "") ||
        /could not find the function|does not exist/i.test(error.message);
      return {
        valid: false as const,
        reason: unavailable ? ("deployment" as const) : ("unknown" as const),
        message: unavailable
          ? "Invitations are not ready on this deployment. Ask an administrator to apply the latest database updates."
          : "We could not check this invitation. Please try again.",
      };
    }
    return result as
      | { valid: true; organizationName: string; emailHint: string; role: Role; accepted: boolean }
      | { valid: false; message: string };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data, context }) => {
    const invoke = () => context.supabase.rpc("accept_org_invite", { _token: data.token });
    let { data: result, error } = await invoke();
    const staleSchema =
      error &&
      (["PGRST202", "42883"].includes(error.code ?? "") ||
        /could not find the function|does not exist/i.test(error.message));
    if (staleSchema) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      const retry = await invoke();
      result = retry.data;
      error = retry.error;
    }
    if (error) {
      const stillStale =
        ["PGRST202", "42883"].includes(error.code ?? "") ||
        /could not find the function|does not exist/i.test(error.message);
      return {
        ok: false as const,
        message: stillStale
          ? "Invitations are not ready on this deployment. Ask an administrator to apply the latest database updates."
          : error.message,
      };
    }
    return result as
      | { ok: true; orgId: string; orgName: string; alreadyAccepted: boolean }
      | { ok: false; message: string };
  });
