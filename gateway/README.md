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
- [G1] GatewaySession — explicit state, no module-level globals — files: `gateway/session.py`, `gateway/tests/test_session.py`. Notes: (a) every run_round call passes previous_checkpoint + checkpoint_registry from self; session.py references zero round_manager globals in code (only `run_round` imported — grep-verified, mentions elsewhere are docstring); (b) THREE prompt-vs-reality gaps, all documented in session.py's module docstring instead of worked around silently: run_round takes NO checkpoint_store param (session owns one for gateway-side reads; run_round persists via its internal default — residual, flagged upstream); the summary carries NO Checkpoint so the new head is reconstructed from session-owned registry + summary (hashes/URIs/parents real; is_delta/metrics mirror hasher hardcodes with source refs; timestamp fresh); make_clients returns adapters not SimulatedClients (wrapped exactly like the C-tests); (c) owned DriftMonitor held per design but run_round ingests into its own internal monitor (same residue class — no monitor param exists); (d) test: 3 real rounds via asyncio.run (8/8 pass, no drift), round==3, history==3, idle between calls, 3 distinct head hashes with parent links, own registry mutated (len 3) while round_manager._default_registry stays empty.

- [G0] gateway project setup (own `.venv`; requirements fastapi/uvicorn/web3/pydantic/pytest/httpx + numpy/scikit-learn per root requirements; trivial FastAPI `main.py` with GET /health) — files: `gateway/requirements.txt`, `gateway/main.py`, `gateway/tests/__init__.py`, `gateway/tests/conftest.py`, `gateway/tests/test_g0_setup.py`. Notes: (a) conftest inserts repo root + all five sibling dirs + gateway/ (same pattern as fl-orchestrator's conftest); auth-service's `entrypoint` and rollback-service's `chain_bridge` win plain imports — provenance-api's `entrypoint` loads by file location with sys.modules save/restore (both services ship those top-level names; new ambiguity, documented in-test); (b) httpx 0.28 removed TestClient and its ASGITransport is async-only, so the health test drives the app via AsyncClient inside asyncio.run — still httpx, no live server.
