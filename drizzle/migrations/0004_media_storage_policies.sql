-- Remember where an uploaded asset lives so it can be deleted with the row
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS storage_path text;

-- Workspace members manage their own workspace folder inside the media bucket
CREATE POLICY "media upload by org member"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "media read by org member"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'media'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "media update by org member"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "media delete by org member"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );
