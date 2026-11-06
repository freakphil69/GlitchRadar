"""Zentrale Kostenbremse für alle kostenpflichtigen KI-Aufrufe von GlitchRadar.

Grundsatz: Für Nutzer läuft alles wie bisher – es fallen nur doppelte/unnötige Aufrufe weg.
- Standardmäßig ist die KI AN, mit großzügigem Tageslimit als Notbremse.
- Erst wenn ein Limit erreicht ist, greift die Regelbewertung bzw. der Hinweistext.
- Jeder Aufruf muss vorher über reserve() ein Kontingent holen.
- Das Kontingent wird atomar in MongoDB gezählt (global, über alle Nutzer und Prozesse).
- Fällt die Budgetprüfung aus (DB-Fehler o. Ä.), wird KEIN Aufruf erlaubt.

Einstellungen (backend/.env):
  AI_ENABLED=true               Hauptschalter (false = sofort alle KI-Aufrufe aus)
  AI_SCORING_ENABLED=true       KI-Risikobewertung neuer Deals (Gemini) – sonst Regelbewertung
  AI_ENRICH_ENABLED=true        KI-Schrittplan auf der Detailseite (Claude)
  AI_DAILY_CALL_LIMIT=500       Notbremse: max. KI-Aufrufe pro Tag (UTC), global
  AI_TOTAL_CALL_LIMIT=0         optionales Gesamtlimit (0 = aus)

Hinweis: Das ist eine Zählung von Aufrufen, keine Abrechnungsgrenze des Anbieters.
Die tatsächlichen Kosten pro Aufruf schwanken. Ein verbindliches Limit / das
Abschalten der automatischen Aufladung muss im Emergent-Konto selbst geprüft werden.
"""
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _flag(name: str, default: str = "true") -> bool:
    return os.environ.get(name, default).strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: str) -> int:
    try:
        return max(0, int(os.environ.get(name, default)))
    except ValueError:
        return int(default)


def settings() -> dict:
    return {
        "enabled": _flag("AI_ENABLED"),
        "scoring_enabled": _flag("AI_SCORING_ENABLED"),
        "enrich_enabled": _flag("AI_ENRICH_ENABLED"),
        "daily_limit": _int("AI_DAILY_CALL_LIMIT", "500"),
        "total_limit": _int("AI_TOTAL_CALL_LIMIT", "0"),  # 0 = kein Gesamtlimit
    }


def kind_allowed(kind: str) -> bool:
    s = settings()
    if not s["enabled"] or s["daily_limit"] <= 0:
        return False
    return s["scoring_enabled"] if kind == "scoring" else s["enrich_enabled"] if kind == "enrich" else False


def _day_key() -> str:
    return "day:" + datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def _take(db, key: str, limit: int) -> bool:
    await db.ai_budget.update_one({"_id": key}, {"$setOnInsert": {"count": 0}}, upsert=True)
    res = await db.ai_budget.update_one({"_id": key, "count": {"$lt": limit}}, {"$inc": {"count": 1}})
    return res.modified_count == 1


async def reserve(db, kind: str) -> bool:
    """Reserviert atomar EINEN kostenpflichtigen Aufruf. False = nicht aufrufen."""
    if not kind_allowed(kind):
        return False
    s = settings()
    try:
        has_total = s["total_limit"] > 0
        if has_total and not await _take(db, "total", s["total_limit"]):
            return False
        if not await _take(db, _day_key(), s["daily_limit"]):
            if has_total:
                await db.ai_budget.update_one({"_id": "total"}, {"$inc": {"count": -1}})
            return False
        if not has_total:
            await db.ai_budget.update_one({"_id": "total"}, {"$inc": {"count": 1}}, upsert=True)
        await db.ai_budget.update_one({"_id": f"kind:{kind}"}, {"$inc": {"count": 1}}, upsert=True)
        return True
    except Exception as e:  # Budgetprüfung nicht verfügbar -> kein Aufruf
        logger.warning(f"Budgetprüfung fehlgeschlagen, KI-Aufruf blockiert: {e}")
        return False


async def status(db) -> dict:
    s = settings()
    out = {**s, "used_today": None, "used_total": None}
    try:
        day = await db.ai_budget.find_one({"_id": _day_key()})
        tot = await db.ai_budget.find_one({"_id": "total"})
        out["used_today"] = int(day["count"]) if day else 0
        out["used_total"] = int(tot["count"]) if tot else 0
    except Exception:
        pass
    out["scoring_available"] = kind_allowed("scoring")
    out["enrich_available"] = kind_allowed("enrich")
    return out
