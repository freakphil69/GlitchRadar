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
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator
from starlette.middleware.cors import CORSMiddleware

from emergentintegrations.llm.chat import LlmChat, UserMessage

from urllib.parse import quote

from auth import ensure_auth_indexes, make_auth
from feeds import FEEDS, fetch_all_feeds

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

GLITCH_TYPES = {"price_error", "coupon", "cashback", "shipping", "stack", "deal"}
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


# Affiliate links: only real, configured partner IDs ever produce an affiliate link.
# AWIN_PUBLISHER_ID = your Awin publisher id; AWIN_ADVERTISER_IDS = "zalando=1234,otto=5678"
# (advertiser ids from each program you were accepted into); AMAZON_PARTNER_TAG = "name-21".
SHOP_HOMEPAGES = {
    "zalando": "https://www.zalando.de/",
    "mediamarkt": "https://www.mediamarkt.de/",
    "saturn": "https://www.saturn.de/",
    "otto": "https://www.otto.de/",
    "decathlon": "https://www.decathlon.de/",
    "amazon": "https://www.amazon.de/",
    "amazon marketplace": "https://www.amazon.de/",
    "about you": "https://www.aboutyou.de/",
    "ikea": "https://www.ikea.com/de/de/",
    "lieferando": "https://www.lieferando.de/",
    "nike": "https://www.nike.com/de/",
    "adidas": "https://www.adidas.de/",
    "rossmann": "https://www.rossmann.de/",
    "dm": "https://www.dm.de/",
    "douglas": "https://www.douglas.de/",
    "lidl": "https://www.lidl.de/",
    "kaufland": "https://www.kaufland.de/",
    "ebay": "https://www.ebay.de/",
    "notebooksbilliger": "https://www.notebooksbilliger.de/",
    "cyberport": "https://www.cyberport.de/",
    "alternate": "https://www.alternate.de/",
    "galaxus": "https://www.galaxus.de/",
    "google store": "https://store.google.com/de/",
    "apple": "https://www.apple.com/de/",
}


def _awin_advertisers() -> dict:
    out = {}
    for pair in os.environ.get("AWIN_ADVERTISER_IDS", "").split(","):
        if "=" in pair:
            k, v = pair.split("=", 1)
            if k.strip() and v.strip().isdigit():
                out[k.strip().lower()] = v.strip()
    return out


def build_affiliate_link(shop: str) -> tuple[Optional[str], Optional[str]]:
    key = (shop or "").strip().lower()
    base_url = SHOP_HOMEPAGES.get(key)
    if not base_url:
        return None, None
    amazon_tag = os.environ.get("AMAZON_PARTNER_TAG", "").strip()
    if key.startswith("amazon") and amazon_tag:
        return base_url, f"{base_url}?tag={quote(amazon_tag)}"
    publisher = os.environ.get("AWIN_PUBLISHER_ID", "").strip()
    advertiser = _awin_advertisers().get(key)
    if publisher and advertiser:
        aff = (f"https://www.awin1.com/cread.php?awinmid={advertiser}"
               f"&awinaffid={quote(publisher)}&ued={quote(base_url, safe='')}")
        return base_url, aff
    return base_url, None


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
    original_price: Optional[float] = None
    glitched_price: Optional[float] = None
    currency: str = "EUR"
    discount_pct: int = 0
    coupon_code: Optional[str] = None
    url: Optional[str] = None
    affiliate_url: Optional[str] = None
    image_url: Optional[str] = None
    source: str = "mydealz"
    source_url: str = ""
    temperature: Optional[int] = None
    votes_up: int = 0
    votes_down: int = 0
    risk_level: str = "medium"
    risk_note: str = ""
    risk_analysis: Optional[str] = None
    success_rate: int = 60
    source_label: str = "MYDEALZ"
    scout_model: str = ""
    status: str = "active"
    enriched: bool = False
    instructions: List[str] = Field(default_factory=list)
    tips: List[str] = Field(default_factory=list)
    time_window_note: Optional[str] = None
    expires_at: Optional[datetime] = None
    published_at: datetime = Field(default_factory=_now)
    created_at: datetime = Field(default_factory=_now)

    @field_validator("expires_at", "published_at", "created_at", mode="after")
    @classmethod
    def _tz_glitch(cls, v: Optional[datetime]) -> Optional[datetime]:
        return _ensure_tz(v) if v else v

    def out(self) -> dict:
        d = super().out()
        if not d.get("url") or not d.get("affiliate_url"):
            base, aff = build_affiliate_link(self.shop)
            d["url"] = d.get("url") or base
            d["affiliate_url"] = d.get("affiliate_url") or aff
        return d


class ScanDoc(BaseDocument):
    started_at: datetime = Field(default_factory=_now)
    finished_at: Optional[datetime] = None
    status: str = "running"
    model_primary: str = "RSS · MYDEALZ + DEALDOKTOR"
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

ENRICH_PROMPT = """Analysiere diesen ECHTEN, online gefundenen Deal (aus einem öffentlichen Deal-Feed) und erstelle den Ausführungsplan.
Erfinde KEINE Fakten, Codes oder Preise, die nicht im Fund stehen. Wenn etwas unklar ist, sag, dass man es im Original-Beitrag prüfen soll.
FUND:
{payload}

Erstelle:
- "steps": 4-6 konkrete Schritte auf Deutsch (kurz, imperativ; z.B. Original-Beitrag öffnen, Preis im Shop prüfen, Code im Warenkorb eingeben).
- "tips": 2-4 kurze Profi-Tipps (z.B. Screenshot vom Preis machen, Käuferschutz nutzen, nicht mehr bestellen als gebraucht).
- "risk_analysis": 2-3 Sätze Risiko-Bewertung (Stornorisiko bei Preisfehlern, Limits, Ablauf).
- "time_window_note": 1 Satz, wie lange solche Deals erfahrungsgemäß halten.
Antworte NUR mit JSON: {{"steps": ["..."], "tips": ["..."], "risk_analysis": "...", "time_window_note": "..."}}"""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


@api_router.get("/")
async def root():
    return {"message": "GlitchRadar.io API", "sources": [f[2] for f in FEEDS]}


async def _expire_stale() -> None:
    now = _now()
    await db.glitches.update_many(
        {"status": "active", "$or": [
            {"expires_at": {"$ne": None, "$lt": now}},
            {"published_at": {"$lt": now - timedelta(hours=STALE_HOURS)}},
        ]},
        {"$set": {"status": "expired"}},
    )


IMG_HOSTS = ("static.mydealz.de", "www.dealdoktor.de", "dealdoktor.de", "static.preisjaeger.at",
             "www.mytopdeals.net", "mytopdeals.net", "www.sparhamster.at", "sparhamster.at")


@api_router.get("/img")
async def image_proxy(u: str):
    # Web preview only: mydealz images send Cross-Origin-Resource-Policy: same-origin.
    from urllib.parse import urlparse
    host = urlparse(u).hostname or ""
    if urlparse(u).scheme != "https" or host not in IMG_HOSTS:
        raise HTTPException(status_code=400, detail="Host nicht erlaubt")
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as hc:
        r = await hc.get(u, headers={"User-Agent": "Mozilla/5.0 (compatible; GlitchRadar/1.0)"})
    if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image/"):
        raise HTTPException(status_code=404, detail="Bild nicht gefunden")
    return Response(content=r.content, media_type=r.headers["content-type"],
                    headers={"Cache-Control": "public, max-age=86400"})


@api_router.get("/glitches")
async def list_glitches(type: str = "all", sort: str = "new", min_discount: int = 0,
                        shops: str = "", categories: str = "", q: str = ""):
    await _expire_stale()
    query: dict = {"status": "active"}
    term = q.strip()[:80]
    if term:
        words = [re.escape(w) for w in term.split() if w][:6]
        query["$and"] = [{"$or": [
            {"title": {"$regex": w, "$options": "i"}},
            {"shop": {"$regex": w, "$options": "i"}},
            {"description": {"$regex": w, "$options": "i"}},
            {"category": {"$regex": w, "$options": "i"}},
        ]} for w in words]
    if type == "delivery":
        query.setdefault("$and", []).append({"$or": [
            {"source_label": {"$regex": "LIEFER|FAST FOOD"}},
            {"title": {"$regex": DELIVERY_RE, "$options": "i"}},
            {"shop": {"$regex": DELIVERY_RE, "$options": "i"}},
        ]})
    elif type != "all":
        query["type"] = type
        query["discount_pct"] = {"$gte": min_discount}
    shop_list = [s.strip() for s in shops.split(",") if s.strip()][:50]
    cat_list = [c.strip() for c in categories.split(",") if c.strip()][:50]
    if shop_list:
        query["shop"] = {"$in": shop_list}
    if cat_list:
        query["category"] = {"$in": cat_list}
    order = {
        "new": [("published_at", -1)],
        "hot": [("temperature", -1), ("published_at", -1)],
        "discount": [("discount_pct", -1), ("published_at", -1)],
        "risk": [("success_rate", -1), ("published_at", -1)],
    }.get(sort, [("published_at", -1)])
    docs = await db.glitches.find(query).sort(order).to_list(100)
    out = []
    for d in docs:
        g = GlitchDoc.from_mongo(d)
        if g:
            out.append(g.out())
    return out


ALARM_MINUTES = 15
DELIVERY_RE = (r"lieferando|wolt|uber ?eats|foodora|domino|burger ?king|mc ?donald|kfc|subway|pizza|"
               r"flink|getir|knuspr|picnic|hellofresh|marley ?spoon|too ?good ?to ?go|lieferdienst|lieferservice|fast ?food")


@api_router.get("/alarm")
async def glitch_alarm():
    """Urgent finds: expiring within 15 min, or price errors fresher than 15 min."""
    await _expire_stale()
    now = _now()
    window = timedelta(minutes=ALARM_MINUTES)
    docs = await db.glitches.find({"status": "active", "$or": [
        {"expires_at": {"$gte": now, "$lte": now + window}},
        {"type": "price_error", "published_at": {"$gte": now - window}},
    ]}).sort([("published_at", -1)]).to_list(10)
    out = []
    for d in docs:
        g = GlitchDoc.from_mongo(d)
        item = g.out()
        if g.expires_at and now <= g.expires_at <= now + window:
            item["alarm_reason"] = "expiring"
            item["alarm_deadline"] = g.expires_at.isoformat()
        else:
            item["alarm_reason"] = "fresh"
            item["alarm_deadline"] = (g.published_at + window).isoformat()
        out.append(item)
    return out


@api_router.get("/facets")
async def facets():
    async def top(field: str) -> list:
        rows = await db.glitches.aggregate([
            {"$match": {"status": "active", field: {"$nin": [None, ""]}}},
            {"$group": {"_id": f"${field}", "n": {"$sum": 1}}},
            {"$sort": {"n": -1, "_id": 1}},
            {"$limit": 40},
        ]).to_list(40)
        return [{"name": r["_id"], "count": r["n"]} for r in rows
                if not (field == "shop" and (str(r["_id"]).endswith("-Fund") or r["_id"] == "Online-Deal"))]
    return {"shops": await top("shop"), "categories": await top("category")}


@api_router.get("/codes")
async def list_codes(shop: str = "all"):
    await _expire_stale()
    query: dict = {"status": "active", "coupon_code": {"$ne": None}}
    if shop != "all":
        query["shop"] = shop
    docs = await db.glitches.find(query).sort([("published_at", -1)]).to_list(100)
    return [GlitchDoc.from_mongo(d).out() for d in docs]


class VoteIn(BaseModel):
    up: bool


@api_router.post("/glitches/{glitch_id}/vote")
async def vote_glitch(glitch_id: str, body: VoteIn):
    field = "votes_up" if body.up else "votes_down"
    res = await db.glitches.update_one({"_id": _parse_oid(glitch_id)}, {"$inc": {field: 1}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Glitch nicht gefunden")
    g = GlitchDoc.from_mongo(await db.glitches.find_one({"_id": _parse_oid(glitch_id)}))
    return g.out()


@api_router.get("/glitches/{glitch_id}")
async def get_glitch(glitch_id: str):
    g = GlitchDoc.from_mongo(await db.glitches.find_one({"_id": _parse_oid(glitch_id)}))
    if not g:
        raise HTTPException(status_code=404, detail="Glitch nicht gefunden")
    if g.status == "active" and g.expires_at and g.expires_at < _now():
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
        "risk_level": g.risk_level, "published_at": g.published_at.isoformat(),
        "source": g.source_label, "source_url": g.source_url,
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
STALE_HOURS = 72
POLL_SECONDS = 600
DEFAULT_RISK = {
    "price_error": ("high", 50, "Preisfehler werden oft storniert – Bestellung kann abgelehnt werden."),
    "coupon": ("low", 75, "Codes sind meist offiziell, können aber limitiert sein."),
    "stack": ("medium", 60, "Kombinationen werden oft schnell gesperrt."),
}


async def ingest_feeds() -> dict:
    scan = ScanDoc()
    await db.scans.insert_one(scan.to_mongo())
    items, ok_feeds = await fetch_all_feeds()
    if ok_feeds == 0:
        await db.scans.update_one(
            {"_id": scan.id},
            {"$set": {"status": "failed", "finished_at": _now(), "error": "Keine Quelle erreichbar"}},
        )
        raise HTTPException(status_code=502, detail="Keine Deal-Quelle erreichbar. Bitte später erneut versuchen.")

    urls = [it["source_url"] for it in items]
    existing = {d["source_url"] async for d in db.glitches.find({"source_url": {"$in": urls}}, {"source_url": 1})}
    fresh = [it for it in items if it["source_url"] not in existing][:60]

    scores: List[dict] = []
    for i in range(0, len(fresh), 25):
        batch = fresh[i:i + 25]
        compact = [
            {"title": b["title"], "shop": b["shop"], "type": b["type"], "price": b["glitched_price"],
             "statt": b["original_price"], "rabatt_pct": b["discount_pct"], "code": b["coupon_code"]}
            for b in batch
        ]
        llm = await score_items(compact)
        for b, sc in zip(batch, llm):
            if not sc.get("risk_note"):
                risk, rate, note = DEFAULT_RISK.get(b["type"], ("medium", 65, "Deal im Original-Beitrag prüfen."))
                sc = {"risk_level": risk, "success_rate": rate, "risk_note": note}
            scores.append(sc)

    docs = []
    for it, sc in zip(fresh, scores):
        docs.append(GlitchDoc(**it, risk_level=sc["risk_level"], success_rate=sc["success_rate"],
                              risk_note=sc["risk_note"], scout_model=SCORER_MODEL).to_mongo())
    if docs:
        try:
            await db.glitches.insert_many(docs, ordered=False)
        except Exception as e:  # duplicate source_url races are harmless
            logger.warning(f"Insert teilweise übersprungen: {e}")

    total = round(sum((d["original_price"] - d["glitched_price"]) for d in docs
                      if d.get("original_price") and d.get("glitched_price") is not None), 2)
    await db.scans.update_one(
        {"_id": scan.id},
        {"$set": {"status": "done", "finished_at": _now(), "found_count": len(docs), "total_savings": total}},
    )
    scan_done = ScanDoc.from_mongo(await db.scans.find_one({"_id": scan.id}))
    new_docs = await db.glitches.find({"source_url": {"$in": [d["source_url"] for d in docs]}}).to_list(len(docs) or 1)
    return {"scan": scan_done.out(), "glitches": [GlitchDoc.from_mongo(d).out() for d in new_docs] if docs else []}


async def _poll_loop() -> None:
    while True:
        try:
            if not scan_lock.locked():
                async with scan_lock:
                    res = await ingest_feeds()
                    logger.info(f"Hintergrund-Scan: {res['scan']['found_count']} neue Funde")
        except Exception as e:
            logger.warning(f"Hintergrund-Scan fehlgeschlagen: {e}")
        await asyncio.sleep(POLL_SECONDS)


@api_router.post("/scan")
async def run_scan():
    if scan_lock.locked():
        raise HTTPException(status_code=409, detail="SCOUT IST BEREITS AM ARBEITEN — EINEN MOMENT BITTE")
    async with scan_lock:
        return await ingest_feeds()


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
        {"$match": {"status": "active", "original_price": {"$ne": None}, "glitched_price": {"$ne": None}}},
        {"$group": {
            "_id": None,
            "savings": {"$sum": {"$subtract": ["$original_price", "$glitched_price"]}},
        }},
    ]).to_list(1)
    avg_rows = await db.glitches.aggregate([
        {"$match": {"status": "active", "discount_pct": {"$gt": 0}}},
        {"$group": {"_id": None, "avg": {"$avg": "$discount_pct"}}},
    ]).to_list(1)
    if agg:
        savings = round(_f(agg[0].get("savings")), 2)
    if avg_rows:
        avg = round(_f(avg_rows[0].get("avg")))
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


auth_router, current_user = make_auth(db)


class StashIn(BaseModel):
    items: List[dict] = Field(default_factory=list, max_length=500)


@api_router.get("/stash")
async def get_stash(request: Request):
    user = await current_user(request)
    doc = await db.stashes.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"items": (doc or {}).get("items", [])}


@api_router.put("/stash")
async def put_stash(body: StashIn, request: Request):
    user = await current_user(request)
    await db.stashes.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"user_id": user["user_id"], "items": body.items, "updated_at": _now()}},
        upsert=True,
    )
    return {"ok": True, "count": len(body.items)}


@api_router.get("/hall-of-fame")
async def hall_of_fame(limit: int = 20):
    docs = await db.glitches.aggregate([
        {"$match": {"$or": [{"type": "price_error"}, {"discount_pct": {"$gte": 50}}]}},
        {"$addFields": {"saving": {"$cond": [
            {"$and": [{"$gt": ["$original_price", None]}, {"$gt": ["$glitched_price", None]}]},
            {"$subtract": ["$original_price", "$glitched_price"]}, 0]}}},
        {"$sort": {"saving": -1, "discount_pct": -1, "temperature": -1}},
        {"$limit": max(1, min(limit, 50))},
    ]).to_list(50)
    out = []
    for d in docs:
        g = GlitchDoc.from_mongo(d)
        if g:
            item = g.out()
            item["saving"] = round(_f(d.get("saving")), 2)
            out.append(item)
    return out


app.include_router(api_router)
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    # Remove every AI-simulated or demo find — only real online finds stay.
    removed = await db.glitches.delete_many({"$or": [
        {"source_label": {"$in": ["KI-SCOUT", "DEMO-SEED"]}},
        {"source_url": {"$exists": False}},
    ]})
    if removed.deleted_count:
        logger.info(f"{removed.deleted_count} simulierte Funde entfernt")
    await db.glitches.create_index("source_url", unique=True)
    await db.scans.update_many({"status": "running"}, {"$set": {"status": "failed", "error": "Server-Neustart"}})
    await ensure_auth_indexes(db)
    await db.glitches.create_index([("status", 1), ("published_at", -1)])
    asyncio.create_task(_poll_loop())


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
