CREATE OR REPLACE FUNCTION public.enforce_post_insert_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role public.app_role;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF caller_id IS NULL OR NEW.created_by IS DISTINCT FROM caller_id THEN
    RAISE EXCEPTION 'Post creator must match the signed-in user';
  END IF;
  SELECT role INTO caller_role FROM public.org_members
  WHERE org_id = NEW.org_id AND user_id = caller_id;
  IF caller_role IS NULL THEN RAISE EXCEPTION 'You are not a member of this workspace'; END IF;
  IF caller_role NOT IN ('super_admin', 'admin') THEN
    IF NEW.status IS DISTINCT FROM 'draft'::public.post_status THEN
      RAISE EXCEPTION 'New posts must begin as drafts';
    END IF;
    NEW.scheduled_at := NULL;
    NEW.published_at := NULL;
    NEW.claimed_at := NULL;
    NEW.discord_message_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_post_insert_permissions_trigger ON public.posts;
CREATE TRIGGER enforce_post_insert_permissions_trigger
BEFORE INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_post_insert_permissions();

DROP POLICY IF EXISTS "posts delete" ON public.posts;
CREATE POLICY "posts delete" ON public.posts FOR DELETE TO authenticated
USING (
  public.has_org_role(org_id, auth.uid(), ARRAY['super_admin','admin']::public.app_role[])
  OR (created_by = auth.uid() AND status IN ('draft','changes_requested','rejected'))
);

DROP POLICY IF EXISTS "audit insert" ON public.post_audit;
CREATE POLICY "audit insert" ON public.post_audit FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(org_id, auth.uid())
  AND actor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_id AND p.org_id = org_id
  )
);

NOTIFY pgrst, 'reload schema';