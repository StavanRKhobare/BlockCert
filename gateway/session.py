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
    _SESSION_DIR,  # gateway's own `chain_clients` shadows nothing
    # (renamed from chain_bridge: that top-level name belongs to
    # rollback-service's plain imports per G0 — see build log).
):
    if _d not in sys.path:
        sys.path.insert(0, _d)

from chain_clients.did_client import DIDClient, StakingClient
from chain_bridge.chain_client import ChainClient  # rollback-service's
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

# Round from which client-3 turns poisoned (Story C5's verified scenario).
ATTACK_START_ROUND = 12
ATTACK_CLIENT_INDEX = 3


# Placeholder initial stake: 1 ETH-equivalent in wei. Arbitrary — covers
# registration economics for the demo; a real value needs tokenomics this
# build does not have (same honesty standard as every other placeholder).
INITIAL_STAKE_WEI = 1_000_000_000_000_000_000


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
        # Every gateway-originated chain write appends one record here
        # (G5): {tx_hash, block_number, gas_used, function_called,
        # contract_name, timestamp}. Receipt data comes from the local
        # node, so logging is a read, never a second write.
        self.transaction_log: list[dict] = []
        self.chain_client = ChainClient()
        # On-chain identities, parallel to self.clients by index.
        self.did_client = DIDClient()
        self.staking_client = StakingClient()
        self.chain_dids: list[str] = [
            f"did:bfa:client-{i}" for i in range(len(self.clients))
        ]
        self.client_stats: dict[str, dict[str, int]] = {
            did: {"participated": 0, "passed": 0} for did in self.chain_dids
        }
        self._chain_ready = False
        # C5 attacker wiring (Story G3): flag-driven patches on client-3,
        # installed once here, flipped at ATTACK_START_ROUND in step_round.
        # Verbatim copy of test_full_simulation.py's pattern — poisoned
        # embeddings for auth, drifted training for aggregation weight.
        self._attacker_armed = {"on": False}
        victim_adapter = self.clients[ATTACK_CLIENT_INDEX].adapter
        orig_embed = victim_adapter.embed
        victim_adapter.embed = (
            lambda images=None, n=16, poisoned=False: orig_embed(
                images, n=n, poisoned=(poisoned or self._attacker_armed["on"])
            )
        )
        victim_client = self.clients[ATTACK_CLIENT_INDEX]
        orig_run_round = victim_client.run_round
        victim_client.run_round = lambda inject_drift=False: orig_run_round(
            inject_drift=(inject_drift or self._attacker_armed["on"])
        )
        # Eager when possible (tests, scripts — no running loop), lazy
        # otherwise: under ASGI a loop is already running at construction,
        # so routers call register_all_clients() first (idempotent) instead.
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            asyncio.run(self.register_all_clients())

    async def advance_stage(self, stage: str) -> None:
        self.current_stage = stage
        # artificial pacing so dashboards polling at ~200-300ms intervals can observe stage progression; real processing time will replace this once the vision model adds actual training latency
        await asyncio.sleep(0.4)

    def _log_tx(
        self, tx_hash: str, function_called: str, contract_name: str
    ) -> dict:
        """Append one transaction record from the local receipt."""
        receipt = self.did_client.w3.eth.get_transaction_receipt(tx_hash)
        record = {
            "tx_hash": tx_hash,
            "block_number": int(receipt.blockNumber),
            "gas_used": int(receipt.gasUsed),
            "function_called": function_called,
            "contract_name": contract_name,
            "timestamp": int(time.time()),
        }
        self.transaction_log.append(record)
        return record

    async def register_all_clients(self) -> None:
        """Register + fund all 8 clients on-chain, once (idempotent).

        Skips DIDs that are already registered and DIDs that already hold
        a balance, so reruns (and restarts against a live node) never
        double-register (the contract reverts) or double-stake. Safe to
        call repeatedly; routers call it before serving chain reads.
        """
        if self._chain_ready:
            return
        for i in range(len(self.clients)):
            did = self.chain_dids[i]
            if not self.did_client.is_registered(did):
                # Dummy public key: no real keypair infrastructure exists
                # yet (known gap) — the string is an opaque placeholder.
                tx = self.did_client.register_did(
                    did, f"placeholder-pubkey-client-{i}", f"Client {i}"
                )
                self._log_tx(tx, "registerDID", "DIDRegistry")
            if self.staking_client.balance_of(did) == 0:
                tx = self.staking_client.stake(did, INITIAL_STAKE_WEI)
                self._log_tx(tx, "stake", "Staking")
        self._chain_ready = True

    async def step_round(self) -> dict:
        if self.current_round >= self.max_rounds:
            return {"status": "max_rounds_reached"}
        self.current_round += 1
        if self.current_round >= ATTACK_START_ROUND:
            self._attacker_armed["on"] = True
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
            # Anchor the new head on-chain (G5). run_round never forwards a
            # chain client into checkpoint_round (no such parameter exists),
            # so nothing has anchored yet this round — gateway anchors the
            # same reconstructed head post-round instead of changing
            # fl-orchestrator. One anchor tx per checkpointed round.
            anchor_tx = self.chain_client.anchor_checkpoint(
                self.previous_checkpoint
            )
            self._log_tx(anchor_tx, "anchorCheckpoint", "CheckpointAnchor")
        await self.advance_stage("broadcasting")
        self.round_history.append(summary)
        # Per-client participation is certain (every client is submitted
        # every round); per-client PASS attribution is not — the summary
        # carries only totals. Passed counts advance for all clients on
        # clean rounds only; on rounds with failures they hold (unknown
        # attribution, never guessed). A future run_round returning
        # per-client verdicts removes this boundary.
        for stats in self.client_stats.values():
            stats["participated"] += 1
        if summary.get("n_failed", 0) == 0:
            for stats in self.client_stats.values():
                stats["passed"] += 1
        await self.advance_stage("idle")
        return summary
