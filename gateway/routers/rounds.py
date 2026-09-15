"""Round-step endpoints over the shared session (G3 manual + G4 autonomous).

Same lazy-singleton + set_session() injection pattern as clients.py so
importing this module (and main) never constructs a session or needs the
chain; tests inject their own.
"""

import asyncio

from fastapi import APIRouter, HTTPException

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


def _task_running(session: GatewaySession) -> bool:
    task = session.autonomous_task
    return task is not None and not task.done()


def _autonomous_status(session: GatewaySession) -> dict:
    # Retrieving a finished task's exception (if any) marks it retrieved
    # so the loop never warns about unretrieved background errors.
    task = session.autonomous_task
    if task is not None and task.done() and not task.cancelled():
        task.exception()
    return {"running": _task_running(session), "current_round": session.current_round}


@router.post("/rounds/autonomous/start")
async def autonomous_start(body: dict | None = None) -> dict:
    interval = float((body or {}).get("interval_seconds", 5.0))
    session = get_session()
    if _task_running(session):
        raise HTTPException(
            status_code=409, detail="autonomous loop already running"
        )

    async def _loop() -> None:
        # No run_in_threadpool here, deliberately: a round takes ~2.7s
        # measured (G3: ~41s for 15 rounds), of which 2.4s is the six
        # 0.4s pacing sleeps that YIELD to the loop, and the compute
        # slices (numpy/sklearn embeds, FedAvg, local web3 waits) are
        # millisecond-scale with an await between every stage. The loop
        # stays responsive to concurrent GETs throughout; a threadpool
        # would only move the sleeps onto a worker thread for no gain.
        # Revisit with profiling once the vision model adds real training
        # latency (step_round's blocking profile changes completely then).
        while session.current_round < session.max_rounds:
            await session.step_round()
            if session.current_round >= session.max_rounds:
                break
            await asyncio.sleep(interval)

    session.autonomous_task = asyncio.create_task(_loop())
    return {"running": True, "current_round": session.current_round}


@router.post("/rounds/autonomous/stop")
async def autonomous_stop() -> dict:
    session = get_session()
    task = session.autonomous_task
    if task is not None and not task.done():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass  # cooperative stop lands at the next await point; expected
    return _autonomous_status(session)


@router.get("/rounds/autonomous/status")
async def autonomous_status() -> dict:
    return _autonomous_status(get_session())
