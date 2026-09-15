"""GET /clients: registry view over the session's 8 clients.

Assumes gateway/ is the working directory (or on sys.path) — same
convention as every sibling service's modules. The session is created
lazily on first request so importing this module (and main) never needs
the chain; tests inject their own session via set_session().
"""

from fastapi import APIRouter

from session import GatewaySession

router = APIRouter()

_session: GatewaySession | None = None


def get_session() -> GatewaySession:
    global _session
    if _session is None:
        _session = GatewaySession()
    return _session


def set_session(session: GatewaySession | None) -> None:
    global _session
    _session = session


@router.get("/clients")
async def list_clients() -> list[dict]:
    session = get_session()
    await session.register_all_clients()  # idempotent; no-op when done
    out = []
    for did in session.chain_dids:
        stats = session.client_stats[did]
        out.append(
            {
                "did": did,
                "stake_balance": session.staking_client.balance_of(did),
                "rounds_participated": stats["participated"],
                "rounds_passed": stats["passed"],
            }
        )
    return out
