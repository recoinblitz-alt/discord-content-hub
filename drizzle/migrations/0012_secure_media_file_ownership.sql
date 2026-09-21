DROP POLICY IF EXISTS "media update by org member" ON storage.objects;
CREATE POLICY "media update by owner or admin"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'media'
  AND (
    owner_id = auth.uid()::text
    OR public.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), ARRAY['super_admin','admin']::public.app_role[])
  )
)
WITH CHECK (
  bucket_id = 'media'
  AND (
    owner_id = auth.uid()::text
    OR public.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), ARRAY['super_admin','admin']::public.app_role[])
  )
);

DROP POLICY IF EXISTS "media delete by org member" ON storage.objects;
CREATE POLICY "media delete by owner or admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'media'
  AND (
    owner_id = auth.uid()::text
    OR public.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), ARRAY['super_admin','admin']::public.app_role[])
  )
);