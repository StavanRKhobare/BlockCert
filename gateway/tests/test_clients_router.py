"""G2 integration: node reachable, 8 DIDs registered + funded, /clients exact."""

import asyncio

import httpx

from session import INITIAL_STAKE_WEI, GatewaySession


def _get(app, path: str):
    async def _fetch():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            return await client.get(path)

    return asyncio.run(_fetch())


def test_clients_registry_endpoint():
    from main import app
    from routers.clients import set_session

    # Node reachable: bridge construction connects (raises ConnectionError
    # otherwise) — session construction exercises both bridges.
    session = GatewaySession()
    node_reachable = True

    assert all(
        session.did_client.is_registered(did) for did in session.chain_dids
    )
    clients_registered = len(session.chain_dids)
    assert clients_registered == 8

    set_session(session)
    try:
        response = _get(app, "/clients")
    finally:
        set_session(None)

    assert response.status_code == 200
    entries = response.json()
    assert len(entries) == 8
    assert [e["did"] for e in entries] == [
        f"did:bfa:client-{i}" for i in range(8)
    ]
    stake_balances_correct = all(
        e["stake_balance"] > 0 for e in entries
    ) and all(
        e["stake_balance"] == INITIAL_STAKE_WEI
        for e in entries
        if e["did"] != "did:bfa:client-3"
    )
    # client-3 may carry G6 slashes on the continuous node — never above
    # initial, never zero-or-negative.
    client3 = next(e for e in entries if e["did"] == "did:bfa:client-3")
    assert 0 < client3["stake_balance"] <= INITIAL_STAKE_WEI
    assert stake_balances_correct
    # No rounds stepped yet: counts are zero (shape present, values honest).
    assert all(
        e["rounds_participated"] == 0 and e["rounds_passed"] == 0
        for e in entries
    )
    # Chain re-read agrees with the endpoint (live read, not cached).
    # Non-client-3 balances are untouched by any story (only G6 slashes,
    # and only client-3); client-3's is bounded above by initial.
    assert all(
        session.staking_client.balance_of(did) == INITIAL_STAKE_WEI
        for did in session.chain_dids
        if did != "did:bfa:client-3"
    )
    assert (
        0
        < session.staking_client.balance_of("did:bfa:client-3")
        <= INITIAL_STAKE_WEI
    )

    print(
        f"[G2] node_reachable={node_reachable} "
        f"clients_registered={clients_registered} "
        f"stake_balances_correct={stake_balances_correct}"
    )
    assert node_reachable and clients_registered == 8 and stake_balances_correct
    print("[G2] STATUS=PASS")
