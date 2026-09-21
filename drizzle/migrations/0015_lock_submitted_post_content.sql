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
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  SELECT role INTO caller_role FROM public.org_members
  WHERE org_id = OLD.org_id AND user_id = caller_id;
  IF caller_role IS NULL THEN RAISE EXCEPTION 'You are not a member of this workspace'; END IF;
  IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Post ownership cannot be changed';
  END IF;
  IF caller_role IN ('super_admin', 'admin') THEN RETURN NEW; END IF;

  IF caller_role = 'approver' AND OLD.created_by IS DISTINCT FROM caller_id THEN
    IF NOT (OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected', 'changes_requested')) THEN
      RAISE EXCEPTION 'Approvers can only review pending posts';
    END IF;
    IF NEW.title IS DISTINCT FROM OLD.title OR NEW.content IS DISTINCT FROM OLD.content
      OR NEW.embed IS DISTINCT FROM OLD.embed OR NEW.buttons IS DISTINCT FROM OLD.buttons
      OR NEW.attachments IS DISTINCT FROM OLD.attachments OR NEW.server_id IS DISTINCT FROM OLD.server_id
      OR NEW.channel_id IS DISTINCT FROM OLD.channel_id OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
      OR NEW.timezone IS DISTINCT FROM OLD.timezone OR NEW.use_embed IS DISTINCT FROM OLD.use_embed
      OR NEW.media_mode IS DISTINCT FROM OLD.media_mode THEN
      RAISE EXCEPTION 'Review decisions cannot edit post content';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.created_by IS DISTINCT FROM caller_id THEN
    RAISE EXCEPTION 'You can only edit your own posts';
  END IF;
  IF OLD.status NOT IN ('draft','changes_requested','rejected') THEN
    RAISE EXCEPTION 'Submitted posts cannot be edited by their creator';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IS DISTINCT FROM 'pending'::public.post_status THEN
    RAISE EXCEPTION 'Your role can only submit your own drafts for approval';
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';