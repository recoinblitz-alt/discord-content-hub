CREATE OR REPLACE FUNCTION public.can_manage_profile(_profile uuid, _caller uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members target
    JOIN public.org_members caller ON caller.org_id = target.org_id
    WHERE target.user_id = _profile
      AND caller.user_id = _caller
      AND caller.role = ANY (ARRAY['super_admin'::public.app_role, 'admin'::public.app_role])
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_profile(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_profile(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_org_directory(_org uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id, p.display_name, p.avatar_url
  FROM public.org_members m
  JOIN public.profiles p ON p.id = m.user_id
  WHERE m.org_id = _org
    AND public.is_org_member(_org, auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_org_directory(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_directory(uuid) TO authenticated, service_role;

ALTER POLICY "members read" ON public.org_members
USING (
  user_id = auth.uid()
  OR public.has_org_role(
    org_id,
    auth.uid(),
    ARRAY['super_admin'::public.app_role, 'admin'::public.app_role]
  )
);

ALTER POLICY "profiles self read" ON public.profiles
USING (
  id = auth.uid()
  OR public.can_manage_profile(id, auth.uid())
);

NOTIFY pgrst, 'reload schema';