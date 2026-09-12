"""Public entrypoint for the provenance-api.

Thin orchestration over ``PassportClient`` (Story P1): hash evidence,
submit lifecycle events, and read back per-device histories as
``PassportEntry`` models.
"""

import hashlib

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
    The returned entry is built from an immediate on-chain read-back, so
    submission and later retrieval source the same record.
    """
    if event_type not in _VALID_EVENT_TYPES:
        raise ValueError(f"invalid event type: {event_type!r}")
    evidence_hash = hashlib.sha256(evidence).hexdigest()
    entry_id, _tx_hash = PassportClient().submit_event(
        device_id,
        event_type,
        evidence_hash,
        model_version_hash,
        actor_did,
        signature,
    )
    event = PassportClient().get_event(entry_id)
    return PassportEntry(
        device_id=event["device_id"],
        event_type=event["event_type"],
        evidence_hash=event["evidence_hash"],
        model_version_hash=event["model_version_hash"],
        actor_did=event["actor_did"],
        signature=event["signature"],
        timestamp=float(event["timestamp"]),
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
                actor_did=event["actor_did"],
                signature=event["signature"],
                timestamp=float(event["timestamp"]),
            )
        )
    entries.sort(key=lambda e: e.timestamp)
    return entries
