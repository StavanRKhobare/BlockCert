"""G8: the limitations endpoint returns a non-empty, well-formed list."""

import asyncio

import httpx


def test_limitations_documented():
    from main import app

    async def _fetch():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            return await client.get("/status/limitations")

    # Served over HTTP, not introspected: this FastAPI version keeps
    # included routers as lazy _IncludedRouter wrappers until requests
    # flow, so app.routes never lists them (observed, not assumed).
    response = asyncio.run(_fetch())
    assert response.status_code == 200
    items = response.json()

    assert isinstance(items, list) and len(items) > 0
    assert all(
        isinstance(item.get("id"), str)
        and isinstance(item.get("summary"), str)
        and item["id"]
        and item["summary"]
        for item in items
    )
    assert len({item["id"] for item in items}) == len(items)

    print(f"[G8] limitations_documented={len(items)}")
    print("[G8] STATUS=PASS")
