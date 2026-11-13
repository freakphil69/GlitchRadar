"""Two-stage offer admission. Callers must provide real source/product checks.

This module does not install itself in the scanner or migrate existing rows.
Only a successful, fresh check before AND after insertion may activate a row.
"""
import asyncio
import copy
import hashlib
import json
import math
import uuid
from datetime import datetime, timedelta, timezone

FIELDS = ("source_url", "url", "affiliate_url", "title", "shop", "product_id",
          "glitched_price", "original_price", "currency", "description",
          "coupon_code", "expires_at", "type", "category")
TTL = timedelta(minutes=15)


def utcnow():
    return datetime.now(timezone.utc)


def identity(doc):
    def value(item):
        if isinstance(item, datetime):
            aware = item if item.tzinfo else item.replace(tzinfo=timezone.utc)
            return aware.astimezone(timezone.utc).isoformat(timespec="milliseconds")
        return item
    fields = {key: value(doc.get(key)) for key in FIELDS}
    return hashlib.sha256(json.dumps(fields, sort_keys=True, ensure_ascii=False,
                                    allow_nan=False).encode()).hexdigest()


def stamp(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Timezone required")
    return parsed


def stage_valid(doc, stage, now):
    try:
        if stage["identity"] != identity(doc):
            return False
        started = stamp(stage["started_at"])
        if not timedelta(0) <= now - started <= TTL:
            return False
        price = doc.get("glitched_price")
        if isinstance(price, bool) or not isinstance(price, (int, float)):
            return False
        if not math.isfinite(price) or price < 0 or not doc.get("product_id"):
            return False
        expiry = doc.get("expires_at")
        if expiry:
            expiry = stamp(expiry) if isinstance(expiry, str) else expiry
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            if expiry <= now:
                return False
        for label, field in (("source", "source_url"), ("product", "url"),
                             ("affiliate", "affiliate_url")):
            if label == "affiliate" and not doc.get(field):
                continue
            proof = stage["checks"][label]
            if not doc.get(field) or proof.get("passed") is not True or proof.get("url") != doc[field]:
                return False
            if not started <= stamp(proof["checked_at"]) <= now:
                return False
            if label != "source":
                expected = {"title": doc.get("title"), "product_id": doc["product_id"],
                            "price": price, "currency": doc.get("currency", "EUR")}
                if isinstance(proof.get("price"), bool) or any(proof.get(k) != v for k, v in expected.items()):
                    return False
        return True
    except (KeyError, TypeError, ValueError, AttributeError, OverflowError):
        return False


def admission_valid(doc, now=None):
    now = now or utcnow()
    admission = doc.get("admission") or {}
    return (admission.get("state") == "verified"
            and stage_valid(doc, admission.get("before"), now)
            and stage_valid(doc, admission.get("after"), now))


async def run_stage(doc, verify, timeout):
    stage = {"identity": identity(doc), "started_at": utcnow().isoformat(), "checks": {}}
    try:
        checks = await asyncio.wait_for(verify(copy.deepcopy(doc)), timeout=timeout)
        stage["checks"] = copy.deepcopy(checks) if isinstance(checks, dict) else {}
    except (asyncio.TimeoutError, OSError, ValueError, TypeError, OverflowError):
        stage["error"] = "verification_failed"
    return stage


async def admit_offer(collection, candidate, verify, timeout=30):
    """Return the activated row or None. Storage errors are not reported as passes.

    verify(doc) must do new checks and return source/product/optional affiliate
    proof dictionaries. HTTP 200 alone is NOT sufficient product evidence.
    """
    doc = copy.deepcopy(candidate)
    doc.setdefault("currency", "EUR")
    before = await run_stage(doc, verify, timeout)
    token = uuid.uuid4().hex
    doc.update(status="pending_review", link_check=None, affiliate_check=None,
               admission={"state": "pending", "token": token, "before": before})
    result = await collection.insert_one(doc)
    doc.setdefault("_id", result.inserted_id)
    stored = await collection.find_one({"_id": doc["_id"]})
    if stored is None or identity(stored) != identity(doc):
        return None
    after = await run_stage(stored, verify, timeout)
    now = utcnow()
    passed = stage_valid(stored, before, now) and stage_valid(stored, after, now)
    admission = {"state": "verified" if passed else "quarantined", "token": token,
                 "before": before, "after": after}
    updates = {"admission": admission, "status": "active" if passed else "pending_review",
               "link_check": after["checks"].get("product") if passed else None,
               "affiliate_check": after["checks"].get("affiliate") if passed else None}
    query = {"_id": doc["_id"], "status": "pending_review", "admission.token": token}
    query.update({key: stored.get(key) for key in FIELDS})
    result = await collection.update_one(query, {"$set": updates})
    if passed and result.modified_count == 1:
        return {**stored, **updates}
    return None
