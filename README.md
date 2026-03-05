# Meetap MVP (Next.js 14 + Supabase)

Социальное приложение с лентой, событиями и админкой.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (Postgres/Auth/Storage)
- TanStack Query
- Deploy: Vercel

## Key routes
- `/feed`
- `/events`
- `/events/[id]`
- `/profile/me`
- `/admin`

## Environment
Создай `.env.local` по примеру `.env.example`.

Критично для событий:
- `SUPABASE_SERVICE_ROLE_KEY`
- `KUDAGO_BASE_URL` (default `https://kudago.com/public-api/v1.4`)
- `TIMEPAD_BASE_URL` (default `https://api.timepad.ru/v1`)
- `TIMEPAD_TOKEN` (optional; если есть — увеличивает покрытие)
- `APP_ENV=local|vercel`

## Migrations
Выполни все миграции из `supabase/migrations` по порядку, включая:
- `021_events_experience_revamp.sql`
- `022_events_import_jobs_and_hardening.sql`
- `023_public_event_import_sources.sql`

## Local mode (без задержек)

### Вариант A: Supabase CLI
1. `supabase start`
2. `supabase db reset` (или `supabase migration up`)
3. `npm install`
4. `npm run dev`

### Импорт событий локально
- Основной запуск: `npm run import-events`
- Принудительно seed: `npm run import-events -- --force-seed=true`
- С выбором города: `npm run import-events -- --city=Moscow --days=45`
- С категориями: `npm run import-events -- --categories=sports,concerts,arts,quests,standup,exhibitions`

### Telegram в local
- `TELEGRAM_MODERATION_MOCK=true` (отключает реальную отправку в бота)
- Для реального webhook локально используй ngrok/cloudflared.

## Events import architecture
- Основной источник: KudaGo Public API (`/events`).
- Дополнительный добор: Timepad API (если доступен токен).
- Fallback: seed-события (по 15 на категорию), если внешние источники недоступны.
- Все данные сохраняются в `public.events`; клиент читает только через `/api/events`.
- Логи импорта: `public.event_import_jobs` (или legacy `public.import_jobs`, если таблица уже используется).

## API
- `GET /api/events?category=&city=&limit=15`
- `POST /api/event-submissions` (alias на `POST /api/events/submissions`)
- `POST /api/admin/import-events` (manual run, admin)
- `GET /api/admin/import-events/status` (latest job + coverage by category)
- `GET/POST /api/cron/import-events` (Vercel cron / CRON_SECRET)

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

## Stability
- `/api/events` использует hot/stale cache + rate limit + concurrency guard.
- При перегрузе отдаётся stale payload или предсказуемая 429/503 ошибка (без stack trace).
- `POST /api/events/submissions` защищён rate limit + concurrency guard.

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
