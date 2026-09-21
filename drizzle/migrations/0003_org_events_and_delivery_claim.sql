-- Claim marker so a due post can only be picked up by one scheduled run
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Workspace-wide events visible to every member, managed by admins
CREATE TABLE public.org_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  timezone text NOT NULL DEFAULT 'UTC',
  color text NOT NULL DEFAULT '#5865F2',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX org_events_org_start_idx ON public.org_events (org_id, starts_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_events TO authenticated;
GRANT ALL ON public.org_events TO service_role;

ALTER TABLE public.org_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events read" ON public.org_events
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "events admin insert" ON public.org_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

CREATE POLICY "events admin update" ON public.org_events
  FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

CREATE POLICY "events admin delete" ON public.org_events
  FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));
