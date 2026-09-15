"""G7 integration: submit two device events, fetch history back."""

import asyncio
import hashlib

import httpx


def _request(app, method: str, path: str, body: dict | None = None):
    async def _fetch():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            return await client.request(method, path, json=body)

    return asyncio.run(_fetch())


def test_submit_and_fetch_device_history():
    from main import app

    device_id = "did:bfa:g7-device"
    payloads = [
        {
            "device_id": device_id,
            "event_type": "repair",
            "evidence_hex": b"g7-repair-evidence".hex(),
            "model_version_hash": "0x" + "ab" * 32,
            "actor_did": "did:bfa:client-1",
            "signature": "0xg7-sig-001",
        },
        {
            "device_id": device_id,
            "event_type": "inspection",
            "evidence_hex": b"g7-inspection-evidence".hex(),
            "model_version_hash": "0x" + "cd" * 32,
            "actor_did": "did:bfa:client-1",
            "signature": "0xg7-sig-002",
        },
    ]

    submitted = []
    for payload in payloads:
        response = _request(app, "POST", "/passport/events", payload)
        assert response.status_code == 200, response.text
        submitted.append(response.json())

    # Entries echo the submission, with server-hashed evidence.
    for payload, entry in zip(payloads, submitted):
        assert entry["device_id"] == device_id
        assert entry["event_type"] == payload["event_type"]
        assert entry["actor_did"] == payload["actor_did"]
        assert entry["signature"] == payload["signature"]
        assert entry["evidence_hash"] == hashlib.sha256(
            bytes.fromhex(payload["evidence_hex"])
        ).hexdigest()

    # History returns both (plus anything from prior runs against the
    # continuous node — assert presence, not exact count).
    history = _request(app, "GET", f"/passport/devices/{device_id}").json()
    submitted_hashes = {e["evidence_hash"] for e in submitted}
    fetched_hashes = {e["evidence_hash"] for e in history}
    submit_and_fetch_correct = submitted_hashes <= fetched_hashes and len(
        submitted_hashes
    ) == 2
    assert submit_and_fetch_correct

    print(f"[G7] submit_and_fetch_correct={submit_and_fetch_correct}")
    assert submit_and_fetch_correct
    print("[G7] STATUS=PASS")
