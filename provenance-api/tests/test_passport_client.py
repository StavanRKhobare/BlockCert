"""Integration test for PassportClient — needs the real Hardhat node running.

Start it with `npx hardhat node` from blockchain/ (plus
`npm run deploy:localhost`) before running this file. If the node is not
reachable the test fails here with node_reachable=False — never faked.
"""

import os

import pytest

from chain_bridge.passport_client import PassportClient

_DEPLOYMENTS_DIR = os.path.normpath(
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "..",
        "blockchain",
        "deployments",
        "localhost",
    )
)


def test_passport_client_roundtrip():
    try:
        client = PassportClient(deployments_dir=_DEPLOYMENTS_DIR)
    except ConnectionError:
        print("[P1] node_reachable=False")
        pytest.fail("Hardhat node not reachable at 127.0.0.1:8545")
    node_reachable = True

    device_id = "device-p1"
    entry_id, tx_hash = client.submit_event(
        device_id,
        "repair",
        "evidence-p1-repair",
        "model-v1",
        "did:example:tech-1",
        "sig-p1-repair",
    )
    assert isinstance(entry_id, int) and entry_id >= 0
    assert tx_hash.startswith("0x") and len(tx_hash) == 66

    event = client.get_event(entry_id)
    roundtrip_exact = event == {
        "device_id": device_id,
        "event_type": "repair",
        "evidence_hash": "evidence-p1-repair",
        "model_version_hash": "model-v1",
        "actor_did": "did:example:tech-1",
        "signature": "sig-p1-repair",
        "timestamp": event["timestamp"],
    }
    assert roundtrip_exact

    second_id, _ = client.submit_event(
        device_id,
        "inspection",
        "evidence-p1-inspection",
        "model-v1",
        "did:example:inspector-1",
        "sig-p1-inspection",
    )
    entry_ids = client.get_events_for_device(device_id)
    two_events_same_device = entry_ids == [entry_id, second_id]
    assert two_events_same_device

    print(
        f"[P1] node_reachable={node_reachable} entry_id={entry_id} "
        f"tx_hash={tx_hash} roundtrip_exact={roundtrip_exact} "
        f"two_events_same_device={two_events_same_device}"
    )
