"""Seed/cleanup a TEST_ alarm glitch for UI testing. Usage: python seed_alarm_ui.py seed|clean"""
import sys
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from pymongo import MongoClient

db = MongoClient("mongodb://localhost:27017")["test_database"]
URL = "https://www.mydealz.de/TEST_alarm_ui_iter6"
if sys.argv[1] == "seed":
    now = datetime.now(timezone.utc)
    db.glitches.delete_many({"source_url": URL})
    db.glitches.insert_one({
        "_id": ObjectId(), "type": "price_error", "title": "TEST_ALARM_UI Preisfehler",
        "shop": "TestShop", "category": "Test", "description": "Frischer Preisfehler zum Testen",
        "original_price": 500.0, "glitched_price": 50.0, "discount_pct": 90, "currency": "EUR",
        "source": "mydealz", "source_url": URL, "source_label": "MYDEALZ", "status": "active",
        "votes_up": 0, "votes_down": 0, "risk_level": "low", "success_rate": 80, "risk_note": "",
        "published_at": now - timedelta(minutes=1), "created_at": now,
        "enriched": False, "instructions": [], "tips": [],
    })
    print("seeded")
else:
    print("deleted", db.glitches.delete_many({"source_url": URL}).deleted_count)
