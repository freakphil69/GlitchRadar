"""Emergent managed push (SuprSend relay). Device tokens live at the relay; we only keep user ids."""
import asyncio
import logging
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")

_client = httpx.AsyncClient(base_url=PUSH_BASE_URL, headers={"X-Push-Key": PUSH_KEY}, timeout=10.0)


class RegisterPushBody(BaseModel):
    user_id: str = Field(min_length=3, max_length=80)
    platform: str
    device_token: str = Field(min_length=10)


def build_push_router(db) -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.post("/register-push", status_code=201)
    async def register_push(body: RegisterPushBody):
        resp = await _client.post("/api/v1/push/users/register", json=body.model_dump())
        if resp.status_code == 401:
            raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
        if resp.status_code >= 500:
            raise HTTPException(502, "Push provider unavailable")
        resp.raise_for_status()
        await db.push_users.update_one(
            {"user_id": body.user_id},
            {"$set": {"user_id": body.user_id, "platform": body.platform, "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        return {"status": "registered"}

    return router


async def send_push(recipients: list[str], data: dict, idempotency_key: str | None = None, _attempt: int = 0) -> None:
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 recipients per /trigger call; chunk before sending")
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload: dict = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    code = resp.json().get("code", "") if resp.headers.get("content-type", "").startswith("application/json") else ""
    if code == "idempotency_key_in_progress" and idempotency_key and _attempt < 3:
        await asyncio.sleep(3)
        return await send_push(recipients, data, idempotency_key=idempotency_key, _attempt=_attempt + 1)
    if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
        logger.warning(f"Push paused: {code} ({resp.status_code}): {resp.json().get('message', '')}")
        return
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


async def broadcast_alarm(db, glitch_id: str, title: str, message: str) -> None:
    """Send one Glitch-Alarm push to every registered device user (chunks of 100). Never raises."""
    try:
        ids = [u["user_id"] async for u in db.push_users.find({}, {"user_id": 1})]
        for i in range(0, len(ids), 100):
            await send_push(ids[i:i + 100], {"title": title, "message": message, "action_url": f"/glitch/{glitch_id}"},
                            idempotency_key=f"alarm-{glitch_id}-{i}")
    except Exception as e:
        logger.warning(f"Push failed (non-blocking): {e}")
