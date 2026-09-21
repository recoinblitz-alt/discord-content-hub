import { createFileRoute } from "@tanstack/react-router";

import { CONTACT_EMAIL, LegalPage, Section } from "@/components/legal-page";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie notice — MUNO" },
      {
        name: "description",
        content:
          "MUNO uses only the storage needed to keep you signed in and remember your theme.",
      },
      { property: "og:title", content: "Cookie notice — MUNO" },
      {
        property: "og:description",
        content: "No advertising or tracking cookies — only the sign-in session and theme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cookies,
});

function Cookies() {
  return (
    <LegalPage title="Cookie notice" updated="21 September 2026">
      <p>
        We use no advertising, analytics or tracking cookies. Only the following strictly necessary
        storage is used, all of it on your own device:
      </p>

      <Section heading="Sign-in session">
        <p>
          Your authenticated session is kept so you stay signed in between visits and page reloads.
          Signing out clears it.
        </p>
      </Section>

      <Section heading="Theme preference">
        <p>
          Whether you chose dark or light mode is remembered so the app does not flash the wrong
          theme when it loads.
        </p>
      </Section>

      <Section heading="Current workspace">
        <p>
          If you belong to more than one workspace, we remember which one you were last looking at.
        </p>
      </Section>

      <Section heading="Managing it">
        <p>
          You can clear this storage in your browser settings at any time; you will simply be signed
          out and the theme will return to its default. Questions:{" "}
          <span className="text-foreground">{CONTACT_EMAIL}</span>.
        </p>
      </Section>
    </LegalPage>
  );
}
