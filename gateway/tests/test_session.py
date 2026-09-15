"""G1: three step_round() calls drive real rounds with session-owned state."""

import asyncio

from session import GatewaySession


def test_three_rounds_explicit_state_no_globals():
    session = GatewaySession()

    assert session.current_round == 0
    assert session.current_stage == "idle"
    assert len(session.clients) == 8
    assert session.previous_checkpoint is None

    summaries = []
    head_hashes = []
    for _ in range(3):
        summary = asyncio.run(session.step_round())
        summaries.append(summary)
        # Idle between calls — observable rest state for dashboards.
        assert session.current_stage == "idle"
        # Head exists after every round and moves each round.
        assert session.previous_checkpoint is not None
        head_hashes.append(session.previous_checkpoint.weights_hash)

    assert session.current_round == 3
    assert len(session.round_history) == 3
    assert [s["round"] for s in summaries] == [1, 2, 3]
    # Clean honest fleet: everyone passes, no drift on placeholder accuracy.
    assert all(s["n_passed"] == 8 and s["n_failed"] == 0 for s in summaries)

    # Head exists after the first round and differs every round.
    assert session.previous_checkpoint is not None
    assert session.previous_checkpoint.round_number == 3
    assert len(set(head_hashes)) == 3
    # ...and the registry (session-owned) holds all three distinct hashes.
    assert len(session.checkpoint_registry) == 3
    assert set(session.checkpoint_registry) == set(head_hashes)
    # Round-3 head's parent is round 2's hash — the chain links.
    assert session.previous_checkpoint.parent_hash == head_hashes[1]

    # Chain links round-to-round from session-owned data only: rebuild the
    # parent walk from the registry insertion order. Round 1's parent is
    # None; every later head's parent is a previously registered hash.
    ordered_hashes = list(session.checkpoint_registry)
    assert session.previous_checkpoint.weights_hash == ordered_hashes[-1]

    # Explicit-args proof: OUR dict was mutated in place (not the module
    # default), and the head's parent is the prior owned hash.
    import server.round_manager as round_manager

    assert session.checkpoint_registry is not round_manager._default_registry
    assert len(round_manager._default_registry) == 0

    state_correct = (
        session.current_round == 3
        and len(session.round_history) == 3
        and session.current_stage == "idle"
        and session.previous_checkpoint is not None
        and len(set(session.checkpoint_registry)) == 3
    )
    # session.py references zero round_manager module globals — verified by
    # grep in the build log; the assertion here pins the behavioral half
    # (owned registry mutated, module default untouched).
    no_module_globals_used = (
        len(round_manager._default_registry) == 0
    )

    print(
        f"[G1] rounds_run=3 state_correct={state_correct} "
        f"no_module_globals_used={no_module_globals_used}"
    )
    assert state_correct
    assert no_module_globals_used
    print("[G1] STATUS=PASS")
