# BlockFedEDAuth-R — Muse Spark 1.3 Build Prompts, Batch 1

Covers: **Blockchain layer, auth-service, fl-orchestrator, rollback-service.**
Explicitly out of scope this batch: attribution-service, provenance-api,
gateway, dashboard, vision-model (see Section 1.4).

No Docker anywhere in this batch. Blockchain = TypeScript/Hardhat, run as a
local npm process. Everything else = Python.

---

## 0. Ground rules — give this to Muse Spark before Story A0

Paste this once, at the very start of your first session, before any story prompt:

> You are building one story at a time from a fixed spec. Rules for every story:
> 1. Only build the ONE story I give you in this message. Do not build ahead, do
>    not build other epics, do not "helpfully" add features not listed.
> 2. Do not modify any file under `shared/` for any reason. If you believe a
>    change there is required, STOP and tell me why instead of making it.
> 3. When a story's prompt gives exact function/class signatures, use them
>    exactly — same names, same argument names, same return types. Do not
>    rename anything for style reasons.
> 4. At the end of every story, run the verification script specified in the
>    prompt and print its output using the `[STORY_ID] key=value` format
>    given in the prompt, ending with `[STORY_ID] STATUS=PASS` or
>    `[STORY_ID] STATUS=FAIL`. Show me this output before we move on.
> 5. Append a bullet to that module's `README.md` under a `## Build Log`
>    heading (create the heading if it doesn't exist): `- [STORY_ID] <what you
>    built> — files: <list>`.
> 6. After the printed output shows STATUS=PASS, run `git add -A && git commit
>    -m "[STORY_ID] <short description>"`. One commit per story, never batch
>    multiple stories into one commit.
> 7. If anything in a prompt is ambiguous or missing information you need,
>    stop and ask me before writing code. Do not guess.

---

## 1. Integration contract — applies to every epic below

### 1.1 Repo layout this batch adds

```
blockfededauth-r/
  shared/                          <- EXISTING, do not touch (see 1.2)
  blockchain/
    contracts/
      CheckpointAnchor.sol
      DIDRegistry.sol
      Staking.sol
      Dispute.sol
      Passport.sol
    scripts/deploy.ts
    test/*.test.ts
    hardhat.config.ts
    package.json
    deployments/localhost/
      CheckpointAnchor.json        <- {address, abi} written by deploy.ts
      DIDRegistry.json
      Staking.json
      Dispute.json
      Passport.json
  auth-service/
    golden_reference/reference_stats.py
    scoring/suspicion.py
    scoring/reference_perf_check.py
    scoring/combined.py
    entrypoint.py
    tests/test_auth_service.py
  fl-orchestrator/
    client_sim/simulated_client.py
    client_sim/partition.py
    server/round_manager.py
    server/aggregate.py
    tests/test_fl_orchestrator.py
  rollback-service/
    checkpoint_store/hasher.py
    checkpoint_store/local_store.py
    checkpoint_store/delta.py
    drift_monitor/window_tracker.py
    drift_monitor/rollback_executor.py
    chain_bridge/chain_client.py
    tests/test_rollback_service.py
```

### 1.2 The existing `shared/` contract (ground truth — verbatim, do not regenerate)

Muse Spark must treat these three files as fixed and import from them, never
redefine equivalents locally. Paste these into Muse Spark's context at the
start of Epics B, C, and D so it has the exact, real signatures instead of
guessing:

**`shared/interfaces/model_adapter.py`** — abstract methods every service
codes against: `get_weights() -> dict[str, np.ndarray]`,
`set_weights(weights: dict[str, np.ndarray]) -> None`,
`local_train(local_data, epochs=1) -> dict[str, np.ndarray]`,
`embed(images) -> np.ndarray` (shape `(N, D)`),
`predict_anomaly_score(images) -> np.ndarray` (shape `(N,)`),
`model_id() -> str`.

**`shared/interfaces/schemas.py`** — Pydantic models: `ClientDID`,
`ClientUpdate`, `SuspicionScore`, `AuthDecision` (enum), `Checkpoint`,
`DriftEvent`, `AttributionResult`, `StakeEvent`, `PassportEntry`. Full field
lists are in the file itself — read it, don't retype it from memory.

**`shared/mock_model/mock_adapter.py`** — `MockModelAdapter(client_did, seed)`
implementing `ModelAdapter`, plus `make_golden_reference(n_clients=5, seed=42)
-> np.ndarray`. Weight shapes: `{"layer1": (16,16), "layer2": (8,8), "head":
(4,)}`. Embedding dim: 32. Supports `local_train(inject_drift=True)` and
`embed(poisoned=True)` to simulate an attacker.

### 1.3 Cross-service touchpoints (exact — this is what makes the four epics fit together later)

| # | Caller | Calls | Signature | Returns |
|---|---|---|---|---|
| 1 | `fl-orchestrator/server/round_manager.py` | `auth-service/entrypoint.py` | `score_client(client_did: str, round_number: int, embeddings: np.ndarray, reference_stats: dict) -> SuspicionScore` | Only clients with `SuspicionScore.passed == True` are included in that round's FedAvg aggregation. |
| 2 | `fl-orchestrator/server/round_manager.py` | `rollback-service/checkpoint_store/hasher.py` | `checkpoint_round(round_number: int, weights: dict[str, np.ndarray], reference_set_metrics: dict, store: LocalCheckpointStore, previous_checkpoint: Checkpoint \| None, full_snapshot_interval: int = 5, chain_client: ChainClient \| None = None) -> Checkpoint` (built in **Story D2.5**, not D1 — D1 only built the hashing primitives it depends on) | Called once per round, immediately after aggregation succeeds, before broadcasting weights back to clients. `store` and `previous_checkpoint` (the prior round's returned `Checkpoint`, or `None` on round 1) are the caller's responsibility to keep and pass in. `chain_client` is optional and best-effort — see D2.5. |
| 3 | `fl-orchestrator/server/round_manager.py` | `rollback-service/drift_monitor/window_tracker.py` | `ingest_round(round_number: int, suspicion_scores: list[SuspicionScore], reference_set_accuracy: float) -> DriftEvent \| None` | Called once per round, right after touchpoint #2. If it returns a `DriftEvent` (not `None`), round_manager MUST call touchpoint #4 before proceeding to the next round. |
| 4 | `fl-orchestrator/server/round_manager.py` | `rollback-service/drift_monitor/rollback_executor.py` | `execute(drift_event: DriftEvent, model_adapter: ModelAdapter, store: LocalCheckpointStore, checkpoint_registry: dict[str, str]) -> None` (real signature from Story D4 — this table previously listed a 2-argument version, corrected after the mismatch was caught before C4's resume) | Restores `model_adapter`'s weights in place via `model_adapter.set_weights(...)` from the checkpoint named in `drift_event.reverted_to_checkpoint_hash`. `checkpoint_registry` maps `weights_hash -> off_chain_uri` for EVERY round checkpointed so far, not just the latest — `round_manager` owns this dict and must append `{checkpoint.weights_hash: checkpoint.off_chain_uri}` to it after every successful `checkpoint_round` call (touchpoint #2), since a drift event can point back further than one round. `store` is the same `LocalCheckpointStore` instance `round_manager` already threads through touchpoint #2. |
| 5 | `rollback-service/checkpoint_store/hasher.py` | `rollback-service/chain_bridge/chain_client.py` | `anchor_checkpoint(checkpoint: Checkpoint) -> str` | Returns a transaction hash. Reads the deployed `CheckpointAnchor` contract's address+ABI from `blockchain/deployments/localhost/CheckpointAnchor.json`. |
| 6 | anything using `chain_client.py` | — | Reads `CHAIN_RPC_URL` env var, default `http://127.0.0.1:8545`; reads `CHAIN_DEPLOYMENTS_DIR` env var, default `../blockchain/deployments/localhost`. | A Hardhat node (`npx hardhat node`, Epic A) must already be running in its own terminal before any test that exercises touchpoint #5 or #6. |

### 1.4 Explicitly out of scope this batch (do not build, do not stub beyond what's listed above)

- `attribution-service/` — depends on `DriftEvent`s existing first (this batch builds that).
- `provenance-api/`, `gateway/`, `dashboard/` — depend on all four services below existing first.
- `vision-model/` — separate teammate track, untouched by this batch.
- Wiring `Staking`/`Dispute` contract calls to actual auth-service rejections — the contracts get built in Epic A (so the blockchain layer is complete on its own), but *triggering* stake/slash/dispute from a real rejection is a `gateway` responsibility, batch 2. Epic A's tests exercise these contracts standalone with dummy addresses/DIDs, not via auth-service.

### 1.5 Printed verification convention (use for every story)

Every story's test/verification script prints one line per fact being
confirmed, prefixed with the story ID, then a final status line:

```
[A2] contract=CheckpointAnchor deployed_address=0x... 
[A2] tx_confirmed=True gas_used=123456
[A2] STATUS=PASS
```

Paste this exact console output back into this chat after each story so it
can be checked before moving to the next one.

---

## 2. EPIC A — Blockchain layer (TypeScript / Hardhat, no Docker)

**Prerequisite:** Node.js + npm installed. No Docker.

### Story A0 — Hardhat project setup

**Prompt for Muse Spark:**
> Create a new Hardhat TypeScript project inside `blockchain/`. Run
> `npm init -y`, install `hardhat`, `@nomicfoundation/hardhat-toolbox`, and
> `typescript`. Initialize Hardhat with the TypeScript project template.
> Do not use Docker anywhere. The local node will be run manually later with
> `npx hardhat node` in its own terminal — do not try to start it
> automatically from a script. Verify by running `npx hardhat compile` on
> the empty starter project and printing `[A0] hardhat_compile=True` if it
> succeeds, else `[A0] hardhat_compile=False` with the error. End with
> `[A0] STATUS=PASS` or `FAIL`.

**Files created:** `blockchain/package.json`, `blockchain/hardhat.config.ts`, `blockchain/contracts/` (empty).
**Commit:** `[A0] Hardhat project scaffolded`

### Story A1 — CheckpointAnchor contract (highest priority — this is the only contract touchpoint #5 needs)

**Prompt for Muse Spark:**
> Write `blockchain/contracts/CheckpointAnchor.sol` (Solidity ^0.8.20). It
> must implement exactly this interface:
> - `function anchorCheckpoint(uint256 roundNumber, string calldata weightsHash, string calldata offChainUri, string calldata parentHash, bool isDelta) external returns (uint256 checkpointId)` — stores the checkpoint and emits event `CheckpointAnchored(uint256 checkpointId, uint256 roundNumber, string weightsHash, string offChainUri, string parentHash, bool isDelta, address submitter, uint256 timestamp)`.
> - `function getCheckpoint(uint256 checkpointId) external view returns (uint256 roundNumber, string memory weightsHash, string memory offChainUri, string memory parentHash, bool isDelta, address submitter, uint256 timestamp)`.
> - `function getLatestCheckpointId() external view returns (uint256)`.
> - Store checkpoints in an array; `checkpointId` is the array index. No
>   access control yet (anyone can anchor) — that's a later story, do not
>   add it now.
> - This contract NEVER stores model weights themselves, only the hash
>   string and the off-chain URI pointing to where the weights actually
>   live. Do not add any field that could hold raw weight data.
> Write `blockchain/test/CheckpointAnchor.test.ts` covering: anchoring one
> checkpoint and reading it back exactly; anchoring three checkpoints and
> confirming `getLatestCheckpointId()` returns 2 (zero-indexed); confirming
> the emitted event's fields match the call arguments. Run `npx hardhat
> test` and print `[A1] tests_passed=<N> tests_failed=<N>`, then
> `[A1] STATUS=PASS` only if failed count is 0.

**Commit:** `[A1] CheckpointAnchor contract + tests`

### Story A2 — DIDRegistry contract

**Prompt for Muse Spark:**
> Write `blockchain/contracts/DIDRegistry.sol`. Interface:
> - `function registerDID(string calldata did, string calldata publicKey, string calldata displayName) external` — reverts if `did` is already registered. Emits `DIDRegistered(string did, address owner, string publicKey, uint256 timestamp)`.
> - `function getDID(string calldata did) external view returns (string memory publicKey, string memory displayName, address owner, uint256 timestamp)`.
> - `function isRegistered(string calldata did) external view returns (bool)`.
> Write `blockchain/test/DIDRegistry.test.ts`: register one DID, read it
> back exactly; attempt to register the same `did` twice and confirm the
> second call reverts; confirm `isRegistered` is false for an unregistered
> DID. Print `[A2] tests_passed=<N> tests_failed=<N>` then `[A2] STATUS=PASS/FAIL`.

**Commit:** `[A2] DIDRegistry contract + tests`

### Story A3 — Staking contract

**Prompt for Muse Spark:**
> Write `blockchain/contracts/Staking.sol`. Interface:
> - `function stake(string calldata did) external payable` — records `msg.value` against `did`'s balance. Emits `Staked(string did, uint256 amount, uint256 newBalance)`.
> - `function slash(string calldata did, uint256 amount, string calldata reason) external` — reduces `did`'s balance by `amount` (reverts if balance is insufficient), sends the slashed amount to the contract owner. Emits `Slashed(string did, uint256 amount, string reason, uint256 newBalance)`.
> - `function balanceOf(string calldata did) external view returns (uint256)`.
> - Use OpenZeppelin's `Ownable` for the owner-only check on `slash` (install `@openzeppelin/contracts` via npm). No dispute logic here — that's Story A4, kept separate on purpose.
> Write `blockchain/test/Staking.test.ts`: stake from one account, confirm
> balance; slash part of it, confirm new balance and that the reason string
> round-trips through the event; confirm `slash` reverts when called by a
> non-owner account; confirm `slash` reverts when `amount` exceeds balance.
> Print `[A3] tests_passed=<N> tests_failed=<N>` then `[A3] STATUS=PASS/FAIL`.

**Commit:** `[A3] Staking contract + tests`

### Story A4 — Dispute contract (provisional-flag → challenge-window → finalize/overturn)

**Prompt for Muse Spark:**
> Write `blockchain/contracts/Dispute.sol`. This implements the
> provisional-flag pattern: a flag is never deleted, only superseded by a
> later status. Interface:
> - `enum Status { ProvisionallyRejected, FinalizedRejected, Overturned }`
> - `function fileFlag(string calldata did, uint256 roundNumber, string calldata reason, uint256 challengeWindowSeconds) external returns (uint256 disputeId)` — status starts as `ProvisionallyRejected`, records `block.timestamp + challengeWindowSeconds` as the deadline. Emits `FlagFiled(uint256 disputeId, string did, uint256 roundNumber, string reason, uint256 deadline)`.
> - `function overturn(uint256 disputeId, string calldata evidenceHash) external` — only callable before the deadline; sets status to `Overturned`. Emits `Overturned(uint256 disputeId, string evidenceHash)`. Reverts if called after the deadline or if status is not `ProvisionallyRejected`.
> - `function finalize(uint256 disputeId) external` — only callable at or after the deadline; sets status to `FinalizedRejected` if still `ProvisionallyRejected` (no-op if already `Overturned`). Emits `Finalized(uint256 disputeId, Status finalStatus)`.
> - `function getDispute(uint256 disputeId) external view returns (string memory did, uint256 roundNumber, Status status, uint256 deadline)`.
> Write `blockchain/test/Dispute.test.ts`: file a flag, confirm status is
> `ProvisionallyRejected`; overturn it before the deadline, confirm status
> becomes `Overturned`; in a second scenario, file a flag with a very short
> window, use Hardhat's time-manipulation helpers to advance past the
> deadline, call `finalize`, confirm status becomes `FinalizedRejected`;
> confirm `overturn` reverts if called after the deadline. Print
> `[A4] tests_passed=<N> tests_failed=<N>` then `[A4] STATUS=PASS/FAIL`.

**Commit:** `[A4] Dispute contract + tests`

### Story A5 — Passport contract

**Prompt for Muse Spark:**
> Write `blockchain/contracts/Passport.sol`. Interface (note: this
> supersedes an earlier version of this spec that omitted `signature` —
> corrected before Epic P built on top of it, see Story A5.1 below for the
> history if you're seeing this after that revision already happened):
> - `function submitEvent(string calldata deviceId, string calldata eventType, string calldata evidenceHash, string calldata modelVersionHash, string calldata actorDid, string calldata signature) external returns (uint256 entryId)` — `eventType` must be one of `"repair"`, `"resale"`, `"refurbishment"`, `"recycling"`, `"inspection"` (revert otherwise). Emits `PassportEventSubmitted(uint256 entryId, string deviceId, string eventType, string evidenceHash, string modelVersionHash, string actorDid, string signature, uint256 timestamp)`.
> - `function getEventsForDevice(string calldata deviceId) external view returns (uint256[] memory entryIds)`.
> - `function getEvent(uint256 entryId) external view returns (string memory deviceId, string memory eventType, string memory evidenceHash, string memory modelVersionHash, string memory actorDid, string memory signature, uint256 timestamp)`.
> Write `blockchain/test/Passport.test.ts`: submit two events for the same
> `deviceId`, confirm `getEventsForDevice` returns both entry IDs in order;
> confirm `getEvent` round-trips fields exactly, including `signature`;
> confirm submitting an invalid `eventType` string reverts. Print
> `[A5] tests_passed=<N> tests_failed=<N>` then `[A5] STATUS=PASS/FAIL`.

**Commit:** `[A5] Passport contract + tests`

### Story A5.1 — Add `signature` to Passport.sol (revision, only needed if Story A5 was already built against the old 5-argument version before this correction was made)

**Prompt for Muse Spark:**
> Modify `blockchain/contracts/Passport.sol`: add a `string signature`
> parameter to `submitEvent(...)` (after `actorDid`), store it, add it to
> the `PassportEventSubmitted` event, and add it to `getEvent(...)`'s
> return tuple (after `actorDid`, before `timestamp`). Update
> `blockchain/test/Passport.test.ts`'s existing calls/assertions to
> include and check `signature`. Run `npx hardhat test`, print
> `[A5.1] tests_passed=<N> tests_failed=<N>` then
> `[A5.1] STATUS=PASS/FAIL`. Redeploy (`npm run deploy:localhost` against a
> running node) so `deployments/localhost/Passport.json`'s ABI reflects
> the new field — anything downstream (`provenance-api`, see Story P2.1)
> that already integrated against the old 5-argument signature will break
> until it's updated too.

**Commit:** `[A5.1] Add signature field to Passport contract`

### Story A6 — Deployment script + artifact output

**Prompt for Muse Spark:**
> Write `blockchain/scripts/deploy.ts`. It must deploy all five contracts
> (`CheckpointAnchor`, `DIDRegistry`, `Staking`, `Dispute`, `Passport`) to
> whatever network Hardhat is currently pointed at, and for each one write a
> JSON file to `blockchain/deployments/<network-name>/<ContractName>.json`
> with exactly this shape: `{"address": "0x...", "abi": [...], "deployedAt": "<ISO timestamp>"}`.
> Create the `deployments/<network-name>/` directory if it doesn't exist.
> Add an npm script `"deploy:localhost": "hardhat run scripts/deploy.ts
> --network localhost"` to `package.json`. Do not run this yet — it
> requires a running node (Story A7 does that). Print
> `[A6] script_written=True` and `[A6] STATUS=PASS` once the file compiles
> (`npx hardhat compile` succeeds with the new script present).

**Commit:** `[A6] Deployment script writing artifacts to deployments/`

### Story A7 — End-to-end smoke test against a real local node

**Prompt for Muse Spark:**
> This story requires a Hardhat node running. In a separate terminal (not
> automated, tell the user to run it manually if you can't spawn background
> processes), run `npx hardhat node` from `blockchain/` — this starts a
> local chain on `http://127.0.0.1:8545`. Then run `npm run deploy:localhost`.
> Confirm all five `deployments/localhost/*.json` files were written and
> each contains a valid-looking `address` (starts with `0x`, 42 characters)
> and a non-empty `abi` array. Write a small script
> `blockchain/scripts/smoke_test.ts` that connects to the running node,
> loads `CheckpointAnchor`'s deployed address+ABI from the JSON file, calls
> `anchorCheckpoint(1, "hash-abc", "local://checkpoints/1", "", false)`,
> then calls `getCheckpoint(0)` and confirms the returned `weightsHash`
> equals `"hash-abc"`. Print
> `[A7] node_running=True deployments_written=5 smoke_test_roundtrip=True`
> then `[A7] STATUS=PASS`. If the node isn't running, print
> `[A7] node_running=False` and stop — do not fake success.

**Commit:** `[A7] End-to-end deployment smoke test`

---

## 3. EPIC B — auth-service (Python)

Read Section 1.2 first — this epic is built entirely against
`shared.mock_model.MockModelAdapter`, no blockchain and no vision model
involved anywhere.

### Story B0 — Project setup

**Prompt for Muse Spark:**
> Inside `auth-service/`, set up a Python package with `requirements.txt`
> containing `numpy`, `scikit-learn`, `pydantic`, `pytest`. Create empty
> `__init__.py` files so `golden_reference/`, `scoring/`, and `tests/` are
> importable packages. Import `shared.interfaces.schemas` and
> `shared.mock_model.mock_adapter` to confirm they resolve correctly from
> `auth-service/`'s working directory (add whatever `sys.path`/package
> config is needed — do not copy those files into `auth-service/`). Print
> `[B0] shared_imports_ok=True` and `[B0] STATUS=PASS` if the import
> succeeds.

**Commit:** `[B0] auth-service project setup`

### Story B1 — Golden reference statistics

**Prompt for Muse Spark:**
> Write `auth-service/golden_reference/reference_stats.py` with a function
> `compute_reference_stats(embeddings: np.ndarray) -> dict` that takes an
> `(N, D)` array (from `shared.mock_model.make_golden_reference()`) and
> returns `{"mean": np.ndarray (D,), "covariance": np.ndarray (D,D),
> "inv_covariance": np.ndarray (D,D), "threshold": float, "embeddings":
> np.ndarray (N,D)}`. The `"embeddings"` key holds the EXACT input array,
> unchanged — this is what Story B5's `micro_cluster_score` call will use
> as its `reference_embeddings` argument, since the golden reference is
> deliberately multi-modal (pooled from several distinct simulated
> clients) and must not be approximated by sampling from `N(mean,
> covariance)` — that would erase the multi-cluster structure the
> micro-cluster check exists to detect. `threshold` is the 99th percentile
> of the Mahalanobis distance of every embedding in the input from `mean`,
> using `covariance`. Handle the case where `covariance` is singular by
> adding a small regularization term (`1e-6 * identity`) before inverting
> — do not let this raise an exception. Write
> `auth-service/tests/test_reference_stats.py`: call
> `make_golden_reference()`, compute stats, assert `mean.shape == (32,)`,
> assert `covariance.shape == (32,32)`, assert `threshold > 0`, assert
> `stats["embeddings"].shape == embeddings.shape` and
> `np.array_equal(stats["embeddings"], embeddings)`. Print
> `[B1] mean_shape=<shape> threshold=<value> embeddings_preserved=<bool>`
> then `[B1] STATUS=PASS/FAIL`.

**Commit:** `[B1] Golden reference statistics`

### Story B2 — Suspicion scoring: outlier fraction, mean shift, micro-cluster score

**Prompt for Muse Spark:**
> Write `auth-service/scoring/suspicion.py` with three functions:
> - `outlier_fraction(client_embeddings: np.ndarray, reference_stats: dict) -> float` — fraction of `client_embeddings` whose Mahalanobis distance from `reference_stats["mean"]` (using `reference_stats["inv_covariance"]`) exceeds `reference_stats["threshold"]`.
> - `mean_shift(client_embeddings: np.ndarray, reference_stats: dict) -> float` — Euclidean distance between `client_embeddings.mean(axis=0)` and `reference_stats["mean"]`.
> - `micro_cluster_score(client_embeddings: np.ndarray, reference_embeddings: np.ndarray) -> float` — concatenate both embedding sets, run `sklearn.cluster.KMeans(n_clusters=2)`, find whichever resulting cluster has the higher fraction of client-vs-reference points, and return that fraction (0.5 = no separation, 1.0 = perfect separation).
> Write `auth-service/tests/test_suspicion.py` using
> `MockModelAdapter`: build a golden reference from 5 honest mock clients,
> then compute all three scores for (a) a 6th honest mock client's
> embeddings and (b) an attacker's `embed(poisoned=True)` embeddings.
> Assert the poisoned client's `outlier_fraction` and `mean_shift` are both
> strictly greater than the honest client's. Print
> `[B2] honest_outlier=<v> poisoned_outlier=<v> honest_shift=<v>
> poisoned_shift=<v> honest_cluster=<v> poisoned_cluster=<v>` then
> `[B2] STATUS=PASS/FAIL`.

**Commit:** `[B2] Suspicion scoring: outlier fraction, mean shift, micro-cluster`

### Story B3 — Reference-set performance check (the new, non-embedding-based signal)

**Prompt for Muse Spark:**
> Write `auth-service/scoring/reference_perf_check.py` with a function
> `reference_set_accuracy_delta(model_adapter: ModelAdapter,
> golden_labeled_images: Any, golden_labels: np.ndarray,
> baseline_accuracy: float) -> float`. It must call
> `model_adapter.predict_anomaly_score(golden_labeled_images)`, threshold
> the returned scores at 0.5 to get binary predictions, compute accuracy
> against `golden_labels`, and return `(new_accuracy - baseline_accuracy)`.
> Since `MockModelAdapter.predict_anomaly_score` returns random scores
> regardless of input, write the test using a fixed random seed and treat
> this story's job as confirming the FUNCTION'S ARITHMETIC is correct, not
> that the mock model produces meaningful accuracy — add a code comment
> saying this check becomes meaningful once real labeled data exists.
> Write `auth-service/tests/test_reference_perf_check.py` with a fake
> stand-in object (not `MockModelAdapter`) whose
> `predict_anomaly_score` always returns a fixed known array, so the
> expected accuracy and delta can be hand-computed and asserted exactly.
> Print `[B3] computed_delta=<v> expected_delta=<v>` then
> `[B3] STATUS=PASS/FAIL`.

**Commit:** `[B3] Reference-set performance-delta check`

### Story B4 — Combined score and pass/fail decision

**Prompt for Muse Spark:**
> Write `auth-service/scoring/combined.py` with
> `combine_scores(outlier_frac: float, mean_shift_val: float,
> cluster_score: float, ref_perf_delta: float, weights: dict =
> {"outlier": 2.0, "shift": 1.0, "cluster": 1.5, "perf": 1.0}, threshold:
> float = 3.0) -> tuple[float, bool]`. Formula:
> `combined = weights["outlier"]*outlier_frac + weights["shift"]*mean_shift_val
> + weights["cluster"]*cluster_score - weights["perf"]*min(ref_perf_delta, 0)`
> (a negative performance delta, i.e. accuracy got worse, ADDS to
> suspicion; note the minus sign with `min(...,0)` handles this — a
> positive delta contributes zero). Returns `(combined_score, combined_score
> < threshold)` — `passed=True` means combined_score is BELOW threshold.
> These default `weights` and `threshold=3.0` are placeholder values (see
> integration doc Section 7) — do not tune them, just implement the
> formula exactly as given. Write
> `auth-service/tests/test_combined.py` with 3-4 hand-picked input
> combinations and hand-computed expected outputs. Print
> `[B4] case1_score=<v> case1_passed=<bool> ... ` for each case then
> `[B4] STATUS=PASS/FAIL`.

**Commit:** `[B4] Combined suspicion score + pass/fail decision`

### Story B4.5 — Calibrated threshold (inserted after diagnostics showed the fixed constant=3.0 fails: outlier_fraction saturates at 1.0 for every client due to high-dimensional random cluster centers, and every client — honest included — was being rejected)

**Prompt for Muse Spark:**
> Write `auth-service/scoring/calibration.py` with
> `calibrate_threshold(reference_stats: dict, calibration_clients: list,
> k: float = 3.0) -> float`. `calibration_clients` is a list of
> known-honest `MockModelAdapter` instances built directly here with a
> seed range that does NOT overlap the golden reference's seeds (42-46) or
> the primary simulated fleet's seeds (0-7) — use seeds 100-104 — to avoid
> the circularity of calibrating a client against a reference partly built
> from itself. This does not touch `shared/` at all. For each calibration
> client: compute `outlier_fraction`, `mean_shift`, `micro_cluster_score`
> (reuse Story B2's functions exactly, do not reimplement), then
> `combine_scores(...)` from Story B4 with `ref_perf_delta=0.0` and the
> SAME default `weights` as production (do not change B4's default
> weights). Return `mean(combined_scores) + k * std(combined_scores)`.
> Update `auth-service/entrypoint.py`'s `score_client` (Story B5) to read
> the threshold from `reference_stats["calibrated_threshold"]` instead of
> `combine_scores`'s hardcoded `threshold=3.0` default — same pattern as
> the earlier `"embeddings"` fix, no change to `score_client`'s own
> signature. Write `auth-service/tests/test_calibration.py`: build 5
> calibration clients (seeds 100-104), compute the calibrated threshold
> against the existing golden reference, then build a fresh set of 8
> honest clients (`make_clients(8)`) and one poisoned client, assert the
> calibrated threshold is strictly greater than the max combined score
> among the 8 honest clients AND strictly less than the poisoned client's
> combined score. Print `[B4.5] calibrated_threshold=<v> max_honest=<v>
> attacker_score=<v> separates_correctly=<bool>` then
> `[B4.5] STATUS=PASS/FAIL`. Also re-run
> `fl-orchestrator/tests/diagnose_auth_scores.py` (from Story C4's
> follow-up) with the new calibrated threshold wired in, and print all 9
> `[DIAG] ...` lines again alongside each client's now-computed
> `passed=<bool>`.

**Commit:** `[B4.5] Calibrated (data-driven) suspicion threshold, replacing hardcoded constant`

### Story B5 — Public entrypoint (touchpoint #1)

**Prompt for Muse Spark:**
> Write `auth-service/entrypoint.py` with the EXACT signature from the
> integration contract:
> `def score_client(client_did: str, round_number: int, embeddings:
> np.ndarray, reference_stats: dict) -> SuspicionScore` (import
> `SuspicionScore` from `shared.interfaces.schemas` — do not redefine it).
> This function must call B1's output (passed in as `reference_stats`,
> already computed once and reused across calls — this function does NOT
> recompute reference stats), B2's three scoring functions, and B4's
> combiner, then construct and return a `SuspicionScore` with all fields.
> For `micro_cluster_score` specifically, pass `reference_stats["embeddings"]`
> as its `reference_embeddings` argument — do not sample synthetically from
> `reference_stats["mean"]`/`["covariance"]` and do not stub this signal to
> `0.0`; B1 already provides the exact raw array needed via its
> `"embeddings"` key. **For the pass/fail threshold, use
> `reference_stats["calibrated_threshold"]` (Story B4.5) — this key will
> not exist yet if you're building B5 before B4.5; if so, fall back to
> `combine_scores`'s own default (`threshold=3.0`) and mark this spot
> `# TODO(B4.5): switch to calibrated_threshold once available` — do not
> silently leave the hardcoded default in place once B4.5 exists.** Fill
> in the rest of `SuspicionScore`'s fields the same way
> (`reference_set_accuracy_delta` can be `0.0` for now — B3 isn't wired
> in here yet, that's a note for whoever builds `gateway` in batch 2, since
> it needs golden labeled images which don't exist until the vision model
> does). Write
> `auth-service/tests/test_entrypoint.py`: call `score_client` for an
> honest and a poisoned mock client, assert the honest one's
> `SuspicionScore.passed` is `True` and the poisoned one's is `False`. Print
> `[B5] honest_passed=<bool> poisoned_passed=<bool>` then
> `[B5] STATUS=PASS/FAIL`.

**Commit:** `[B5] auth-service public entrypoint (score_client)`

### Story B6 — Full auth-service regression suite

**Prompt for Muse Spark:**
> Run the entire `auth-service/tests/` suite with `pytest -v` and print a
> summary: `[B6] total=<N> passed=<N> failed=<N>`, then
> `[B6] STATUS=PASS` only if `failed == 0`. If anything fails, show the
> full pytest output, do not summarize it away.

**Commit:** `[B6] auth-service full test suite green`

---

## 4. EPIC C — fl-orchestrator (Python)

Depends on Epic B being done (touchpoint #1) and Epic D's `checkpoint_round`/
`ingest_round`/`execute` existing (touchpoints #2-4) — build Epic D's
function *signatures* first if you haven't yet reached Epic D, or stub them
temporarily (see Story C3's note).

### Story C0 — Project setup

**Prompt for Muse Spark:**
> Same as Story B0 but for `fl-orchestrator/`: `requirements.txt` with
> `numpy`, `pydantic`, `pytest`; empty `__init__.py`s in `client_sim/`,
> `server/`, `tests/`; confirm `shared.interfaces` and `shared.mock_model`
> import correctly. Print `[C0] shared_imports_ok=True` then
> `[C0] STATUS=PASS`.

**Commit:** `[C0] fl-orchestrator project setup`

### Story C1 — Client simulation harness

**Prompt for Muse Spark:**
> Write `fl-orchestrator/client_sim/partition.py` with a function
> `make_clients(n_clients: int = 8, seed: int = 0) -> list[MockModelAdapter]`
> that creates `n_clients` `MockModelAdapter` instances with distinct
> `client_did` strings (`"client-0"`, `"client-1"`, ...) and distinct seeds
> (so their embedding class-centers differ — this is how non-IID-ness is
> simulated at the mock-model stage; add a code comment noting that once
> the real vision model exists, this must be replaced with an actual
> per-client data partition by defect category, not just a different
> random seed). Write
> `fl-orchestrator/client_sim/simulated_client.py` with a class
> `SimulatedClient` wrapping one `ModelAdapter` plus its `client_did`, with
> a method `run_round(inject_drift: bool = False) -> dict[str, np.ndarray]`
> that calls the adapter's `local_train`. Write
> `fl-orchestrator/tests/test_partition.py` confirming `make_clients(8)`
> returns 8 distinct DIDs and 8 adapters whose `embed()` outputs have
> different means from each other (proving non-IID separation exists).
> Print `[C1] n_clients=8 unique_dids=True embeddings_differ=True` then
> `[C1] STATUS=PASS/FAIL`.

**Commit:** `[C1] Client simulation + non-IID partition harness`

### Story C2 — FedAvg aggregation function

**Prompt for Muse Spark:**
> Write `fl-orchestrator/server/aggregate.py` with
> `fedavg(client_weights: list[dict[str, np.ndarray]], client_sample_counts:
> list[int]) -> dict[str, np.ndarray]` — a sample-count-weighted average of
> each layer across all clients in the list (standard FedAvg). It must
> raise `ValueError` if `client_weights` is empty (this is the case where
> every client failed authentication this round — the caller, Story C5,
> must handle this by skipping the round rather than crashing). Write
> `fl-orchestrator/tests/test_aggregate.py`: three clients with known,
> hand-picked weight dicts and equal sample counts, assert the result is
> the exact elementwise mean; a second case with unequal sample counts,
> hand-compute the expected weighted average and assert exact match; a
> third case with an empty list, assert `ValueError` is raised. Print
> `[C2] equal_weights_case=<pass/fail> weighted_case=<pass/fail>
> empty_case=<pass/fail>` then `[C2] STATUS=PASS/FAIL`.

**Commit:** `[C2] FedAvg aggregation function`

### Story C3 — Integrate auth-service (touchpoint #1)

**Prompt for Muse Spark:**
> Write `fl-orchestrator/server/round_manager.py`, starting with just the
> authentication-gating logic (aggregation and checkpointing come in later
> stories). Import `auth_service.entrypoint.score_client` (add
> `auth-service/` to the path the same way `B0` confirmed `shared/`
> resolves). Write a function
> `authenticate_round(clients: list[SimulatedClient], round_number: int,
> reference_stats: dict) -> tuple[list[SimulatedClient], list[SuspicionScore]]`
> that, for each client, calls `client.model_adapter.embed()`, passes the
> result to `score_client(...)`, and returns two parallel lists: the
> sub-list of clients whose score passed, and ALL suspicion scores (passed
> and failed) for that round — the second list is needed later by
> touchpoint #3. Write
> `fl-orchestrator/tests/test_round_manager_auth.py` with a mix of honest
> and one poisoned client (use `MockModelAdapter.embed`'s `poisoned=True`
> via a `SimulatedClient` subclass or flag), asserting the poisoned one is
> excluded from the returned passing list but still present in the full
> scores list. Print
> `[C3] total_clients=<N> passed_clients=<N> poisoned_excluded=<bool>` then
> `[C3] STATUS=PASS/FAIL`.

**Commit:** `[C3] Authentication gating integrated into round manager`

### Story C4 — Checkpointing + drift monitor integration (touchpoints #2, #3, #4)

**Prompt for Muse Spark:**
> Extend `fl-orchestrator/server/round_manager.py` with a function
> `run_round(clients: list[SimulatedClient], round_number: int,
> reference_stats: dict, global_model: ModelAdapter,
> checkpoint_store: "LocalCheckpointStore | None" = None,
> previous_checkpoint: "Checkpoint | None" = None,
> checkpoint_registry: "dict[str, str] | None" = None) -> dict` that, in
> order: (1) calls `authenticate_round` from Story C3; (2) has each passing
> client call `run_round(...)` from Story C1 to get their trained weights;
> (3) calls `fedavg(...)` from Story C2 on the passing clients' weights,
> weighted by a sample count of 1 per client for now (a placeholder — note
> in a comment that real per-client sample counts arrive with the vision
> model); (4) calls `global_model.set_weights(...)` with the aggregated
> result; (5) calls `checkpoint_round(...)` (touchpoint #2, built in Story
> D2.5) — `round_manager` owns and threads `previous_checkpoint` from one
> call to the next (pass in the `Checkpoint` this function returns on round
> N as `previous_checkpoint` on round N+1), and after every successful call
> appends `{checkpoint.weights_hash: checkpoint.off_chain_uri}` into
> `checkpoint_registry` (create an empty `dict` for it if the caller didn't
> pass one in — this registry must accumulate across ALL rounds, not just
> the latest, since Story D4's `execute` needs to look up any prior round,
> not only the most recent one); (6) calls
> `rollback_service.drift_monitor.window_tracker.ingest_round(...)`
> (touchpoint #3, from Story D3); (7) if that returns a `DriftEvent`, calls
> `rollback_executor.execute(drift_event, global_model, checkpoint_store,
> checkpoint_registry)` (touchpoint #4, from Story D4 — note its REAL
> signature takes 4 arguments; an earlier version of this spec incorrectly
> listed only 2) before returning. **Each of steps (5), (6), (7) is
> independently either real or
> stubbed depending on what already exists in your workspace right now** —
> check for each one separately, don't assume all-or-nothing. For whichever
> of D2.5 / D3 / D4 do NOT exist yet, write that one call against its exact
> signature from Section 1.3, marked `# TODO(rollback-service): wire real
> import once this story exists`, backed by a local stub returning a
> plausible dummy value, so `fl-orchestrator`'s own tests still run
> independently. Return a dict summary:
> `{"round": round_number, "n_passed": ..., "n_failed": ...,
> "drift_triggered": bool, "checkpoint": Checkpoint}`.
> Write `fl-orchestrator/tests/test_round_manager_full.py` running 3 rounds
> with all-honest clients, asserting no errors and `drift_triggered=False`
> each time. Print `[C4] rounds_run=3 errors=0
> checkpoint_round_real=<bool> ingest_round_real=<bool>
> execute_real=<bool>` (one bool per touchpoint, reflecting what was
> actually available in this workspace) then `[C4] STATUS=PASS/FAIL`.

**Commit:** `[C4] Full round loop wired to checkpointing + drift monitor`

### Story C5 — Multi-round test harness with an injected attacker

**Prompt for Muse Spark:**
> Write `fl-orchestrator/tests/test_full_simulation.py`: create 8 clients
> via `make_clients(8)`, compute golden reference stats via
> `auth-service`'s `compute_reference_stats(make_golden_reference())`, run
> `run_round(...)` for 20 rounds, with client `"client-3"` set to
> `inject_drift=True` and `embed(poisoned=True)` starting at round 12
> onward (rounds 1-11 all-honest). Collect the per-round summaries. Assert
> that `client-3` is excluded (`n_failed >= 1`) in at least one round from
> round 12 onward. Print, for every round, `[C5] round=<n> n_passed=<n>
> n_failed=<n> drift_triggered=<bool>`, then a final
> `[C5] attacker_ever_excluded=<bool>` and `[C5] STATUS=PASS/FAIL`.

**Commit:** `[C5] 20-round simulation with injected attacker at round 12`

### Story C6 — Full fl-orchestrator regression suite

**Prompt for Muse Spark:**
> Same pattern as Story B6, for `fl-orchestrator/tests/`. Print
> `[C6] total=<N> passed=<N> failed=<N>` then `[C6] STATUS=PASS/FAIL`.

**Commit:** `[C6] fl-orchestrator full test suite green`

---

## 5. EPIC D — rollback-service (Python)

Stories D1-D4 have zero dependency on blockchain and can be built before,
after, or in parallel with Epic A. Story D5 is the only one that needs
Epic A's deployed contracts.

### Story D0 — Project setup

**Prompt for Muse Spark:**
> Same pattern as B0/C0, for `rollback-service/`: `requirements.txt` with
> `numpy`, `pydantic`, `pytest`, `web3` (needed later for D5, install now).
> Empty `__init__.py`s in `checkpoint_store/`, `drift_monitor/`,
> `chain_bridge/`, `tests/`. Confirm `shared.interfaces` and
> `shared.mock_model` import correctly. Print
> `[D0] shared_imports_ok=True` then `[D0] STATUS=PASS`.

**Commit:** `[D0] rollback-service project setup`

### Story D1 — Checkpoint hashing (Merkle tree over layers)

**Prompt for Muse Spark:**
> Write `rollback-service/checkpoint_store/hasher.py` with:
> - `hash_layer(array: np.ndarray) -> str` — SHA-256 hex digest of the
>   array's raw bytes (`array.tobytes()`).
> - `merkle_root(weights: dict[str, np.ndarray]) -> str` — hash each layer
>   with `hash_layer`, sort the layer names alphabetically (so ordering is
>   deterministic regardless of dict insertion order), concatenate the
>   per-layer hashes in that sorted order, and SHA-256 that concatenation
>   to get the root hash.
> Write `rollback-service/tests/test_hasher.py`: confirm `merkle_root`
> returns the exact same string for two calls with identical weights;
> confirm it returns a DIFFERENT string if a single value in one layer
> changes by any amount; confirm it's insensitive to the dict's key
> insertion order (build the same weights dict two ways with keys inserted
> in different orders, assert equal roots). Print
> `[D1] deterministic=<bool> sensitive_to_change=<bool>
> order_insensitive=<bool>` then `[D1] STATUS=PASS/FAIL`.

**Commit:** `[D1] Merkle-style checkpoint hashing`

### Story D2 — Local content-addressed off-chain store + delta compression

**Prompt for Muse Spark:**
> Write `rollback-service/checkpoint_store/local_store.py` with a class
> `LocalCheckpointStore(base_dir: str = "./checkpoint_data")`:
> - `save_full(weights_hash: str, weights: dict[str, np.ndarray]) -> str` —
>   serializes `weights` (use `np.savez`) to `<base_dir>/<weights_hash>.npz`,
>   returns that file path as the "off_chain_uri" (a `local://` URI is fine,
>   e.g. `f"local://{path}"` — this is deliberately swappable for an IPFS
>   URI later without changing any CALLER code, only this function's
>   internals).
> - `load(off_chain_uri: str) -> dict[str, np.ndarray]` — reverses
>   `save_full`, reading the `.npz` back into a `{name: array}` dict.
> - `verify_integrity(off_chain_uri: str, expected_hash: str) -> bool` —
>   loads the checkpoint and confirms `hasher.merkle_root(loaded) ==
>   expected_hash`.
> Write `rollback-service/checkpoint_store/delta.py` with:
> - `compute_delta(previous: dict[str, np.ndarray], current: dict[str,
>   np.ndarray]) -> dict[str, np.ndarray]` — elementwise subtraction,
>   `current[k] - previous[k]` per layer (both dicts always have the same
>   keys/shapes, given the fixed `ModelAdapter` contract — do not handle
>   mismatched shapes, that would indicate a bug elsewhere).
> - `apply_delta(previous: dict[str, np.ndarray], delta: dict[str,
>   np.ndarray]) -> dict[str, np.ndarray]` — the inverse, `previous[k] +
>   delta[k]`.
> Write `rollback-service/tests/test_local_store.py` and
> `test_delta.py`: save a checkpoint, load it back, assert every array is
> exactly equal (`np.array_equal`) to the original; corrupt one saved file
> byte-for-byte on disk and confirm `verify_integrity` returns `False`;
> compute a delta between two mock-model weight snapshots and confirm
> `apply_delta(previous, compute_delta(previous, current))` exactly
> reconstructs `current`. Print
> `[D2] roundtrip_exact=<bool> corruption_detected=<bool>
> delta_reconstruction_exact=<bool>` then `[D2] STATUS=PASS/FAIL`.

**Commit:** `[D2] Local checkpoint store + delta compression`

### Story D2.5 — Checkpoint orchestration (this is the actual `checkpoint_round`, touchpoint #2 — inserted after the fact, see chat: this was named in Section 1.3 but never had a story build it)

**Prompt for Muse Spark:**
> In the SAME file as Story D1, `rollback-service/checkpoint_store/hasher.py`,
> add the orchestrating function that touchpoint #2 in the integration
> contract actually needs (D1 only built the low-level `hash_layer`/
> `merkle_root` primitives it depends on):
> `def checkpoint_round(round_number: int, weights: dict[str, np.ndarray],
> reference_set_metrics: dict, store: "LocalCheckpointStore",
> previous_checkpoint: "Checkpoint | None" = None, full_snapshot_interval:
> int = 5, chain_client: "ChainClient | None" = None) -> Checkpoint`
> (import `Checkpoint` from `shared.interfaces.schemas`; import
> `LocalCheckpointStore` from `checkpoint_store.local_store`; type-hint
> `chain_client` loosely, e.g. `Any`, so this file has no hard import
> dependency on `chain_bridge/` — that keeps this function usable even
> before Story D5 exists). Logic, in order:
> 1. `weights_hash = merkle_root(weights)`.
> 2. **For this story, ALWAYS save a full snapshot** via
>    `store.save_full(weights_hash, weights)` — do not attempt chained
>    delta reconstruction yet (real delta-chain replay, where restoring a
>    checkpoint means walking back through several deltas, is real added
>    complexity deliberately deferred — see Section 7's existing note on
>    this). Set the returned `Checkpoint.is_delta = False` unconditionally
>    for now. This keeps Story D4's rollback executor correct with zero
>    changes, since it already assumes it can directly load a full
>    checkpoint.
> 3. `parent_hash = previous_checkpoint.weights_hash if previous_checkpoint
>    else None`.
> 4. Build `Checkpoint(round_number=round_number, weights_hash=weights_hash,
>    parent_hash=parent_hash, off_chain_uri=<result of step 2>,
>    is_delta=False, reference_set_metrics=reference_set_metrics)`.
> 5. If `chain_client is not None`: call
>    `chain_client.anchor_checkpoint(checkpoint)` inside a `try/except`
>    that catches `ConnectionError` specifically, logs a warning
>    (`print(f"[checkpoint_round] on-chain anchoring skipped: {e}")`), and
>    does NOT re-raise — on-chain anchoring is an additive audit trail, and
>    off-chain checkpoint correctness (what rollback actually depends on)
>    must never fail just because the blockchain node happens to be down.
> 6. Return the `Checkpoint`.
> Write `rollback-service/tests/test_checkpoint_round.py`: checkpoint 3
> consecutive rounds of `MockModelAdapter` weights, passing each round's
> returned `Checkpoint` in as the next round's `previous_checkpoint`;
> assert each round's `weights_hash` differs from the last; assert round
> 2's `parent_hash` exactly equals round 1's `weights_hash` (and round 3's
> equals round 2's) — this is what makes it a real hash chain; assert
> `store.load(checkpoint.off_chain_uri)` for round 1 reconstructs round 1's
> exact original weights; run once with `chain_client=None` and confirm no
> error; run once with a fake `chain_client` object whose
> `anchor_checkpoint` always raises `ConnectionError`, and confirm
> `checkpoint_round` still returns a valid `Checkpoint` rather than
> raising. Print
> `[D2.5] rounds=3 hash_chain_valid=<bool> restore_exact=<bool>
> chain_anchor_optional_ok=<bool>` then `[D2.5] STATUS=PASS/FAIL`.

**Commit:** `[D2.5] Checkpoint orchestration function (checkpoint_round)`

### Story D3 — Sliding-window drift monitor (touchpoint #3)

**Prompt for Muse Spark:**
> Write `rollback-service/drift_monitor/window_tracker.py` with a class
> `DriftMonitor(window_size: int = 5, drift_threshold: float = 2.0)`
> holding internal state across calls (it's stateful — one instance persists
> for the whole simulation, not recreated per round). Method:
> `ingest_round(round_number: int, suspicion_scores: list[SuspicionScore],
> reference_set_accuracy: float, latest_checkpoint_hash: str) ->
> DriftEvent | None`. Logic: append this round's mean `combined_score`
> across all `suspicion_scores` (both passed and failed clients) and this
> round's `reference_set_accuracy` to two internal rolling lists, each
> capped at `window_size` (drop the oldest when exceeding). If both lists
> have reached `window_size` entries, compute the average combined_score
> and the trend of `reference_set_accuracy` (last value minus first value
> in the window) over that window; if the average combined_score exceeds
> `drift_threshold` for the AND the accuracy trend is negative (getting
> worse), return a `DriftEvent` with `window_start_round =
> round_number - window_size + 1`, `window_end_round = round_number`,
> `trigger_reason = "sustained suspicion + accuracy decline over window"`,
> `reverted_to_checkpoint_hash = latest_checkpoint_hash` (the caller is
> responsible for passing in the hash of the last checkpoint BEFORE this
> window started — note this clearly in a docstring, since getting the
> wrong checkpoint here silently breaks the whole rollback guarantee).
> Otherwise return `None`. Write
> `rollback-service/tests/test_window_tracker.py`: feed 5 rounds of
> low-suspicion, stable-accuracy data, assert `None` every time; then feed
> 5 more rounds of rising suspicion and declining accuracy, assert a
> `DriftEvent` is eventually returned with correct `window_start_round`/
> `window_end_round`. Print
> `[D3] stable_rounds_triggered=False drift_rounds_triggered=True
> trigger_round=<n>` then `[D3] STATUS=PASS/FAIL`.

**Commit:** `[D3] Sliding-window drift monitor`

### Story D4 — Rollback executor (touchpoint #4)

**Prompt for Muse Spark:**
> Write `rollback-service/drift_monitor/rollback_executor.py` with
> `execute(drift_event: DriftEvent, model_adapter: ModelAdapter,
> store: LocalCheckpointStore, checkpoint_registry: dict[str, str]) -> None`.
> `checkpoint_registry` maps `weights_hash -> off_chain_uri` (the caller
> maintains this; Story D5/C4 wires it from what `checkpoint_round` has
> saved so far). Steps: look up
> `checkpoint_registry[drift_event.reverted_to_checkpoint_hash]`, call
> `store.load(...)` on it, call `store.verify_integrity(...)` and raise a
> clear exception if it fails (never silently restore unverified weights),
> then call `model_adapter.set_weights(loaded_weights)`. Write
> `rollback-service/tests/test_rollback_executor.py`: create a
> `MockModelAdapter`, save its initial weights as a checkpoint, mutate its
> weights (simulate several rounds of drift), call `execute` with a
> `DriftEvent` pointing back to the saved checkpoint, assert
> `model_adapter.get_weights()` now exactly equals the originally-saved
> weights. Also test that a corrupted/tampered checkpoint causes `execute`
> to raise rather than silently restoring bad data. Print
> `[D4] restore_exact=<bool> corruption_blocks_restore=<bool>` then
> `[D4] STATUS=PASS/FAIL`.

**Commit:** `[D4] Rollback executor with integrity verification`

### Story D5 — Blockchain anchoring (touchpoint #5, requires Epic A's local node running)

**Prompt for Muse Spark:**
> Requires: `npx hardhat node` running in `blockchain/` (separate terminal),
> and `npm run deploy:localhost` already run (Epic A, Story A7), so
> `blockchain/deployments/localhost/CheckpointAnchor.json` exists. Write
> `rollback-service/chain_bridge/chain_client.py` with a class
> `ChainClient(rpc_url: str = None, deployments_dir: str = None)` — if
> `rpc_url` is `None`, read env var `CHAIN_RPC_URL`, default
> `"http://127.0.0.1:8545"`; if `deployments_dir` is `None`, read env var
> `CHAIN_DEPLOYMENTS_DIR`, default `"../blockchain/deployments/localhost"`.
> On init, connect via `web3.Web3(web3.HTTPProvider(rpc_url))`, load
> `CheckpointAnchor.json` from `deployments_dir`, instantiate the contract
> object from its `address`+`abi`. Method:
> `anchor_checkpoint(checkpoint: Checkpoint) -> str` (import `Checkpoint`
> from `shared.interfaces.schemas`) — calls the contract's
> `anchorCheckpoint(...)` with the matching fields
> (`checkpoint.round_number`, `checkpoint.weights_hash`,
> `checkpoint.off_chain_uri`, `checkpoint.parent_hash or ""`,
> `checkpoint.is_delta`), using the first account Hardhat's node exposes by
> default (`web3.eth.accounts[0]`) to send the transaction, waits for the
> receipt, returns the transaction hash as a hex string. If the node isn't
> reachable, raise a clear `ConnectionError` with a message telling the
> user to start `npx hardhat node` — do not fail silently or fall back to
> a mock. Write
> `rollback-service/tests/test_chain_client.py` (this one is an
> integration test, not a unit test — it needs the real node running):
> build a `Checkpoint`, call `anchor_checkpoint`, then independently call
> the contract's `getCheckpoint(0)` (or the correct index) directly and
> confirm the `weightsHash` matches. Print
> `[D5] node_reachable=<bool> tx_hash=<hash> roundtrip_confirmed=<bool>`
> then `[D5] STATUS=PASS/FAIL`. If the node isn't reachable, print
> `[D5] node_reachable=False` and stop — do not fabricate a pass.

**Commit:** `[D5] Blockchain checkpoint anchoring via ChainClient`

### Story D6 — Full rollback-service regression suite + end-to-end drift scenario

**Prompt for Muse Spark:**
> First, same pattern as B6/C6: run all of `rollback-service/tests/` with
> `pytest -v`, print `[D6] total=<N> passed=<N> failed=<N>`. Then write one
> more integration script, `rollback-service/tests/test_e2e_scenario.py`,
> that ties D1-D4 together without needing the blockchain node: simulate 15
> rounds of checkpointing via `hasher.checkpoint_round` + `local_store`, with
> rounds 1-9 stable and rounds 10-15 drifting (reuse the same injection
> pattern as `fl-orchestrator`'s Story C5 — a `MockModelAdapter` with
> `local_train(inject_drift=True)` from round 10 onward), feed each round
> into `DriftMonitor.ingest_round`, and confirm that once a `DriftEvent`
> fires, `rollback_executor.execute(...)` restores the model to its
> pre-round-10 state exactly. Print
> `[D6] e2e_drift_triggered=<bool> e2e_restore_exact=<bool>` then final
> `[D6] STATUS=PASS/FAIL`.

**Commit:** `[D6] rollback-service full suite + end-to-end drift/restore scenario`

---

## 6. Suggested execution order

```
A0 -> A1 -> A2 -> A3 -> A4 -> A5 -> A6 -> A7   (blockchain, can run fully in parallel with B/D below)
B0 -> B1 -> B2 -> B3 -> B4 -> B4.5 -> B5 -> B6   (auth-service, no dependency on A or D)
D0 -> D1 -> D2 -> D2.5 -> D3 -> D4                (rollback-service core, no dependency on A or B)
                                    D5 (needs A7 done)
                                    D6
C0 -> C1 -> C2 -> C3 (needs B5) -> C4 (needs D1-D4, D5 optional/stubbed) -> C5 -> C6
```

If you're doing this solo with one Muse Spark session at a time: `A` and `B`
and `D0-D4` can genuinely be built in any order relative to each other. `C`
should come last since it's the integration point that pulls the other three
together.

---

## 7. Defaults I picked that are placeholders, not researched values — flag if you want different ones

- 8 simulated clients (mid of the earlier-recommended 5-15 range).
- Non-IID simulated only via distinct random seeds at the mock-model stage
  — genuinely revisit this once real per-defect-category data exists (noted
  inline in Story C1's prompt).
- Suspicion combiner weights `{"outlier": 2.0, "shift": 1.0, "cluster": 1.5,
  "perf": 1.0}` (Story B4) are still arbitrary and worth revisiting once real
  embeddings exist — `outlier_fraction`'s weight in particular may need
  lowering, since diagnostics on the mock model showed it saturates at 1.0
  for every client (honest and poisoned alike) and currently contributes no
  discriminating signal, only `shift`/`cluster` do. The `threshold=3.0`
  constant itself was superseded by Story B4.5's data-driven calibration —
  do not reintroduce a hardcoded threshold anywhere downstream of B4.5.
- Drift monitor: `window_size=5` rounds, `drift_threshold=2.0` (Story D3) —
  same caveat.
- 20-round test simulations with an attacker injected at round 12 (Stories
  C5, D6) — arbitrary but long enough to show a window-based trigger
  actually needs sustained rounds, not just one.
- Full-snapshot-vs-delta checkpoint cadence was designed for in the
  architecture (report Section 5.4) but not actually implemented as an
  automatic "every N rounds, force a full snapshot" policy in these
  stories — D2 gives you `save_full`, but nothing here calls it on anything
  other than round 1's checkpoint. Worth a follow-up story once you see how
  large delta chains get in practice.

## 8. Open items — none block starting

Everything above is specified precisely enough to start immediately. The
only things intentionally left open are the tunable defaults in Section 7
(by design — better to tune against real behavior than guess now) and the
batch-2 items listed in Section 1.4.

When you paste Muse Spark's printed `[STORY_ID] ...` output back into this
chat, paste it story-by-story (or in small batches) rather than all at once
at the very end — that way if something's wrong early, we catch it before
five more stories get built on top of the mistake.
