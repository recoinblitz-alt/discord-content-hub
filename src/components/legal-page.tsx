import { Link } from "@tanstack/react-router";
import { ArrowLeft, Zap } from "lucide-react";
import type { ReactNode } from "react";

export const LEGAL_LINKS = [
  { to: "/terms", label: "Terms & Conditions" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/cookies", label: "Cookie notice" },
  { to: "/support", label: "Support" },
] as const;

export const COMPANY_NAME = "Relaystack";
export const CONTACT_EMAIL = "support@relaystack.app";

export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground ${className}`}>
      <span>
        © {new Date().getFullYear()} {COMPANY_NAME}
      </span>
      {LEGAL_LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="transition-colors hover:text-foreground">
          {l.label}
        </Link>
      ))}
    </footer>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blurple text-blurple-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <span className="font-display text-sm font-semibold">{COMPANY_NAME}</span>
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back home
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20">
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {updated}</p>
        <div className="legal-body mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
        <div className="mt-12 border-t border-border pt-6">
          <LegalFooter />
        </div>
      </main>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-base font-semibold text-foreground">{heading}</h2>
      {children}
    </section>
  );
}
