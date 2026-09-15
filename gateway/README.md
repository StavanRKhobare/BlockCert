# gateway

FastAPI service that wires fl-orchestrator, auth-service, rollback-service,
attribution-service, blockchain/client, and provenance-api together behind
one API surface and drives the round lifecycle end to end.

## Build last (of the non-vision modules)
Once modules 1-7 (see root README) each work standalone against mocks,
wire them here. This is also what dashboard/ talks to. Because everything
below it is already interface-driven, this can be fully built and
demoed end-to-end BEFORE the real vision model exists.

Continuous Hardhat node: unlike prior epics' per-story fresh nodes, this
epic keeps ONE `npx hardhat node` running (blockchain/) for all stories —
gateway state (DIDs, stakes, round history) accumulates across stories.

## Build Log

- [G0] gateway project setup (own `.venv`; requirements fastapi/uvicorn/web3/pydantic/pytest/httpx + numpy/scikit-learn per root requirements; trivial FastAPI `main.py` with GET /health) — files: `gateway/requirements.txt`, `gateway/main.py`, `gateway/tests/__init__.py`, `gateway/tests/conftest.py`, `gateway/tests/test_g0_setup.py`. Notes: (a) conftest inserts repo root + all five sibling dirs + gateway/ (same pattern as fl-orchestrator's conftest); auth-service's `entrypoint` and rollback-service's `chain_bridge` win plain imports — provenance-api's `entrypoint` loads by file location with sys.modules save/restore (both services ship those top-level names; new ambiguity, documented in-test); (b) httpx 0.28 removed TestClient and its ASGITransport is async-only, so the health test drives the app via AsyncClient inside asyncio.run — still httpx, no live server.
