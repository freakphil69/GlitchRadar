"""Auth for GlitchRadar: email/password (JWT) + Emergent-managed Google login.

Both paths resolve to one identity: users.user_id (never Mongo _id). Google tokens live in
user_sessions (Emergent flow); local JWTs are revoked via revoked_tokens on logout.
"""
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
JWT_AUDIENCE = "glitchradar-app"
TOKEN_DAYS = 7
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_FAILS = 5
LOCK_MINUTES = 15
_DUMMY_HASH = bcrypt.hashpw(b"constant-dummy-password", bcrypt.gensalt(rounds=12))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(v: datetime) -> datetime:
    return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


class Credentials(BaseModel):
    email: str = Field(max_length=200)
    password: str = Field(min_length=8, max_length=128)
    name: Optional[str] = Field(default=None, max_length=80)


class SessionIn(BaseModel):
    session_id: str = Field(min_length=4, max_length=500)


def public_user(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "email": u["email"],
        "name": u.get("name"),
        "picture": u.get("picture"),
        "auth_provider": u.get("auth_provider", "local"),
    }


def _issue_jwt(user_id: str) -> str:
    now = _now()
    return jwt.encode(
        {"sub": user_id, "jti": uuid.uuid4().hex, "aud": JWT_AUDIENCE, "iat": now,
         "exp": now + timedelta(days=TOKEN_DAYS), "typ": "local"},
        JWT_SECRET, algorithm=JWT_ALG,
    )


def _norm_email(email: str) -> str:
    e = email.strip().lower()
    if not EMAIL_RE.match(e):
        raise HTTPException(status_code=422, detail="Bitte eine gültige E-Mail-Adresse eingeben")
    return e


async def ensure_auth_indexes(db) -> None:
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.revoked_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("email", unique=True)


def make_auth(db):
    router = APIRouter(prefix="/api/auth")

    async def current_user(request: Request) -> dict:
        header = request.headers.get("Authorization", "")
        if not header.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Nicht angemeldet")
        token = header[7:].strip()
        user_id = None
        session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if session:
            if _aware(session["expires_at"]) < _now():
                raise HTTPException(status_code=401, detail="Sitzung abgelaufen")
            user_id = session["user_id"]
        else:
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG], audience=JWT_AUDIENCE)
            except jwt.InvalidTokenError:
                raise HTTPException(status_code=401, detail="Nicht angemeldet")
            if await db.revoked_tokens.find_one({"jti": payload.get("jti")}, {"_id": 1}):
                raise HTTPException(status_code=401, detail="Sitzung beendet")
            user_id = payload.get("sub")
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Nicht angemeldet")
        return user

    @router.post("/register", status_code=201)
    async def register(body: Credentials):
        email = _norm_email(body.email)
        existing = await db.users.find_one({"email": email}, {"_id": 0})
        if existing:
            detail = ("Dieses Konto nutzt Google – bitte mit Google anmelden"
                      if not existing.get("password_hash") else "E-Mail ist bereits registriert")
            raise HTTPException(status_code=409, detail=detail)
        user = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": (body.name or "").strip() or email.split("@")[0],
            "picture": None,
            "password_hash": bcrypt.hashpw(body.password.encode(), bcrypt.gensalt(rounds=12)).decode(),
            "auth_provider": "local",
            "created_at": _now(),
        }
        try:
            await db.users.insert_one(dict(user))
        except Exception:
            raise HTTPException(status_code=409, detail="E-Mail ist bereits registriert")
        return {"token": _issue_jwt(user["user_id"]), "user": public_user(user)}

    @router.post("/login")
    async def login(body: Credentials):
        email = _norm_email(body.email)
        attempt = await db.login_attempts.find_one({"email": email}, {"_id": 0})
        if attempt and attempt.get("locked_until") and _aware(attempt["locked_until"]) > _now():
            raise HTTPException(status_code=429, detail="Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen")
        user = await db.users.find_one({"email": email}, {"_id": 0})
        stored = user.get("password_hash") if user else None
        ok = bcrypt.checkpw(body.password.encode(), stored.encode() if stored else _DUMMY_HASH) and bool(stored)
        if not ok:
            fails = (attempt or {}).get("fails", 0) + 1
            update = {"fails": fails, "last_at": _now()}
            if fails >= MAX_FAILS:
                update = {"fails": 0, "last_at": _now(), "locked_until": _now() + timedelta(minutes=LOCK_MINUTES)}
            await db.login_attempts.update_one({"email": email}, {"$set": update}, upsert=True)
            raise HTTPException(status_code=401, detail="E-Mail oder Passwort falsch")
        await db.login_attempts.delete_one({"email": email})
        return {"token": _issue_jwt(user["user_id"]), "user": public_user(user)}

    @router.post("/session")
    async def google_session(body: SessionIn):
        async with httpx.AsyncClient(timeout=15) as hc:
            r = await hc.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Google-Anmeldung fehlgeschlagen")
        data = r.json()
        email = str(data.get("email", "")).strip().lower()
        session_token = data.get("session_token")
        if not email or not session_token:
            raise HTTPException(status_code=401, detail="Google-Anmeldung fehlgeschlagen")
        existing = await db.users.find_one({"email": email}, {"_id": 0})
        if existing:
            provider = existing.get("auth_provider", "local")
            await db.users.update_one({"user_id": existing["user_id"]}, {"$set": {
                "name": existing.get("name") or data.get("name"),
                "picture": data.get("picture"),
                "auth_provider": provider if "google" in provider else f"{provider}+google",
            }})
            user = await db.users.find_one({"user_id": existing["user_id"]}, {"_id": 0, "password_hash": 0})
        else:
            user = {
                "user_id": f"user_{uuid.uuid4().hex[:12]}",
                "email": email,
                "name": data.get("name") or email.split("@")[0],
                "picture": data.get("picture"),
                "auth_provider": "google",
                "created_at": _now(),
            }
            await db.users.insert_one(dict(user))
        await db.user_sessions.insert_one({
            "session_token": session_token,
            "user_id": user["user_id"],
            "expires_at": _now() + timedelta(days=TOKEN_DAYS),
            "created_at": _now(),
        })
        return {"token": session_token, "session_token": session_token, "user": public_user(user)}

    @router.get("/me")
    async def me(request: Request):
        return public_user(await current_user(request))

    @router.post("/logout")
    async def logout(request: Request):
        await current_user(request)
        token = request.headers.get("Authorization", "")[7:].strip()
        deleted = await db.user_sessions.delete_one({"session_token": token})
        if not deleted.deleted_count:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG], audience=JWT_AUDIENCE)
            await db.revoked_tokens.update_one(
                {"jti": payload["jti"]},
                {"$set": {"jti": payload["jti"], "expires_at": datetime.fromtimestamp(payload["exp"], timezone.utc)}},
                upsert=True,
            )
        return {"ok": True}

    return router, current_user
