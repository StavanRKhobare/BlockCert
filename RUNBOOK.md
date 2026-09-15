# BlockFedEDAuth-R Runbook — what to run for what

Prereqs: Python ≥ 3.10, Node ≥ 20 (repo built with Python 3.14, Node v24).
Each command shows the directory to run it from. All `pytest` commands run
from the **repo root** (each service's `conftest.py` puts the root on
`sys.path` so `shared.*` resolves — do not `cd` into the service dirs).

## Ports

| Process | Port | URL |
|---|---|---|
| Hardhat local chain (backend) | **8545** | `http://127.0.0.1:8545` |
| Gateway (FastAPI / uvicorn) | **8000** | `http://localhost:8000` |
| Vite — client dashboard | **5173** | `http://localhost:5173` |
| Vite — server dashboard | **5174** | `http://localhost:5174` (auto-bumped from 5173 when both run) |

Python services (`auth-service`, `fl-orchestrator`, `rollback-service`, `provenance-api`)
remain importable modules, not HTTP servers — the HTTP layer is `gateway/` (see §3).
Both dashboards poll the gateway (CORS allows `http://localhost:5173` and `:5174`).

## 0. One-time Python setup

**Root (covers all importable services):**

```bash
python3 -m pip install -r requirements.txt
```

Debian/Ubuntu may refuse with "externally-managed-environment" (PEP 668):
use a venv, or add `--break-system-packages`. Covers `numpy`,
`scikit-learn`, `pydantic`, `pytest`, `web3` for all six Python packages.

**Gateway (isolated — do not mix with the root env):**

```bash
cd gateway
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt   # fastapi, uvicorn, web3, pydantic, pytest, httpx + numpy/scikit-learn
```

`gateway/.venv` is gitignored (see root `.gitignore`). The same applies to the
per-service `.venv` folders already present in `auth-service/`, `fl-orchestrator/`,
`rollback-service/`, `provenance-api/` — all ignored.

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

## 2. Python service test suites

**Importable services (repo root, no node needed unless marked):**

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

**Gateway (requires the chain running — §1 — and its own venv):**

```bash
cd gateway
source .venv/bin/activate
python -m pytest tests/ -v          # 12 tests (G0–G11), needs the node running
```

Gateway also exposes `GET /status/limitations` — the 10-entry known-placeholder
catalog that `CONTEXT/Issues.md` is the long-form companion to.

## 3. Gateway — wiring layer (HTTP)

```bash
cd gateway
source .venv/bin/activate
uvicorn main:app --reload --port 8000   # requires the chain running (§1)
# health check:
curl http://localhost:8000/health
curl http://localhost:8000/status/limitations
```

`gateway/.env` is not needed; `VITE_GATEWAY_URL` lives in each dashboard's `.env`.

## 4. Frontends — dashboards (both Vite apps, separate installs)

**Client dashboard (`dashboard/client` — port 5173):**

```bash
cd dashboard/client
npm install   # first time only
npm run dev        # Vite dev server (5173)
npx vitest run     # 10+ tests (CD2–CD10 + App), fetch-mocked since CD-G10
npm run build      # production build (stricter than tsc --noEmit — keep green)
```

**Server dashboard (`dashboard/server` — port 5174):**

```bash
cd dashboard/server
npm install   # first time only
npm run dev        # Vite dev server (5174 — auto-bumped when client is on 5173)
npx vitest run     # 13 files / 16 tests (SD2–SD11 + App), fetch-mocked since SD-G11
npm run build
```

Both dashboards poll the gateway (`VITE_GATEWAY_URL`, default `http://localhost:8000`).
Set it in `dashboard/client/.env` and `dashboard/server/.env` if the gateway runs elsewhere.

## 5. Still on hold (stubs — README only, no entrypoint)

- `attribution-service` — windowed culprit scoring; placeholder panel in server dashboard (SD10).
- `vision-model` — teammate track; mock model (`shared/mock_model`) stands in until `ModelAdapter` lands.
- `infra/` — empty.

## Quick full-check order (full stack, as of SD-G11)

1. `cd blockchain && npx hardhat node` (Terminal 1, leave running)
2. `cd blockchain && npm run deploy:localhost` (Terminal 2, once per node restart)
3. Repo root: the four importable `pytest` suites (Section 2)
4. `cd gateway && source .venv/bin/activate && python -m pytest tests/ -v`
5. `cd dashboard/client && npx vitest run && npm run build`
6. `cd dashboard/server && npx vitest run && npm run build`
7. Spot-check the live stack: `curl http://localhost:8000/status/limitations`
   and open both dashboards — see `CONTEXT/Issues.md` §4 for exactly which
   panels are live-polled vs. replay vs. synthetic.

## Troubleshooting

- `ModuleNotFoundError: No module named 'web3'` (rollback-service /
  provenance-api collection errors) → the root requirements were never
  installed in that terminal's Python. Fix: `python3 -m pip install -r
  requirements.txt` from repo root (add `--break-system-packages` on
  Ubuntu/Debian, or use a venv). Note `auth-service`/`fl-orchestrator`
  pass without it, which is why the missing package only shows up in the
  later suites.
- `ModuleNotFoundError` inside `gateway/` → you forgot to activate its venv
  (`source gateway/.venv/bin/activate`) — it is isolated from the root env.
- Chain-integration tests fail with `ConnectionError` telling you to start
  `npx hardhat node` → start the node (Section 1) and redeploy, then rerun.
  They never fake a pass against a dead node — by design.
- Dashboard shows "currentRound stuck at 0 / always idle" → the gateway isn't
  running or `VITE_GATEWAY_URL` is wrong; check `curl http://localhost:8000/health`
  and each dashboard's `.env` (`VITE_GATEWAY_URL=http://localhost:8000`).
- `git status` showing `checkpoint_data/*.npz` or `.venv/` as untracked → fixed
  by the updated root `.gitignore` (this commit); `git rm --cached` if still staged.
- Which panels are real vs. demo? → see `CONTEXT/Issues.md` (§4) and
  `gateway/README.md` / `dashboard/*/README.md` Build Logs for the exact
  live-vs-replay split.
