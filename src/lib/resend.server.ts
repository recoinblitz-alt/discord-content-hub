const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "MUNO <abhishek@solvextra.com>";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ResendResult = { sent: boolean; message?: string };

async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<ResendResult> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return { sent: false, message: "Email sending is not configured." };
  const from = process.env["RESEND_FROM_EMAIL"] ?? DEFAULT_FROM;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`Resend send failed [${response.status}]: ${body}`);
      return { sent: false, message: `Email provider refused the message (${response.status}).` };
    }
    return { sent: true };
  } catch (error) {
    console.error(error);
    return { sent: false, message: "Could not reach the email provider." };
  }
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  approver: "Approver",
  user: "Normal User",
};

export async function sendInviteEmail(input: {
  to: string;
  organizationName: string;
  role: string;
  inviteUrl: string;
  invitedBy?: string | null;
}): Promise<ResendResult> {
  const org = escapeHtml(input.organizationName);
  const roleLabel = escapeHtml(ROLE_LABELS[input.role] ?? input.role);
  const url = input.inviteUrl;
  const inviter = input.invitedBy ? escapeHtml(input.invitedBy) : null;

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#141a33;">
  <div style="max-width:520px;margin:24px auto;background:#ffffff;border:1px solid #e6e8f0;border-radius:14px;padding:28px 32px;">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#5865F2;font-weight:600;">MUNO</p>
    <h1 style="margin:0 0 12px;font-size:20px;line-height:1.35;">You're invited to join ${org}</h1>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#41496b;">
      ${inviter ? `${inviter} has invited you` : "You have been invited"} to join the <strong>${org}</strong> workspace on MUNO as <strong>${roleLabel}</strong>.
      Accept the invitation to set your password and get started.
    </p>
    <p style="margin:0 0 22px;">
      <a href="${url}" style="display:inline-block;background:#5865F2;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">Accept invitation</a>
    </p>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7391;">
      If the button doesn't work, copy this link into your browser:<br />
      <a href="${url}" style="color:#5865F2;word-break:break-all;">${url}</a>
    </p>
  </div>
  <p style="max-width:520px;margin:0 auto;text-align:center;font-size:11px;color:#8b92ad;">Sent by MUNO — Discord content operations.</p>
</body></html>`;

  const text = `You're invited to join ${input.organizationName} on MUNO as ${ROLE_LABELS[input.role] ?? input.role}.

Accept your invitation: ${url}`;

  return sendEmail({
    to: input.to,
    subject: `You're invited to join ${input.organizationName} on MUNO`,
    html,
    text,
  });
}
