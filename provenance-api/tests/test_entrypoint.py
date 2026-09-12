"""Integration test for the provenance-api entrypoint (needs the node running)."""

import hashlib
import uuid

import pytest

from entrypoint import get_passport_history, submit_lifecycle_event


def test_submit_and_history_roundtrip():
    # Unique device IDs per run so the test is safe to re-run against a
    # reused chain (a second run would otherwise see the first run's entries).
    device_id = f"device-p2-history-{uuid.uuid4().hex[:8]}"

    first = submit_lifecycle_event(
        device_id,
        "repair",
        b"repair-evidence-bytes",
        "model-v1",
        "did:example:tech-1",
        "sig-repair",
    )
    second = submit_lifecycle_event(
        device_id,
        "resale",
        b"resale-evidence-bytes",
        "model-v2",
        "did:example:seller-1",
        "sig-resale",
    )

    history = get_passport_history(device_id)
    history_length_ok = len(history) == 2
    assert history_length_ok
    order_correct = (
        history[0].timestamp <= history[1].timestamp
        and history[0].event_type == "repair"
        and history[1].event_type == "resale"
    )
    assert order_correct
    assert history[0].device_id == device_id
    assert history[0].evidence_hash == hashlib.sha256(
        b"repair-evidence-bytes"
    ).hexdigest()
    assert history[0].model_version_hash == "model-v1"
    assert history[0].actor_did == "did:example:tech-1"
    assert history[1].evidence_hash == hashlib.sha256(
        b"resale-evidence-bytes"
    ).hexdigest()
    assert history[1].actor_did == "did:example:seller-1"
    assert first.signature == "sig-repair"
    assert second.signature == "sig-resale"

    # Invalid event types fail fast locally: no chain call is made, so a
    # fresh device still has an empty history afterward.
    # Invalid event types fail fast locally: no chain call is made, so the
    # same fresh device still has an empty history afterward.
    fresh_id = f"device-p2-fresh-{uuid.uuid4().hex[:8]}"
    with pytest.raises(ValueError):
        submit_lifecycle_event(
            fresh_id,
            "not-a-real-type",
            b"whatever",
            "model-v1",
            "did:example:tech-1",
            "sig-x",
        )
    invalid_event_type_rejected_locally = get_passport_history(fresh_id) == []
    assert invalid_event_type_rejected_locally

    print(
        f"[P2] history_length=2 order_correct={order_correct} "
        f"invalid_event_type_rejected_locally="
        f"{invalid_event_type_rejected_locally}"
    )
