"""Backend tests for new endpoints: /alarm, /facets, and shops/categories filter on /glitches."""
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

BASE_URL = os.environ.get("GLITCHRADAR_TEST_URL",
                          "https://error-scout-20.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _now():
    return datetime.now(timezone.utc)


@pytest.fixture(scope="module")
def seed_alarm_glitches():
    """Insert 2 synthetic alarm glitches directly into MongoDB and clean up after."""
    async def seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        now = _now()
        docs = [
            {
                "_id": ObjectId(),
                "type": "coupon",
                "title": "TEST_ALARM_EXPIRING",
                "shop": "TestShopExpiring",
                "category": "TestCategoryExpiring",
                "description": "soon to expire",
                "original_price": 100.0,
                "glitched_price": 10.0,
                "discount_pct": 90,
                "currency": "EUR",
                "source": "mydealz",
                "source_url": "https://www.mydealz.de/TEST_alarm_expiring",
                "source_label": "MYDEALZ",
                "status": "active",
                "votes_up": 0, "votes_down": 0,
                "risk_level": "low", "success_rate": 80, "risk_note": "",
                "expires_at": now + timedelta(minutes=10),
                "published_at": now - timedelta(hours=2),
                "created_at": now - timedelta(hours=2),
                "enriched": False, "instructions": [], "tips": [],
            },
            {
                "_id": ObjectId(),
                "type": "price_error",
                "title": "TEST_ALARM_FRESH",
                "shop": "TestShopFresh",
                "category": "TestCategoryFresh",
                "description": "very fresh price error",
                "original_price": 500.0,
                "glitched_price": 50.0,
                "discount_pct": 90,
                "currency": "EUR",
                "source": "mydealz",
                "source_url": "https://www.mydealz.de/TEST_alarm_fresh",
                "source_label": "MYDEALZ",
                "status": "active",
                "votes_up": 0, "votes_down": 0,
                "risk_level": "high", "success_rate": 55, "risk_note": "",
                "expires_at": None,
                "published_at": now - timedelta(minutes=2),
                "created_at": now - timedelta(minutes=2),
                "enriched": False, "instructions": [], "tips": [],
            },
        ]
        try:
            await db.glitches.insert_many(docs)
            return [str(d["_id"]) for d in docs], [d["source_url"] for d in docs]
        finally:
            client.close()

    ids, urls = asyncio.run(seed())

    yield ids

    async def cleanup():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        try:
            await db.glitches.delete_many({"source_url": {"$in": urls}})
        finally:
            client.close()

    asyncio.run(cleanup())


# ---------- /api/alarm ----------
def test_alarm_returns_list_with_schema(session):
    r = session.get(f"{API}/alarm")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for g in data:
        assert g.get("id")
        assert g.get("alarm_reason") in ("expiring", "fresh")
        assert g.get("alarm_deadline")
        # deadline must be ISO 8601
        datetime.fromisoformat(g["alarm_deadline"].replace("Z", "+00:00"))
        assert g.get("status") == "active"


def test_alarm_includes_seeded_items(session, seed_alarm_glitches):
    r = session.get(f"{API}/alarm")
    assert r.status_code == 200
    data = r.json()
    titles = {g["title"]: g for g in data}
    # expiring item should be present
    assert "TEST_ALARM_EXPIRING" in titles, f"expiring seed missing from /alarm: titles={list(titles)}"
    assert titles["TEST_ALARM_EXPIRING"]["alarm_reason"] == "expiring"
    # fresh price error should also be present
    assert "TEST_ALARM_FRESH" in titles, f"fresh seed missing from /alarm"
    assert titles["TEST_ALARM_FRESH"]["alarm_reason"] == "fresh"


# ---------- /api/facets ----------
def test_facets_schema(session):
    r = session.get(f"{API}/facets")
    assert r.status_code == 200
    data = r.json()
    assert "shops" in data and isinstance(data["shops"], list)
    assert "categories" in data and isinstance(data["categories"], list)
    for row in data["shops"] + data["categories"]:
        assert "name" in row and "count" in row
        assert isinstance(row["count"], int) and row["count"] > 0


def test_facets_excludes_placeholder_shops(session):
    r = session.get(f"{API}/facets")
    assert r.status_code == 200
    shops = [s["name"] for s in r.json()["shops"]]
    for name in shops:
        assert not str(name).endswith("-Fund"), f"placeholder shop leaked: {name}"
        assert name != "Online-Deal", "Online-Deal placeholder leaked"


# ---------- /api/glitches shops/categories filter ----------
def test_glitches_filter_by_shop(session, seed_alarm_glitches):
    r = session.get(f"{API}/glitches", params={"shops": "TestShopExpiring"})
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    for g in items:
        assert g["shop"] == "TestShopExpiring"


def test_glitches_filter_by_multiple_shops(session, seed_alarm_glitches):
    r = session.get(f"{API}/glitches",
                    params={"shops": "TestShopExpiring,TestShopFresh"})
    assert r.status_code == 200
    shops = {g["shop"] for g in r.json()}
    assert shops.issubset({"TestShopExpiring", "TestShopFresh"})
    assert len(shops) >= 2


def test_glitches_filter_by_category(session, seed_alarm_glitches):
    r = session.get(f"{API}/glitches",
                    params={"categories": "TestCategoryExpiring"})
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    for g in items:
        assert g["category"] == "TestCategoryExpiring"


def test_glitches_empty_filter_regression(session, seed_alarm_glitches):
    """Empty shops/categories = no filtering (regression for favourites OFF)."""
    r = session.get(f"{API}/glitches", params={"shops": "", "categories": ""})
    assert r.status_code == 200
    assert len(r.json()) > 1, "empty filter should still return many glitches"


def test_glitches_filter_unknown_shop_returns_empty(session):
    r = session.get(f"{API}/glitches", params={"shops": "ThisShopDoesNotExist_XYZ"})
    assert r.status_code == 200
    assert r.json() == []
