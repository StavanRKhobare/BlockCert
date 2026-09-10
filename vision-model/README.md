# vision-model  (teammate's module)

Implements `shared/interfaces/model_adapter.py`'s `ModelAdapter` for the
real anomaly-detection model (dataset: MIIC and/or IDA/ICME 2026 — see
project report Section 5.1).

## Contract to satisfy
- `get_weights()` / `set_weights()` — whatever the real architecture's
  state_dict looks like, flattened into {name: np.ndarray}.
- `local_train(local_data, epochs)` — real local training loop.
- `embed(images)` — run through the FIXED shared ViT (never trained).
- `predict_anomaly_score(images)` — the actual anomaly score.

## Swap-in step
Once this class exists and passes the same unit tests
`shared/mock_model` is exercised with, point
`fl-orchestrator/client_sim/simulated_client.py` at it instead of
`MockModelAdapter`. No other module needs to change.
