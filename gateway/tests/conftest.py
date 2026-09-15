"""Make every sibling service importable from gateway/.

Same sys.path pattern used everywhere else (repo root + sibling service
dirs), extended to five siblings this time: shared, auth-service,
fl-orchestrator, rollback-service, provenance-api — plus gateway/ itself
so `main` imports regardless of pytest's rootdir handling.

Known ambiguity this epic must live with: auth-service/entrypoint.py and
provenance-api/entrypoint.py are BOTH top-level `entrypoint`, and both
services ship a `chain_bridge` package. Path order below gives
auth-service's `entrypoint` and rollback-service's `chain_bridge`
priority for plain imports; tests needing provenance-api's entrypoint
load it by file location with save/restore (see test_g0_setup.py).

Do not copy sibling files here — always import the real ones.
"""

import os
import sys

_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
_GATEWAY_DIR = os.path.dirname(_TESTS_DIR)
_REPO_ROOT = os.path.dirname(_GATEWAY_DIR)

for _d in (
    _REPO_ROOT,
    os.path.join(_REPO_ROOT, "provenance-api"),
    os.path.join(_REPO_ROOT, "rollback-service"),
    os.path.join(_REPO_ROOT, "fl-orchestrator"),
    os.path.join(_REPO_ROOT, "auth-service"),
    _GATEWAY_DIR,
):
    sys.path.insert(0, _d)
