# rollback-service

The project's core contribution. Never stores full weights on-chain —
only hashes. See project report Section 5.4.

## Build now, using any weights dict (mock model's is fine)
- `checkpoint_store/hasher.py` — hash a weights dict (Merkle tree over
  layers, not one flat hash, so partial verification/delta work later).
- `checkpoint_store/delta.py` — store only the diff vs. the previous
  checkpoint; materialize full snapshots periodically.
- `checkpoint_store/ipfs_client.py` — push/pull checkpoint blobs to a local
  IPFS node (see infra/docker-compose.yml); content-addressing gives
  integrity for free, confirm hash-on-retrieval matches on-chain record.
- `drift_monitor/window_tracker.py` — track outlier fraction / mean shift /
  reference-set-accuracy over a sliding window of rounds; trigger a
  DriftEvent when sustained drift exceeds threshold even if no single round
  crossed auth-service's per-round bar.
- `drift_monitor/rollback_executor.py` — on DriftEvent, fetch the last good
  checkpoint from IPFS, call `model_adapter.set_weights(...)`.

This entire module can be fully built and unit-tested against
`MockModelAdapter.local_train(inject_drift=True)` today.

## Build Log

- [D0] Python package setup (requirements incl. web3, importable subpackages, shared/ import path via tests/conftest.py, local .venv) — files: rollback-service/requirements.txt, rollback-service/checkpoint_store/__init__.py, rollback-service/drift_monitor/__init__.py, rollback-service/chain_bridge/__init__.py, rollback-service/tests/__init__.py, rollback-service/tests/conftest.py, rollback-service/.gitignore.
- [D1] Merkle-style checkpoint hashing (per-layer SHA-256, alphabetically ordered root) — files: rollback-service/checkpoint_store/hasher.py, rollback-service/tests/test_hasher.py.
- [D2] Local checkpoint store + delta compression (npz store with integrity check, elementwise deltas) — files: rollback-service/checkpoint_store/local_store.py, rollback-service/checkpoint_store/delta.py, rollback-service/tests/test_local_store.py, rollback-service/tests/test_delta.py.
- [D3] Sliding-window drift monitor (sustained suspicion + accuracy decline trigger) — files: rollback-service/drift_monitor/window_tracker.py, rollback-service/tests/test_window_tracker.py.
