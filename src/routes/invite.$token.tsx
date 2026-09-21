import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvite, inspectInvite } from "@/lib/invites.functions";
import { ROLE_LABELS, type Role } from "@/lib/types";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Join a workspace — MUNO" },
      { name: "description", content: "Accept your MUNO workspace invitation." },
      { property: "og:title", content: "Join a workspace — MUNO" },
      { property: "og:description", content: "Accept your MUNO workspace invitation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AcceptInvite,
});

export const PENDING_INVITE_KEY = "relaystack-pending-invite";

function AcceptInvite() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "signin" | "setup" | "working" | "sent" | "error">("checking");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState<{ organizationName: string; emailHint: string; role: Role } | null>(null);

  const completeAcceptance = async () => {
    setState("working");
    const result = await acceptInvite({ data: { token } });
    if (!result.ok) {
      setMessage(result.message);
      setState("error");
      return;
    }
    localStorage.removeItem(PENDING_INVITE_KEY);
    localStorage.setItem("discord-cms-current-org", result.orgId);
    await navigate({ to: "/dashboard", replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const preview = await inspectInvite({ data: { token } });
      if (cancelled) return;
      if (!preview.valid) {
        localStorage.removeItem(PENDING_INVITE_KEY);
        setMessage(preview.message);
        setState("error");
        return;
      }
      setInvite({
        organizationName: preview.organizationName,
        emailHint: preview.emailHint,
        role: preview.role,
      });
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        localStorage.setItem(PENDING_INVITE_KEY, token);
        setState("signin");
        return;
      }
      localStorage.setItem(PENDING_INVITE_KEY, token);
      const needsSetup =
        new URLSearchParams(window.location.search).get("invited") === "1" &&
        !data.session.user.user_metadata?.["invite_profile_complete"];
      if (needsSetup) {
        setName(String(data.session.user.user_metadata?.["display_name"] ?? ""));
        setEmail(data.session.user.email ?? "");
        setState("setup");
        return;
      }
      await completeAcceptance();
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const finishInvite = async () => {
    if (!name.trim()) {
      toast.error("Enter your name");
      return;
    }
    if (password && password.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    setState("working");
    const { error } = await supabase.auth.updateUser({
      ...(password ? { password } : {}),
      data: { display_name: name.trim(), invite_profile_complete: true },
    });
    if (error) {
      setMessage(error.message);
      setState("error");
      return;
    }
    await completeAcceptance();
  };

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (authMode === "signup" && !name.trim()) {
      toast.error("Enter your name");
      return;
    }
    setState("working");
    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/invite/${token}?invited=1`,
          data: { display_name: name.trim(), invite_profile_complete: true },
        },
      });
      if (error) {
        setMessage(error.message);
        setState("signin");
        return;
      }
      if (!data.session) {
        setState("sent");
        return;
      }
      await completeAcceptance();
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setMessage(error.message);
      setState("signin");
      return;
    }
    await completeAcceptance();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold">Workspace invitation</h1>
        {invite && (
          <p className="mt-2 text-sm text-muted-foreground">
            Join {invite.organizationName} as {ROLE_LABELS[invite.role]} using {invite.emailHint}.
          </p>
        )}
        {state === "checking" || state === "working" ? (
          <p className="mt-2 text-sm text-muted-foreground">Checking your invitation…</p>
        ) : state === "signin" ? (
          <form className="mt-4 space-y-3 text-left" onSubmit={authenticate}>
            <p className="mt-2 text-sm text-muted-foreground">
              {authMode === "signin"
                ? "Sign in with the invited email address to join this workspace."
                : "Create your account with the invited email address. You will join after verification."}
            </p>
            {authMode === "signup" && <div className="space-y-1.5"><Label htmlFor="new-name">Your name</Label><Input id="new-name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Rivera" /></div>}
            <div className="space-y-1.5"><Label htmlFor="invite-email">Email</Label><Input id="invite-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="existing-password">Password</Label><Input id="existing-password" type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></div>
            {message && <p className="text-sm text-destructive">{message}</p>}
            <Button type="submit" className="w-full">{authMode === "signin" ? "Sign in and join" : "Create account"}</Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => { setMessage(""); setAuthMode(authMode === "signin" ? "signup" : "signin"); }}>
              {authMode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
            </Button>
          </form>
        ) : state === "setup" ? (
          <div className="mt-4 space-y-3 text-left">
            <p className="text-sm text-muted-foreground">
              Your email is verified. Add your name and choose a password to join the workspace.
            </p>
            <div className="space-y-1.5"><Label htmlFor="invite-name">Your name</Label><Input id="invite-name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Rivera" /></div>
            {email && <div className="space-y-1.5"><Label>Email</Label><Input value={email} disabled /></div>}
            <div className="space-y-1.5">
              <Label htmlFor="invite-password">New password</Label>
              <Input
                id="invite-password"
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <Button className="w-full" onClick={() => void finishInvite()}>
              Save and join workspace
            </Button>
          </div>
        ) : state === "sent" ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">Check your email and open the verification link. It will return you here and add you to the workspace.</p>
            <Button variant="outline" className="w-full" onClick={() => setState("signin")}>Back to sign in</Button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-destructive">{message}</p>
            <Button className="mt-4 w-full" onClick={() => window.location.reload()}>Check invitation again</Button>
            <Button variant="outline" className="mt-2 w-full" onClick={() => setState("signin")}>Sign in with another account</Button>
          </>
        )}
      </div>
    </main>
  );
}
