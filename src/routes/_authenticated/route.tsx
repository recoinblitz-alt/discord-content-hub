import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { AppFrame } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { StoreProvider, useWorkspace } from "@/lib/store";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) throw redirect({ to: "/auth" });
    const pendingInvite = window.localStorage.getItem("relaystack-pending-invite");
    if (pendingInvite) {
      throw redirect({ to: "/invite/$token", params: { token: pendingInvite } });
    }
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <StoreProvider>
      <WorkspaceLayout />
    </StoreProvider>
  );
}

function WorkspaceLayout() {
  const { ready, loading, organizations } = useWorkspace();
  const pendingInvite =
    typeof window !== "undefined" ? window.localStorage.getItem("relaystack-pending-invite") : null;

  if (!ready || (loading && organizations.length === 0)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (organizations.length === 0 && pendingInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (organizations.length === 0) return <NoWorkspace />;

  return (
    <AppFrame>
      <Outlet />
    </AppFrame>
  );
}

function NoWorkspace() {
  const { currentUser, signOut } = useWorkspace();
  const [showCreate, setShowCreate] = useState(false);

  if (showCreate) return <CreateWorkspace onBack={() => setShowCreate(false)} />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-2.5">
          <BrandLogo className="h-11 w-11" />
          <div className="leading-tight">
            <div className="font-display text-base font-semibold">Welcome to MUNO</div>
            <div className="text-xs text-muted-foreground">
              {currentUser?.email ? `Signed in as ${currentUser.email}` : "You're signed in"}
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          You're not part of a workspace yet. Join one with an invite, or start your own.
        </p>

        <JoinWithInvite />

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={() => setShowCreate(true)}>
          Create a new workspace
        </Button>

        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Sign out or use another account
        </button>
      </div>
    </div>
  );
}

function JoinWithInvite() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  const join = (event: React.FormEvent) => {
    event.preventDefault();
    const raw = value.trim();
    if (!raw) return;
    const token = raw.split("?")[0]?.split("/").filter(Boolean).pop() ?? "";
    if (!token) {
      toast.error("Paste the invite link or code you were sent");
      return;
    }
    navigate({ to: "/invite/$token", params: { token } });
  };

  return (
    <form onSubmit={join} className="space-y-2">
      <Label htmlFor="invite-code">Have an invite link or code?</Label>
      <div className="flex gap-2">
        <Input
          id="invite-code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste invite link or code"
        />
        <Button type="submit" disabled={!value.trim()}>
          Join
        </Button>
      </div>
    </form>
  );
}

function CreateWorkspace({ onBack }: { onBack: () => void }) {
  const { createWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("Gaming / Esports");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createWorkspace(name.trim(), kind);
      toast.success("Workspace created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the workspace");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-2.5">
          <BrandLogo className="h-11 w-11" />
          <div className="leading-tight">
            <div className="font-display text-base font-semibold">Name your workspace</div>
            <div className="text-xs text-muted-foreground">You'll be its owner</div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws-name">Workspace name</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nova Esports"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ws-kind">What is it for?</Label>
          <select
            id="ws-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option>Gaming / Esports</option>
            <option>Creator Community</option>
            <option>Product / SaaS</option>
            <option>Agency</option>
            <option>Other</option>
          </select>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Create workspace
        </Button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Back
        </button>
      </form>
    </div>
  );
}

