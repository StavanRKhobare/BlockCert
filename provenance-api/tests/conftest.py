"""Make the repo root importable so `shared.*` resolves from provenance-api/.

Do not copy shared/ files here — always import the real ones.
"""

import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
