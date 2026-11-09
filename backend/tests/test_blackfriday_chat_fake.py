# Iteration 10: Black Friday filter, per-deal KI chat (SSE), Jev fake filter, push register
import json
import os
import re
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
BF_RE = re.compile(r"black ?friday|black ?week|cyber ?monday|black ?deals|singles ?day|#bf\b|bf-?deal|black ?november", re.I)
SESSION = f"TEST_{uuid.uuid4().hex[:12]}"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def any_glitch(s):
    r = s.get(f"{BASE_URL}/api/glitches", timeout=30)
    assert r.status_code == 200 and r.json()
    return r.json()[0]


# Black Friday filter
class TestBlackFriday:
    def test_blackfriday_nonempty_and_matching(self, s):
        r = s.get(f"{BASE_URL}/api/glitches", params={"type": "blackfriday"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0, "blackfriday list empty"
        bad = [d["title"] for d in data if not BF_RE.search((d.get("title") or "") + " " + (d.get("description") or ""))]
        # list truncates description to 220 chars -> verify with detail endpoint
        really_bad = []
        for d in data:
            if d["title"] in bad:
                full = s.get(f"{BASE_URL}/api/glitches/{d['id']}", timeout=30).json()
                if not BF_RE.search((full.get("title") or "") + " " + (full.get("description") or "")):
                    really_bad.append(d["title"])
        print(f"BF count={len(data)} truncated-only matches={len(bad) - len(really_bad)}")
        assert not really_bad, really_bad

    def test_blackfriday_with_search(self, s):
        r = s.get(f"{BASE_URL}/api/glitches", params={"type": "blackfriday", "q": "zzzqqqnotfound"}, timeout=30)
        assert r.status_code == 200 and r.json() == []


# Regression of list + fake filter
class TestListFake:
    @pytest.mark.parametrize("params", [{"type": "all"}, {"type": "delivery"}, {"q": "LEGO"}, {"type": "coupon"},
                                        {"type": "price_error"}, {"sort": "hot"}])
    def test_list_ok_no_fake(self, s, params):
        r = s.get(f"{BASE_URL}/api/glitches", params=params, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for d in data:
            assert (d.get("fake_score") or 0) < 0.75
            assert "_id" not in d
        if params.get("type") in ("all", None) and "q" not in params:
            assert len(data) > 0


# KI chat SSE
class TestDealChat:
    def test_chat_stream_and_history(self, s, any_glitch):
        gid = any_glitch["id"]
        t0 = time.time()
        r = s.post(f"{BASE_URL}/api/glitches/{gid}/chat", json={"session_id": SESSION, "message": "Lohnt sich das?"},
                   stream=True, timeout=120, headers={"Accept": "text/event-stream"})
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/event-stream")
        events, first_at = [], None
        for line in r.iter_lines(decode_unicode=True):
            if line and line.startswith("data: "):
                if first_at is None:
                    first_at = time.time() - t0
                events.append(line[6:])
        assert events and events[-1] == "[DONE]", events[-3:]
        payloads = [json.loads(e) for e in events[:-1]]
        errs = [p for p in payloads if "error" in p]
        assert not errs, errs
        deltas = [p["delta"] for p in payloads if "delta" in p]
        answer = "".join(deltas)
        print(f"deltas={len(deltas)} first_event_after={first_at:.1f}s total={time.time()-t0:.1f}s answer={answer[:300]!r}")
        assert len(deltas) >= 2 and len(answer) > 20
        h = s.get(f"{BASE_URL}/api/glitches/{gid}/chat", params={"session_id": SESSION}, timeout=30)
        assert h.status_code == 200
        hist = h.json()
        assert [m["role"] for m in hist][-2:] == ["user", "assistant"]
        assert hist[-2]["text"] == "Lohnt sich das?"
        assert hist[-1]["text"] == answer

    def test_chat_invalid_id_404(self, s):
        r = s.post(f"{BASE_URL}/api/glitches/000000000000000000000000/chat",
                   json={"session_id": SESSION, "message": "hi"}, timeout=30)
        assert r.status_code == 404

    def test_chat_malformed_id(self, s):
        r = s.post(f"{BASE_URL}/api/glitches/not-an-id/chat", json={"session_id": SESSION, "message": "hi"}, timeout=30)
        print("malformed id status", r.status_code)
        assert r.status_code in (400, 404, 422)

    def test_chat_too_long_422(self, s, any_glitch):
        r = s.post(f"{BASE_URL}/api/glitches/{any_glitch['id']}/chat",
                   json={"session_id": SESSION, "message": "x" * 501}, timeout=30)
        assert r.status_code == 422

    def test_chat_short_session_422(self, s, any_glitch):
        r = s.post(f"{BASE_URL}/api/glitches/{any_glitch['id']}/chat",
                   json={"session_id": "abc", "message": "hi"}, timeout=30)
        assert r.status_code == 422

    def test_history_unknown_session_empty(self, s, any_glitch):
        r = s.get(f"{BASE_URL}/api/glitches/{any_glitch['id']}/chat", params={"session_id": "TEST_none_" + uuid.uuid4().hex},
                  timeout=30)
        assert r.status_code == 200 and r.json() == []


# Push (expected 500 in preview; only validate it does not crash with other codes)
class TestPush:
    def test_register_push_validation(self, s):
        r = s.post(f"{BASE_URL}/api/register-push", json={"user_id": "x", "platform": "ios", "device_token": "short"},
                   timeout=30)
        assert r.status_code == 422
