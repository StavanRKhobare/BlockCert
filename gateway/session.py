"""GatewaySession: all round state lives in ONE instance — no globals.

This is the state-management fix for the pattern flagged in C4/C5 review:
round_manager.py keeps module-level mutable defaults (_previous_checkpoint,
_default_registry, _default_store, _default_monitor) that only worked
because tests reset them between runs. Gateway never relies on those
defaults for its own chaining: every run_round call explicitly passes
previous_checkpoint and checkpoint_registry from self.

Three prompt-vs-reality notes (verified against source, not assumed):

1. run_round() takes NO checkpoint_store parameter (it persists via its
   internal _default_store). The session still constructs and owns one
   LocalCheckpointStore for gateway-side reads (verify_integrity, future
   routers); the double-store residue is flagged for a future
   fl-orchestrator change. Zero fl-orchestrator changes in this story.

2. run_round's summary dict carries NO Checkpoint object, so "update from
   the returned Checkpoint" is impossible as specified. The session
   reconstructs the new head SOLELY from data it owns: the newly added key
   of its own checkpoint_registry (hasher-computed hash + URI), the
   summary's n_passed/n_failed, and its own previous head for parent_hash.
   is_delta=False and the metrics keys mirror checkpoint_round's hardcodes
   (hasher.py: always full snapshot, metrics passthrough); timestamp is a
   fresh time.time() like the hasher's own default. Each mirrored choice is
   marked below with its source. session.py contains ZERO references to
   round_manager's module globals (grep-verifiable) — the residual risk is
   duplication drift inside run_round itself, not hidden session state.

3. make_clients(8) returns MockModelAdapters (DIDs "client-{i}", seeds
   0-7), not SimulatedClients. The session wraps them exactly like the
   C-story tests do: SimulatedClient(adapter, adapter.client_did) — same
   8 clients, same seeds, same DIDs as every measured number in this
   build. Client-3 is NOT armed here (Story G3); clean plumbing first.

Likewise the session OWNS a DriftMonitor for its whole life per the
design, but run_round ingests into its own internal monitor (same residue
class as the store — no monitor parameter exists). The owned monitor is
held for session-lifetime status reads and the future direct wiring.
"""

import asyncio
import os
import sys
import time

_SESSION_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(_SESSION_DIR)

for _d in (
    _REPO_ROOT,
    os.path.join(_REPO_ROOT, "auth-service"),
    os.path.join(_REPO_ROOT, "fl-orchestrator"),
    os.path.join(_REPO_ROOT, "rollback-service"),
):
    if _d not in sys.path:
        sys.path.insert(0, _d)

from shared.interfaces.schemas import Checkpoint
from shared.mock_model.mock_adapter import MockModelAdapter, make_golden_reference

from checkpoint_store.local_store import LocalCheckpointStore
from client_sim.partition import make_clients
from client_sim.simulated_client import SimulatedClient
from drift_monitor.window_tracker import DriftMonitor
from golden_reference.reference_stats import compute_reference_stats
from scoring.calibration import calibrate_threshold
from server.round_manager import run_round

# Stage literals reused exactly from the dashboards' SystemStage type, plus
# the idle rest state. Real processing time replaces the artificial pacing
# once the vision model adds actual training latency.
STAGES = (
    "idle",
    "collecting_updates",
    "authenticating_all",
    "aggregating",
    "checkpointing",
    "anchoring_chain",
    "drift_monitoring",
    "broadcasting",
)


class GatewaySession:
    def __init__(self, max_rounds: int = 20):
        self.current_round: int = 0
        self.current_stage: str = "idle"
        self.previous_checkpoint: Checkpoint | None = None
        self.checkpoint_registry: dict[str, str] = {}
        self.drift_monitor = DriftMonitor()
        self.round_history: list[dict] = []
        # Same 8 clients (seeds 0-7) as every measured number in this build.
        self.clients: list[SimulatedClient] = [
            SimulatedClient(adapter, adapter.client_did)
            for adapter in make_clients(8)
        ]
        # Real B4.5 numbers, computed once (C4 production flow verbatim).
        self.reference_stats: dict = compute_reference_stats(
            make_golden_reference()
        )
        self.reference_stats["calibrated_threshold"] = calibrate_threshold(
            self.reference_stats,
            [MockModelAdapter(f"calib-{i}", seed=100 + i) for i in range(5)],
        )
        self.global_model = MockModelAdapter("global", seed=0)
        self.checkpoint_store = LocalCheckpointStore()
        self.max_rounds: int = max_rounds
        self.autonomous_task: asyncio.Task | None = None  # Story G4

    async def advance_stage(self, stage: str) -> None:
        self.current_stage = stage
        # artificial pacing so dashboards polling at ~200-300ms intervals can observe stage progression; real processing time will replace this once the vision model adds actual training latency
        await asyncio.sleep(0.4)

    async def step_round(self) -> dict:
        if self.current_round >= self.max_rounds:
            return {"status": "max_rounds_reached"}
        self.current_round += 1
        await self.advance_stage("authenticating_all")
        await self.advance_stage("aggregating")
        registry_size_before = len(self.checkpoint_registry)
        summary = run_round(
            self.clients,
            self.current_round,
            self.reference_stats,
            self.global_model,
            previous_checkpoint=self.previous_checkpoint,
            checkpoint_registry=self.checkpoint_registry,
        )
        await self.advance_stage("checkpointing")
        await self.advance_stage("drift_monitoring")
        # New head, reconstructed from session-owned data only (see module
        # docstring note 2). run_round appends exactly one registry entry on
        # the passing path; with zero passing clients it checkpoints nothing
        # and the previous head stands.
        if len(self.checkpoint_registry) > registry_size_before:
            new_hash = next(reversed(self.checkpoint_registry))
            parent_hash = (
                self.previous_checkpoint.weights_hash
                if self.previous_checkpoint
                else None
            )
            self.previous_checkpoint = Checkpoint(
                round_number=self.current_round,
                weights_hash=new_hash,
                parent_hash=parent_hash,
                off_chain_uri=self.checkpoint_registry[new_hash],
                is_delta=False,  # mirrors checkpoint_round: always full snapshot
                reference_set_metrics={
                    "n_passed": summary["n_passed"],
                    "n_failed": summary["n_failed"],
                },
                timestamp=time.time(),
            )
        await self.advance_stage("broadcasting")
        self.round_history.append(summary)
        await self.advance_stage("idle")
        return summary
