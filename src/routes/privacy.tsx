import { createFileRoute } from "@tanstack/react-router";

import { CONTACT_EMAIL, COMPANY_NAME, LegalPage, Section } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Relaystack" },
      {
        name: "description",
        content:
          "What Relaystack stores, why, who processes it, how long it is kept, and how to request deletion.",
      },
      { property: "og:title", content: "Privacy Policy — Relaystack" },
      {
        property: "og:description",
        content: "How Relaystack handles account data, posts, uploaded images and bot tokens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="21 September 2026">
      <p>
        This policy explains what {COMPANY_NAME} stores about you and your workspace, why we store
        it, and the choices you have.
      </p>

      <Section heading="What we store">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <span className="text-foreground">Account details</span> — your email address, display
            name and a hashed password (or the identity returned by your sign-in provider).
          </li>
          <li>
            <span className="text-foreground">Workspace data</span> — workspace name, members and
            their roles, invitations you send.
          </li>
          <li>
            <span className="text-foreground">Content</span> — posts, embeds, buttons, templates,
            calendar events, approval decisions and comments, plus the audit trail of who did what
            and when.
          </li>
          <li>
            <span className="text-foreground">Uploaded images</span> — files you add to the media
            library, stored in a private bucket and served through our own address.
          </li>
          <li>
            <span className="text-foreground">Discord bot tokens</span> — stored encrypted, readable
            only by our server when sending a message, and never shown back to you in full.
          </li>
          <li>
            <span className="text-foreground">Discord server data</span> — server, channel and, when
            you run an export, member and role information retrieved from Discord&rsquo;s API.
          </li>
          <li>
            <span className="text-foreground">Technical logs</span> — delivery results and error
            messages needed to diagnose failed sends.
          </li>
        </ul>
      </Section>

      <Section heading="Why we store it">
        <p>
          To provide the service you asked for: authenticating you, showing your workspace, running
          approvals, scheduling and delivering posts to Discord, and keeping an audit trail for your
          team. We do not sell your data and we do not use it for advertising.
        </p>
      </Section>

      <Section heading="Who processes it">
        <ul className="ml-5 list-disc space-y-1">
          <li>Our hosting and database provider, to run the application and store your data.</li>
          <li>Discord, when we deliver a message or read server, channel or member information.</li>
          <li>Email delivery, for sign-in confirmation and password resets.</li>
        </ul>
        <p>
          These providers act on our instructions. Data may be processed in countries outside your
          own; we rely on the providers&rsquo; standard contractual protections.
        </p>
      </Section>

      <Section heading="Exported member data">
        <p>
          A workspace owner can export the member list of a connected Discord server (user ID,
          username, display name, join date and roles). That file is generated for you and
          downloaded to your device; we do not keep a copy. You are responsible for handling it
          lawfully once exported, including telling your members if required.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <p>
          Account and workspace data is kept while your account is active. Delete a post, image,
          event or workspace and it is removed from our database; backups age out within 30 days.
          Removing a bot token deletes it immediately.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          You can ask for a copy of your data, correction of inaccurate data, deletion of your
          account, or restriction of processing. Write to{" "}
          <span className="text-foreground">{CONTACT_EMAIL}</span> and we will respond within 30
          days. If you are in the EEA or UK you may also complain to your local data protection
          authority.
        </p>
      </Section>

      <Section heading="Security">
        <p>
          Data is encrypted in transit, access to your workspace is restricted by row-level rules to
          its own members, and bot tokens are readable only by our server processes. No system is
          perfectly secure — tell us straight away if you suspect a problem.
        </p>
      </Section>

      <Section heading="Children">
        <p>
          The service is not intended for anyone under 13, or under the minimum age Discord requires
          in your country.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Privacy questions or requests: <span className="text-foreground">{CONTACT_EMAIL}</span>.
        </p>
      </Section>
    </LegalPage>
  );
}
