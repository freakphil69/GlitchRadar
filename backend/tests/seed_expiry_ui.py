# Seed/cleanup TEST_ glitches for expiry-badge UI test. Usage: python seed_expiry_ui.py seed|clean
import os, sys, json
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
IDS_FILE = "/tmp/expiry_seed_ids.json"


def seed():
    now = datetime.now(timezone.utc)
    today = now.strftime("%d.%m.")
    tomorrow = (now + timedelta(days=1)).strftime("%d.%m.")
    later = (now + timedelta(days=10)).strftime("%d.%m.%Y")
    specs = [
        ("today", f"gültig bis {today}"),
        ("tomorrow", f"gültig bis {tomorrow}"),
        ("later", f"gültig bis {later}"),
    ]
    ids = {}
    for i, (k, desc) in enumerate(specs):
        doc = {
            "type": "coupon", "title": f"TEST_Expiry {k} Coupon", "shop": "TEST_Shop", "category": "Sonstiges",
            "description": f"10€ Gutschein, {desc}", "why_it_works": "", "currency": "EUR", "discount_pct": 10,
            "source": "mydealz", "source_url": f"https://example.com/test-expiry-{k}", "votes_up": 0, "votes_down": 0,
            "risk_level": "low", "risk_note": "", "success_rate": 80, "source_label": "MYDEALZ", "scout_model": "",
            "status": "active", "enriched": False, "instructions": [], "tips": [],
            "published_at": now + timedelta(minutes=5 - i), "created_at": now,
        }
        ids[k] = str(db.glitches.insert_one(doc).inserted_id)
    json.dump(ids, open(IDS_FILE, "w"))
    print(json.dumps({"ids": ids, "today": today, "tomorrow": tomorrow, "later": later}))


def clean():
    ids = json.load(open(IDS_FILE))
    r = db.glitches.delete_many({"_id": {"$in": [ObjectId(v) for v in ids.values()]}})
    print("deleted", r.deleted_count)


if __name__ == "__main__":
    seed() if sys.argv[1] == "seed" else clean()
