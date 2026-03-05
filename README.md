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
- `YANDEX_TICKETS_AUTH` (если есть партнерский доступ)
- `YANDEX_TICKETS_BASE_URL` (default `https://api.tickets.yandex.net`)
- `APP_ENV=local|vercel`

## Migrations
Выполни все миграции из `supabase/migrations` по порядку, включая:
- `021_events_experience_revamp.sql`
- `022_events_import_jobs_and_hardening.sql`

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
- С категориями: `npm run import-events -- --categories=sports,concerts,arts`

### Telegram в local
- `TELEGRAM_MODERATION_MOCK=true` (отключает реальную отправку в бота)
- Для реального webhook локально используй ngrok/cloudflared.

## Events import architecture
- Источник: Yandex Tickets API (`event.list` + `event.detail`) server-side.
- Fallback: seed-события (по 15 на категорию), если API недоступен или `YANDEX_TICKETS_AUTH` не задан.
- Все данные сохраняются в `public.events`; клиент читает только из Supabase через `/api/events`.
- Логи импорта: `public.import_jobs`.

## API
- `GET /api/events`
- `POST /api/event-submissions` (alias на `POST /api/events/submissions`)
- `POST /api/admin/import-events` (manual run, admin)
- `GET/POST /api/cron/import-events` (Vercel cron / CRON_SECRET)

## Vercel cron
Используй cron на `/api/cron/import-events` (например каждые 30 минут):
- если Vercel cron header есть — endpoint примет запрос;
- иначе можно защитить Bearer-токеном через `CRON_SECRET`.

Пример `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/import-events", "schedule": "*/30 * * * *" }
  ]
}
```

## Stability
- `/api/events` использует hot/stale cache + rate limit + concurrency guard.
- При перегрузе отдаётся stale payload или предсказуемая 429/503 ошибка (без сырых stack traces).
- `POST /api/events/submissions` защищён rate limit + concurrency guard.

## Checklist after deploy
1. `POST /api/admin/import-events` вернул `ok=true`.
2. В `import_jobs` есть `status=finished`.
3. В `events` не менее 15 событий на каждую категорию:
   - Спорт
   - Концерты
   - Искусство
   - Квесты
   - Стендап
   - Выставки
4. `/events` показывает карточки, не `0`.
5. Кнопка «Добавить событие» открывает форму с первого клика.
6. Submission уходит в `event_submissions` со статусом `pending`.
