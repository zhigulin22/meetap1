-- Meetap: manual safe migration for privacy/admin growth block
-- Run this whole file in Supabase SQL Editor

-- 0) Ensure old reserved column name is fixed if it was created before
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'alerts'
      AND column_name = 'window'
  ) THEN
    EXECUTE 'ALTER TABLE public.alerts RENAME COLUMN "window" TO alert_window';
  END IF;
END $$;

-- 1) Core tables
CREATE TABLE IF NOT EXISTS public.user_privacy_settings (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  show_phone boolean NOT NULL DEFAULT false,
  show_facts boolean NOT NULL DEFAULT true,
  show_badges boolean NOT NULL DEFAULT true,
  show_last_active boolean NOT NULL DEFAULT true,
  show_event_history boolean NOT NULL DEFAULT true,
  show_city boolean NOT NULL DEFAULT true,
  show_work boolean NOT NULL DEFAULT true,
  show_university boolean NOT NULL DEFAULT true,
  who_can_message text NOT NULL DEFAULT 'shared_events',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  variants jsonb NOT NULL DEFAULT '{}'::jsonb,
  rollout_percent int NOT NULL DEFAULT 0,
  start_at timestamptz,
  end_at timestamptz,
  primary_metric text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  metric text NOT NULL,
  threshold numeric NOT NULL,
  alert_window text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  is_seasonal boolean NOT NULL DEFAULT false,
  season_key text,
  icon text,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  is_featured boolean NOT NULL DEFAULT false,
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS public.event_endorsements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, from_user_id, to_user_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_event_endorsements_to ON public.event_endorsements(to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_metric ON public.alerts(metric, status);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON public.experiments(status);

-- 3) RLS
ALTER TABLE public.user_privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_endorsements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_privacy_settings' AND policyname='public read privacy settings'
  ) THEN
    CREATE POLICY "public read privacy settings" ON public.user_privacy_settings FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='experiments' AND policyname='public read experiments'
  ) THEN
    CREATE POLICY "public read experiments" ON public.experiments FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='alerts' AND policyname='public read alerts'
  ) THEN
    CREATE POLICY "public read alerts" ON public.alerts FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='badges' AND policyname='public read badges'
  ) THEN
    CREATE POLICY "public read badges" ON public.badges FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_badges' AND policyname='public read user_badges'
  ) THEN
    CREATE POLICY "public read user_badges" ON public.user_badges FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='event_endorsements' AND policyname='public read event_endorsements'
  ) THEN
    CREATE POLICY "public read event_endorsements" ON public.event_endorsements FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notifications' AND policyname='public read notifications'
  ) THEN
    CREATE POLICY "public read notifications" ON public.notifications FOR SELECT USING (true);
  END IF;
END $$;

-- 4) Seed badges
INSERT INTO public.badges (key, title, description, category, icon, rules)
VALUES
  ('starter_profile', 'Профиль собран', 'Заполнены фото, интересы и 3 факта', 'Активность', 'sparkles', '{"profile_completed": true}'::jsonb),
  ('events_regular', 'Свой в событиях', 'Посетил 5 событий', 'Ивенты', 'calendar', '{"event_joins": 5}'::jsonb),
  ('trusted_after_events', 'Теплый контакт', 'Тебя отметили после событий 10 раз', 'Общение', 'thumbs-up', '{"endorsements": 10}'::jsonb),
  ('season_winter_community', 'Зимний комьюнити', 'Сезонный бейдж сообщества', 'Сезонные', 'snowflake', '{"season":"winter"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5) Normalize existing privacy value (if old 'verified' was saved)
UPDATE public.user_privacy_settings
SET who_can_message = 'shared_events', updated_at = now()
WHERE who_can_message = 'verified';
