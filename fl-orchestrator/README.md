# fl-orchestrator

FedAvg round loop: client registration, weight aggregation, round scheduling.

## Build now, using shared.mock_model.MockModelAdapter
- `server/round_manager.py` — drives N simulated clients through
  register -> local_train -> submit ClientUpdate -> (wait for auth-service
  pass/fail) -> aggregate accepted weights -> broadcast new global weights.
- `client_sim/simulated_client.py` — wraps a ModelAdapter (mock for now,
  real vision-model later) plus a non-IID data-partition config, so you can
  simulate 5-15 clients with deliberately different local distributions.
- Aggregation math itself (weighted average of `get_weights()` dicts) has
  zero dependency on what's inside those dicts — build and unit-test this
  fully today.

## Plug-in point
`client_sim/simulated_client.py` takes a `ModelAdapter` in its constructor.
Swap `MockModelAdapter` for the real vision model's adapter later; nothing
else here changes.

## Build Log

- [C0] Python package setup (requirements, importable subpackages, shared/ import path via tests/conftest.py, local .venv) — files: fl-orchestrator/requirements.txt, fl-orchestrator/client_sim/__init__.py, fl-orchestrator/server/__init__.py, fl-orchestrator/tests/__init__.py, fl-orchestrator/tests/conftest.py, fl-orchestrator/.gitignore.
- [C1] Client simulation + non-IID partition harness — files: fl-orchestrator/client_sim/partition.py, fl-orchestrator/client_sim/simulated_client.py, fl-orchestrator/tests/test_partition.py.
- [C2] FedAvg aggregation function (sample-count weighted, ValueError on empty) — files: fl-orchestrator/server/aggregate.py, fl-orchestrator/tests/test_aggregate.py.
- [C3] Authentication gating via real score_client (passing sub-list + full scores list) — files: fl-orchestrator/server/round_manager.py, fl-orchestrator/tests/test_round_manager_auth.py, fl-orchestrator/tests/conftest.py, fl-orchestrator/client_sim/simulated_client.py, fl-orchestrator/requirements.txt.
- [C4] Full round loop (real checkpoint_round; ingest/execute still TODO stubs) — files: fl-orchestrator/server/round_manager.py, fl-orchestrator/tests/test_round_manager_full.py, fl-orchestrator/tests/conftest.py, fl-orchestrator/.gitignore.
- [C4] Full round loop revised (registry threading + REAL D3/D4, calibrated honest clients) — files: fl-orchestrator/server/round_manager.py, fl-orchestrator/tests/test_round_manager_full.py.
