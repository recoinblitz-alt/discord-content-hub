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

  IF caller_role IN ('super_admin', 'admin') THEN
    RETURN NEW;
  END IF;

  IF caller_role = 'approver' THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
      OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected', 'changes_requested')
    ) THEN
      RAISE EXCEPTION 'Approvers can only review pending posts';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.created_by IS DISTINCT FROM caller_id THEN
    RAISE EXCEPTION 'Normal users can only edit their own posts';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    OLD.status IN ('draft', 'changes_requested', 'rejected') AND NEW.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Normal users can only submit their own drafts for approval';
  END IF;

  RETURN NEW;
END;
$$;