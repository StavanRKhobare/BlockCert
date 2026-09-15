"""Order-proof loader for provenance-api's entrypoint (G7).

Plain `import entrypoint` binds auth-service's and plain
`import chain_bridge` binds rollback-service's (G0 path order) — but
provenance-api's entrypoint needs provenance-api's chain_bridge. So load
by file location with save/restore of any already-imported `chain_bridge*`
modules, exactly like the G0 test's helper, factored here for reuse.
"""

import importlib.util
import os
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_provenance_entrypoint():
    prov_dir = os.path.join(_REPO_ROOT, "provenance-api")
    evicted = {}
    for key in [
        k for k in sys.modules if k == "chain_bridge" or k.startswith("chain_bridge.")
    ]:
        evicted[key] = sys.modules.pop(key)
    sys.path.insert(0, prov_dir)
    try:
        spec = importlib.util.spec_from_file_location(
            "provenance_entrypoint", os.path.join(prov_dir, "entrypoint.py")
        )
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        sys.modules["provenance_entrypoint"] = module
        spec.loader.exec_module(module)
        return module
    finally:
        sys.path.remove(prov_dir)
        for key in [
            k
            for k in sys.modules
            if k == "chain_bridge" or k.startswith("chain_bridge.")
        ]:
            del sys.modules[key]
        sys.modules.update(evicted)
