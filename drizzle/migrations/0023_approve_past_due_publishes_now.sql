CREATE OR REPLACE FUNCTION public.enforce_post_timing_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF current_setting('muno.review_override', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN
    RAISE EXCEPTION 'Published posts are permanently locked';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'scheduled' AND OLD.scheduled_at IS NOT NULL AND OLD.scheduled_at <= now() THEN
    RAISE EXCEPTION 'This post has reached its posting time and is locked';
  END IF;
  IF NEW.scheduled_at IS NOT NULL AND NEW.scheduled_at <= now() THEN
    IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'rejected'
      AND NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'The posting date and time must be in the future';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_post_role_permissions()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  caller_role public.app_role;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  SELECT role INTO caller_role FROM public.org_members WHERE org_id = OLD.org_id AND user_id = caller_id;
  IF caller_role IS NULL THEN RAISE EXCEPTION 'You are not a member of this workspace'; END IF;
  IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Post ownership cannot be changed';
  END IF;
  IF caller_role IN ('super_admin', 'admin') THEN RETURN NEW; END IF;
  -- review_post() itself has validated the reviewer; it may move a past-due time to "now".
  IF current_setting('muno.review_override', true) = 'on' THEN RETURN NEW; END IF;

  IF caller_role = 'approver' AND OLD.created_by IS DISTINCT FROM caller_id THEN
    IF NOT (OLD.status = 'pending' AND NEW.status IN ('approved', 'scheduled', 'rejected', 'changes_requested')) THEN
      RAISE EXCEPTION 'Approvers can only review pending posts';
    END IF;
    IF NEW.status = 'scheduled' AND OLD.scheduled_at IS NULL THEN
      RAISE EXCEPTION 'A scheduled post needs a date and time';
    END IF;
    IF NEW.title IS DISTINCT FROM OLD.title OR NEW.content IS DISTINCT FROM OLD.content
      OR NEW.embed IS DISTINCT FROM OLD.embed OR NEW.buttons IS DISTINCT FROM OLD.buttons
      OR NEW.attachments IS DISTINCT FROM OLD.attachments OR NEW.server_id IS DISTINCT FROM OLD.server_id
      OR NEW.channel_id IS DISTINCT FROM OLD.channel_id OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
      OR NEW.timezone IS DISTINCT FROM OLD.timezone OR NEW.use_embed IS DISTINCT FROM OLD.use_embed
      OR NEW.media_mode IS DISTINCT FROM OLD.media_mode THEN
      RAISE EXCEPTION 'Review decisions cannot edit post content';
    END IF;
    IF NEW.published_at IS DISTINCT FROM OLD.published_at
      OR NEW.discord_message_id IS DISTINCT FROM OLD.discord_message_id
      OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at THEN
      RAISE EXCEPTION 'Only an admin can publish this post';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.created_by IS DISTINCT FROM caller_id THEN
    RAISE EXCEPTION 'You can only edit your own posts';
  END IF;
  IF OLD.status = 'pending' AND NEW.status = 'pending'::public.post_status THEN
    IF NEW.published_at IS DISTINCT FROM OLD.published_at
      OR NEW.discord_message_id IS DISTINCT FROM OLD.discord_message_id
      OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at THEN
      RAISE EXCEPTION 'Only an admin can publish this post';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status NOT IN ('draft','changes_requested','rejected') THEN
    RAISE EXCEPTION 'Submitted posts cannot be edited by their creator';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IS DISTINCT FROM 'pending'::public.post_status THEN
    RAISE EXCEPTION 'Your role can only submit your own drafts for approval';
  END IF;
  IF NEW.published_at IS DISTINCT FROM OLD.published_at
    OR NEW.discord_message_id IS DISTINCT FROM OLD.discord_message_id
    OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at THEN
    RAISE EXCEPTION 'Only an admin can publish this post';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_post(_post uuid, _decision text, _note text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  target public.posts%ROWTYPE;
  caller_role public.app_role;
  next_status public.post_status;
  clean_note text := nullif(trim(coalesce(_note, '')), '');
  late boolean;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO target FROM public.posts WHERE id = _post FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'This post no longer exists.');
  END IF;
  SELECT role INTO caller_role FROM public.org_members WHERE org_id = target.org_id AND user_id = caller_id;
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

  late := target.scheduled_at IS NOT NULL AND target.scheduled_at <= now();
  next_status := CASE
    WHEN _decision = 'approved' THEN 'scheduled'::public.post_status
    WHEN _decision = 'rejected' THEN 'rejected'::public.post_status
    ELSE 'changes_requested'::public.post_status
  END;

  PERFORM set_config('muno.review_override', 'on', true);
  UPDATE public.posts
  SET status = next_status,
      scheduled_at = CASE WHEN late AND _decision = 'approved' THEN now() ELSE scheduled_at END,
      updated_at = now()
  WHERE id = target.id;
  PERFORM set_config('muno.review_override', 'off', true);

  INSERT INTO public.post_audit (post_id, org_id, actor_id, action, note)
  VALUES (target.id, target.org_id, caller_id, _decision,
    coalesce(clean_note,
      CASE WHEN _decision = 'approved' AND late THEN 'Approved after the requested time — publishing now'
           WHEN _decision = 'approved' THEN 'Approved and scheduled for ' || to_char(target.scheduled_at AT TIME ZONE target.timezone, 'YYYY-MM-DD HH24:MI') || ' ' || target.timezone
           ELSE NULL END));

  RETURN jsonb_build_object('ok', true, 'status', next_status,
    'message', CASE
      WHEN next_status = 'scheduled' AND late THEN 'Approved — the time had passed, so it posts right away'
      WHEN next_status = 'scheduled' THEN 'Approved and scheduled'
      WHEN next_status = 'rejected' THEN 'Rejected with feedback'
      ELSE 'Changes requested' END);
END;
$function$;