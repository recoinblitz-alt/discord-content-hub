import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Loader2, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { ready, loading, organizations } = useStore();

  if (!ready || (loading && organizations.length === 0)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (organizations.length === 0) return <CreateWorkspace />;

  return <Outlet />;
}

function CreateWorkspace() {
  const { createWorkspace, signOut } = useStore();
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blurple text-blurple-foreground">
            <Zap className="h-5 w-5" />
          </div>
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
          onClick={() => void signOut()}
          className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
