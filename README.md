# BlockFedEDAuth-R

Drift-triggered, blockchain-anchored rollback for federated semiconductor defect
detection. See `/docs` for the full project report and architecture decision
records (ADRs).

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
   `rollback-service` drift events.
7. `provenance-api/` — downstream passport lookups, depends only on `blockchain/`.
8. `gateway/` — wire everything above together behind one API.
9. `dashboard/` — build against `gateway/`'s mock-backed endpoints.

**Swap-in step (once the vision model is ready):** implement
`shared/interfaces/model_adapter.py`'s `ModelAdapter` in `vision-model/`, point
`fl-orchestrator/client_sim/` at it instead of `shared/mock_model`, and nothing
else in the repo needs to change.

## Infra

`infra/docker-compose.yml` spins up a local Ethereum-style testnet node (for
`blockchain/`) and a local IPFS node (for `rollback-service/checkpoint_store/`)
so every module above can be developed and tested fully offline.
