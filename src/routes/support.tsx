import { createFileRoute } from "@tanstack/react-router";

import { CONTACT_EMAIL, COMPANY_NAME, LegalPage, Section } from "@/components/legal-page";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — Relaystack" },
      {
        name: "description",
        content:
          "Get help with bot connection, approvals, scheduled delivery and member exports in Relaystack.",
      },
      { property: "og:title", content: "Support — Relaystack" },
      {
        property: "og:description",
        content: "Contact details and answers to common Relaystack questions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Support,
});

function Support() {
  return (
    <LegalPage title="Support" updated="21 September 2026">
      <p>
        Email <span className="text-foreground">{CONTACT_EMAIL}</span> and we will get back to you.
        Include your workspace name and, for delivery problems, the post title and the time you
        expected it to send.
      </p>

      <Section heading="My bot token is rejected">
        <p>
          Copy it again from the Discord Developer Portal (Bot → Reset Token), and make sure the bot
          has been invited to the server with permission to send messages and embed links.
        </p>
      </Section>

      <Section heading="A scheduled post did not send">
        <p>
          Open the post in the Posts list. Failed posts show the reason Discord gave and a Retry
          button. The most common causes are the bot losing access to the channel or the channel
          being deleted.
        </p>
      </Section>

      <Section heading="My picture arrived in a frame instead of as a full image">
        <p>
          In the post creator&rsquo;s Media section choose &ldquo;Upload to Discord&rdquo;. Pictures
          over 10 MB, or added as an outside link rather than uploaded to your library, fall back to
          the framed embed image and the post notes why.
        </p>
      </Section>

      <Section heading="The member export says the intent is off">
        <p>
          In the Discord Developer Portal open your application, go to Bot → Privileged Gateway
          Intents and switch on &ldquo;Server Members Intent&rdquo;, then run the export again.
        </p>
      </Section>

      <Section heading="Legal">
        <p>
          {COMPANY_NAME} is not affiliated with Discord Inc. See our Terms and Privacy Policy below.
        </p>
      </Section>
    </LegalPage>
  );
}
