# Meetap MVP (Next.js 14 + Supabase + OpenAI)

MVP соцсети для офлайн-знакомств.

## Stack

- Next.js 14 (App Router) + TypeScript + TailwindCSS
- shadcn-style UI components
- Next.js API Routes
- Supabase (Postgres + Storage + Auth)
- OpenAI (AI moderation + recommendations)
- framer-motion
- Deploy: Vercel

## Routes

- `/` — landing
- `/register` — Telegram phone verification + name
- `/feed` — контент (Daily Duo + gate)
- `/events` — мероприятия
- `/events/[id]` — детальная страница мероприятия
- `/contacts` — поиск людей/групп
- `/profile/[id]` — профиль пользователя
- `/profile/me` — мой профиль и настройки

Protected routing реализован в `middleware.ts`.

## Environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=

SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# Face detector tuning
FACE_DETECT_MODEL=gpt-4.1-mini
FACE_DETECT_MIN_CONFIDENCE=0.58
```

## Supabase setup

1. Create a Supabase project.
2. Run SQL from:
- `supabase/migrations/001_init.sql`
- `supabase/migrations/002_comments.sql`
- `supabase/migrations/003_personality_profile.sql`
- `supabase/seed.sql`
3. Create Telegram bot via BotFather and set username/token.
4. Configure Telegram webhook:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-domain>/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

## Local run

```bash
npm install
npm run dev
```

## Core API

- `POST /api/auth/start-verification`
- `GET /api/auth/check-verification?token=...`
- `POST /api/auth/complete-registration`
- `POST /api/telegram/webhook`
- `GET /api/feed/posts`
- `POST /api/feed/posts/create-daily-duo`
- `POST /api/feed/posts/:id/react`
- `GET /api/events`
- `GET /api/events/:id`
- `POST /api/events/:id/join`
- `POST /api/events/:id/find-3`
- `GET /api/contacts`
- `GET/PATCH /api/profile/me`
- `POST /api/profile/avatar`
- `POST /api/profile/psych-test`
- `GET /api/profile/:id`
- `POST /api/ai/face-validate`
- `POST /api/ai/icebreaker`

## Notes

- Daily Duo requires 2 photos; AI face-check enforces people on both images.
- Feed lock is active if `users.last_post_at` older than 7 days.
- Face validation uses 3-pass consensus with configurable model and threshold.
