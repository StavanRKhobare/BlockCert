"""G3 integration: 15 manual steps, attacker excluded from round 12."""

import asyncio

import httpx

from session import GatewaySession


def _request(app, method: str, path: str):
    async def _fetch():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            return await client.request(method, path)

    return asyncio.run(_fetch())


def test_fifteen_manual_steps_with_attacker():
    from main import app
    from routers import rounds

    session = GatewaySession()
    rounds.set_session(session)
    try:
        summaries = []
        for _ in range(15):
            response = _request(app, "POST", "/rounds/step")
            assert response.status_code == 200
            summaries.append(response.json())

        # Rounds 1-11 all-honest: nobody excluded (C5's finding, first half).
        assert all(s["n_failed"] == 0 for s in summaries[:11])
        # Round 12 onward: the armed attacker is excluded every round.
        late = summaries[11:]
        attacker_excluded_from_round_12 = all(
            s["n_failed"] >= 1 for s in late
        )
        assert attacker_excluded_from_round_12

        current = _request(app, "GET", "/rounds/current").json()
        assert current["current_round"] == 15
        assert current["current_stage"] == "idle"
        assert current["latest_summary"]["round"] == 15

        history = _request(app, "GET", "/rounds/history").json()
        history_length_correct = len(history) == 15
        assert history_length_correct
    finally:
        rounds.set_session(None)

    print(
        f"[G3] rounds_stepped=15 "
        f"attacker_excluded_from_round_12={attacker_excluded_from_round_12} "
        f"history_length_correct={history_length_correct}"
    )
    assert attacker_excluded_from_round_12 and history_length_correct
    print("[G3] STATUS=PASS")
