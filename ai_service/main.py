from __future__ import annotations

import base64
import json
import logging
import os
import uuid
from typing import Any

import cv2
import httpx
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from deepseek_client import DeepSeekClient
from prompts import (
    ADMIN_ASSISTANT_SYSTEM_PROMPT,
    ADMIN_ASSISTANT_USER_TEMPLATE,
    FACE_VALIDATE_SYSTEM_PROMPT,
    FACE_VALIDATE_USER_TEMPLATE,
    FIRST_MESSAGE_SYSTEM_PROMPT,
    FIRST_MESSAGE_USER_TEMPLATE,
    ICEBREAKER_SYSTEM_PROMPT,
    ICEBREAKER_USER_TEMPLATE,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("ai_service")


class FaceValidateInput(BaseModel):
    image_url: str | None = None
    base64: str | None = None


class FaceValidateOutput(BaseModel):
    faces_count: int
    confidence: float
    ok: bool
    reason: str | None = None


class IcebreakerInput(BaseModel):
    user1: dict[str, Any]
    user2: dict[str, Any]
    context: str | None = None


class IcebreakerOutput(BaseModel):
    messages: list[str]
    topic: str
    question: str
    profileSummary: str | None = None
    approachTips: list[str] | None = None
    offlineIdeas: list[str] | None = None
    onlineIdeas: list[str] | None = None


class AdminAssistantInput(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    snapshot: dict[str, Any] = Field(default_factory=dict)


class AdminAssistantOutput(BaseModel):
    summary: str
    risks: list[str]
    actions: list[str]
    queries: list[str]


class FirstMessageSuggestionsInput(BaseModel):
    user1: dict[str, Any]
    user2: dict[str, Any]
    context: str | None = None


class FirstMessageSuggestionsOutput(BaseModel):
    messages: list[str]


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _build_deepseek_client() -> DeepSeekClient | None:
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        return None

    base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1").strip()
    model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat").strip()
    return DeepSeekClient(api_key=api_key, base_url=base_url, model=model)


FACE_MIN_CONFIDENCE = max(0.0, min(1.0, _env_float("FACE_DETECT_MIN_CONFIDENCE", 0.35)))
DEEPSEEK_CLIENT = _build_deepseek_client()
FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

if FACE_CASCADE.empty():
    raise RuntimeError("Unable to load OpenCV Haar cascade for face detection")

app = FastAPI(title="Meetap AI Service", version="1.0.0")


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "provider": "deepseek" if DEEPSEEK_CLIENT else "fallback",
        "face_min_confidence": FACE_MIN_CONFIDENCE,
    }


@app.post("/v1/face-validate", response_model=FaceValidateOutput)
async def face_validate(payload: FaceValidateInput) -> FaceValidateOutput:
    request_id = uuid.uuid4().hex[:8]

    if not payload.image_url and not payload.base64:
        logger.warning("[%s] Валидация фото отклонена: не переданы image_url и base64", request_id)
        raise HTTPException(status_code=422, detail="image_url or base64 is required")

    image_source = "image_url" if payload.image_url else "base64"
    payload_hint = len(payload.base64 or "") if payload.base64 else len(payload.image_url or "")
    logger.info(
        "[%s] Получена фотография для проверки: источник=%s, размер_поля=%d",
        request_id,
        image_source,
        payload_hint,
    )

    image_bytes = await _resolve_image_bytes(payload)
    faces_count = _detect_faces_count(image_bytes)

    # Deterministic local confidence so the endpoint works even without external LLM.
    local_confidence = min(0.99, 0.42 + faces_count * 0.2) if faces_count > 0 else 0.04
    local_result = {
        "faces_count": faces_count,
        "confidence": round(local_confidence, 3),
        "ok": faces_count >= 1 and local_confidence >= FACE_MIN_CONFIDENCE,
        "reason": "Local detector: faces found" if faces_count > 0 else "No faces detected",
    }

    if not DEEPSEEK_CLIENT:
        verdict = FaceValidateOutput(**local_result)
        logger.info(
            "[%s] Вердикт по фото (локально): лица=%d, confidence=%.3f, ok=%s, причина=%s",
            request_id,
            verdict.faces_count,
            verdict.confidence,
            verdict.ok,
            verdict.reason or "-",
        )
        return verdict

    try:
        ai_result = DEEPSEEK_CLIENT.chat_json(
            system_prompt=FACE_VALIDATE_SYSTEM_PROMPT,
            user_prompt=FACE_VALIDATE_USER_TEMPLATE.format(
                detector_faces_count=faces_count,
                detector_confidence_hint=round(local_confidence, 3),
                min_confidence=FACE_MIN_CONFIDENCE,
            ),
            temperature=0.0,
            max_tokens=220,
        )
        normalized = _normalize_face_result(ai_result, fallback=local_result)
        verdict = FaceValidateOutput(**normalized)
        logger.info(
            "[%s] Вердикт по фото (deepseek+локальный): лица=%d, confidence=%.3f, ok=%s, причина=%s",
            request_id,
            verdict.faces_count,
            verdict.confidence,
            verdict.ok,
            verdict.reason or "-",
        )
        return verdict
    except Exception:
        verdict = FaceValidateOutput(**local_result)
        logger.warning(
            "[%s] DeepSeek недоступен, использован локальный вердикт: лица=%d, confidence=%.3f, ok=%s, причина=%s",
            request_id,
            verdict.faces_count,
            verdict.confidence,
            verdict.ok,
            verdict.reason or "-",
        )
        return verdict


@app.post("/v1/icebreaker", response_model=IcebreakerOutput)
def icebreaker(payload: IcebreakerInput) -> IcebreakerOutput:
    fallback = _fallback_icebreaker(payload)

    if not DEEPSEEK_CLIENT:
        return IcebreakerOutput(**fallback)

    try:
        user1 = payload.user1 or {}
        user2 = payload.user2 or {}
        prompt = ICEBREAKER_USER_TEMPLATE.format(
            user1_name=user1.get("name", "User 1"),
            user2_name=user2.get("name", "User 2"),
            context=(payload.context or "offline meeting")[:500],
            user1_interests=", ".join(user1.get("interests", []) or []) or "не указаны",
            user2_interests=", ".join(user2.get("interests", []) or []) or "не указаны",
        )

        raw = DEEPSEEK_CLIENT.chat_json(
            system_prompt=ICEBREAKER_SYSTEM_PROMPT,
            user_prompt=prompt,
            temperature=0.6,
            max_tokens=700,
        )
        normalized = _normalize_icebreaker(raw, fallback)
        return IcebreakerOutput(**normalized)
    except Exception:
        return IcebreakerOutput(**fallback)


@app.post("/v1/admin-assistant", response_model=AdminAssistantOutput)
def admin_assistant(payload: AdminAssistantInput) -> AdminAssistantOutput:
    fallback = {
        "summary": "AI service is unavailable now. Use dashboard KPIs and event counters.",
        "risks": ["Check open moderation flags and unusual traffic spikes"],
        "actions": ["Review top events", "Inspect users with repeated flags"],
        "queries": ["search: наркот", "search: взрыв", "search: заклад"],
    }

    if not DEEPSEEK_CLIENT:
        return AdminAssistantOutput(**fallback)

    try:
        prompt = ADMIN_ASSISTANT_USER_TEMPLATE.format(
            question=payload.question,
            snapshot_json=json.dumps(payload.snapshot, ensure_ascii=False)[:12000],
        )
        raw = DEEPSEEK_CLIENT.chat_json(
            system_prompt=ADMIN_ASSISTANT_SYSTEM_PROMPT,
            user_prompt=prompt,
            temperature=0.2,
            max_tokens=800,
        )
        normalized = _normalize_admin_assistant(raw, fallback)
        return AdminAssistantOutput(**normalized)
    except Exception:
        return AdminAssistantOutput(**fallback)


@app.post("/v1/first-message-suggestions", response_model=FirstMessageSuggestionsOutput)
def first_message_suggestions(payload: FirstMessageSuggestionsInput) -> FirstMessageSuggestionsOutput:
    request_id = uuid.uuid4().hex[:8]
    fallback = _fallback_first_message_suggestions(payload)

    if not DEEPSEEK_CLIENT:
        logger.warning(
            "[%s] Генерация первого сообщения: source=fallback, reason=deepseek_not_configured",
            request_id,
        )
        return FirstMessageSuggestionsOutput(**fallback)

    try:
        user1 = payload.user1 or {}
        user2 = payload.user2 or {}
        target_name = str(user2.get("name") or "собеседник")
        target_interests = _extract_interests(user2)

        prompt = FIRST_MESSAGE_USER_TEMPLATE.format(
            user1_name=str(user1.get("name") or "Пользователь"),
            user2_name=target_name,
            context=(payload.context or "первый диалог в личных сообщениях")[:500],
            user1_interests=", ".join(_extract_interests(user1)) or "не указаны",
            user1_profile=_extract_profile_summary(user1),
            user2_interests=", ".join(target_interests) or "не указаны",
            user2_profile=str(user2.get("profileSummary") or "без дополнительных данных")[:700],
        )

        raw = DEEPSEEK_CLIENT.chat_json(
            system_prompt=FIRST_MESSAGE_SYSTEM_PROMPT,
            user_prompt=prompt,
            temperature=0.5,
            max_tokens=360,
        )

        messages = raw.get("messages")
        if not isinstance(messages, list):
            logger.warning(
                "[%s] Генерация первого сообщения: source=fallback, reason=invalid_deepseek_payload, keys=%s",
                request_id,
                list(raw.keys())[:10],
            )
            return FirstMessageSuggestionsOutput(**fallback)

        logger.info(
            "[%s] Генерация первого сообщения: source=deepseek, messages=%d",
            request_id,
            len(messages),
        )

        # Возвращаем пользователю ровно тот список сообщений, который прислал DeepSeek.
        return FirstMessageSuggestionsOutput(messages=messages)
    except Exception:
        logger.exception(
            "[%s] Генерация первого сообщения: source=fallback, reason=deepseek_error",
            request_id,
        )
        return FirstMessageSuggestionsOutput(**fallback)


async def _resolve_image_bytes(payload: FaceValidateInput) -> bytes:
    if payload.base64:
        value = payload.base64.strip()
        if value.startswith("data:image") and "," in value:
            value = value.split(",", 1)[1]
        try:
            return base64.b64decode(value, validate=True)
        except Exception as exc:
            logger.warning("Ошибка декодирования base64 изображения")
            raise HTTPException(status_code=422, detail="Invalid base64 image") from exc

    assert payload.image_url is not None

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(payload.image_url)
            response.raise_for_status()
            return response.content
    except Exception as exc:
        logger.warning("Не удалось получить изображение по image_url")
        raise HTTPException(status_code=422, detail="Unable to fetch image_url") from exc


def _detect_faces_count(image_bytes: bytes) -> int:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        logger.warning("Не удалось декодировать изображение для детекции лиц")
        raise HTTPException(status_code=422, detail="Unable to decode image")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = FACE_CASCADE.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(32, 32),
    )

    return int(len(faces))


def _normalize_face_result(raw: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    faces_count = raw.get("faces_count", fallback["faces_count"])
    confidence = raw.get("confidence", fallback["confidence"])
    ok = raw.get("ok", fallback["ok"])
    reason = raw.get("reason", fallback.get("reason"))

    try:
        faces_count = max(0, int(faces_count))
    except Exception:
        faces_count = fallback["faces_count"]

    try:
        confidence = float(confidence)
    except Exception:
        confidence = fallback["confidence"]

    confidence = max(0.0, min(1.0, confidence))
    ok = bool(ok) and faces_count >= 1 and confidence >= FACE_MIN_CONFIDENCE

    return {
        "faces_count": faces_count,
        "confidence": round(confidence, 3),
        "ok": ok,
        "reason": str(reason)[:280] if reason else None,
    }


def _fallback_icebreaker(payload: IcebreakerInput) -> dict[str, Any]:
    user2 = payload.user2 or {}
    user2_name = str(user2.get("name") or "человек")
    interests = user2.get("interests") or []
    first_interest = interests[0] if isinstance(interests, list) and interests else "оффлайн встреч"

    return {
        "messages": [
            f"Привет! Увидел(а), что тебе близка тема {first_interest}. Хочешь познакомиться?",
            "Я бы с радостью присоединился(ась) к небольшому мероприятию или прогулке.",
        ],
        "topic": "Общие интересы",
        "question": "Какой формат первого знакомства тебе комфортнее?",
        "profileSummary": f"{user2_name} лучше откликается на спокойный диалог через общий контекст.",
        "approachTips": [
            "Начни коротко, без длинной самопрезентации",
            "Ссылайся на общий интерес или недавний пост",
        ],
        "offlineIdeas": ["Кофе рядом с мероприятием", "Короткая прогулка на 30 минут"],
        "onlineIdeas": ["Обменяться 2-3 вопросами перед встречей"],
    }


def _normalize_icebreaker(raw: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    messages = raw.get("messages") if isinstance(raw.get("messages"), list) else fallback["messages"]
    topic = str(raw.get("topic") or fallback["topic"])[:160]
    question = str(raw.get("question") or fallback["question"])[:240]

    def _str_list(value: Any, default: list[str]) -> list[str]:
        if not isinstance(value, list):
            return default
        items = [str(item)[:240] for item in value if str(item).strip()]
        return items[:6] if items else default

    return {
        "messages": _str_list(messages, fallback["messages"]),
        "topic": topic,
        "question": question,
        "profileSummary": str(raw.get("profileSummary") or fallback.get("profileSummary") or "")[:360] or None,
        "approachTips": _str_list(raw.get("approachTips"), fallback.get("approachTips") or []),
        "offlineIdeas": _str_list(raw.get("offlineIdeas"), fallback.get("offlineIdeas") or []),
        "onlineIdeas": _str_list(raw.get("onlineIdeas"), fallback.get("onlineIdeas") or []),
    }


def _normalize_admin_assistant(raw: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    def _as_list(value: Any, default: list[str]) -> list[str]:
        if not isinstance(value, list):
            return default
        items = [str(item)[:240] for item in value if str(item).strip()]
        return items[:8] if items else default

    return {
        "summary": str(raw.get("summary") or fallback["summary"])[:1200],
        "risks": _as_list(raw.get("risks"), fallback["risks"]),
        "actions": _as_list(raw.get("actions"), fallback["actions"]),
        "queries": _as_list(raw.get("queries"), fallback["queries"]),
    }


def _extract_interests(user: dict[str, Any]) -> list[str]:
    raw = user.get("interests")
    if not isinstance(raw, list):
        return []
    result = []
    for item in raw:
        text = " ".join(str(item).split())
        if text:
            result.append(text[:80])
    return result[:8]


def _extract_profile_summary(user: dict[str, Any]) -> str:
    text = str(user.get("profileSummary") or "").strip()
    return text[:700] if text else "без дополнительных данных"


def _truncate_words(text: str, limit: int) -> str:
    words = text.split()
    if len(words) <= limit:
        return text
    return " ".join(words[:limit]).rstrip(".,;:!?") + "…"


def _fallback_first_message_suggestions(payload: FirstMessageSuggestionsInput) -> dict[str, Any]:
    user1 = payload.user1 or {}
    user2 = payload.user2 or {}
    sender_focus = _extract_interests(user1)
    target_name = str(user2.get("name") or "Привет")
    target_interests = _extract_interests(user2)
    my_focus = sender_focus[0] if sender_focus else "активности"
    focus = target_interests[0] if target_interests else "новые знакомства"

    return {
        "messages": [
            _truncate_words(
                f"Привет, {target_name}! Пишу познакомиться. Как проходит твой день?",
                30,
            ),
            _truncate_words(
                f"Привет! Я обычно про {my_focus}, поэтому решил написать. Если тебе комфортно, давай познакомимся.",
                30,
            ),
            f"Привет, {target_name}! Вижу, тебе интересна тема «{focus}». Что в ней тебя больше всего вдохновляет?",
        ]
    }
