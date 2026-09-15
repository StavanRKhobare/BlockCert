"""Gateway: FastAPI service tying every prior epic together.

Round state lives in a GatewaySession (Story G1) — no module-level
globals. Routers land in later stories; G0 wires only /health.
"""

from fastapi import FastAPI

app = FastAPI(title="BlockFedEDAuth-R gateway")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
