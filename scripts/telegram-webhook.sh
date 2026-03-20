#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-set}"
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
WEBHOOK_SECRET="${TELEGRAM_WEBHOOK_SECRET:-}"
BASE_URL="${2:-${WEBHOOK_BASE_URL:-}}"

if [[ -z "$BOT_TOKEN" ]]; then
  echo "Error: TELEGRAM_BOT_TOKEN is required"
  exit 1
fi

case "$ACTION" in
  set)
    if [[ -z "$BASE_URL" ]]; then
      echo "Usage: TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... $0 set https://your-domain"
      exit 1
    fi
    if [[ -z "$WEBHOOK_SECRET" ]]; then
      echo "Error: TELEGRAM_WEBHOOK_SECRET is required for set"
      exit 1
    fi
    curl -sS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
      -d "url=${BASE_URL%/}/api/telegram/webhook" \
      -d "secret_token=${WEBHOOK_SECRET}" | tee /tmp/telegram_set_webhook.json
    ;;
  info)
    curl -sS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | tee /tmp/telegram_webhook_info.json
    ;;
  delete)
    curl -sS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook" | tee /tmp/telegram_delete_webhook.json
    ;;
  me)
    curl -sS "https://api.telegram.org/bot${BOT_TOKEN}/getMe" | tee /tmp/telegram_get_me.json
    ;;
  *)
    echo "Unknown action: $ACTION"
    echo "Available: set | info | delete | me"
    exit 1
    ;;
esac
