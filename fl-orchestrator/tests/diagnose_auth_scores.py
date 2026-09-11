"""Temporary read-only diagnostic: per-client auth scores. NOT a committed test.

Run: .venv/bin/python tests/diagnose_auth_scores.py  (from fl-orchestrator/)
"""

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, _REPO_ROOT)
sys.path.insert(0, os.path.join(_REPO_ROOT, "auth-service"))
sys.path.insert(0, os.path.dirname(_HERE))

from shared.mock_model.mock_adapter import (  # noqa: E402
    MockModelAdapter,
    make_golden_reference,
)

from client_sim.partition import make_clients  # noqa: E402
from golden_reference.reference_stats import compute_reference_stats  # noqa: E402
from scoring.calibration import calibrate_threshold  # noqa: E402
from scoring.combined import combine_scores  # noqa: E402
from scoring.suspicion import (  # noqa: E402
    mean_shift,
    micro_cluster_score,
    outlier_fraction,
)


def _score(emb, stats, reference_embeddings):
    out = outlier_fraction(emb, stats)
    shift = mean_shift(emb, stats)
    clus = micro_cluster_score(emb, reference_embeddings)
    combined, _ = combine_scores(out, shift, clus, 0.0)
    return out, shift, clus, combined


def main() -> None:
    reference_embeddings = make_golden_reference()
    stats = compute_reference_stats(reference_embeddings)
    calib_clients = [MockModelAdapter(f"calib-{i}", seed=100 + i) for i in range(5)]
    threshold = calibrate_threshold(stats, calib_clients)
    print(f"[DIAG] calibrated_threshold={threshold:.4f}")
    clients = make_clients(8)
    for client in clients:
        out, shift, clus, combined = _score(
            client.embed(n=50), stats, reference_embeddings
        )
        print(
            f"[DIAG] client={client.client_did} outlier={out:.4f} "
            f"shift={shift:.4f} cluster={clus:.4f} combined={combined:.4f} "
            f"poisoned=False passed={combined < threshold}"
        )
    attacker = clients[0]
    out, shift, clus, combined = _score(
        attacker.embed(n=50, poisoned=True), stats, reference_embeddings
    )
    print(
        f"[DIAG] client=attacker outlier={out:.4f} "
        f"shift={shift:.4f} cluster={clus:.4f} combined={combined:.4f} "
        f"poisoned=True passed={combined < threshold}"
    )


if __name__ == "__main__":
    main()
