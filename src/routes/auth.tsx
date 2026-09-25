import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — MUNO" },
      {
        name: "description",
        content: "Sign in to MUNO to schedule, approve and publish Discord announcements.",
      },
      { property: "og:title", content: "Sign in — MUNO" },
      {
        property: "og:description",
        content: "Discord content scheduling and approvals for your team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);

  const goAfterAuth = () => {
    const pending = localStorage.getItem("relaystack-pending-invite");
    if (pending) {
      navigate({ to: "/invite/$token", params: { token: pending }, replace: true });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  };

  useEffect(() => {
    const pending = localStorage.getItem("relaystack-pending-invite");
    setPendingInvite(pending);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goAfterAuth();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);


  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: pendingInvite
              ? `${window.location.origin}/invite/${pendingInvite}?invited=1`
              : window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          goAfterAuth();
        } else {
          setSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        goAfterAuth();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email) {
      toast.error("Enter your email first");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <BrandLogo className="h-11 w-11" />
          <div className="leading-tight">
            <div className="font-display text-base font-semibold">MUNO</div>
            <div className="text-xs text-muted-foreground">Discord content ops</div>
          </div>
        </div>

        {sent ? (
          <div className="rounded-xl border border-border bg-surface p-6 text-sm">
            <h1 className="font-display text-lg font-semibold">Check your email</h1>
            <p className="mt-2 text-muted-foreground">
              We sent a confirmation link to {email}. Open it to finish creating your account, then
              come back and sign in.
            </p>
            <Button variant="outline" className="mt-4 w-full" onClick={() => setSent(false)}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-surface p-6">
            <div>
              <h1 className="font-display text-lg font-semibold">
                 {mode === "signin" ? "Sign in" : pendingInvite ? "Create your invited account" : "Create your workspace account"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Welcome back — pick up where your team left off."
                   : pendingInvite
                     ? "Use the invited email address. After verification, you will join the workspace automatically."
                     : "The first account becomes the owner of a new, empty workspace."}
              </p>
            </div>

            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.gg"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Need an account?" : "Already have an account?"}
              </button>
              {mode === "signin" && (
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-2 hover:underline"
                  onClick={reset}
                >
                  Forgot password?
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
