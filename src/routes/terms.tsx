import { createFileRoute } from "@tanstack/react-router";

import { CONTACT_EMAIL, COMPANY_NAME, LegalPage, Section } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — MUNO" },
      {
        name: "description",
        content:
          "The terms that govern use of MUNO, the Discord content scheduling and approval platform.",
      },
      { property: "og:title", content: "Terms & Conditions — MUNO" },
      {
        property: "og:description",
        content: "Accounts, acceptable use, content ownership and liability for MUNO.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Terms & Conditions" updated="21 September 2026">
      <p>
        These terms form an agreement between you and {COMPANY_NAME} (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) covering your use of the {COMPANY_NAME} service. By creating an account or
        using the service you accept them. If you do not accept them, do not use the service.
      </p>

      <Section heading="1. The service">
        <p>
          {COMPANY_NAME} lets teams draft, review, approve, schedule and publish messages to Discord
          channels using a Discord bot that you supply and control. We provide the software; we do
          not operate Discord and we are not affiliated with Discord Inc.
        </p>
      </Section>

      <Section heading="2. Accounts and workspaces">
        <p>
          You need an account to use the service. Keep your credentials secure and tell us promptly
          if you believe they have been compromised. The first person to create a workspace becomes
          its owner and may invite others and assign roles. Workspace owners and admins are
          responsible for who they invite and what those people do inside the workspace.
        </p>
      </Section>

      <Section heading="3. Discord bot tokens and permissions">
        <p>
          You are responsible for creating your Discord application, inviting the bot to servers you
          are authorised to administer, and granting it only the permissions you intend. Providing a
          bot token confirms that you have the right to act for that Discord server. You may remove
          the bot or revoke the token at any time, which stops delivery immediately.
        </p>
      </Section>

      <Section heading="4. Acceptable use">
        <p>You agree not to use the service to:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>send unlawful, harassing, hateful, deceptive or infringing content;</li>
          <li>send unsolicited bulk messages, spam or automated mass mentions;</li>
          <li>circumvent Discord&rsquo;s rate limits, Terms of Service or Community Guidelines;</li>
          <li>attempt to breach, probe or overload our systems, or access another workspace;</li>
          <li>resell or white-label the service without our written agreement.</li>
        </ul>
        <p>
          Your use of Discord remains subject to Discord&rsquo;s own terms. A suspension or ban
          imposed by Discord is outside our control.
        </p>
      </Section>

      <Section heading="5. Your content">
        <p>
          You keep ownership of everything you create or upload: posts, embeds, templates, images and
          workspace data. You grant us only the permission needed to store, process and deliver that
          content on your instruction — for example uploading an image to Discord when you publish a
          post. You confirm you hold the rights to the content you upload.
        </p>
      </Section>

      <Section heading="6. Availability and scheduled delivery">
        <p>
          We work to keep scheduled delivery accurate and reliable, but the service is provided
          without any guaranteed uptime. Delivery depends on Discord&rsquo;s API being reachable and
          on your bot&rsquo;s permissions remaining valid. Where a send fails, the post is marked as
          failed with the reason reported by Discord so you can retry it.
        </p>
      </Section>

      <Section heading="7. Suspension and termination">
        <p>
          You may stop using the service and delete your workspace at any time. We may suspend or
          end access if these terms are breached, if use puts our systems or other users at risk, or
          if required by law. On termination, workspace data may be deleted after a short retention
          period — export anything you need first.
        </p>
      </Section>

      <Section heading="8. Disclaimers and liability">
        <p>
          The service is provided &ldquo;as is&rdquo; without warranties of any kind, to the extent
          permitted by law. We are not liable for indirect or consequential loss, lost profits, lost
          data, or for messages sent, not sent, or sent late. Nothing in these terms limits
          liability that cannot lawfully be limited.
        </p>
      </Section>

      <Section heading="9. Changes">
        <p>
          We may update these terms; the &ldquo;last updated&rdquo; date above will change and
          continued use after that date means you accept the new version.
        </p>
      </Section>

      <Section heading="10. Contact">
        <p>
          Questions about these terms: <span className="text-foreground">{CONTACT_EMAIL}</span>.
        </p>
      </Section>
    </LegalPage>
  );
}
