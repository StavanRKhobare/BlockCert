"""Provenance passport endpoints (G7): thin wrappers, no new logic.

POST /passport/events decodes the hex evidence transport and delegates to
provenance-api's submit_lifecycle_event; GET /passport/devices/{device_id}
delegates to get_passport_history. provenance-api does the real work
(hashing, chain submit, on-chain read-back).
"""

from fastapi import APIRouter
from pydantic import BaseModel

from sibling_import import load_provenance_entrypoint

router = APIRouter()

_prov = load_provenance_entrypoint()


class SubmitEventBody(BaseModel):
    device_id: str
    event_type: str
    # Hex transport for submit_lifecycle_event's `evidence: bytes` (JSON
    # carries no raw bytes) — decoded with bytes.fromhex before delegating.
    evidence_hex: str
    model_version_hash: str
    actor_did: str
    signature: str


@router.post("/passport/events")
async def submit_event(body: SubmitEventBody) -> dict:
    entry = _prov.submit_lifecycle_event(
        device_id=body.device_id,
        event_type=body.event_type,
        evidence=bytes.fromhex(body.evidence_hex),
        model_version_hash=body.model_version_hash,
        actor_did=body.actor_did,
        signature=body.signature,
    )
    return entry.model_dump()


@router.get("/passport/devices/{device_id}")
async def device_history(device_id: str) -> list[dict]:
    return [e.model_dump() for e in _prov.get_passport_history(device_id)]
