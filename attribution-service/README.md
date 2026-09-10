# attribution-service

Cheap, windowed culprit attribution — NOT full Shapley value. Only runs
inside a DriftEvent's round window (see report Section 5.5 / 6.3).

## Build now
- `similarity_scorer.py` — for each client active in the drift window,
  compute similarity between their submitted update direction and the
  direction the global model drifted in. Rank clients by this score.
- Test against `MockModelAdapter.local_train(inject_drift=True)` for one
  client among several honest ones; confirm the poisoned client ranks top.
