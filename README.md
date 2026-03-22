# Meetap MVP (Next.js 14 + Supabase + Python AI Service)

Социальное приложение с лентой, событиями, чатами и админкой.

## Stack
- Next.js 14 (App Router) + TypeScript + TailwindCSS
- Supabase (Postgres + Storage + Auth)
- TanStack Query
- shadcn-style UI components
- Python AI service (FastAPI) + DeepSeek API
- framer-motion
- Deploy: Vercel

## Key routes
- `/feed`
- `/events`
- `/events/[id]`
- `/contacts`
- `/chats/[id]`
- `/profile/me`
- `/admin`

- `/` — landing
- `/register` — Telegram phone verification + name
- `/login` — вход по номеру и паролю
- `/onboarding` — онбординг для новых Google-пользователей
- `/feed` — контент (Daily Duo + gate)
- `/events` — мероприятия
- `/events/[id]` — детальная страница мероприятия
- `/contacts` — поиск людей/групп
- `/profile/[id]` — профиль пользователя
- `/profile/me` — мой профиль и настройки
- `/profile/psych-test` — отдельная страница психологического теста
- `/admin` — панель администратора

## Environment
Создай `.env.local` по примеру `.env.example`.

Основные:
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `AI_SERVICE_URL` (default `http://127.0.0.1:8000`)
- `FACE_DETECT_MIN_CONFIDENCE` (default `0.35`)
- `DAILY_DUO_GROUP_BONUS_XP` (default `100`)
- `COMPATIBILITY_SEED_COUNT` (default `10`)

Админка и безопасность:
- `OPENAI_API_KEY` (optional; для admin AI insight/рисков)
- `TELEGRAM_MODERATION_CHAT_ID`
- `TELEGRAM_MODERATION_ADMIN_IDS`
- `TELEGRAM_MODERATION_MOCK` (true в local, чтобы не слать в бота)
- `QA_BOTS_CONTROL_TOKEN`, `QA_BOTS_PASSWORD`, `DEMO_AUTH_ENABLED` (optional)

Импорт событий:
- `KUDAGO_BASE_URL` (default `https://kudago.com/public-api/v1.4`)
- `TIMEPAD_BASE_URL` (default `https://api.timepad.ru/v1`)
- `TIMEPAD_TOKEN` (optional)
- `EXTERNAL_IMPORT_TIMEOUT_MS` (default `6500`)
- `CRON_SECRET` (optional)
- `APP_ENV=local|vercel`

## Supabase setup

1. Создай проект в [Supabase](https://supabase.com).
2. Выполни SQL-миграции по порядку:
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_comments.sql`
   - `supabase/migrations/003_personality_profile.sql`
   - `supabase/migrations/004_password_auth.sql`
   - `supabase/migrations/005_user_sessions.sql`
   - `supabase/migrations/006_admin_analytics.sql`
   - `supabase/migrations/007_google_auth.sql`
   - `supabase/seed.sql`
3. В настройках Supabase → Authentication → Providers включи **Google** и добавь OAuth Client ID и Secret.
4. В Supabase → Authentication → URL Configuration добавь Redirect URL:
   ```
   https://<your-domain>/api/auth/google/callback
   ```

### Telegram (опционально)

5. Создай бота через [@BotFather](https://t.me/BotFather), получи username и token.
6. Настрой Telegram webhook.

## Migrations
Выполни все миграции из `supabase/migrations` по порядку.
Ключевые:
- `001_init.sql` → `007_user_compatibility.sql`
- `021_events_experience_revamp.sql` → `025_event_media.sql`
- `008_growth_privacy_admin.sql` → `020_badges_long_term_progress.sql` (админка/метрики/qa)

## Local mode

### Вариант A: Supabase CLI
1. `supabase start`
2. `supabase db reset` (или `supabase migration up`)
3. `npm install`
4. `npm run dev`

## AI service (Python)

AI service env (`ai_service/.env`):

```env
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
FACE_DETECT_MIN_CONFIDENCE=0.35
```

Run Python AI service (separate terminal):

```bash
cd ai_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

## Импорт событий локально
- Основной запуск: `npm run import-events`
- Принудительно seed: `npm run import-events -- --force-seed=true`
- С выбором города: `npm run import-events -- --city=Moscow --days=45`
- С категориями: `npm run import-events -- --categories=sports,concerts,arts,quests,standup,exhibitions`

## Vercel cron
Используй cron на `/api/cron/import-events` (например каждые 6 часов):
- если Vercel cron header есть — endpoint примет запрос;
- иначе можно защитить Bearer-токеном через `CRON_SECRET`.

Пример `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/import-events", "schedule": "0 */6 * * *" }
  ]
}
```

## Core API

### Auth
- `GET  /api/auth/google/start` — редирект на Google OAuth
- `GET  /api/auth/google/callback` — обработка callback от Google
- `POST /api/auth/google/onboarding` — завершение регистрации Google-пользователя
- `POST /api/auth/start-verification` — начало Telegram-верификации
- `GET  /api/auth/check-verification?token=...` — проверка кода
- `POST /api/auth/complete-registration` — завершение регистрации через Telegram
- `POST /api/auth/login-password` — вход по паролю
- `POST /api/auth/set-password` — установка пароля
- `POST /api/auth/logout` — выход
- `GET  /api/auth/sessions` — список активных сессий

### Feed
- `GET  /api/feed/posts`
- `POST /api/feed/posts/create-daily-duo`
- `POST /api/feed/posts/:id/react`
- `GET  /api/feed/posts/:id/comments`

### Events
- `GET  /api/events`
- `GET  /api/events/:id`
- `POST /api/events/:id/join`
- `POST /api/events/:id/find-3`

### Contacts
- `GET  /api/contacts`
- `POST /api/contacts/connect`

### Profile
- `GET/PATCH /api/profile/me`
- `POST /api/profile/avatar`
- `POST /api/profile/psych-test`
- `GET  /api/profile/:id`

### AI
- `POST /api/ai/face-validate`
- `POST /api/ai/icebreaker`

### Admin
- `GET  /api/admin/overview`
- `GET  /api/admin/users`
- `POST /api/admin/users/block`
- `GET  /api/admin/search`
- `POST /api/admin/assistant`

### Analytics
- `POST /api/analytics/track`

### Telegram
- `POST /api/telegram/webhook`

## Notes
- Daily Duo uses one photo capture/upload flow.
- Если face validation обнаруживает 2+ людей на Daily Duo фото, добавляется XP через `DAILY_DUO_GROUP_BONUS_XP`.
- Contacts page использует AI compatibility score из `user_compatibility`; при отсутствии таблицы — fallback в `users.personality_profile.compatibility_cache_v1`.
- Кнопка «Хочу познакомиться» открывает чат; варианты первого сообщения предрассчитаны в compatibility payload и могут быть перегенерированы.
- Лента скрывает `shadow_banned` пользователей.
- Face validation выполняется через Python AI service; Next.js обращается по `AI_SERVICE_URL`.

- Daily Duo has mobile camera flow: front shot → back shot → editor → publish.
- Feed lock is active if `users.last_post_at` older than 7 days.
- Comments persist in DB and open as chat-style modal.
- Face validation uses multi-pass consensus with model fallback and adjustable confidence threshold.
- Admin panel доступен только пользователям с `role = 'admin'` в таблице `users`.
- Google OAuth flow создаёт пользователя в Supabase Auth + в кастомной таблице `users`.

## Checklist after deploy
1. `POST /api/admin/import-events` вернул `ok=true`.
2. В `event_import_jobs` есть `status=ok` и заполненный `stats_json`.
3. В `events` не менее 15 событий на каждую категорию:
   - `sports`
   - `concerts`
   - `arts`
   - `quests`
   - `standup`
   - `exhibitions`
4. `/events` показывает карточки, не `0`.
5. Кнопка «Добавить событие» открывает форму с первого клика.
6. Submission уходит в `event_submissions` со статусом `pending`.
