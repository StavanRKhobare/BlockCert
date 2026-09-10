"""Make the repo root importable so `shared.*` resolves from fl-orchestrator/.

Also puts `auth-service/` on the path so the real `score_client` entrypoint
is imported (touchpoint #1) — never a local copy of it.

Do not copy shared/ or auth-service/ files here — always import the real ones.
"""

import os
import sys

_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(os.path.dirname(_TESTS_DIR))

sys.path.insert(0, _REPO_ROOT)
sys.path.insert(0, os.path.join(_REPO_ROOT, "auth-service"))
