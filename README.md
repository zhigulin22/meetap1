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

Protected routing реализован в `middleware.ts`.

## Environment variables

Скопируй `.env.example` в `.env.local` и заполни значениями:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App URL (used in OAuth redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# OpenAI
OPENAI_API_KEY=sk-...

# Telegram (optional if using Google auth only)
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot_username
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# Face detection tuning
FACE_DETECT_MODEL=gpt-4o-mini
FACE_DETECT_MIN_CONFIDENCE=0.35
```

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
6. Настрой Telegram webhook:

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

- Daily Duo has mobile camera flow: front shot → back shot → editor → publish.
- Feed lock is active if `users.last_post_at` older than 7 days.
- Comments persist in DB and open as chat-style modal.
- Face validation uses multi-pass consensus with model fallback and adjustable confidence threshold.
- Admin panel доступен только пользователям с `role = 'admin'` в таблице `users`.
- Google OAuth flow создаёт пользователя в Supabase Auth + в кастомной таблице `users`.
