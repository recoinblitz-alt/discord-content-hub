ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.accept_org_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_row public.invites%ROWTYPE;
  caller_id uuid := auth.uid();
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  org_name text;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO invite_row
  FROM public.invites
  WHERE token = _token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This invite link is not valid.');
  END IF;

  IF caller_email = '' OR caller_email <> lower(invite_row.email) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Sign in with the email address this invitation was sent to.');
  END IF;

  IF invite_row.accepted_at IS NOT NULL AND invite_row.accepted_by IS DISTINCT FROM caller_id THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This invitation was already used by another account.');
  END IF;

  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (invite_row.org_id, caller_id, invite_row.role)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  UPDATE public.invites
  SET accepted_at = coalesce(accepted_at, now()),
      accepted_by = coalesce(accepted_by, caller_id)
  WHERE id = invite_row.id;

  SELECT name INTO org_name FROM public.organizations WHERE id = invite_row.org_id;

  RETURN jsonb_build_object(
    'ok', true,
    'orgId', invite_row.org_id,
    'orgName', coalesce(org_name, 'the workspace'),
    'alreadyAccepted', invite_row.accepted_at IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_org_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_org_invite(text) TO authenticated;

DROP POLICY IF EXISTS "members admin update" ON public.org_members;
DROP POLICY IF EXISTS "members admin delete" ON public.org_members;

DROP POLICY IF EXISTS "templates write" ON public.templates;
DROP POLICY IF EXISTS "templates update" ON public.templates;
DROP POLICY IF EXISTS "templates delete" ON public.templates;

CREATE POLICY "templates admin insert"
ON public.templates FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.has_org_role(org_id, auth.uid(), ARRAY['super_admin','admin']::public.app_role[])
);

CREATE POLICY "templates admin update"
ON public.templates FOR UPDATE TO authenticated
USING (public.has_org_role(org_id, auth.uid(), ARRAY['super_admin','admin']::public.app_role[]))
WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['super_admin','admin']::public.app_role[]));

CREATE POLICY "templates admin delete"
ON public.templates FOR DELETE TO authenticated
USING (public.has_org_role(org_id, auth.uid(), ARRAY['super_admin','admin']::public.app_role[]));

CREATE OR REPLACE FUNCTION public.enforce_post_role_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role public.app_role;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role
  FROM public.org_members
  WHERE org_id = OLD.org_id AND user_id = caller_id;

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'You are not a member of this workspace';
  END IF;

  IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Post ownership cannot be changed';
  END IF;

  IF caller_role IN ('super_admin', 'admin', 'approver') THEN
    RETURN NEW;
  END IF;

  IF OLD.created_by IS DISTINCT FROM caller_id THEN
    RAISE EXCEPTION 'Normal users can only edit their own posts';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status IN ('draft', 'changes_requested', 'rejected') AND NEW.status = 'pending')
    OR (OLD.status = NEW.status)
  ) THEN
    RAISE EXCEPTION 'Normal users can only submit their own drafts for approval';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_post_role_permissions_trigger ON public.posts;
CREATE TRIGGER enforce_post_role_permissions_trigger
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_post_role_permissions();