# BlockFedEDAuth-R

Drift-triggered, blockchain-anchored rollback for federated semiconductor defect
detection. For the honest account of what's real, what's mock, and what's still
missing, see `CONTEXT/Issues.md` and `gateway/routers/status.py` (`GET /status/limitations`);
for the design rationale see `CONTEXT/context.md` and `docs/adr/`.

## Module map

| Module | Depends on | Needs the real vision model? |
|---|---|---|
| `shared/` | nothing | No — this IS the contract everything else codes against |
| `blockchain/` | nothing | No — fully standalone (contracts, staking, disputes, passport) |
| `rollback-service/` | `shared/` | No — only needs serialized weight blobs, any shape |
| `auth-service/` | `shared/` | No — only needs embedding vectors, can be synthetic |
| `fl-orchestrator/` | `shared/`, `rollback-service` | No — drives `ModelAdapter`, uses the mock by default |
| `attribution-service/` | `fl-orchestrator/`, `rollback-service/` | No — operates on update vectors, not images |
| `provenance-api/` | `blockchain/` | No |
| `gateway/` | all of the above | No — wires services together over the shared interface |
| `dashboard/` | `gateway/` | No |
| `vision-model/` | `shared/interfaces/model_adapter.py` | **This IS the vision model** — your teammate's module |

## Recommended build order (all before the vision model exists)

1. `shared/interfaces/` — lock the `ModelAdapter` contract and Pydantic schemas first.
   Everything else depends on this not changing shape later.
2. `blockchain/contracts/` — fully decoupled, good first real sprint. DID registry,
   staking/slashing, checkpoint-hash anchoring, dispute window, provenance passport.
3. `rollback-service/` — hash-chain + off-chain checkpoint storage + delta
   compression + drift monitor. Test against `shared/mock_model`'s dummy weights.
4. `auth-service/` — suspicion-score math (outlier fraction, mean shift,
   micro-cluster) plus the labeled-reference-set performance check. Test against
   synthetic Gaussian-cluster embeddings — no real images needed yet.
5. `fl-orchestrator/` — FedAvg round loop, client registration, aggregation.
   Runs entirely on `shared/mock_model` clients.
6. `attribution-service/` — windowed culprit scoring, triggered by
   `rollback-service` drift events. **On hold** (standing call — placeholder in server dashboard).
7. `provenance-api/` — downstream passport lookups, depends only on `blockchain/`.
8. `gateway/` — wire everything above together behind one API.
9. `dashboard/` — two Vite apps (`dashboard/client` :5173, `dashboard/server` :5174)
   polling the gateway; mock-backed until G10/G11 swapped in the live feed.

**Status as of SD-G11 (2026-09-15):** steps 1–9 are built and green — both dashboards now
poll live gateway state for round/stage/DIDs/transactions/passports and remain on deterministic
replay (sliced by the live round) only for scores/checkpoints/stakes/disputes, which have **no
gateway endpoint yet** — the spec gap documented in `CONTEXT/Issues.md` §1 and slated for G12.
The full stack's known placeholders are enumerated in `GET /status/limitations`.

**Swap-in step (once the vision model is ready):** implement
`shared/interfaces/model_adapter.py`'s `ModelAdapter` in `vision-model/`, point
`fl-orchestrator/client_sim/` at it instead of `shared/mock_model`, and nothing
else in the repo needs to change.

## Infra

`infra/docker-compose.yml` spins up a local Ethereum-style testnet node (for
`blockchain/`) and a local IPFS node (for `rollback-service/checkpoint_store/`)
so every module above can be developed and tested fully offline.
Currently `blockchain/` runs as a local `npx hardhat node` (port 8545) without
Docker — the `gateway` keeps one continuous node for the whole session (see `RUNBOOK.md` §1).

## Where to look for "what's real vs. what's still mock"

- `CONTEXT/Issues.md` — consolidated, citation-backed gap list (this file's companion).
- `gateway/routers/status.py` → `GET /status/limitations` — 10-entry machine-readable catalog.
- `gateway/README.md`, `dashboard/client/README.md`, `dashboard/server/README.md` — per-module
  Build Logs with exact live-vs-replay splits.
- `RUNBOOK.md` §3–5 — what actually needs to be running for each layer.
