CREATE OR REPLACE FUNCTION public.create_workspace(_name text, _kind text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_org_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  INSERT INTO public.organizations (name, kind, plan, created_by)
  VALUES (trim(_name), coalesce(nullif(trim(_kind), ''), 'Workspace'), 'Free', caller_id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (new_org_id, caller_id, 'super_admin');

  RETURN new_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_workspace(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(text, text) TO authenticated;
NOTIFY pgrst, 'reload schema';