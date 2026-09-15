"""Known-limitations endpoint (G8): plainly stated, evaluator-facing.

Every entry is cross-checked against the cited source — docstrings, contract
code, or prior epics' READMEs/build logs. Static list by design: it changes
only when a limitation is actually retired, in which case the entry is
removed (with its retiring commit), not edited into optimism.
"""

from fastapi import APIRouter

router = APIRouter()

LIMITATIONS: list[dict] = [
    {
        "id": "placeholder-reference-accuracy",
        "area": "drift / rollback",
        "summary": "Reference-set accuracy is a hardcoded constant (0.9) pending the vision model.",
        "detail": "fl-orchestrator/server/round_manager.py _PLACEHOLDER_ACCURACY = 0.9: B3's performance check exists but is not wired into rounds, so the drift monitor's accuracy-decline half can never fire on the real path (dashboards demo it with a labeled synthetic event).",
    },
    {
        "id": "drift-threshold-uncalibrated",
        "area": "drift / rollback",
        "summary": "The drift monitor's drift_threshold=2.0 was never recalibrated against real accuracy data.",
        "detail": "rollback-service/drift_monitor/window_tracker.py default. Follows from the above: with no real accuracy series, no calibration run is meaningful yet.",
    },
    {
        "id": "challenge-window-placeholder",
        "area": "disputes",
        "summary": "The 60s dispute challenge window is an unvalidated placeholder.",
        "detail": "gateway/session.py CHALLENGE_WINDOW_SECONDS. A real deployment needs this empirically tuned (operator response time), not guessed.",
    },
    {
        "id": "slash-percentage-placeholder",
        "area": "staking",
        "summary": "The 10% slash per finalized rejection is a policy stub, not economics.",
        "detail": "gateway/session.py SLASH_FRACTION. Not derived from any tokenomic analysis; no overturn path exists yet, so every filed dispute finalizes as rejected.",
    },
    {
        "id": "no-did-keypairs",
        "area": "identity",
        "summary": "No real DID keypair/signature infrastructure exists yet.",
        "detail": "Gateway registers placeholder pubkey strings (documented gap, G2); provenance-api passes signatures through unverified (entrypoint docstring: 'not verified (gateway scope)').",
    },
    {
        "id": "initial-stake-arbitrary",
        "area": "staking",
        "summary": "The 1 ETH initial stake is arbitrary; no tokenomics exist.",
        "detail": "gateway/session.py INITIAL_STAKE_WEI. Covers demo registration economics only.",
    },
    {
        "id": "run-round-residual-globals",
        "area": "orchestration",
        "summary": "run_round still owns module-level store/monitor/previous-checkpoint defaults internally.",
        "detail": "Gateway passes previous_checkpoint + checkpoint_registry explicitly and references zero module globals (G1 grep-proof), but the callee's own defaults persist — full removal needs a run_round return-contract change (return the Checkpoint; accept store/monitor).",
    },
    {
        "id": "no-per-client-verdicts",
        "area": "orchestration",
        "summary": "Round summaries carry totals only — no per-client verdicts, no Checkpoint object.",
        "detail": "Forces attribution-by-elimination for disputes, passed-counts that hold (never guess) on dirty rounds, and session-side head reconstruction mirroring hasher fields (all G1/G2/G6 documented).",
    },
    {
        "id": "attribution-on-hold",
        "area": "attribution",
        "summary": "Culprit attribution-service remains on hold; dashboards show a labeled placeholder.",
        "detail": "Standing scoping call for this batch; server dashboard SD10 panel + system-map node are grayed out, not functional.",
    },
    {
        "id": "vision-model-on-hold",
        "area": "vision",
        "summary": "All embeddings/weights are mock (seeded RNG); client non-IID-ness is just distinct seeds.",
        "detail": "shared/mock_model + client_sim/partition.py NOTE. Dashboard pacing (0.4s stage sleeps) is artificial and stands in for real training latency.",
    },
]


@router.get("/status/limitations")
async def list_limitations() -> list[dict]:
    return LIMITATIONS
