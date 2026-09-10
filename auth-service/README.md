# auth-service

Adapted FedEDAuth suspicion scoring, one-class version, plus the new
labeled-reference-set performance check (see project report, Section 5.3
and the model-worsening-detection discussion).

## Build now, using synthetic embeddings
- `golden_reference/reference_stats.py` — compute per-class mean/covariance/
  threshold from `shared.mock_model.make_golden_reference()`.
- `scoring/suspicion.py` — outlier fraction (Mahalanobis or swap in a
  non-parametric method e.g. local outlier factor), mean shift,
  micro-cluster score (k-means k=2), combined into `SuspicionScore`.
- `scoring/reference_perf_check.py` — run the candidate global model
  (`predict_anomaly_score`) against a small labeled golden set each round;
  track accuracy/F1 delta as a DIRECT, non-embedding-based signal.
- Test everything against `MockModelAdapter.embed(poisoned=True)` to
  simulate an attacker and confirm separation.

## Open items to resolve while building
- Adaptive per-client thresholds vs. one global threshold.
- Track suspicion *trend* over rounds, not just single-round value (feeds
  rollback-service's drift monitor).

## Build Log

- [B0] Python package setup (requirements, importable subpackages, shared/ import path via tests/conftest.py, local .venv) — files: auth-service/requirements.txt, auth-service/golden_reference/__init__.py, auth-service/scoring/__init__.py, auth-service/tests/__init__.py, auth-service/tests/conftest.py, auth-service/.gitignore.
- [B1] Golden reference statistics (mean/covariance/inverse + 99th-percentile Mahalanobis threshold, regularized inverse) — files: auth-service/golden_reference/reference_stats.py, auth-service/tests/test_reference_stats.py.
- [B2] Suspicion scoring (outlier fraction, mean shift, micro-cluster) — files: auth-service/scoring/suspicion.py, auth-service/tests/test_suspicion.py.
- [B3] Reference-set performance-delta check (threshold-at-0.5 accuracy arithmetic) — files: auth-service/scoring/reference_perf_check.py, auth-service/tests/test_reference_perf_check.py.
- [B4] Combined suspicion score + pass/fail decision (placeholder weights, exact formula) — files: auth-service/scoring/combined.py, auth-service/tests/test_combined.py.
- [B5] Public entrypoint score_client (exact integration signature; B1 amended to also return raw "embeddings" for the micro-cluster signal) — files: auth-service/entrypoint.py, auth-service/tests/test_entrypoint.py, auth-service/golden_reference/reference_stats.py, auth-service/tests/test_reference_stats.py.
- [B6] Full auth-service regression suite green (5 passed, 0 failed) — files: auth-service/README.md.
