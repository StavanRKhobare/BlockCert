"""Integration test for ChainClient — needs the real Hardhat node running.

Start it with `npx hardhat node` from blockchain/ (plus
`npm run deploy:localhost`) before running this file. If the node is not
reachable the test fails here with node_reachable=False — never faked.
"""

import os

import pytest
from shared.interfaces.schemas import Checkpoint

from chain_bridge.chain_client import ChainClient

_DEPLOYMENTS_DIR = os.path.normpath(
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "..",
        "blockchain",
        "deployments",
        "localhost",
    )
)


def test_anchor_checkpoint_roundtrip():
    try:
        client = ChainClient(deployments_dir=_DEPLOYMENTS_DIR)
    except ConnectionError:
        print("[D5] node_reachable=False")
        pytest.fail("Hardhat node not reachable at 127.0.0.1:8545")
    node_reachable = True

    checkpoint = Checkpoint(
        round_number=1,
        weights_hash="hash-d5",
        parent_hash="",
        off_chain_uri="local://d5-checkpoint-1",
        is_delta=False,
        reference_set_metrics={"accuracy": 0.9},
    )
    tx_hash = client.anchor_checkpoint(checkpoint)

    stored = client.contract.functions.getCheckpoint(0).call()
    roundtrip_confirmed = stored[1] == "hash-d5"

    assert tx_hash.startswith("0x")
    assert roundtrip_confirmed

    print(
        f"[D5] node_reachable={node_reachable} tx_hash={tx_hash} "
        f"roundtrip_confirmed={roundtrip_confirmed}"
    )
