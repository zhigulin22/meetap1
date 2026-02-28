# Meetap MVP (Next.js 14 + Supabase + Python AI Service)

MVP соцсети для офлайн-знакомств.

## Stack

- Next.js 14 (App Router) + TypeScript + TailwindCSS
- shadcn-style UI components
- Next.js API Routes
- Supabase (Postgres + Storage + Auth)
- Python AI service (FastAPI) + DeepSeek API
- framer-motion
- Deploy: Vercel

## Routes

- `/` — landing
- `/register` — Telegram phone verification + name
- `/login` — вход по номеру и паролю
- `/feed` — контент (Daily Duo + gate)
- `/events` — мероприятия
- `/events/[id]` — детальная страница мероприятия
- `/contacts` — поиск людей/групп
- `/profile/[id]` — профиль пользователя
- `/profile/me` — мой профиль и настройки
- `/profile/psych-test` — отдельная страница психологического теста

Protected routing реализован в `middleware.ts`.

## Environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=

SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
AI_SERVICE_URL=http://127.0.0.1:8000

# Face detector tuning
FACE_DETECT_MIN_CONFIDENCE=0.35
```

AI service env (`ai_service/.env`):

```env
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
FACE_DETECT_MIN_CONFIDENCE=0.35
```

## Supabase setup

1. Create a Supabase project.
2. Run SQL from:
- `supabase/migrations/001_init.sql`
- `supabase/migrations/002_comments.sql`
- `supabase/migrations/003_personality_profile.sql`
- `supabase/migrations/004_password_auth.sql`
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

Run Python AI service (separate terminal):

```bash
cd ai_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# create ai_service/.env and add DEEPSEEK_API_KEY
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

## Core API

- `POST /api/auth/start-verification`
- `GET /api/auth/check-verification?token=...`
- `POST /api/auth/complete-registration`
- `POST /api/auth/login-password`
- `POST /api/auth/set-password`
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

- Daily Duo has mobile camera flow: front shot -> back shot -> editor -> publish.
- Feed lock is active if `users.last_post_at` older than 7 days.
- Comments persist in DB and open as chat-style modal.
- Face validation is handled by a separate Python AI service; Next.js accesses it via `AI_SERVICE_URL`.
