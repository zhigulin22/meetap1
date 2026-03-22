# Meetap AI Service (Python)

Separate AI service for Meetap, exposed over HTTP for the Next.js app.

## Endpoints

- `GET /health`
- `POST /v1/face-validate`
- `POST /v1/icebreaker`
- `POST /v1/first-message-suggestions`
- `POST /v1/admin-assistant`

## Run locally

```bash
cd ai_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# create .env and add DEEPSEEK_API_KEY
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

## Notes

- Face validation is deterministic via local OpenCV detector.
- If `DEEPSEEK_API_KEY` is set, DeepSeek is used for text generation (`icebreaker`, `first-message-suggestions`, `admin-assistant`) and response calibration.
