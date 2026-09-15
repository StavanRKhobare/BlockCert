"""Round-step endpoints over the shared session (G3 manual mode).

Same lazy-singleton + set_session() injection pattern as clients.py so
importing this module (and main) never constructs a session or needs the
chain; tests inject their own.
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


@router.post("/rounds/step")
async def step_round() -> dict:
    return await get_session().step_round()


@router.get("/rounds/current")
async def current_round() -> dict:
    session = get_session()
    history = session.round_history
    return {
        "current_round": session.current_round,
        "current_stage": session.current_stage,
        "latest_summary": history[-1] if history else None,
    }


@router.get("/rounds/history")
async def round_history() -> list[dict]:
    return get_session().round_history
