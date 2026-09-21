CREATE UNIQUE INDEX IF NOT EXISTS invites_one_pending_per_email_org_idx
ON public.invites (org_id, lower(email))
WHERE accepted_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_org_invite_preview(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_row public.invites%ROWTYPE;
  org_name text;
  email_parts text[];
  email_local text;
  email_domain text;
  masked_email text;
BEGIN
  SELECT * INTO invite_row
  FROM public.invites
  WHERE token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'This invitation link is not valid. Ask your workspace administrator for a new link.'
    );
  END IF;

  SELECT name INTO org_name
  FROM public.organizations
  WHERE id = invite_row.org_id;

  email_parts := string_to_array(invite_row.email, '@');
  email_local := coalesce(email_parts[1], '');
  email_domain := coalesce(email_parts[2], '');
  masked_email := CASE
    WHEN length(email_local) <= 2 THEN left(email_local, 1) || '***@' || email_domain
    ELSE left(email_local, 2) || repeat('*', greatest(length(email_local) - 2, 3)) || '@' || email_domain
  END;

  RETURN jsonb_build_object(
    'valid', true,
    'organizationName', coalesce(org_name, 'the workspace'),
    'emailHint', masked_email,
    'role', invite_row.role,
    'accepted', invite_row.accepted_at IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_invite_preview(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_org_invite_preview(text) IS 'Returns safe invitation metadata for validating a link before authentication.';
COMMENT ON FUNCTION public.accept_org_invite(text) IS 'Atomically accepts a workspace invitation for the authenticated matching email.';
GRANT EXECUTE ON FUNCTION public.accept_org_invite(text) TO authenticated;

NOTIFY pgrst, 'reload schema';