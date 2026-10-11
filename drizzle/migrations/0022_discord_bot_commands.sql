CREATE TABLE IF NOT EXISTS public.discord_bot_settings (
  server_id uuid PRIMARY KEY REFERENCES public.servers(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_key text NOT NULL DEFAULT '',
  command_channel_id text,
  approval_channel_id text,
  submit_role_ids text[] NOT NULL DEFAULT '{}',
  approve_role_ids text[] NOT NULL DEFAULT '{}',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  commands_registered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discord_bot_settings TO authenticated;
GRANT ALL ON public.discord_bot_settings TO service_role;
ALTER TABLE public.discord_bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot settings admin all" ON public.discord_bot_settings FOR ALL TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS discord_review_message_id text;
NOTIFY pgrst, 'reload schema';