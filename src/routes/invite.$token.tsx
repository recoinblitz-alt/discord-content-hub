import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
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
  const [state, setState] = useState<"checking" | "signin" | "working" | "error">("checking");
  const [message, setMessage] = useState("");

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
