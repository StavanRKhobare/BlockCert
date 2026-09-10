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
