import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any, List, Optional

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator
from starlette.middleware.cors import CORSMiddleware

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

GLITCH_TYPES = {"price_error", "coupon", "cashback", "shipping", "stack"}
RISK_LEVELS = {"low", "medium", "high"}
SCOUT_MODEL = "gpt-5.6-terra"
SCORER_MODEL = "gemini-3-flash-preview"
ANALYST_MODEL = "claude-sonnet-5-5"


# ---------------------------------------------------------------------------
# Mongo helpers (ObjectId-safe models)
# ---------------------------------------------------------------------------

def _coerce_oid(v: Any) -> Any:
    if v is None or v == "":
        return ObjectId()
    if isinstance(v, ObjectId):
        return v
    if ObjectId.is_valid(str(v)):
        return ObjectId(str(v))
    return v


PyObjectId = Annotated[ObjectId, BeforeValidator(_coerce_oid)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, populate_by_name=True)

    id: PyObjectId = Field(default_factory=ObjectId, alias="_id")

    def to_mongo(self) -> dict:
        return self.model_dump(by_alias=True, exclude_none=True, mode="python")

    @classmethod
    def from_mongo(cls, doc: Optional[dict]):
        if not doc:
            return None
        return cls(**doc)

    def out(self) -> dict:
        d = self.model_dump(exclude={"id"}, mode="json")
        d["id"] = str(self.id)
        return d


def _parse_oid(oid: str) -> ObjectId:
    if not ObjectId.is_valid(oid):
        raise HTTPException(status_code=400, detail="Ungültige ID")
    return ObjectId(oid)


def _f(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _i(v: Any, default: int = 0) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return default


def _as_text(resp: Any) -> str:
    if isinstance(resp, str):
        return resp
    if isinstance(resp, dict):
        return resp.get("content") or json.dumps(resp, ensure_ascii=False)
    content = getattr(resp, "content", None)
    return content if isinstance(content, str) else str(resp)


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _extract_json_array(text: str) -> list:
    t = _strip_fences(text)
    m = re.search(r"\[[\s\S]*\]", t)
    if not m:
        raise ValueError("Kein JSON-Array in der Antwort")
    return json.loads(m.group(0))


def _extract_json_dict(text: str) -> dict:
    t = _strip_fences(text)
    m = re.search(r"\{[\s\S]*\}", t)
    if not m:
        raise ValueError("Kein JSON-Objekt in der Antwort")
    return json.loads(m.group(0))


def _clean_step(s: str) -> str:
    return re.sub(r"^\s*\d+[.)]\s*", "", str(s)).strip()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_tz(v: datetime) -> datetime:
    # BSON returns naive UTC datetimes — pin them back to tz-aware UTC.
    return v if v.tzinfo is not None else v.replace(tzinfo=timezone.utc)


def _discount_pct(original: float, glitched: float) -> int:
    if original <= 0:
        return 0
    return max(0, min(100, round((1 - glitched / original) * 100)))


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class GlitchDoc(BaseDocument):
    type: str
    title: str
    shop: str
    category: str = "Sonstiges"
    description: str = ""
    why_it_works: str = ""
    original_price: float
    glitched_price: float
    currency: str = "EUR"
    discount_pct: int = 0
    coupon_code: Optional[str] = None
    url: Optional[str] = None
    risk_level: str = "medium"
    risk_note: str = ""
    risk_analysis: Optional[str] = None
    success_rate: int = 70
    source_label: str = "KI-SCOUT"
    scout_model: str = ""
    status: str = "active"
    enriched: bool = False
    instructions: List[str] = Field(default_factory=list)
    tips: List[str] = Field(default_factory=list)
    time_window_note: Optional[str] = None
    expires_at: datetime
    created_at: datetime = Field(default_factory=_now)

    @field_validator("expires_at", "created_at", mode="after")
    @classmethod
    def _tz_glitch(cls, v: datetime) -> datetime:
        return _ensure_tz(v)


class ScanDoc(BaseDocument):
    started_at: datetime = Field(default_factory=_now)
    finished_at: Optional[datetime] = None
    status: str = "running"
    model_primary: str = SCOUT_MODEL
    model_scorer: str = SCORER_MODEL
    found_count: int = 0
    total_savings: float = 0.0
    error: Optional[str] = None

    @field_validator("started_at", "finished_at", mode="after")
    @classmethod
    def _tz_scan(cls, v: Optional[datetime]) -> Optional[datetime]:
        return _ensure_tz(v) if v else v


# ---------------------------------------------------------------------------
# LLM Scout pipeline: GPT 5.6 Terra (Funde) -> Gemini 3 Flash (Scoring)
# ---------------------------------------------------------------------------

SCOUT_SYSTEM = (
    "Du bist der GLITCH-SCOUT von GlitchRadar.io, ein autonomer Scanner, der "
    "Preisfehler, Gutschein-Glitches, Cashback-Fehler, Versandkosten-Bugs und "
    "stapelbare Rabatt-Kombinationen in Onlineshops aufspürt, bevor sie geschlossen "
    "werden. Du antwortest AUSSCHLIESSLICH mit validem JSON, ohne jeden zusätzlichen Text."
)

SCAN_PROMPT = """Scanne das Netzwerk nach {n} frischen Glitches aus deutschen bzw. EU-Onlineshops.
Glitch-Typen (feld "type"): "price_error" (Preisfehler z.B. Dezimal-/Rundungsfehler), "coupon"
(Gutschein-Code gibt mehr Rabatt als vorgesehen), "cashback" (Cashback-Multiplikator-Fehler),
"shipping" (Versandkosten-Fehler), "stack" (Rabatte stapelbar, obwohl ausgeschlossen).
Regeln:
- Alles auf DEUTSCH, Preise in EUR, Titel im knackigen Alarm-Stil (max 70 Zeichen).
- Realistische Szenarien, wie sie durch Konfigurations-, Rundungs- oder Kampagnenfehler entstehen.
- Jeder Glitch hat ein kurzes Zeitfenster: expires_in_minutes zwischen 15 und 360.
- Bei Gutscheinen/Guthaben: original_price = typischer Warenwert, glitched_price = Zahlbetrag nach Glitch.
- Verteile die Typen und Shops bunt (z.B. Elektronik, Fashion, Supermarkt, Baumarkt, Food).
Antworte NUR mit JSON-Array nach exakt diesem Schema:
[{{"type": "price_error", "title": "...", "shop": "...", "category": "Tech|Fashion|Home|Food|Beauty|Sport|Sonstiges", "description": "1-2 Sätze", "why_it_works": "1 Satz Fehlerursache", "original_price": 199.99, "glitched_price": 19.99, "currency": "EUR", "coupon_code": "CODE oder null", "url": null, "expires_in_minutes": 90}}]
Kein Text vor oder nach dem JSON."""

SCORE_SYSTEM = (
    "Du bist das Risiko-Scoring-Modul von GlitchRadar.io. Du bewertest Glitch-Funde "
    "realistisch und vorsichtig. Du antwortest AUSSCHLIESSLICH mit validem JSON."
)

SCORE_PROMPT = """Bewerte jeden der {n} Glitch-Funde aus der Liste unten.
Gib je Eintrag an:
- "index": Position in der Liste (0-basiert)
- "risk_level": "low", "medium" oder "high" (Stornorisiko / Kostenrisiko für den Käufer)
- "success_rate": ganze Zahl 0-100, wie wahrscheinlich das Einlösen klappt
- "risk_note": genau 1 kurzer Satz auf Deutsch zum Risiko
Antworte NUR mit JSON-Array, für alle {n} Einträge.
FUND-LISTE:
{items}"""


async def generate_glitches(n: int) -> list:
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"scout-{uuid.uuid4()}", system_message=SCOUT_SYSTEM)
        .with_model("openai", SCOUT_MODEL)
    )
    raw = await asyncio.wait_for(chat.send_message(UserMessage(text=SCAN_PROMPT.format(n=n))), timeout=150)
    return _extract_json_array(_as_text(raw))


async def score_items(items: list) -> List[dict]:
    defaults = [{"risk_level": "medium", "success_rate": 70, "risk_note": ""} for _ in items]
    try:
        chat = (
            LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"scorer-{uuid.uuid4()}", system_message=SCORE_SYSTEM)
            .with_model("gemini", SCORER_MODEL)
        )
        prompt = SCORE_PROMPT.format(n=len(items), items=json.dumps(items, ensure_ascii=False))
        raw = await asyncio.wait_for(chat.send_message(UserMessage(text=prompt)), timeout=60)
        arr = _extract_json_array(_as_text(raw))
        out = list(defaults)
        for sc in arr:
            if not isinstance(sc, dict):
                continue
            idx = _i(sc.get("index"), -1)
            if idx < 0 or idx >= len(out):
                continue
            risk = sc.get("risk_level")
            out[idx] = {
                "risk_level": risk if risk in RISK_LEVELS else "medium",
                "success_rate": max(0, min(100, _i(sc.get("success_rate"), 70))),
                "risk_note": str(sc.get("risk_note", ""))[:220],
            }
        return out
    except Exception as e:
        logger.warning(f"Scoring failed, nutze Defaults: {e}")
        return defaults


ANALYST_SYSTEM = (
    "Du bist der Analyst von GlitchRadar.io und erstellst schnelle, konkrete und "
    "verantwortungsvolle Ausführungspläne für Preisfehler und Gutschein-Glitches. "
    "Du antwortest AUSSCHLIESSLICH mit validem JSON."
)

ENRICH_PROMPT = """Analysiere diesen Glitch und erstelle den Ausführungsplan für den Radar-Operator.
GLITCH:
{payload}

Erstelle:
- "steps": 5-7 konkrete Ausführungsschritte auf Deutsch (kurz, imperativ, shop-bezogen; z.B. Produkt in den Warenkorb, Code eingeben, schnelle Kasse wählen).
- "tips": 2-4 kurze Profi-Tipps (z.B. Screenshot vom Preis machen, Käuferschutz nutzen, nicht mehr bestellen als gebraucht).
- "risk_analysis": 2-3 Sätze Risiko-Bewertung (Stornorisiko, Limits; der Shop kann den Fehler jederzeit stornieren).
- "time_window_note": 1 Satz zum Zeitfenster.
Antworte NUR mit JSON: {{"steps": ["..."], "tips": ["..."], "risk_analysis": "...", "time_window_note": "..."}}"""


# ---------------------------------------------------------------------------
# Seed data (nur falls die Datenbank leer ist)
# ---------------------------------------------------------------------------

SEED_GLITCHES = [
    {"type": "price_error", "title": "Philips Airfryer XXL: 199,99 € → 19,99 €", "shop": "MediaMarkt", "category": "Tech",
     "description": "Kassensystem rundet den Marketplace-Preis auf die falsche Dezimalstelle. Der Warenkorb übernimmt 19,99 €.",
     "why_it_works": "Dezimalfehler in der Preis-Feed-Synchronisierung des Marketplace.",
     "original_price": 199.99, "glitched_price": 19.99, "coupon_code": None, "risk_level": "medium",
     "success_rate": 76, "risk_note": "Hohe Stornoquote wahrscheinlich, schnell handeln.",
     "expires_in_minutes": 95, "minutes_ago": 12},
    {"type": "coupon", "title": "GLITCH40: 40 % auf alles statt 15 %", "shop": "Zalando", "category": "Fashion",
     "description": "Alter Campaign-Schlüssel wird von der Gutschein-Engine noch akzeptiert und verdoppelt+ den Rabatt.",
     "why_it_works": "Kampagne wurde deaktiviert, aber nicht aus der Engine entfernt.",
     "original_price": 300.0, "glitched_price": 180.0, "coupon_code": "GLITCH40", "risk_level": "low",
     "success_rate": 84, "risk_note": "Gutschein wird meist anerkannt, ohne Storno.",
     "expires_in_minutes": 210, "minutes_ago": 48},
    {"type": "cashback", "title": "10-fach-Cashback-Glitch: Zelt effektiv 49,90 €", "shop": "Decathlon", "category": "Sport",
     "description": "Cashback-Partner vergütet 10-fach statt einfach – der Effektivpreis fällt auf 49,90 €.",
     "why_it_works": "Multiplikator der Cashback-Kampagne wurde vertauscht.",
     "original_price": 89.90, "glitched_price": 49.90, "coupon_code": None, "risk_level": "low",
     "success_rate": 71, "risk_note": "Cashback kann nachträglich korrigiert werden.",
     "expires_in_minutes": 160, "minutes_ago": 95},
    {"type": "shipping", "title": "Versandkosten-Bug: 1 €-Korb versandfrei + 5 € extra", "shop": "Otto", "category": "Home",
     "description": "Mindestbestellwert-Prüfung greift nicht, zusätzlich akzeptiert der 5 €-Code unterhalb des Limits.",
     "why_it_works": "Schwellenwert-Prüfung wurde beim Deploy übersprungen.",
     "original_price": 29.99, "glitched_price": 24.99, "coupon_code": "OTTO5", "risk_level": "medium",
     "success_rate": 69, "risk_note": "Teilstornos möglich, Warenkorb klein halten.",
     "expires_in_minutes": 45, "minutes_ago": 30},
    {"type": "price_error", "title": "LEGO Technic Ferrari: 459 € → 45,90 €", "shop": "Amazon Marketplace", "category": "Tech",
     "description": "Preis-Dezimalfehler im Marketplace-Feed – mehrere Verkäufer ziehen automatisch nach.",
     "why_it_works": "Neupreis wurde ohne Komma übernommen (4590 → 45,90).",
     "original_price": 459.0, "glitched_price": 45.90, "coupon_code": None, "risk_level": "high",
     "success_rate": 58, "risk_note": "Amazon storniert Marketplace-Fehler häufig.",
     "expires_in_minutes": 75, "minutes_ago": 20},
    {"type": "stack", "title": "Neukunden-Code stapelbar mit Sale: -60 %", "shop": "About You", "category": "Fashion",
     "description": "Der 20 %-Neukundencode lässt sich auf reduzierte Artikel anwenden – Effektivrabatt bis 60 %.",
     "why_it_works": "Sale-Ausschluss-Flag fehlt in der Code-Konfiguration.",
     "original_price": 129.99, "glitched_price": 38.99, "coupon_code": "NEW60", "risk_level": "low",
     "success_rate": 81, "risk_note": "Klassiker, wird meist geduldet.",
     "expires_in_minutes": 320, "minutes_ago": 140},
    {"type": "price_error", "title": "Kallax 4x4: 99 € → 9,90 € im Logistik-Portal", "shop": "IKEA", "category": "Home",
     "description": "Das Logistik-Portal zeigt den Selbstabhol-Preis falsch an – Klick & Collect übernimmt 9,90 €.",
     "why_it_works": "Portal-Berechnung nutzt Meterpreis statt Stückpreis.",
     "original_price": 99.0, "glitched_price": 9.90, "coupon_code": None, "risk_level": "medium",
     "success_rate": 64, "risk_note": "Abholung kann am Terminal abgelehnt werden.",
     "expires_in_minutes": 55, "minutes_ago": 41},
    {"type": "coupon", "title": "App-Glitch: 10 €-Gutschein ohne Mindestbestellwert", "shop": "Lieferando", "category": "Food",
     "description": "Der 10 €-Gutschein springt auch unterhalb des Mindestbestellwerts an.",
     "why_it_works": "App-Client prüft den Mindestbestellwert erst nach dem Coupon.",
     "original_price": 25.0, "glitched_price": 15.0, "coupon_code": "GLITCH10", "risk_level": "low",
     "success_rate": 88, "risk_note": "Lokal begrenzt, funktioniert in den meisten Städten.",
     "expires_in_minutes": 120, "minutes_ago": 65},
    {"type": "price_error", "title": "Air Max 270 Größen-Preisfehler: 160 € → 79 €", "shop": "Nike", "category": "Sport",
     "description": "Der Sale-Feed setzt bei ausgewählten Größen einen halben Preis – Größenlogik-Fehler.",
     "why_it_works": "Größen-Suffix wird beim Preis-Mapping ignoriert.",
     "original_price": 160.0, "glitched_price": 79.0, "coupon_code": None, "risk_level": "medium",
     "success_rate": 73, "risk_note": "Beliebte Größen sind zuerst weg.",
     "expires_in_minutes": 400, "minutes_ago": 190},
    {"type": "stack", "title": "Beauty-Coupon x20 stapelt auf Reduziertes + 5 €", "shop": "Rossmann", "category": "Beauty",
     "description": "20 %-App-Coupon stapelt auf reduzierte Parfums, zusätzlich greift der 5 €-Coupon.",
     "why_it_works": "Kategoriesperre des Coupons wurde auf der Sale-Seite nicht gesetzt.",
     "original_price": 89.0, "glitched_price": 49.0, "coupon_code": "BEAUTY20", "risk_level": "low",
     "success_rate": 79, "risk_note": "Online + Abholung im Laden möglich.",
     "expires_in_minutes": 260, "minutes_ago": 110},
]


async def seed_if_empty() -> None:
    if await db.glitches.count_documents({}) > 0:
        return
    now = _now()
    docs = []
    for s in SEED_GLITCHES:
        docs.append(
            GlitchDoc(
                type=s["type"], title=s["title"], shop=s["shop"], category=s["category"],
                description=s["description"], why_it_works=s["why_it_works"],
                original_price=_f(s["original_price"]), glitched_price=_f(s["glitched_price"]),
                discount_pct=_discount_pct(_f(s["original_price"]), _f(s["glitched_price"])),
                coupon_code=s.get("coupon_code"), url=None,
                risk_level=s.get("risk_level", "medium"), risk_note=s.get("risk_note", ""),
                success_rate=_i(s.get("success_rate"), 70),
                source_label="DEMO-SEED", scout_model="",
                expires_at=now + timedelta(minutes=_i(s.get("expires_in_minutes"), 60)),
                created_at=now - timedelta(minutes=_i(s.get("minutes_ago"), 30)),
            ).to_mongo()
        )
    await db.glitches.insert_many(docs)
    logger.info(f"Seeded {len(docs)} Demo-Glitches")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


@api_router.get("/")
async def root():
    return {"message": "GlitchRadar.io API", "scout": SCOUT_MODEL}


async def _expire_stale() -> None:
    await db.glitches.update_many(
        {"status": "active", "expires_at": {"$lt": _now()}},
        {"$set": {"status": "expired"}},
    )


@api_router.get("/glitches")
async def list_glitches(type: str = "all", sort: str = "ending", min_discount: int = 0):
    await _expire_stale()
    query: dict = {"status": "active"}
    if type != "all":
        query["type"] = type
    if min_discount > 0:
        query["discount_pct"] = {"$gte": min_discount}
    order = {
        "ending": [("expires_at", 1)],
        "new": [("created_at", -1)],
        "discount": [("discount_pct", -1)],
        "risk": [("success_rate", -1)],
    }.get(sort, [("expires_at", 1)])
    docs = await db.glitches.find(query).sort(order).to_list(80)
    out = []
    for d in docs:
        g = GlitchDoc.from_mongo(d)
        if g:
            out.append(g.out())
    return out


@api_router.get("/glitches/{glitch_id}")
async def get_glitch(glitch_id: str):
    g = GlitchDoc.from_mongo(await db.glitches.find_one({"_id": _parse_oid(glitch_id)}))
    if not g:
        raise HTTPException(status_code=404, detail="Glitch nicht gefunden")
    if g.status == "active" and g.expires_at < _now():
        g.status = "expired"
        await db.glitches.update_one({"_id": g.id}, {"$set": {"status": "expired"}})
    return g.out()


@api_router.post("/glitches/{glitch_id}/report-dead")
async def report_dead(glitch_id: str):
    res = await db.glitches.update_one({"_id": _parse_oid(glitch_id)}, {"$set": {"status": "expired"}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Glitch nicht gefunden")
    return {"ok": True}


@api_router.post("/glitches/{glitch_id}/enrich")
async def enrich_glitch(glitch_id: str):
    g = GlitchDoc.from_mongo(await db.glitches.find_one({"_id": _parse_oid(glitch_id)}))
    if not g:
        raise HTTPException(status_code=404, detail="Glitch nicht gefunden")
    if g.enriched and g.instructions:
        return g.out()
    payload = json.dumps({
        "type": g.type, "title": g.title, "shop": g.shop, "category": g.category,
        "description": g.description, "original_price": g.original_price,
        "glitched_price": g.glitched_price, "coupon_code": g.coupon_code,
        "risk_level": g.risk_level, "expires_at": g.expires_at.isoformat(),
    }, ensure_ascii=False)
    try:
        chat = (
            LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"analyst-{glitch_id}", system_message=ANALYST_SYSTEM)
            .with_model("anthropic", ANALYST_MODEL)
        )
        raw = await asyncio.wait_for(chat.send_message(UserMessage(text=ENRICH_PROMPT.format(payload=payload))), timeout=90)
        data = _extract_json_dict(_as_text(raw))
        updates = {
            "enriched": True,
            "instructions": [_clean_step(s) for s in list(data.get("steps", []))[:8] if str(s).strip()],
            "tips": [str(s).strip() for s in list(data.get("tips", []))[:5] if str(s).strip()],
            "risk_analysis": str(data.get("risk_analysis", "")).strip() or None,
            "time_window_note": str(data.get("time_window_note", "")).strip() or None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enrichment fehlgeschlagen: {e}")
        raise HTTPException(status_code=502, detail="Entschlüsselung fehlgeschlagen. Bitte erneut versuchen.")
    await db.glitches.update_one({"_id": g.id}, {"$set": updates})
    g2 = GlitchDoc.from_mongo(await db.glitches.find_one({"_id": g.id}))
    return g2.out()


scan_lock = asyncio.Lock()


@api_router.post("/scan")
async def run_scan():
    if scan_lock.locked():
        raise HTTPException(status_code=409, detail="SCOUT IST BEREITS AM ARBEITEN — EINEN MOMENT BITTE")
    async with scan_lock:
        return await _run_scan_pipeline()


async def _run_scan_pipeline():
    scan = ScanDoc()
    await db.scans.insert_one(scan.to_mongo())
    try:
        items = await generate_glitches(7)
        if not items:
            raise ValueError("Scout lieferte keine Funde")
        scored = await score_items(items)
        now = _now()
        docs = []
        for it, sc in zip(items, scored):
            if not isinstance(it, dict):
                continue
            original = _f(it.get("original_price"))
            glitched = _f(it.get("glitched_price"))
            if glitched <= 0 or glitched >= original:
                continue
            minutes = max(15, min(480, _i(it.get("expires_in_minutes"), 60)))
            docs.append(
                GlitchDoc(
                    type=str(it.get("type")) if it.get("type") in GLITCH_TYPES else "price_error",
                    title=str(it.get("title", "Unbekannter Glitch"))[:120],
                    shop=str(it.get("shop", "Unbekannt"))[:60],
                    category=str(it.get("category", "Sonstiges"))[:40],
                    description=str(it.get("description", ""))[:500],
                    why_it_works=str(it.get("why_it_works", ""))[:300],
                    original_price=original, glitched_price=glitched,
                    discount_pct=_discount_pct(original, glitched),
                    coupon_code=(str(it["coupon_code"]).strip()[:40] if it.get("coupon_code") else None),
                    url=None,
                    risk_level=sc["risk_level"], risk_note=sc["risk_note"],
                    success_rate=sc["success_rate"],
                    source_label="KI-SCOUT", scout_model=SCOUT_MODEL,
                    expires_at=now + timedelta(minutes=minutes),
                    created_at=now,
                ).to_mongo()
            )
        if not docs:
            raise ValueError("Keine verwertbaren Funde")
        await db.glitches.insert_many(docs)
        total = round(sum(d["original_price"] - d["glitched_price"] for d in docs), 2)
        await db.scans.update_one(
            {"_id": scan.id},
            {"$set": {"status": "done", "finished_at": _now(), "found_count": len(docs), "total_savings": total}},
        )
    except HTTPException:
        await db.scans.update_one(
            {"_id": scan.id},
            {"$set": {"status": "failed", "finished_at": _now(), "error": "aborted"}},
        )
        raise
    except Exception as e:
        logger.error(f"Scan fehlgeschlagen: {e}")
        await db.scans.update_one(
            {"_id": scan.id},
            {"$set": {"status": "failed", "finished_at": _now(), "error": str(e)[:300]}},
        )
        raise HTTPException(status_code=502, detail="Scout-Auftrag fehlgeschlagen. Bitte erneut versuchen.")
    fresh = await db.glitches.find({"status": "active"}).sort([("created_at", -1)]).to_list(len(docs))
    scan_done = ScanDoc.from_mongo(await db.scans.find_one({"_id": scan.id}))
    return {
        "scan": scan_done.out() if scan_done else None,
        "glitches": [GlitchDoc.from_mongo(d).out() for d in fresh],
    }


@api_router.get("/scans/recent")
async def recent_scans():
    docs = await db.scans.find({}).sort([("started_at", -1)]).to_list(10)
    out = []
    for d in docs:
        s = ScanDoc.from_mongo(d)
        if s:
            out.append(s.out())
    return out


@api_router.get("/stats")
async def stats():
    await _expire_stale()
    active_count = await db.glitches.count_documents({"status": "active"})
    expired_count = await db.glitches.count_documents({"status": "expired"})
    savings, avg = 0.0, 0
    agg = await db.glitches.aggregate([
        {"$match": {"status": "active"}},
        {"$group": {
            "_id": None,
            "savings": {"$sum": {"$subtract": ["$original_price", "$glitched_price"]}},
            "avg": {"$avg": "$discount_pct"},
        }},
    ]).to_list(1)
    if agg:
        savings = round(_f(agg[0].get("savings")), 2)
        avg = round(_f(agg[0].get("avg")))
    by_type_rows = await db.glitches.aggregate([
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$type", "n": {"$sum": 1}}},
    ]).to_list(10)
    by_type = {str(r["_id"]): _i(r.get("n")) for r in by_type_rows if r.get("_id")}
    last_scan = ScanDoc.from_mongo(await db.scans.find_one({}, sort=[("started_at", -1)]))
    return {
        "active_count": active_count,
        "expired_count": expired_count,
        "total_found": active_count + expired_count,
        "total_savings_potential": savings,
        "avg_discount": avg,
        "by_type": by_type,
        "last_scan": last_scan.out() if last_scan else None,
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        await seed_if_empty()
    except Exception as e:
        logger.error(f"Seed fehlgeschlagen: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
