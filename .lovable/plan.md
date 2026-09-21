# Repair Render invitations and email delivery

## Confirmed findings
- The token shown in the Render link does not exist in the app’s current backend. The only recent invite there uses a different token and has already been accepted.
- The current backend contains `accept_org_invite(text)` and permits signed-in users to call it. Therefore, the Render error is consistent with Render using a different or incompletely migrated backend configuration.
- Invitation sending currently falls back silently when delivery fails, while the Team page only shows a general result and a copyable link.
- No branded sender domain is configured, so reliable MUNO-branded invitation and verification email delivery is not set up.

## Implementation plan
1. **Make Render use one consistent backend**
   - Validate that Render’s browser and server settings point to the same backend.
   - Make the Render deployment apply all database updates before the application starts, including the invitation acceptance function and permissions.
   - Add an invitation-readiness check so deployment health clearly reports a missing function or mismatched backend instead of letting users discover it during acceptance.

2. **Harden invitation creation**
   - Keep invitation creation restricted to Super Admins and Admins.
   - Return and display the real delivery outcome separately from link creation.
   - Preserve a working copy-link fallback, including the complete invited-account setup URL.
   - Prevent duplicate active invitations for the same workspace and email.

3. **Make acceptance reliable and clear**
   - Validate the token before asking the recipient to sign in or create an account.
   - Keep email matching, one-time acceptance, assigned-role enforcement, and duplicate-membership prevention in the database transaction.
   - Replace the generic retry loop with actionable states: invalid/expired link, wrong signed-in email, already accepted, or deployment not ready.
   - Preserve the token through email verification and take the recipient directly into the invited workspace after setting their name and password.

4. **Set up invitation and verification emails**
   - Configure MUNO-branded authentication emails for invitations, verification, password recovery, and related account actions.
   - Use the verified sender domain and monitor delivery outcomes instead of treating “request accepted” as “email delivered.”
   - Keep the share-link fallback visible whenever delivery is rejected or unavailable.

5. **End-to-end verification**
   - Create a fresh invite from the Render app for a new address.
   - Confirm the stored token matches the emailed/copied URL.
   - Complete name, password, email verification, and invitation acceptance.
   - Confirm the invited role, direct entry into the correct workspace, and no duplicate workspace entry.
   - Reopen the same link and verify it behaves safely without creating another membership.

## Required user action
- Email delivery requires a real sender domain you own. The domain setup will be opened during implementation; sending activates after its DNS verification completes.
