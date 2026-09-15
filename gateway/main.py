"""Gateway: FastAPI service tying every prior epic together.

Round state lives in a GatewaySession (Story G1) — no module-level
globals. Routers land in later stories; G0 wires only /health.
"""

from fastapi import FastAPI

from routers.clients import router as clients_router
from routers.rounds import router as rounds_router

app = FastAPI(title="BlockFedEDAuth-R gateway")
app.include_router(clients_router)
app.include_router(rounds_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
