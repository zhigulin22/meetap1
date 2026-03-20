-- Fix users.id to have default uuid generation
alter table public.users
  alter column id set default gen_random_uuid();

-- Add birth_year and school_grade fields for onboarding
alter table public.users
  add column if not exists birth_year   int check (birth_year >= 1950 and birth_year <= 2015),
  add column if not exists school_grade int check (school_grade in (8, 9, 10, 11));
