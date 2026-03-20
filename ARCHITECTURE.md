# Meetap MVP Architecture

## Code Layout

- `src/app` - Next.js UI and API route handlers
- `src/modules/auth` - phone verification and session logic
- `src/modules/feed` - event feed ranking and interactions
- `src/modules/recommendations` - candidate scoring
- `src/modules/chat` - matches and messages
- `src/modules/profile` - onboarding/profile management
- `src/modules/llm` - first-message suggestion generation
- `src/modules/moderation` - report/block workflows
- `src/lib` - shared types, store, and API helpers

## App Flow

1. User enters phone + country.
2. User selects verification method (`telegram` preferred or `sms`).
3. API creates verification session and one-time code (MVP mock).
4. User confirms code and provides required fields: `name`, `country`.
5. User enters app with mobile-first bottom navigation.
6. Profile can be extended later: university, bio, 3 facts.

## Notes

- Current implementation is MVP and uses in-memory storage.
- For production: replace auth mock with real Telegram Login + SMS provider.
