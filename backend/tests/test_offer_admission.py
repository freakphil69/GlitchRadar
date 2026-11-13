"""Offline admission state-machine tests, not a running-backend test."""
import asyncio
import copy
import sys
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import offer_admission as admission


class Collection:
    def __init__(self):
        self.row = None
        self.fail_insert = False
        self.fail_update = False
        self.change_on_read = False
        self.change_before_update = False
        self.status_before_update = None
        self.lost_update = False

    async def insert_one(self, row):
        if self.fail_insert:
            raise RuntimeError("database unavailable")
        assert row["status"] == "pending_review"
        assert row["link_check"] is None
        row.setdefault("_id", "test-id")
        self.row = copy.deepcopy(row)
        return SimpleNamespace(inserted_id=row["_id"])

    async def find_one(self, query):
        if self.change_on_read:
            self.row["glitched_price"] = 999
        return copy.deepcopy(self.row)

    async def update_one(self, query, update):
        if self.fail_update:
            raise RuntimeError("database unavailable")
        if self.change_before_update:
            self.row["url"] = "https://shop.example/changed"
        if self.status_before_update:
            self.row["status"] = self.status_before_update
        actual = {**self.row, "admission.token": self.row["admission"]["token"]}
        if self.lost_update or any(actual.get(k) != v for k, v in query.items()):
            return SimpleNamespace(modified_count=0)
        self.row.update(copy.deepcopy(update["$set"]))
        return SimpleNamespace(modified_count=1)


def candidate():
    return dict(source_url="https://source.example/post", url="https://shop.example/product",
                affiliate_url=None, title="Exact", shop="Shop", product_id="sku",
                glitched_price=50, currency="EUR")


def proofs(doc):
    checked_at = admission.utcnow().isoformat()
    result = {"source": {"passed": True, "url": doc["source_url"], "checked_at": checked_at}}
    for label, field in (("product", "url"), ("affiliate", "affiliate_url")):
        if doc.get(field):
            result[label] = dict(passed=True, url=doc[field], checked_at=checked_at,
                title=doc["title"], product_id=doc["product_id"], price=doc["glitched_price"], currency=doc["currency"])
    return result


@pytest.mark.parametrize("scenario", [
    "pass", "affiliate-pass", "first-fails", "second-fails", "source-fails",
    "affiliate-fails", "cached-second-proof", "changed-after-insert", "changed-before-activation",
    "expired-before-activation", "lost-update", "insert-failure", "update-failure",
    "timeout", "wrong-price-proof", "malformed-result", "negative-price", "boolean-price",
    "missing-product", "missing-source", "missing-url",
])
def test_two_stage_admission(scenario):
    async def run():
        collection = Collection()
        doc = candidate()
        calls = []
        cached = None
        if scenario in ("affiliate-pass", "affiliate-fails"):
            doc["affiliate_url"] = "https://affiliate.example/product"
        if scenario == "negative-price": doc["glitched_price"] = -1
        if scenario == "boolean-price": doc["glitched_price"] = True
        if scenario == "missing-product": doc["product_id"] = None
        if scenario == "missing-source": doc["source_url"] = ""
        if scenario == "missing-url": doc["url"] = None
        collection.change_on_read = scenario == "changed-after-insert"
        collection.change_before_update = scenario == "changed-before-activation"
        collection.status_before_update = "expired" if scenario == "expired-before-activation" else None
        collection.lost_update = scenario == "lost-update"
        collection.fail_insert = scenario == "insert-failure"
        collection.fail_update = scenario == "update-failure"

        async def verify(snapshot):
            nonlocal cached
            calls.append(snapshot)
            if len(calls) == 2:
                assert collection.row["status"] == "pending_review"
            if scenario == "timeout":
                await asyncio.sleep(0.02)
            check = proofs(snapshot)
            if scenario == "first-fails" and len(calls) == 1: check["product"]["passed"] = False
            if scenario == "second-fails" and len(calls) == 2: check["product"]["passed"] = False
            if scenario == "source-fails": check["source"]["passed"] = False
            if scenario == "affiliate-fails": check["affiliate"]["passed"] = False
            if scenario == "wrong-price-proof": check["product"]["price"] = 49
            if scenario == "malformed-result": return True
            if scenario == "cached-second-proof":
                if cached is None: cached = copy.deepcopy(check)
                else: return cached
            return check

        if scenario in ("insert-failure", "update-failure"):
            with pytest.raises(RuntimeError):
                await admission.admit_offer(collection, doc, verify)
            if collection.row:
                assert collection.row["status"] == "pending_review"
            return
        result = await admission.admit_offer(collection, doc, verify, timeout=0.001 if scenario == "timeout" else 1)
        expected = scenario in ("pass", "affiliate-pass")
        assert (result is not None) is expected
        if expected:
            assert len(calls) == 2
            assert collection.row["status"] == "active"
            assert admission.admission_valid(collection.row)
            assert not admission.admission_valid(collection.row, admission.utcnow() + timedelta(minutes=16))
            changed = copy.deepcopy(collection.row)
            changed["coupon_code"] = "CHANGED"
            assert not admission.admission_valid(changed)
        else:
            assert collection.row["status"] != "active"
        assert "status" not in doc
    asyncio.run(run())
