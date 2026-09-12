# BlockFedEDAuth-R Runbook — what to run for what

Prereqs: Python ≥ 3.10, Node ≥ 20 (repo built with Python 3.14, Node v24).
Each command shows the directory to run it from. All `pytest` commands run
from the **repo root** (each service's `conftest.py` puts the root on
`sys.path` so `shared.*` resolves — do not `cd` into the service dirs).

## Ports

| Process | Port | URL |
|---|---|---|
| Hardhat local chain (backend) | **8545** | `http://127.0.0.1:8545` |
| Vite dev server (frontend) | **5173** | `http://localhost:5173` |

Nothing else in the repo opens a port (Python services are importable
modules, not HTTP servers — the HTTP layer is `gateway/`'s job, batch 2).

## 0. One-time Python setup (repo root)

```bash
python3 -m pip install -r requirements.txt
```

Debian/Ubuntu may refuse with "externally-managed-environment" (PEP 668):
use a venv, or add `--break-system-packages`. Covers `numpy`,
`scikit-learn`, `pydantic`, `pytest`, `web3` for all four services.

## 1. Backend — local blockchain (two terminals)

Terminal 1 — start the chain (keep running; port 8545):

```bash
cd blockchain
npx hardhat node
```

Terminal 2 — deploy the five contracts (fresh node = fresh addresses, so
re-run this every time Terminal 1 restarts; old `deployments/` files go stale):

```bash
cd blockchain
npm run deploy:localhost
```

Contract unit tests (no node needed):

```bash
cd blockchain
npx hardhat test
```

## 2. Python service test suites (repo root, no node needed unless marked)

```bash
python3 -m pytest auth-service/tests/ -v
python3 -m pytest fl-orchestrator/tests/ -v
python3 -m pytest rollback-service/tests/ -v
python3 -m pytest provenance-api/tests/ -v
```

Needs the chain running (Section 1) — everything else passes without it:

- `rollback-service/tests/test_chain_client.py` (ChainClient integration)
- `provenance-api/tests/test_passport_client.py` and `test_entrypoint.py`
  (both are on-chain integration tests)

To skip the chain-dependent tests: `python3 -m pytest <service>/tests/ -v
--ignore=<that-file>`.

## 3. Frontend — client dashboard (`dashboard/client`)

First time only:

```bash
cd dashboard/client
npm install
```

Run (port 5173 — currently the Vite template placeholder; CD9 builds the
real `App.tsx`, CD3–CD5 panels are covered by Vitest until then):

```bash
cd dashboard/client
npm run dev        # dev server
npx vitest run     # frontend test suite (6 files: App, schemas, hook, 3 panels)
npm run build      # production build (stricter than tsc --noEmit — keep green)
```

## 4. Not runnable yet (stubs — README only, no entrypoint)

- `gateway/` — HTTP/wiring layer, batch 2.
- `attribution-service/`, `vision-model/` — separate tracks.
- `infra/` — empty.

## Quick full-check order

1. `cd blockchain && npx hardhat node` (Terminal 1, leave running)
2. `cd blockchain && npm run deploy:localhost` (Terminal 2, once per node restart)
3. Repo root: all four `pytest` suites (Section 2)
4. `cd dashboard/client && npx vitest run && npm run build`

## Troubleshooting

- `ModuleNotFoundError: No module named 'web3'` (rollback-service /
  provenance-api collection errors) → the root requirements were never
  installed in that terminal's Python. Fix: `python3 -m pip install -r
  requirements.txt` from repo root (add `--break-system-packages` on
  Ubuntu/Debian, or use a venv). Note `auth-service`/`fl-orchestrator`
  pass without it, which is why the missing package only shows up in the
  later suites.
- Chain-integration tests fail with `ConnectionError` telling you to start
  `npx hardhat node` → start the node (Section 1) and redeploy, then rerun.
  They never fake a pass against a dead node — by design.
