import asyncio, os, pytest, sys
from mongomock_motor import AsyncMongoMockClient
sys.path.insert(0,"/tmp/gr/backend"); import ai_budget
K=["AI_ENABLED","AI_SCORING_ENABLED","AI_ENRICH_ENABLED","AI_DAILY_CALL_LIMIT","AI_TOTAL_CALL_LIMIT"]
def env(**kw):
    for k in K: os.environ.pop(k,None)
    os.environ.update({k:str(v) for k,v in kw.items()})
@pytest.mark.asyncio
async def test_default_on_like_before():
    env(); db=AsyncMongoMockClient()["t"]
    assert await ai_budget.reserve(db,"enrich") and await ai_budget.reserve(db,"scoring")
@pytest.mark.asyncio
async def test_master_switch_off():
    env(AI_ENABLED="false"); assert not await ai_budget.reserve(AsyncMongoMockClient()["t"],"enrich")
@pytest.mark.asyncio
async def test_daily_limit_parallel():
    env(AI_DAILY_CALL_LIMIT=3); db=AsyncMongoMockClient()["t"]
    assert sum(await asyncio.gather(*[ai_budget.reserve(db,"enrich") for _ in range(10)]))==3
@pytest.mark.asyncio
async def test_total_limit():
    env(AI_TOTAL_CALL_LIMIT=2); db=AsyncMongoMockClient()["t"]
    assert sum([await ai_budget.reserve(db,"scoring") for _ in range(5)])==2
@pytest.mark.asyncio
async def test_db_failure_blocks():
    env()
    class B:
        def __getattr__(s,n): raise RuntimeError
    assert not await ai_budget.reserve(B(),"enrich")
