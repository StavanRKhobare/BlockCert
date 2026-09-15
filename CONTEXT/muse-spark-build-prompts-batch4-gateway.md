# BlockFedEDAuth-R — Muse Spark 1.3 Build Prompts, Batch 4, Epic G

Covers: **gateway** (the FastAPI service tying every prior epic together)
plus swapping both dashboards from mock data to real gateway polling.
Attribution-service and vision-model remain on hold, per your call.

## Ground rules

Same as every prior epic — one story at a time, exact signatures, print
`[STORY_ID] key=value` + `STATUS=PASS/FAIL`, README build log, one commit
per story.

## Before starting: keep the Hardhat node running continuously

Unlike every prior epic's per-story fresh-node-and-redeploy pattern,
gateway is meant to be a real running service — **start `npx hardhat node`
once, in its own terminal, and leave it running for this entire epic**
(redeploy once with `npm run deploy:localhost` at the start). This is the
"keep a node running continuously" idea flagged back during Story P0/P1 —
now it actually matters, since gateway's state (registered DIDs, stake
balances, round history) needs to persist and accumulate across the whole
epic's stories, not reset every time.

## Key design decision: no module-level globals

Every prior service (`round_manager.py` especially) used module-level
mutable globals (`_previous_checkpoint`, `_default_registry`,
`_default_monitor`) as a convenience default, which only worked because
tests were careful to reset them between runs — flagged as fragile back
during Stories C4/C5 review, specifically because it wouldn't hold up once
this became a real, possibly-concurrent service. **Gateway fixes this
properly**: all round state lives in one `GatewaySession` class instance
(Story G1), and every call into `fl-orchestrator`'s `run_round` explicitly
passes `previous_checkpoint`/`checkpoint_registry` from that session —
never relying on `round_manager`'s own module-level defaults. This
requires zero changes to `fl-orchestrator` itself (it already accepts
these as parameters); it's entirely about how gateway *calls* it.

## Repo layout this epic adds

```
gateway/
  session.py                    (G1)
  chain_bridge/
    did_client.py                 (G2)
    dispute_staking_client.py       (G6)
  routers/
    rounds.py                        (G3, G4)
    clients.py                        (G2)
    blockchain.py                      (G5)
    passport.py                         (G7)
    status.py                            (G8)
  main.py                                (G0, wires routers + CORS)
  requirements.txt
  tests/
```

## Story G0 — Project setup

**Prompt for Muse Spark:**
> Inside `gateway/`, set up a Python package: `requirements.txt` with
> `fastapi`, `uvicorn`, `web3`, `pydantic`, `pytest`, `httpx` (for testing
> FastAPI endpoints). Confirm `shared.interfaces.*`, `auth-service`'s
> `entrypoint`/`calibration`/`reference_stats`, `fl-orchestrator`'s
> `round_manager`/`client_sim`, `rollback-service`'s
> `checkpoint_store`/`drift_monitor`, `provenance-api`'s `entrypoint`, and
> a `ChainClient`-style connection to the deployed contracts ALL import
> correctly from `gateway/`'s working directory (same `sys.path` pattern
> used everywhere else — five sibling directories to reach this time, not
> one). Write a trivial `main.py` with a FastAPI app and a `GET /health`
> endpoint returning `{"status": "ok"}`. Write a test using `httpx`'s
> `TestClient` confirming `/health` returns 200. Print
> `[G0] all_sibling_imports_ok=True health_endpoint_ok=True` then
> `[G0] STATUS=PASS`.

**Commit:** `[G0] gateway project setup`

## Story G1 — GatewaySession (the state-management fix)

**Prompt for Muse Spark:**
> Write `gateway/session.py` with a class `GatewaySession`:
> - Constructor sets up: `current_round: int = 0`, `current_stage: str =
>   "idle"` (values matching the dashboards' `SystemStage` type — reuse
>   those exact string literals: `"collecting_updates"`,
>   `"authenticating_all"`, `"aggregating"`, `"checkpointing"`,
>   `"anchoring_chain"`, `"drift_monitoring"`, `"broadcasting"`, plus
>   `"idle"`), `previous_checkpoint: Checkpoint | None = None`,
>   `checkpoint_registry: dict[str, str] = {}`, `drift_monitor:
>   DriftMonitor` (one instance, lives for the session's whole life),
>   `round_history: list[dict] = []` (append each round's summary dict
>   after `run_round` returns), `clients: list[SimulatedClient]` (built
>   once via `make_clients(8)`, kept for the session's life so the SAME 8
>   clients persist across rounds — not rebuilt each round), `reference_stats:
>   dict` (computed once at construction via `compute_reference_stats` +
>   `calibrate_threshold`, the real B4.5 numbers), `max_rounds: int = 20`,
>   `autonomous_task: asyncio.Task | None = None` (Story G4 uses this).
> - Method `advance_stage(stage: str) -> None`: sets `current_stage`, then
>   `await asyncio.sleep(0.4)` (an artificial pause — comment clearly:
>   `# artificial pacing so dashboards polling at ~200-300ms intervals can
>   observe stage progression; real processing time will replace this once
>   the vision model adds actual training latency`). Make this method
>   `async`.
> - Method `async def step_round() -> dict`: if `current_round >=
>   max_rounds`, return `{"status": "max_rounds_reached"}` without doing
>   anything else. Otherwise: increment `current_round`, call
>   `advance_stage("authenticating_all")`, then
>   `advance_stage("aggregating")`, then call `run_round(self.clients,
>   self.current_round, self.reference_stats, <global model — construct
>   one `MockModelAdapter("global", seed=0)` once at construction, store
>   it as `self.global_model`>, checkpoint_store=<one
>   `LocalCheckpointStore()` instance, also constructed once and stored as
>   `self.checkpoint_store`>, previous_checkpoint=self.previous_checkpoint,
>   checkpoint_registry=self.checkpoint_registry)` — explicitly passing
>   ALL of these from `self`, never relying on `round_manager`'s own
>   module-level defaults, per this doc's "Key design decision" section
>   above. Then `advance_stage("checkpointing")`,
>   `advance_stage("drift_monitoring")`, update
>   `self.previous_checkpoint` from the round's returned `Checkpoint`,
>   `advance_stage("broadcasting")`, append the round's summary dict to
>   `self.round_history`, `advance_stage("idle")`, return the summary
>   dict. **This story does NOT arm client-3 as an attacker** — that's
>   Story G3, kept separate so this story's test can verify clean
>   plumbing first.
> - Also give clients seeds 0-7 matching the exact fleet used everywhere
>   else in this build (`make_clients(8)`), so this session's numbers are
>   consistent with everything already measured.
> Write `gateway/tests/test_session.py`: construct a `GatewaySession`,
> call `step_round()` three times (use `pytest-asyncio` or run via
> `asyncio.run` in the test), assert `current_round == 3` after,
> `len(round_history) == 3`, `current_stage == "idle"` between calls,
> `previous_checkpoint` is not `None` after the first call and its
> `weights_hash` differs each round. Print
> `[G1] rounds_run=3 state_correct=True no_module_globals_used=True` then
> `[G1] STATUS=PASS/FAIL`.

**Commit:** `[G1] GatewaySession — explicit state, no module-level globals`

## Story G2 — DID registration + client registry endpoints

**Prompt for Muse Spark:**
> Write `gateway/chain_bridge/did_client.py`: a `DIDClient` class
> following the exact same env-var/connect/load-ABI pattern as
> `rollback-service`'s `ChainClient` (Story D5) and `provenance-api`'s
> `PassportClient` (Story P1) — separate file, deliberately duplicated
> connection logic, not shared, same as those two — wrapping
> `DIDRegistry.sol`: `register_did(did: str, public_key: str,
> display_name: str) -> str` (returns tx hash), `is_registered(did: str)
> -> bool`, `get_did(did: str) -> dict`. Also add a `StakingClient` in the
> same file (or a sibling file — your call, keep it small either way)
> wrapping `Staking.sol`: `stake(did: str, amount_wei: int) -> str`,
> `balance_of(did: str) -> int`.
> Extend `GatewaySession` (Story G1): add a method `async def
> register_all_clients() -> None`, called once, that for each of the 8
> simulated clients registers a DID (`did:bfa:client-{i}`, a dummy
> public key string is fine — no real keypair infrastructure exists yet,
> comment this clearly as a known gap) via `DIDClient`, then stakes an
> initial amount (a placeholder value, e.g. `1_000_000_000_000_000_000`
> wei = 1 ETH-equivalent — clearly commented as an arbitrary placeholder,
> same honesty standard as every other placeholder number in this build)
> via `StakingClient`. Call this once at session construction (or lazily
> on first use — your call, document whichever).
> Write `gateway/routers/clients.py`: `GET /clients` returns a list of
> `{did, stake_balance, rounds_participated, rounds_passed}` per client
> (stake balance read live from `StakingClient.balance_of`, the round
> counts derived from `session.round_history`).
> Write `gateway/tests/test_clients_router.py` (integration test, needs
> the node running): construct a session, register all clients, call the
> endpoint via `TestClient`, assert 8 entries returned, each with a
> nonzero stake balance matching what was staked. Print
> `[G2] node_reachable=<bool> clients_registered=8
> stake_balances_correct=<bool>` then `[G2] STATUS=PASS/FAIL`.

**Commit:** `[G2] DID registration + client registry endpoint`

## Story G3 — Manual round-step endpoint (with the attacker scenario wired in)

**Prompt for Muse Spark:**
> Extend `GatewaySession.step_round()` (Story G1) to arm client-3 as
> poisoned from round 12 onward, EXACTLY matching Story C5's real,
> already-verified scenario (same `embed(poisoned=True)` /
> `run_round(inject_drift=True)` flag-patching approach C5 used — copy
> that pattern, don't reinvent it). Write `gateway/routers/rounds.py`:
> `POST /rounds/step` calls `session.step_round()` and returns its
> summary dict as the response body; `GET /rounds/current` returns
> `{current_round, current_stage, latest_summary}`; `GET /rounds/history`
> returns the full `round_history` list. Write
> `gateway/tests/test_rounds_step.py` (integration, needs the node
> running): call `POST /rounds/step` 15 times via `TestClient`, assert
> round 12 onward shows `n_failed >= 1` (matching C5's exact finding),
> assert `GET /rounds/current` reflects round 15 after, assert `GET
> /rounds/history` has exactly 15 entries. Print `[G3] rounds_stepped=15
> attacker_excluded_from_round_12=<bool> history_length_correct=<bool>`
> then `[G3] STATUS=PASS/FAIL`.

**Commit:** `[G3] Manual round-step endpoint with attacker scenario`

## Story G4 — Autonomous loop

**Prompt for Muse Spark:**
> Add to `gateway/routers/rounds.py`: `POST /rounds/autonomous/start`
> (body: `{"interval_seconds": float = 5.0}`) — starts a background
> `asyncio.Task` on `session.autonomous_task` that calls
> `session.step_round()` in a loop, sleeping `interval_seconds` between
> calls, stopping automatically once `current_round >= max_rounds`; use
> `starlette.concurrency.run_in_threadpool` for the underlying blocking
> chain calls inside `step_round()` if profiling shows the event loop
> blocking noticeably — comment either way explaining the choice made.
> `POST /rounds/autonomous/stop` cancels the task if running. `GET
> /rounds/autonomous/status` returns `{"running": bool, "current_round":
> int}`. Guard against starting a second autonomous task while one is
> already running (return a 409-style error response, don't silently spawn
> a duplicate). Write `gateway/tests/test_rounds_autonomous.py`: start
> autonomous mode with a short interval (e.g. `0.1` seconds for test
> speed), wait briefly, assert `current_round` increased without any
> manual `/rounds/step` calls; call stop, assert it stops advancing; assert
> starting a second time while already running returns an error rather
> than a second task. Print `[G4] autonomous_advances_rounds=<bool>
> stop_works=<bool> duplicate_start_rejected=<bool>` then
> `[G4] STATUS=PASS/FAIL`.

**Commit:** `[G4] Autonomous round loop`

## Story G5 — Blockchain transaction feed

**Prompt for Muse Spark:**
> Extend `GatewaySession`: add `transaction_log: list[dict] = []`; every
> place gateway makes a chain call anywhere in this epic (G2's DID
> registration/staking, G3's checkpoint anchoring which already happens
> inside `checkpoint_round` via Story D2.5's `chain_client` parameter —
> wire a real `ChainClient` instance into that call now, appending
> `{tx_hash, block_number, gas_used, function_called, contract_name,
> timestamp}` to `transaction_log` after each) should append a record
> here. Write `gateway/routers/blockchain.py`: `GET
> /blockchain/transactions` returns `transaction_log`, most recent first.
> Write `gateway/tests/test_blockchain_router.py`: after a few rounds and
> client registrations, assert the transaction log contains entries for
> both DID registration and checkpoint anchoring, each with a real-looking
> hex `tx_hash`. Print `[G5] transaction_log_populated=<bool>
> both_categories_present=<bool>` then `[G5] STATUS=PASS/FAIL`.

**Commit:** `[G5] Blockchain transaction feed`

## Story G6 — Real Dispute/Staking wiring (the deferred story from earlier)

**Prompt for Muse Spark:**
> Write `gateway/chain_bridge/dispute_staking_client.py` (or extend G2's
> file) wrapping `Dispute.sol`: `file_flag(did: str, round_number: int,
> reason: str, challenge_window_seconds: int) -> tuple[int, str]` (returns
> `(dispute_id, tx_hash)`), `finalize(dispute_id: int) -> str`,
> `get_dispute(dispute_id: int) -> dict`. Extend `GatewaySession.step_round()`:
> whenever a client's `SuspicionScore.passed` is `False`, call
> `file_flag(...)` with a `challenge_window_seconds` of `60` (an arbitrary
> placeholder, clearly commented as such — same honesty standard as every
> other placeholder in this build; a real deployment would need this
> empirically tuned, not guessed). Track open disputes in
> `session.open_disputes: dict[int, dict]`. On each subsequent
> `step_round()` call, check any open dispute past its deadline and call
> `finalize(...)`; if finalized as still-rejected (not overturned — no
> overturn mechanism is wired to anything yet, so in this build every
> filed dispute finalizes as rejected, which is honest given nothing
> currently disputes them), call `StakingClient.slash(did, amount, reason)`
> with `amount` = **10% of that client's current stake balance** (a
> placeholder policy, explicitly flagged — not derived from any real
> economic analysis). Write `gateway/tests/test_dispute_staking.py`
> (integration, needs the node running, and needs enough real time to
> pass the challenge window — use a short `challenge_window_seconds`
> override for the test, e.g. `2`, not the production `60`): step through
> rounds until client-3 fails (round 12+), assert a dispute was filed
> (check `session.open_disputes`), wait past the short test window, step
> again, assert the dispute finalized and client-3's on-chain stake
> balance decreased by the expected 10%. Print
> `[G6] dispute_filed=<bool> dispute_finalized=<bool>
> stake_slashed_correctly=<bool>` then `[G6] STATUS=PASS/FAIL`.

**Commit:** `[G6] Real Dispute/Staking wiring on authentication rejection`

## Story G7 — Provenance passport endpoints

**Prompt for Muse Spark:**
> Write `gateway/routers/passport.py`: `POST /passport/events` (body
> matching `submit_lifecycle_event`'s parameters) calls
> `provenance-api`'s `entrypoint.submit_lifecycle_event` directly and
> returns the resulting `PassportEntry`; `GET
> /passport/devices/{device_id}` calls `get_passport_history`. Thin
> wrapper, no new logic — `provenance-api` already does the real work.
> Write `gateway/tests/test_passport_router.py` (integration, needs the
> node running): submit two events for one device via the endpoint, fetch
> the history, assert both come back correctly. Print
> `[G7] submit_and_fetch_correct=<bool>` then `[G7] STATUS=PASS/FAIL`.

**Commit:** `[G7] Provenance passport endpoints`

## Story G8 — Known-limitations status endpoint

**Prompt for Muse Spark:**
> Write `gateway/routers/status.py`: `GET /status/limitations` returns a
> static (but accurate, cross-checked against this doc and prior epics'
> READMEs) list of currently-known placeholders/limitations, e.g.:
> reference-set accuracy is a hardcoded constant pending the vision model
> (Story B3 not fully wired), the drift monitor's `drift_threshold=2.0`
> was never recalibrated against real accuracy data, dispute
> challenge-window and slash-percentage are unvalidated placeholders
> (Story G6), no real DID keypair/signature infrastructure exists yet
> (Story G2). This is meant to be shown on a dashboard panel or mentioned
> directly in your evaluation — better to state limitations plainly than
> have an evaluator discover them unprompted. Write a trivial test
> confirming the endpoint returns a non-empty list. Print
> `[G8] limitations_documented=<N>` then `[G8] STATUS=PASS`.

**Commit:** `[G8] Known-limitations status endpoint`

## Story G9 — CORS + full gateway regression suite

**Prompt for Muse Spark:**
> In `main.py`, add FastAPI's `CORSMiddleware` allowing the two
> dashboards' dev-server origins (`http://localhost:5173` and whatever
> port the second Vite app uses if different — check both apps' actual
> dev ports and use those, don't guess). Run the full `gateway/tests/`
> suite (integration, needs the node running) with `pytest -v`. Print
> `[G9] total=<N> passed=<N> failed=<N>` then `[G9] STATUS=PASS` only if
> `failed == 0`.

**Commit:** `[G9] CORS configuration + full gateway test suite green`

## Story G10 — Swap `dashboard-client`'s mock feed for real gateway polling

**Prompt for Muse Spark:**
> Rewrite `dashboard-client/src/mock/useRoundFeed.ts` (Story CD2) to poll
> the real gateway instead of generating local mock data — but **keep its
> exact return shape identical** (`{currentRound, currentStage, isPlaying,
> play, pause, reset, step, suspicionHistory, checkpoints, stakeEvents,
> passportEntries}`), since every component from CD3-CD9 was written
> against that shape and must need zero changes. Rename the file's
> internals but keep the same exported hook name. Implementation: `play()`
> calls `POST {GATEWAY_URL}/rounds/autonomous/start`; `pause()` calls
> `/rounds/autonomous/stop`; `step()` calls `POST /rounds/step`; poll `GET
> /rounds/current` and `/rounds/history` on a fixed interval (e.g. every
> 1 second) via a `useEffect`, derive `currentRound`/`currentStage`/
> `suspicionHistory` (filtered to this hook's configured `clientDid`,
> default `"did:bfa:client-3"`) from the polled data. **`reset()` cannot
> genuinely reset real on-chain/session state** — make it a no-op that
> logs a clear console warning (`"reset() has no effect against live
> gateway data — restart the gateway process to reset"`) rather than
> pretending it works, since silently doing nothing would be worse than
> an honest no-op. Add a `GATEWAY_URL` constant (e.g. from a `.env` file,
> default `http://localhost:8000`). Update
> `useRoundFeed.test.ts`: since this is now a live-polling hook, either
> mock `fetch` calls in the test (preferred — keeps the test fast and not
> dependent on a running gateway) or mark the test as an integration test
> requiring gateway running — pick one and be consistent, document the
> choice. Print `[CD-G10] shape_unchanged=<bool>
> all_downstream_components_unaffected=<bool>` (confirm by running the
> FULL `dashboard-client` test suite from Story CD10 again — if any
> component test broke, the shape wasn't actually preserved) then
> `[CD-G10] STATUS=PASS/FAIL`.

**Commit:** `[CD-G10] Swap dashboard-client from mock to real gateway data`

## Story G11 — Swap `dashboard-server`'s mock feed for real gateway polling

**Prompt for Muse Spark:**
> Same pattern as Story G10, but for `dashboard-server/src/mock/useServerFeed.ts`
> (Story SD2) — poll `GET /rounds/current`, `/rounds/history`, `GET
> /clients`, `GET /blockchain/transactions`, `GET /passport/devices/...`
> (or a new `GET /passport/all` if the system-wide `ProvenanceLedger`
> panel needs an endpoint that doesn't exist yet — add
> `GET /passport/all` to `gateway/routers/passport.py` now if so, calling
> `provenance-api`'s history function once per known device, or extend
> `provenance-api`'s `entrypoint.py` with a genuine "all devices" query if
> the contract supports it; check `Passport.sol`'s actual interface before
> assuming — it currently only supports per-device lookup via
> `getEventsForDevice`, so an "all" endpoint may need to track submitted
> `device_id`s separately in `GatewaySession`, since the contract itself
> has no "list all devices" method). **One thing this story CANNOT swap
> to real data yet: the synthetic `DriftEvent` at round 17** (Story SD6) —
> the real drift monitor still can't trigger given the placeholder
> reference-set accuracy (documented in Story G8's limitations endpoint).
> Keep that one synthetic injection in place in the swapped hook, clearly
> commented as still-synthetic, rather than silently dropping the
> Drift-Monitor-panel's only demonstrable content. Run the full
> `dashboard-server` test suite (Story SD12) again after swapping, same
> "shape unchanged, nothing downstream broke" verification as G10. Print
> `[SD-G11] shape_unchanged=<bool> all_downstream_components_unaffected=<bool>
> synthetic_drift_event_still_present=<bool>` then
> `[SD-G11] STATUS=PASS/FAIL`.

**Commit:** `[SD-G11] Swap dashboard-server from mock to real gateway data`

---

## What's genuinely left after this epic

- `attribution-service` and `vision-model` — both on hold, by your
  standing choice, nothing here changes that.
- Real DID keypair/signature infrastructure (Story G2's placeholder public
  keys, Story P2's unverified `signature` passthrough) — documented as a
  known limitation (Story G8), not solved.
- Real reference-set accuracy, and therefore a real (non-synthetic) drift
  trigger — blocked on the vision model existing, same as always.
- Empirically-tuned economics (`drift_threshold=2.0`, dispute
  challenge-window, slash percentage) — all flagged placeholders, would
  need real measurement once real data exists to calibrate against, same
  category as the B4/B5 threshold work already done once.

At this point every module in the original folder-structure plan (other
than the two explicitly on-hold ones) is built, wired to real data, and
individually verified. Worth a final end-to-end walkthrough — start the
node, start gateway, start both dashboards, run an autonomous session
start to finish — before calling the system demo-ready.
