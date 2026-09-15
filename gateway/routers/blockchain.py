"""Blockchain transaction feed over the session's log (G5).

Same lazy-singleton + set_session() injection pattern as the other
routers so importing this module (and main) never constructs a session.
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


@router.get("/blockchain/transactions")
async def list_transactions() -> list[dict]:
    return list(reversed(get_session().transaction_log))
