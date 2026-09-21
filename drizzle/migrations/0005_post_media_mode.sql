ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_mode text NOT NULL DEFAULT 'embed';

ALTER TABLE public.posts
  ADD CONSTRAINT posts_media_mode_check CHECK (media_mode IN ('upload', 'embed'));