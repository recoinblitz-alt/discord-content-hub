CREATE OR REPLACE FUNCTION public.review_post(
  _post uuid,
  _decision text,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  target public.posts%ROWTYPE;
  caller_role public.app_role;
  next_status public.post_status;
  clean_note text := nullif(trim(coalesce(_note, '')), '');
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO target
  FROM public.posts
  WHERE id = _post
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'This post no longer exists.');
  END IF;

  SELECT role INTO caller_role
  FROM public.org_members
  WHERE org_id = target.org_id AND user_id = caller_id;

  IF caller_role IS NULL OR caller_role NOT IN ('super_admin', 'admin', 'approver') THEN
    RAISE EXCEPTION 'You do not have permission to review this post';
  END IF;

  IF caller_role = 'approver' AND target.created_by = caller_id THEN
    RAISE EXCEPTION 'Another reviewer must decide on your submission';
  END IF;

  IF target.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_reviewed', 'message', 'This post was already reviewed.');
  END IF;

  IF _decision NOT IN ('approved', 'rejected', 'changes_requested') THEN
    RAISE EXCEPTION 'Invalid review decision';
  END IF;

  IF _decision <> 'approved' AND clean_note IS NULL THEN
    RAISE EXCEPTION 'Add a comment so the creator knows what to change';
  END IF;

  IF target.scheduled_at IS NULL AND _decision = 'approved' THEN
    RAISE EXCEPTION 'A posting date and time is required before approval';
  END IF;

  IF target.scheduled_at IS NOT NULL AND target.scheduled_at <= now() AND _decision <> 'rejected' THEN
    RAISE EXCEPTION 'The requested posting time has passed. This post can only be rejected.';
  END IF;

  next_status := CASE
    WHEN _decision = 'approved' THEN 'scheduled'::public.post_status
    WHEN _decision = 'rejected' THEN 'rejected'::public.post_status
    ELSE 'changes_requested'::public.post_status
  END;

  UPDATE public.posts
  SET status = next_status,
      updated_at = now()
  WHERE id = target.id;

  INSERT INTO public.post_audit (post_id, org_id, actor_id, action, note)
  VALUES (
    target.id,
    target.org_id,
    caller_id,
    _decision,
    coalesce(
      clean_note,
      CASE WHEN _decision = 'approved'
        THEN 'Approved and scheduled for ' || to_char(target.scheduled_at AT TIME ZONE target.timezone, 'YYYY-MM-DD HH24:MI') || ' ' || target.timezone
        ELSE NULL
      END
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', next_status,
    'message', CASE
      WHEN next_status = 'scheduled' THEN 'Approved and scheduled'
      WHEN next_status = 'rejected' THEN 'Rejected with feedback'
      ELSE 'Changes requested'
    END
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.review_post(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_post(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_post_timing_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN
    RAISE EXCEPTION 'Published posts are permanently locked';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.status = 'scheduled'
    AND OLD.scheduled_at IS NOT NULL
    AND OLD.scheduled_at <= now() THEN
    RAISE EXCEPTION 'This post has reached its posting time and is locked';
  END IF;

  IF NEW.scheduled_at IS NOT NULL AND NEW.scheduled_at <= now() THEN
    IF TG_OP = 'UPDATE'
      AND OLD.status = 'pending'
      AND NEW.status = 'rejected'
      AND NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'The posting date and time must be in the future';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_post_timing_rules_trigger ON public.posts;
CREATE TRIGGER enforce_post_timing_rules_trigger
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_post_timing_rules();

DO $block$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['posts', 'post_audit', 'org_events', 'channels', 'templates', 'media_assets', 'org_members']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END;
$block$;

NOTIFY pgrst, 'reload schema';