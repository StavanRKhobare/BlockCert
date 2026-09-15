"""Gateway: FastAPI service tying every prior epic together.

Round state lives in a GatewaySession (Story G1) — no module-level
globals. Routers land in later stories; G0 wires only /health.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.blockchain import router as blockchain_router
from routers.clients import router as clients_router
from routers.passport import router as passport_router
from routers.rounds import router as rounds_router
from routers.status import router as status_router

# Dashboard dev-server origins. Neither dashboard app sets a Vite port, so
# both default to 5173 — verified live: client holds :5173, server takes
# :5174 via Vite's auto-increment (strictPort is off). No credentials flow
# (plain GET/POST), so no allow_credentials needed.
DASHBOARD_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
]

app = FastAPI(title="BlockFedEDAuth-R gateway")
app.add_middleware(
    CORSMiddleware,
    allow_origins=DASHBOARD_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(blockchain_router)
app.include_router(clients_router)
app.include_router(passport_router)
app.include_router(rounds_router)
app.include_router(status_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
