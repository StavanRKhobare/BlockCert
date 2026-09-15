"""G6 integration: failure → filed dispute → finalized → 10% slash."""

import asyncio

from session import GatewaySession


def test_dispute_file_finalize_slash():
    session = GatewaySession()
    # Short window for test speed (production default is 60s).
    session.challenge_window_seconds = 2
    victim = session.chain_dids[3]
    assert victim == "did:bfa:client-3"

    # Step through round 12: the armed attacker fails, a dispute opens.
    for _ in range(12):
        asyncio.run(session.step_round())
    assert session.current_round == 12
    assert len(session.open_disputes) == 1
    dispute_id = next(iter(session.open_disputes))
    record = session.open_disputes[dispute_id]
    dispute_filed = (
        record["did"] == victim
        and record["round_filed"] == 12
        and record["status"] == "open"
    )
    assert dispute_filed
    onchain_filed = session.dispute_client.get_dispute(dispute_id)
    assert onchain_filed["status"] == "ProvisionallyRejected"

    balance_before = session.staking_client.balance_of(victim)

    # Past the 2s test window, the next step finalizes and slashes. Chain
    # time only advances when blocks are mined AND jumps unpredictably
    # (observed: +67s for one block after idle, offsets accumulating from
    # prior test runs) — so wall sleeps and small jumps are both flaky.
    # Jump +500s instead: deadline (= file_ts + 2) is guaranteed past no
    # matter the stepping model. Standard time-lock test practice; shifts
    # the shared clock forward, timestamps only, nothing else in this
    # build depends on absolute chain time.
    w3 = session.dispute_client.w3
    w3.provider.make_request("evm_increaseTime", [500])
    w3.provider.make_request("evm_mine", [])
    head = int(w3.eth.get_block("latest").timestamp)
    assert head >= session.dispute_client.get_dispute(dispute_id)["deadline"]
    asyncio.run(session.step_round())
    assert session.current_round == 13

    record = session.open_disputes[dispute_id]
    onchain = session.dispute_client.get_dispute(dispute_id)
    dispute_finalized = (
        record["status"] == "finalized"
        and onchain["status"] == "FinalizedRejected"
    )
    assert dispute_finalized

    # No overturn mechanism exists, so finalization is always rejection —
    # the honest outcome given nothing disputes filed flags.
    balance_after = session.staking_client.balance_of(victim)
    expected_slash = balance_before // 10
    stake_slashed_correctly = (
        record.get("slashed_wei") == expected_slash
        and balance_after == balance_before - expected_slash
    )
    assert stake_slashed_correctly

    # Both dispute txs went through the shared transaction log.
    functions = [e["function_called"] for e in session.transaction_log]
    assert "fileFlag" in functions and "finalize" in functions
    assert "slash" in functions

    print(
        f"[G6] dispute_filed={dispute_filed} "
        f"dispute_finalized={dispute_finalized} "
        f"stake_slashed_correctly={stake_slashed_correctly}"
    )
    assert dispute_filed and dispute_finalized and stake_slashed_correctly
    print("[G6] STATUS=PASS")
