DROP POLICY IF EXISTS "audit insert" ON public.post_audit;
CREATE POLICY "audit insert" ON public.post_audit FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(post_audit.org_id, auth.uid())
  AND post_audit.actor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.posts AS source_post
    WHERE source_post.id = post_audit.post_id
      AND source_post.org_id = post_audit.org_id
  )
);

NOTIFY pgrst, 'reload schema';