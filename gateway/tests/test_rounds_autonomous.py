"""G4 integration: autonomous loop advances, stops, rejects duplicates."""

import asyncio

import httpx

from session import GatewaySession


def test_autonomous_loop():
    from main import app
    from routers import rounds

    session = GatewaySession()
    rounds.set_session(session)
    try:
        asyncio.run(_scenario(app))
    finally:
        rounds.set_session(None)


async def _scenario(app):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        start = await client.post(
            "/rounds/autonomous/start", json={"interval_seconds": 0.1}
        )
        assert start.status_code == 200
        assert start.json()["running"] is True

        # A second start while running is rejected, not duplicated.
        duplicate = await client.post(
            "/rounds/autonomous/start", json={"interval_seconds": 0.1}
        )
        duplicate_start_rejected = duplicate.status_code == 409
        assert duplicate_start_rejected

        # One round takes ~2.7s (six 0.4s pacing sleeps + compute); wait
        # for at least one full autonomous round, no manual steps.
        await asyncio.sleep(3.5)
        mid = (await client.get("/rounds/autonomous/status")).json()
        autonomous_advances_rounds = mid["running"] is True and mid["current_round"] >= 1
        assert autonomous_advances_rounds

        stop = (await client.post("/rounds/autonomous/stop")).json()
        assert stop["running"] is False
        frozen_round = stop["current_round"]

        # Stopped means stopped: further waiting changes nothing.
        await asyncio.sleep(1.5)
        after = (await client.get("/rounds/autonomous/status")).json()
        stop_works = (
            after["running"] is False and after["current_round"] == frozen_round
        )
        assert stop_works

    print(
        f"[G4] autonomous_advances_rounds={autonomous_advances_rounds} "
        f"stop_works={stop_works} "
        f"duplicate_start_rejected={duplicate_start_rejected}"
    )
    assert (
        autonomous_advances_rounds and stop_works and duplicate_start_rejected
    )
    print("[G4] STATUS=PASS")
