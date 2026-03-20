-- Add PIN auth and extended onboarding fields
alter table public.users
  add column if not exists pin_hash         text,
  add column if not exists birth_year       int check (birth_year >= 1980 and birth_year <= 2015),
  add column if not exists school_grade     int check (school_grade >= 8 and school_grade <= 11),
  add column if not exists pin_attempts     int not null default 0,
  add column if not exists pin_locked_until timestamptz;

-- password_hash is already nullable; new Telegram users will use PIN instead
