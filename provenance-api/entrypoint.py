"""Public entrypoint for the provenance-api.

Thin orchestration over ``PassportClient`` (Story P1): hash evidence,
submit lifecycle events, and read back per-device histories as
``PassportEntry`` models.
"""

import hashlib
import time

from shared.interfaces.schemas import PassportEntry

from chain_bridge.passport_client import PassportClient

_VALID_EVENT_TYPES = (
    "repair",
    "resale",
    "refurbishment",
    "recycling",
    "inspection",
)


def submit_lifecycle_event(
    device_id: str,
    event_type: str,
    evidence: bytes,
    model_version_hash: str,
    actor_did: str,
    signature: str,
) -> PassportEntry:
    """Submit one device lifecycle event and return the full entry.

    ``signature`` is passed through as given, not verified (gateway scope).
    """
    if event_type not in _VALID_EVENT_TYPES:
        raise ValueError(f"invalid event type: {event_type!r}")
    evidence_hash = hashlib.sha256(evidence).hexdigest()
    # Chain write; the returned (entry_id, tx_hash) is not part of the
    # PassportEntry schema, so it is intentionally not kept here.
    PassportClient().submit_event(
        device_id, event_type, evidence_hash, model_version_hash, actor_did
    )
    return PassportEntry(
        device_id=device_id,
        event_type=event_type,
        evidence_hash=evidence_hash,
        model_version_hash=model_version_hash,
        actor_did=actor_did,
        signature=signature,
        timestamp=time.time(),
    )


def get_passport_history(device_id: str) -> list[PassportEntry]:
    """Return all entries for a device, oldest first."""
    client = PassportClient()
    entries = []
    for entry_id in client.get_events_for_device(device_id):
        event = client.get_event(entry_id)
        entries.append(
            PassportEntry(
                device_id=event["device_id"],
                event_type=event["event_type"],
                evidence_hash=event["evidence_hash"],
                model_version_hash=event["model_version_hash"],
                # Chain reads carry no signature; signing happens at submit.
                actor_did=event["actor_did"],
                signature="",
                timestamp=float(event["timestamp"]),
            )
        )
    entries.sort(key=lambda e: e.timestamp)
    return entries
