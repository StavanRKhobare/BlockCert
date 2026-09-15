"""G0: every sibling import resolves from gateway/ + /health returns 200."""

import importlib.util
import os
import sys

import httpx

_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(os.path.dirname(_TESTS_DIR))


def load_provenance_entrypoint():
    """Import provenance-api/entrypoint.py under a distinct module name.

    Plain `import entrypoint` would bind auth-service's (path priority) and
    plain `import chain_bridge` binds rollback-service's — but provenance's
    entrypoint needs provenance's `chain_bridge.passport_client`. So: evict
    any already-imported `chain_bridge*` modules, prepend provenance-api,
    load by file location, then restore everything. Proves the module
    imports correctly from gateway's working directory without permanently
    disturbing the interpreter state other tests rely on.
    """
    prov_dir = os.path.join(_REPO_ROOT, "provenance-api")
    evicted = {}
    for key in [k for k in sys.modules if k == "chain_bridge" or k.startswith("chain_bridge.")]:
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
        for key in [k for k in sys.modules if k == "chain_bridge" or k.startswith("chain_bridge.")]:
            del sys.modules[key]
        sys.modules.update(evicted)


def test_all_sibling_imports_ok():
    import shared.interfaces.schemas as schemas

    assert hasattr(schemas, "SuspicionScore")

    from entrypoint import score_client  # auth-service (path priority)

    from scoring.calibration import calibrate_threshold  # noqa: F401  (auth-service/scoring)
    assert callable(calibrate_threshold)

    from golden_reference.reference_stats import (  # noqa: F401
        compute_reference_stats,
    )

    from server.round_manager import run_round  # fl-orchestrator
    from client_sim.simulated_client import SimulatedClient  # noqa: F401

    from checkpoint_store.local_store import LocalCheckpointStore  # noqa: F401
    from drift_monitor.window_tracker import DriftMonitor  # noqa: F401

    from chain_bridge.chain_client import ChainClient  # rollback-service

    prov_entrypoint = load_provenance_entrypoint()

    for symbol in (
        score_client,
        calibrate_threshold,
        compute_reference_stats,
        run_round,
        SimulatedClient,
        LocalCheckpointStore,
        DriftMonitor,
        ChainClient,
    ):
        assert symbol is not None
    assert callable(prov_entrypoint.submit_lifecycle_event)
    assert callable(prov_entrypoint.get_passport_history)

    print("[G0] all_sibling_imports_ok=True")


def test_health_endpoint_ok():
    import asyncio

    from main import app

    # httpx 0.28 removed httpx.TestClient and its ASGITransport is
    # async-only — so drive the app in-process via AsyncClient inside
    # asyncio.run (stdlib, no plugin). Still httpx, no live server.
    async def _get():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            return await client.get("/health")

    response = asyncio.run(_get())

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    print("[G0] health_endpoint_ok=True")


def test_g0_status():
    print("[G0] STATUS=PASS")
