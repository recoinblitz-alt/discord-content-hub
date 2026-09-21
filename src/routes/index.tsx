import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, CheckCheck, MessageSquare, Zap } from "lucide-react";
import { useEffect } from "react";

import { LegalFooter } from "@/components/legal-page";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Relaystack — Discord scheduling, approvals and embeds" },
      {
        name: "description",
        content:
          "Draft Discord announcements with a live embed preview, route them through approvals, schedule them, and let your bot publish automatically.",
      },
      { property: "og:title", content: "Relaystack — Discord content operations" },
      {
        property: "og:description",
        content:
          "Live embed builder, approval queue, content calendar and real bot delivery for your Discord servers.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: MessageSquare,
    title: "Live embed builder",
    body: "Compose messages and rich embeds with a preview that matches Discord exactly.",
  },
  {
    icon: CheckCheck,
    title: "Approvals that stick",
    body: "Route announcement channels through approvers with comments and full history.",
  },
  {
    icon: CalendarClock,
    title: "Scheduled delivery",
    body: "Your bot posts at the exact time you picked, in the timezone you picked.",
  },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blurple text-blurple-foreground">
            <Zap className="h-5 w-5" />
          </div>
          <span className="font-display text-sm font-semibold">Relaystack</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-10 md:pt-20">
        <p className="text-xs font-semibold uppercase tracking-widest text-blurple">
          Discord content operations
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight md:text-5xl">
          Plan, approve and publish every Discord announcement in one place.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          Connect your bot, draft embeds with a pixel-accurate preview, send them through approval,
          and schedule delivery down to the minute.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Get started</Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-surface p-5">
              <f.icon className="h-5 w-5 text-blurple" />
              <h2 className="mt-3 font-display text-sm font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
        <LegalFooter className="mt-16 border-t border-border pt-6" />
      </main>
    </div>
  );
}
