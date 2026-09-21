import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvite } from "@/lib/invites.functions";

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
  const [state, setState] = useState<"checking" | "signin" | "password" | "working" | "error">("checking");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        localStorage.setItem(PENDING_INVITE_KEY, token);
        setState("signin");
        return;
      }
      const invited = new URLSearchParams(window.location.search).get("invited") === "1";
      if (invited && !data.session.user.user_metadata?.["invite_password_set"]) {
        setState("password");
        return;
      }
      setState("working");
      const result = await acceptInvite({ data: { token } });
      if (cancelled) return;
      localStorage.removeItem(PENDING_INVITE_KEY);
      if (result.ok) {
        localStorage.setItem("discord-cms-current-org", result.orgId);
        void navigate({ to: "/dashboard", replace: true });
      } else {
        setMessage(result.message);
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  const finishInvite = async () => {
    if (password.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    setState("working");
    const { error } = await supabase.auth.updateUser({
      password,
      data: { invite_password_set: true },
    });
    if (error) {
      setMessage(error.message);
      setState("error");
      return;
    }
    const result = await acceptInvite({ data: { token } });
    localStorage.removeItem(PENDING_INVITE_KEY);
    if (!result.ok) {
      setMessage(result.message);
      setState("error");
      return;
    }
    localStorage.setItem("discord-cms-current-org", result.orgId);
    void navigate({ to: "/dashboard", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold">Workspace invitation</h1>
        {state === "checking" || state === "working" ? (
          <p className="mt-2 text-sm text-muted-foreground">Checking your invitation…</p>
        ) : state === "signin" ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in or create your account with the invited email address, and you will join
              automatically.
            </p>
            <Button asChild className="mt-4 w-full">
              <Link to="/auth">Continue</Link>
            </Button>
          </>
        ) : state === "password" ? (
          <div className="mt-4 space-y-3 text-left">
            <p className="text-sm text-muted-foreground">
              Your email is verified. Choose a password to finish joining this workspace.
            </p>
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
              Set password and join
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-destructive">{message}</p>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/auth">Back to sign in</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
