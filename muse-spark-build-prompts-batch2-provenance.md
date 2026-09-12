# BlockFedEDAuth-R — Muse Spark 1.3 Build Prompts, Batch 2, Epic P

Covers: **provenance-api** only. `gateway` follows once this is done and
reviewed (per your request). Same ground rules as Batch 1 apply — see that
doc's Section 0 (one story at a time, never touch `shared/`, print
`[STORY_ID] key=value` + `STATUS=PASS/FAIL`, README build log, one commit
per story). Paste Section 0 again if starting a fresh Muse Spark session.

## Prerequisite

Epic A's `Passport.sol` (Story A5) must be deployed — i.e.
`blockchain/deployments/localhost/Passport.json` must exist (Story A7), and
`npx hardhat node` must be running for any story below marked "requires a
running node."

## Repo layout this epic adds

```
provenance-api/
  chain_bridge/passport_client.py
  entrypoint.py
  requirements.txt
  tests/test_passport_client.py
  tests/test_entrypoint.py
```

## Scoping decisions (stated explicitly so nothing is assumed)

- **This is a plain importable Python module, not an HTTP service** — same
  style as `auth-service`/`fl-orchestrator`/`rollback-service` so far.
  Turning it into an HTTP endpoint is `gateway`'s job (it will import and
  call these functions directly, the same way `round_manager` imports
  `score_client`).
- **Evidence hashing happens inside this module, not the caller's
  responsibility** — `submit_lifecycle_event` takes raw `evidence: bytes`
  and computes `hashlib.sha256(evidence).hexdigest()` internally, so every
  caller hashes evidence identically. Do not accept a pre-computed hash
  string instead.
- **No cryptographic signature verification at this layer yet** —
  `actor_did` and `signature` are plain pass-through string parameters,
  stored as given, not verified against a real key. Real DID/signing
  enforcement is deferred to `gateway` (noted as an open item, not silently
  skipped — see Batch 1 doc's integration-contract discussion of DIDs).
- **Does not reuse `rollback-service/chain_bridge/chain_client.py`** — it
  gets its own `passport_client.py`, built the same way (same env-var
  pattern, same connect-and-load-ABI approach) but as a separate file.
  This is deliberate duplication, not an oversight: keeping each service's
  blockchain wiring self-contained is what lets you change one without
  risking the other, matching the project's stated modularity goal.

## Story P0 — Project setup

**Prompt for Muse Spark:**
> Inside `provenance-api/`, set up a Python package with
> `requirements.txt` containing `web3`, `pydantic`, `pytest`. Create empty
> `__init__.py`s so `chain_bridge/` and `tests/` are importable. Confirm
> `shared.interfaces.schemas.PassportEntry` imports correctly from
> `provenance-api/`'s working directory (same `sys.path` approach used in
> Stories B0/C0/D0 — do not copy the file). Print
> `[P0] shared_imports_ok=True` then `[P0] STATUS=PASS`.

**Commit:** `[P0] provenance-api project setup`

## Story P1 — Passport chain client

**Prompt for Muse Spark:**
> Write `provenance-api/chain_bridge/passport_client.py` with a class
> `PassportClient(rpc_url: str = None, deployments_dir: str = None)` —
> same env-var-with-default pattern as `rollback-service`'s `ChainClient`
> (Story D5): `rpc_url` defaults from `CHAIN_RPC_URL` env var
> (`"http://127.0.0.1:8545"` if unset), `deployments_dir` defaults from
> `CHAIN_DEPLOYMENTS_DIR` env var
> (`"../blockchain/deployments/localhost"` if unset). On init, connect via
> `web3.Web3(web3.HTTPProvider(rpc_url))`, load `Passport.json` from
> `deployments_dir`, instantiate the contract from its `address`+`abi`.
> Methods:
> - `submit_event(device_id: str, event_type: str, evidence_hash: str,
>   model_version_hash: str, actor_did: str, signature: str) -> tuple[int, str]`
>   (note: `signature` was added in Story A5.1 — the contract's
>   `submitEvent` now takes 6 arguments, not 5) — calls the contract's
>   `submitEvent(...)`, using `web3.eth.accounts[0]` to send
>   the transaction (same as D5), waits for the receipt, returns
>   `(entry_id, tx_hash)` — extract `entry_id` from the transaction
>   receipt's emitted `PassportEventSubmitted` event, do not assume it
>   equals a simple counter you track client-side (the contract is the
>   source of truth).
> - `get_events_for_device(device_id: str) -> list[int]` — calls
>   `getEventsForDevice(...)`, returns the list of entry IDs as Python
>   ints.
> - `get_event(entry_id: int) -> dict` — calls `getEvent(...)`, returns a
>   plain dict with keys matching the contract's return tuple
>   (`device_id`, `event_type`, `evidence_hash`, `model_version_hash`,
>   `actor_did`, `signature`, `timestamp`) — do NOT construct a
>   `PassportEntry` here,
>   that's Story P2's job (this method stays a thin, honest wrapper around
>   the contract call).
> If the node isn't reachable, raise a clear `ConnectionError` telling the
> user to start `npx hardhat node` — do not fail silently, do not fall
> back to a mock (same rule as D5). Write
> `provenance-api/tests/test_passport_client.py` (integration test,
> requires the node running): submit one event, confirm the returned
> `entry_id` is a non-negative int and `tx_hash` looks like a real hex
> transaction hash (starts with `0x`); call `get_event` on that ID and
> confirm every field round-trips exactly, including `signature`; submit a
> second event for the
> SAME `device_id` and confirm `get_events_for_device` returns both IDs.
> Print `[P1] node_reachable=<bool> entry_id=<n> tx_hash=<hash>
> roundtrip_exact=<bool> two_events_same_device=<bool>` then
> `[P1] STATUS=PASS/FAIL`. If the node isn't reachable, print
> `[P1] node_reachable=False` and stop — do not fabricate a pass.

**Commit:** `[P1] Passport chain client`

## Story P2 — Public entrypoint

**Prompt for Muse Spark:**
> Write `provenance-api/entrypoint.py` with:
> - `def submit_lifecycle_event(device_id: str, event_type: str,
>   evidence: bytes, model_version_hash: str, actor_did: str,
>   signature: str) -> PassportEntry` (import `PassportEntry` from
>   `shared.interfaces.schemas` — do not redefine it). Steps: validate
>   `event_type` is one of `"repair"`, `"resale"`, `"refurbishment"`,
>   `"recycling"`, `"inspection"` — raise `ValueError` immediately if not,
>   BEFORE calling the chain (fail fast locally; don't waste a transaction
>   on input the contract will reject anyway). Compute
>   `evidence_hash = hashlib.sha256(evidence).hexdigest()`. Call
>   `entry_id, _tx_hash = PassportClient().submit_event(device_id,
>   event_type, evidence_hash, model_version_hash, actor_did, signature)`
>   (Story P1 — KEEP `entry_id`, don't discard it). Then immediately call
>   `PassportClient().get_event(entry_id)` and build the returned
>   `PassportEntry` using THAT call's `signature` and `timestamp` values —
>   not the locally-passed `signature` string directly, and not
>   `time.time()`. This guarantees a freshly-submitted entry and that same
>   entry read back later via `get_passport_history` are sourced from the
>   identical on-chain record, not two different notions of "when"/"signed
>   by whom."
> - `def get_passport_history(device_id: str) -> list[PassportEntry]` —
>   calls `PassportClient().get_events_for_device(device_id)`, then
>   `get_event(...)` for each ID, converts each result dict into a
>   `PassportEntry` (using the real `event["signature"]`, not a hardcoded
>   `""`), returns the list sorted by `timestamp` ascending.
> Write `provenance-api/tests/test_entrypoint.py` (integration test,
> requires the node running): call `submit_lifecycle_event` twice for the
> same `device_id` (use a `uuid`-suffixed device_id so the test is safe to
> rerun against a chain that isn't freshly redeployed each time) with
> different `event_type`s (e.g. `"repair"` then
> `"resale"`), then call `get_passport_history` and assert it returns
> exactly 2 entries in the correct chronological order with all fields
> matching what was submitted, INCLUDING asserting the first call's
> returned `PassportEntry.signature`/`.timestamp` exactly equal what
> `get_passport_history` later returns for that same entry (this is the
> check that catches a submit-time/read-time inconsistency, which an
> earlier version of this spec didn't test for); separately, assert calling
> `submit_lifecycle_event` with an invalid `event_type` (e.g.
> `"not-a-real-type"`) raises `ValueError` WITHOUT making any chain call
> (check this against the SAME fresh, unique `device_id` you attempted the
> submission with — not a different one — since that's what actually
> proves no chain write happened for that specific attempt). Print
> `[P2] history_length=2 order_correct=<bool>
> invalid_event_type_rejected_locally=<bool>
> signature_and_timestamp_consistent=<bool>` then `[P2] STATUS=PASS/FAIL`.

**Commit:** `[P2] provenance-api public entrypoint`

## Story P3 — Full regression suite

**Prompt for Muse Spark:**
> Same pattern as Story B6/C6/D6: run `provenance-api/tests/` with
> `pytest -v` (requires the node running, since both test files are
> integration tests). Print `[P3] total=<N> passed=<N> failed=<N>` then
> `[P3] STATUS=PASS` only if `failed == 0`.

**Commit:** `[P3] provenance-api full test suite green`

---

## What's still open after this epic

- `gateway` — will wire `provenance-api` in alongside auth/fl/rollback,
  will add the real HTTP layer every service currently lacks, and will
  carry the Dispute/Staking-triggering follow-up story we just discussed
  (stubbed until then).
- Real signature verification for `actor_did`/`signature` — deferred to
  gateway's DID-wiring work, not this epic.
- `dashboard` — comes after `gateway`, since it talks to gateway's API,
  not directly to each service. No attribution-service panel, per your
  call above.
