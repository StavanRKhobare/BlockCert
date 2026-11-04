BlockFedEDAuth-R — Complete Current Build Context
1. What the project is

BlockFedEDAuth-R is a federated-learning security and provenance system built around four core ideas:

Federated learning
Multiple clients train locally.
Their updates are authenticated before entering FedAvg.
Suspicious/poisoned clients are excluded.
Anomaly/authentication detection
Client embeddings are compared against a golden reference.
Multiple suspicion signals are combined:
Mahalanobis outlier fraction
Mean shift
Micro-cluster separation
Reference-set performance degradation
A calibrated threshold determines whether a client passes authentication.
Checkpointing + rollback
Every aggregated model state is hashed.
Model weights are stored off-chain.
Checkpoints form a hash chain.
A sliding-window drift detector can trigger rollback.
Rollback verifies checkpoint integrity before restoring weights.
Blockchain-backed trust/provenance
Blockchain stores checkpoint hashes/locations rather than model weights.
DIDs, staking, disputes, and lifecycle provenance are represented on-chain.
A Passport contract records lifecycle events for devices.
A provenance API wraps the Passport contract.

The project is intentionally modular. The current architecture is not yet a single HTTP application. The individual services are importable Python modules, and the eventual gateway is supposed to become the HTTP integration layer.

2. Overall architecture currently specified
                         ┌──────────────────────┐
                         │   dashboard-client   │
                         │ React / TS / Vite     │
                         │ Mock round feed       │
                         └──────────┬───────────┘
                                    │
                              future gateway
                                    │
                         ┌──────────▼───────────┐
                         │       gateway        │
                         │      NOT BUILT       │
                         └──────────┬───────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
 ┌────────────────┐       ┌────────────────┐       ┌────────────────┐
 │ auth-service   │       │ fl-orchestrator│       │ provenance-api │
 │ suspicion      │◄──────│ round manager  │       │ Passport API   │
 └────────────────┘       └───────┬────────┘       └───────┬────────┘
                                   │                        │
                                   ▼                        ▼
                          ┌─────────────────┐       ┌─────────────────┐
                          │ rollback-service│       │   Blockchain    │
                          │ checkpoint      │       │ Hardhat/local   │
                          │ drift/rollback  │       │                 │
                          └───────┬─────────┘       └─────────────────┘
                                  │
                                  ▼
                         checkpoint storage
                         + optional anchoring

The critical architectural contract is that fl-orchestrator is the integration point: it authenticates clients, aggregates accepted updates, checkpoints the resulting global model, monitors drift, and invokes rollback when necessary.

3. The immutable shared/ layer

There is an existing shared/ package that is treated as ground truth.

It must not be modified or duplicated.

Three important pieces exist there:

shared/interfaces/model_adapter.py

Every model implementation conforms to:

get_weights() -> dict[str, np.ndarray]

set_weights(weights: dict[str, np.ndarray]) -> None

local_train(local_data, epochs=1) -> dict[str, np.ndarray]

embed(images) -> np.ndarray

predict_anomaly_score(images) -> np.ndarray

model_id() -> str

embed() returns (N, D) embeddings and predict_anomaly_score() returns (N,).

shared/interfaces/schemas.py

Shared Pydantic models include:

ClientDID
ClientUpdate
SuspicionScore
AuthDecision
Checkpoint
DriftEvent
AttributionResult
StakeEvent
PassportEntry

The individual services are supposed to import these rather than recreate them.

shared/mock_model/mock_adapter.py

There is a deterministic mock model:

MockModelAdapter(client_did, seed)

with:

layer1 = (16,16)
layer2 = (8,8)
head   = (4,)

Embedding dimension = 32.

It supports:

local_train(inject_drift=True)
embed(poisoned=True)

for simulating model drift and an attacker.

There is also:

make_golden_reference(n_clients=5, seed=42)

The mock model is what the current backend simulations are built against; the real vision model is deliberately a separate track.

4. Blockchain layer

The blockchain side is:

TypeScript
Hardhat
Solidity
local Hardhat node
no Docker

The local chain runs at:

http://127.0.0.1:8545

using:

npx hardhat node

The five contracts are:

blockchain/contracts/
├── CheckpointAnchor.sol
├── DIDRegistry.sol
├── Staking.sol
├── Dispute.sol
└── Passport.sol

Deployments produce:

blockchain/deployments/localhost/
├── CheckpointAnchor.json
├── DIDRegistry.json
├── Staking.json
├── Dispute.json
└── Passport.json

Each deployment JSON contains:

{
  "address": "0x...",
  "abi": [...],
  "deployedAt": "..."
}

The deployment script is blockchain/scripts/deploy.ts.

4.1 CheckpointAnchor

This is the blockchain component directly used by rollback/checkpointing.

It stores metadata about checkpoints, not model weights.

It accepts:

roundNumber
weightsHash
offChainUri
parentHash
isDelta

and returns a checkpoint ID.

It provides:

anchorCheckpoint(...)
getCheckpoint(...)
getLatestCheckpointId()

It emits:

CheckpointAnchored

Important architectural point:

The blockchain never stores the model weights themselves.

Only the weight hash and an off-chain URI are stored.

4.2 DIDRegistry

Stores decentralized identity information:

DID
public key
display name
owner address
timestamp

Functions:

registerDID(...)
getDID(...)
isRegistered(...)

Duplicate DIDs are rejected.

4.3 Staking

Each DID can have a stake balance.

Functions:

stake(did)
slash(did, amount, reason)
balanceOf(did)

slash() is owner-only using OpenZeppelin Ownable.

Slashed funds are transferred to the contract owner.

Important: the staking contract currently exists independently of the authentication service.

The actual:

auth rejection → slash

wiring is deferred to the gateway.

4.4 Dispute

The dispute system uses a provisional rejection → challenge window → finalization/overturn model.

Statuses:

ProvisionallyRejected
FinalizedRejected
Overturned

Flow:

fileFlag()
     │
     ▼
ProvisionallyRejected
     │
     ├── challenge before deadline ──► Overturned
     │
     └── deadline passes ────────────► FinalizedRejected

A flag is never deleted; its status is superseded.

Functions:

fileFlag(...)
overturn(...)
finalize(...)
getDispute(...)

Again, the contract exists independently; actual integration with auth failures is deferred to the gateway.

5. Passport / device provenance blockchain

The Passport.sol contract records lifecycle events for devices.

Supported lifecycle types:

repair
resale
refurbishment
recycling
inspection

An event contains:

deviceId
eventType
evidenceHash
modelVersionHash
actorDid
signature
timestamp

Functions:

submitEvent(...)
getEventsForDevice(...)
getEvent(...)
Important correction

The Passport contract originally had five arguments, but the design was explicitly revised to add:

signature

The final interface is six arguments.

Downstream code must therefore use the 6-argument version.

This is one of the important things that could otherwise break future development.

6. Auth-service

auth-service is the client authentication/anomaly-detection engine.

It currently operates entirely against the mock model.

It does not depend on:

blockchain
vision model

at this stage.

Its important files are:

auth-service/
├── golden_reference/
│   └── reference_stats.py
├── scoring/
│   ├── suspicion.py
│   ├── reference_perf_check.py
│   ├── combined.py
│   └── calibration.py
├── entrypoint.py
└── tests/
7. Golden reference

The authentication system builds a golden reference from honest clients.

compute_reference_stats() produces:

mean
covariance
inv_covariance
threshold
embeddings

The original embedding array is deliberately retained.

This is important because the golden reference is multi-modal.

The system must not replace the real reference embeddings with synthetic samples drawn from:

N(mean, covariance)

because that would destroy the multi-cluster structure needed by the micro-cluster detector.

The Mahalanobis threshold is initially based on the 99th percentile.

Singular covariance is handled through:

covariance + 1e-6 * I

before inversion.

8. Suspicion detection

Three embedding-based signals are implemented.

8.1 Outlier fraction

Measures the fraction of client embeddings whose Mahalanobis distance exceeds the golden-reference threshold.

8.2 Mean shift

Euclidean distance between:

client embedding mean

and:

golden reference mean
8.3 Micro-cluster score

Client and reference embeddings are combined and clustered using:

KMeans(n_clusters=2)

The score represents how strongly one cluster is dominated by client points versus reference points.

Rough interpretation:

0.5 → little separation
1.0 → strong/perfect separation

These signals were explicitly tested against:

honest mock client
poisoned mock client

and the poisoned client's outlier fraction and mean shift should be higher.

9. Reference-set performance signal

There is a fourth signal that does not use embeddings.

The model is evaluated on a labeled golden/reference dataset.

The system computes:

new_accuracy - baseline_accuracy

using anomaly scores thresholded at 0.5.

Important limitation:

The current mock model's anomaly predictions are random.

Therefore this component currently tests the arithmetic/functionality rather than meaningful model performance.

It is intended to become meaningful once real labeled data from the vision model exists.

10. Combined suspicion score

The current combiner is:

combined =
    2.0 * outlier_fraction
  + 1.0 * mean_shift
  + 1.5 * micro_cluster_score
  - 1.0 * min(reference_perf_delta, 0)

Default threshold originally:

3.0

But 3.0 is no longer the production threshold.

This is extremely important.

The fixed threshold was found to be inappropriate because the mock high-dimensional outlier calculation saturated.

11. Calibrated authentication threshold

A calibration stage was added.

It creates five known-honest calibration clients using seeds:

100–104

This intentionally avoids overlap with:

golden reference: 42–46
main fleet:       0–7

It computes their combined scores and sets:

calibrated_threshold =
    mean(combined_scores)
    + 3 * std(combined_scores)

The authentication entrypoint should use:

reference_stats["calibrated_threshold"]

rather than the original 3.0.

The measured calibrated threshold referenced by the dashboard is approximately:

9.98

and the mock scenario has:

honest clients ≈ 7.8–9.7
poisoned client ≈ 25–26

This calibrated threshold is one of the most important current assumptions in the UI/mock scenario.

12. Authentication entrypoint

The public function is:

score_client(
    client_did: str,
    round_number: int,
    embeddings: np.ndarray,
    reference_stats: dict
) -> SuspicionScore

It:

Uses the existing golden-reference statistics.
Computes the three embedding signals.
Uses the combined score.
Uses the calibrated threshold.
Returns a SuspicionScore.

The micro-cluster detector specifically receives:

reference_stats["embeddings"]

not synthetic embeddings.

The current reference_set_accuracy_delta is allowed to remain:

0.0

because the labeled vision dataset does not yet exist. The future gateway/vision integration is expected to wire this signal properly.

13. Federated-learning orchestrator

fl-orchestrator is where the backend pieces come together.

Main components:

client_sim/
├── partition.py
└── simulated_client.py

server/
├── aggregate.py
└── round_manager.py
14. Client simulation

The current simulation creates:

8 clients

using different random seeds.

DIDs:

client-0
client-1
...
client-7

Different seeds produce different embedding centers, which are being used as a mock approximation of non-IID data.

Important limitation:

This is NOT real non-IID data partitioning.

Once the real vision model exists, clients are supposed to be partitioned by actual defect categories/data distributions rather than random seeds.

15. FedAvg

fedavg() performs sample-count-weighted averaging of model layers.

It accepts:

fedavg(
    client_weights,
    client_sample_counts
)

If every client fails authentication and the input list is empty, it raises ValueError.

The round manager is expected to handle this case by skipping the round rather than crashing.

Currently the simulation uses:

sample_count = 1

for each client.

That is explicitly a placeholder until real per-client sample counts come from the vision model.

16. Round execution pipeline

The intended round sequence is:

1. Client authentication
       ↓
2. Remove failed clients
       ↓
3. Local training of accepted clients
       ↓
4. FedAvg
       ↓
5. Update global model
       ↓
6. Checkpoint
       ↓
7. Drift monitoring
       ↓
8. If drift detected → rollback
       ↓
9. Continue

More specifically, run_round():

authenticate_round()
      ↓
passing clients train
      ↓
fedavg()
      ↓
global_model.set_weights()
      ↓
checkpoint_round()
      ↓
ingest_round()
      ↓
if DriftEvent:
    rollback_executor.execute()

The checkpoint registry must retain every checkpoint, not only the most recent one, because rollback can target an older round.

17. Multi-round attacker scenario

The canonical simulation is:

8 clients
20 rounds

Client:

client-3

becomes malicious starting at:

round 12

Rounds:

1–11  → honest
12–20 → poisoned

The attacker is expected to eventually fail authentication and therefore be excluded from aggregation.

This same scenario is reused by the dashboard mock data.

18. Rollback-service

The rollback system contains:

rollback-service/
├── checkpoint_store/
│   ├── hasher.py
│   ├── local_store.py
│   └── delta.py
├── drift_monitor/
│   ├── window_tracker.py
│   └── rollback_executor.py
└── chain_bridge/
    └── chain_client.py

It is responsible for:

checkpoint creation
checkpoint storage
checkpoint integrity
drift detection
rollback
optional blockchain anchoring
19. Checkpoint hashing

Each model layer is hashed using SHA-256 over:

array.tobytes()

The layer hashes are then sorted alphabetically by layer name and combined to produce a deterministic Merkle-style root.

Therefore:

same weights → same root
any changed value → different root
dictionary insertion order → irrelevant

This root becomes:

weights_hash

for a checkpoint.

20. Off-chain checkpoint storage

Actual model weights are stored locally/off-chain.

LocalCheckpointStore:

save_full()
load()
verify_integrity()

Weights are serialized as:

.npz

files.

Typical URI:

local://...

The abstraction is deliberately designed so this can later be swapped for something such as IPFS without changing callers.

Integrity is checked by:

load checkpoint
      ↓
recompute Merkle root
      ↓
compare against expected weights_hash

Corruption must be detected.

21. Checkpoint orchestration

The real checkpoint entrypoint is:

checkpoint_round(
    round_number,
    weights,
    reference_set_metrics,
    store,
    previous_checkpoint=None,
    full_snapshot_interval=5,
    chain_client=None
)

Important current behavior:

It currently always saves a full snapshot.

Even though the API has:

full_snapshot_interval=5

and delta support exists, the actual checkpoint orchestration does not currently construct delta chains.

It does:

hash weights
↓
save full snapshot
↓
parent_hash = previous checkpoint hash
↓
create Checkpoint
↓
optionally anchor on blockchain

Every checkpoint therefore currently has:

is_delta = False

This is deliberate because proper delta-chain replay was deferred.

This is another critical context point: do not assume delta compression is actually active just because delta.py exists.

22. Checkpoint hash chain

Although the stored model snapshot is currently full, checkpoints are linked:

Checkpoint 1
weights_hash = H1
parent_hash = null

Checkpoint 2
weights_hash = H2
parent_hash = H1

Checkpoint 3
weights_hash = H3
parent_hash = H2

...

Thus the metadata itself forms a hash chain.

The parent hash is the previous checkpoint's weights_hash.

23. Drift monitor

The drift detector is stateful.

Default configuration:

window_size = 5
drift_threshold = 2.0

Each round it tracks:

Mean combined suspicion score across all clients
both accepted and rejected
Reference-set accuracy

After five rounds it checks:

average suspicion > drift_threshold
AND
reference accuracy trend < 0

If both conditions hold:

DriftEvent

is generated.

The event contains:

window_start_round
window_end_round
trigger_reason
reverted_to_checkpoint_hash

The caller must pass the hash of the checkpoint before the drift window began.

That is a critical correctness requirement for rollback.

24. Rollback executor

Rollback does not blindly load a checkpoint.

The process is:

DriftEvent
    ↓
checkpoint_registry lookup
    ↓
find off-chain URI
    ↓
load checkpoint
    ↓
verify integrity
    ↓
set model weights

If integrity verification fails:

raise exception

The system must never restore corrupted/tampered weights.

The function is:

execute(
    drift_event,
    model_adapter,
    store,
    checkpoint_registry
)

This is the definitive four-argument signature. Earlier documentation had a two-argument version, but it was explicitly corrected.

25. Blockchain checkpoint anchoring

ChainClient connects to the local Hardhat blockchain.

Configuration:

CHAIN_RPC_URL
default: http://127.0.0.1:8545

and:

CHAIN_DEPLOYMENTS_DIR
default: ../blockchain/deployments/localhost

It loads:

CheckpointAnchor.json

and calls:

anchorCheckpoint(...)

using Hardhat's first account.

The blockchain anchoring is best effort.

If the blockchain is unavailable:

ConnectionError

is caught by checkpoint_round() and anchoring is skipped.

The checkpoint itself must still succeed because rollback depends on the off-chain checkpoint, not the blockchain audit trail.

26. Provenance API

The provenance layer was added after the original batch.

Directory:

provenance-api/
├── chain_bridge/
│   └── passport_client.py
├── entrypoint.py
└── tests/

It is currently not an HTTP API.

It is a normal importable Python module.

The eventual gateway is responsible for turning it into an HTTP-facing API.

27. PassportClient

PassportClient talks directly to the deployed Passport contract.

Configuration follows the same pattern as ChainClient:

CHAIN_RPC_URL
CHAIN_DEPLOYMENTS_DIR

It provides:

submit_event()
get_events_for_device()
get_event()

submit_event() returns:

(entry_id, tx_hash)

The entry_id is extracted from the emitted blockchain event.

It must not assume that the client-side counter is the source of truth. The blockchain is the source of truth.

28. Public provenance API behavior

The main function is:

submit_lifecycle_event(
    device_id,
    event_type,
    evidence,
    model_version_hash,
    actor_did,
    signature
)

Notice:

evidence = raw bytes

not a precomputed hash.

The API itself computes:

SHA-256(evidence)

and stores the resulting hash on-chain.

This guarantees that callers cannot accidentally use different hashing conventions.

29. Provenance submission flow
raw evidence
     ↓
validate event type
     ↓
SHA-256 evidence
     ↓
PassportClient.submit_event()
     ↓
receive entry_id
     ↓
read same entry back from blockchain
     ↓
construct PassportEntry

The returned PassportEntry gets its:

signature
timestamp

from the actual blockchain read-back.

It must not use:

locally passed signature
time.time()

This ensures that the returned entry and future history reads refer to the exact same on-chain record.

30. Passport history

get_passport_history(device_id):

gets event IDs for the device
retrieves each event
converts each to PassportEntry
uses the actual on-chain signature
sorts by timestamp ascending

The final API therefore provides a chronological device lifecycle history.

31. Signature verification is NOT implemented yet

This is important.

Currently:

actor_did
signature

are simply stored/pass-through strings.

There is no cryptographic verification connecting the signature to the DID/public key yet.

Real DID/signature enforcement is explicitly deferred to the future gateway.

32. Client dashboard

A separate frontend exists/specification is defined as:

React
TypeScript
Vite
Tailwind
Recharts
@xyflow/react
Framer Motion
Vitest
React Testing Library

The dashboard is intentionally a client-side dashboard, not the future server dashboard.

33. Dashboard data architecture

The most important frontend architectural decision is:

useRoundFeed()

is the single data source for all dashboard panels.

Components must not import the mock scenario directly.

Current flow:

roundFeed.ts
      ↓
useRoundFeed()
      ↓
all dashboard components

Later:

real gateway polling
      ↓
useRoundFeed()
      ↓
same components

Therefore useRoundFeed() is deliberately designed as the single swap point between mock data and real backend data.

34. Frontend shared types

The frontend mirrors backend schemas using the same snake_case field names.

Important types include:

ClientDID
SuspicionScore
AuthDecision
Checkpoint
DriftEvent
StakeEvent
PassportEntry

There is also:

RoundPipelineStage

with:

idle
local_training
computing_embeddings
authenticating
aggregating
checkpointing
drift_check
broadcasting

Important:

RoundPipelineStage is currently frontend-only.

The real backend does not yet emit granular pipeline-stage events. Gateway will eventually need to provide them if this visualization is to become live.

35. Dashboard mock scenario

The frontend simulates the same canonical backend scenario:

client = did:example:client-3

rounds 1–11:
    honest

rounds 12–20:
    poisoned

Suspicion:

honest ≈ 7.8–9.7

attacker ≈ 25–26

calibrated threshold ≈ 9.98

Each round also contains a full checkpoint.

The checkpoints have:

parent_hash

chained from round to round.

And:

is_delta = false

because the real checkpoint system currently stores full snapshots.

There are also:

stake events
passport events
pipeline-stage transitions

all within the mock scenario.

36. Dashboard panels

The current client dashboard contains/specifies:

Pipeline Flowchart

Shows:

Local Training
→ Computing Embeddings
→ Authenticating
→ Aggregating
→ Checkpointing
→ Drift Check
→ Broadcasting

with the current stage highlighted and previous/completed stages visually differentiated.

Suspicion History

Line chart:

combined_score vs round

with:

calibrated threshold ≈ 9.9817

and pass/fail points.

Clicking a point exposes:

outlier_fraction
mean_shift
micro_cluster_score

so the user can understand why the client was accepted/rejected.

Fleet Standing

The dashboard simulates:

8 total clients

but only shows the current client's relative position.

The other clients remain anonymous.

The honest scores are based on the measured values:

8.9265
7.7989
8.6812
9.7005
8.2001
7.8533
9.3369
8.5529

The poisoned client should become the most suspicious at round 15.

Stake & Trust

Shows:

current stake
stake/slash/restoration timeline
trust percentage

Trust is currently defined as:

rounds passed / rounds participated

For the canonical 20-round scenario:

11 / 20

because rounds 1–11 pass and rounds 12–20 fail.

Contribution Volume

Shows:

images examined
anomalies detected

These values are currently placeholder mock values because the real vision model is not integrated.

Example:

~50 images/round

with low single-digit anomaly counts.

This is explicitly marked as temporary.

Passport Submissions

Shows the current client's own lifecycle events:

event_type
evidence_hash
timestamp

Hashes can be copied in full.

Device Lookup

Currently searches the local mock passport entries.

Real implementation should eventually do:

DeviceLookup
   ↓
gateway
   ↓
provenance-api
   ↓
Passport blockchain

not search a frontend array.

Teacher Mode

A presentation/evaluation mode exists.

It:

increases font sizes
adds explanatory annotations
enhances the pipeline flowchart
enhances the suspicion chart

It is a presentation layer over the same application, not a second application.

37. Dashboard color semantics

The shared legend establishes:

green → pass / healthy
red   → fail / slashed
amber → pending / disputed

All panels are supposed to use these meanings consistently.

38. What is deliberately NOT built yet

This is probably the most important section for your next build.

Gateway

Not built.

It is supposed to:

expose the HTTP API
connect the frontend to backend services
connect auth/fl/rollback/provenance
eventually handle DID/signature verification
eventually trigger staking/slashing/disputes
become the external integration layer

The current backend services are intentionally not HTTP services.

Attribution service

Not built.

It depends on DriftEvents and is intentionally deferred.

Vision model

Not built in these batches.

The entire current backend uses MockModelAdapter.

Therefore things like:

real image embeddings
real anomaly predictions
real image counts
real client data partitions
real reference labeled dataset

are not yet represented.

Server dashboard

Not built.

The following are explicitly deferred:

Living System Map
Suspicion Heatmap
FedAvg Visualizer
Checkpoint Hash-Chain Graph
Blockchain Explorer
Dispute Kanban
Staking Economics
System-wide Provenance Ledger

These belong to the future Server Dashboard epic.

39. Important things that look implemented but are actually placeholders

This is the section I would keep open while continuing development.

1. Non-IID data

Current:

different random seeds

Future:

real per-client data partitioning by defect/category

So don't build further logic assuming the current distribution represents real federated data.

2. Reference-set performance

Current:

reference_set_accuracy_delta = 0.0

because the real labeled dataset doesn't exist.

3. Contribution volume

Current dashboard values are placeholders pending the vision model.

4. Pipeline stages

Current:

frontend-generated mock sequence

not a backend event stream.

5. Checkpoint deltas

There is a delta.py, but actual checkpoint orchestration currently does:

full snapshot every time

Delta-chain replay has deliberately not been implemented.

6. full_snapshot_interval

The parameter exists:

full_snapshot_interval=5

but the current checkpoint orchestration does not actually implement an automatic full-every-N-round policy.

This was explicitly called out as future work.

7. Suspicion weights

Current:

outlier = 2.0
shift   = 1.0
cluster = 1.5
perf    = 1.0

These are placeholder/tunable values, not empirically established production values.

The mock diagnostics showed that outlier_fraction saturates at 1.0 for both honest and poisoned clients, so it currently provides little discrimination.

8. Drift threshold

Current:

window_size = 5
drift_threshold = 2.0

These are also explicitly placeholders to be revisited against real behavior.

40. Critical integration contracts to preserve

If you're continuing the project, these are the contracts I would not casually change.

Auth
score_client(
    client_did,
    round_number,
    embeddings,
    reference_stats
) -> SuspicionScore
Checkpointing
checkpoint_round(
    round_number,
    weights,
    reference_set_metrics,
    store,
    previous_checkpoint,
    full_snapshot_interval=5,
    chain_client=None
) -> Checkpoint
Drift
ingest_round(
    round_number,
    suspicion_scores,
    reference_set_accuracy,
    latest_checkpoint_hash
) -> DriftEvent | None

There is a subtle documentation discrepancy worth preserving carefully: the integration table initially described a 3-argument drift call, but the actual D3 implementation specification requires latest_checkpoint_hash as a fourth argument. The D3 story explicitly makes this parameter necessary because the rollback target must refer to the checkpoint before the drift window.

Rollback
execute(
    drift_event,
    model_adapter,
    store,
    checkpoint_registry
) -> None
Blockchain checkpoint
anchor_checkpoint(checkpoint) -> str
Passport
submit_event(
    device_id,
    event_type,
    evidence_hash,
    model_version_hash,
    actor_did,
    signature
) -> tuple[int, str]
Provenance public API
submit_lifecycle_event(
    device_id,
    event_type,
    evidence,
    model_version_hash,
    actor_did,
    signature
) -> PassportEntry
History
get_passport_history(device_id) -> list[PassportEntry]
41. The intended end-to-end behavior

Putting everything together, the intended system flow is:

CLIENT
 │
 │ local training
 ▼
ModelAdapter
 │
 │ embeddings
 ▼
AUTH SERVICE
 │
 ├── outlier fraction
 ├── mean shift
 ├── micro-cluster score
 ├── reference performance
 │
 ▼
combined suspicion score
 │
 ▼
calibrated threshold
 │
 ├─────────────── fail ────────────────┐
 │                                     │
 │ pass                                ▼
 ▼                              provisional rejection
FedAvg                                  │
 │                                      │
 ▼                                      ▼
GLOBAL MODEL                         future gateway
 │                                      │
 ▼                                      ├── staking/slashing
CHECKPOINT                              └── dispute
 │
 ├── SHA-256/Merkle-style hash
 ├── save model off-chain
 ├── parent checkpoint hash
 └── optional blockchain anchor
 │
 ▼
DRIFT MONITOR
 │
 ├── stable → next round
 │
 └── sustained suspicion +
     declining reference accuracy
             │
             ▼
         DriftEvent
             │
             ▼
       ROLLBACK EXECUTOR
             │
       verify checkpoint
             │
             ▼
       restore model

Separately:

DEVICE LIFECYCLE EVENT
        │
        ▼
provenance-api
        │
        ├── validate event type
        ├── SHA-256 raw evidence
        ▼
PassportClient
        │
        ▼
Passport.sol
        │
        ▼
on-chain lifecycle record

And eventually:

dashboard
    ↓
gateway
    ↓
real backend services
    ↓
real model/blockchain/provenance
42. Current project maturity according to these files

The supplied material defines a fairly complete backend core + blockchain + provenance + client-dashboard prototype, but the project is not yet end-to-end production/live.

Core backend architecture

Defined/built around:

authentication
federated aggregation
checkpointing
drift detection
rollback
blockchain anchoring
Blockchain

Five-contract architecture exists:

CheckpointAnchor
DIDRegistry
Staking
Dispute
Passport
Provenance

Passport blockchain integration exists through provenance-api.

Frontend

A complete client-facing demonstration dashboard exists around deterministic mock data.

Missing integration layer

The major missing bridge is:

gateway

which is supposed to connect everything into a real application.

Missing real ML layer

The other major missing piece is:

vision-model

which is what will replace the current mock model assumptions.

43. The single most important mental model going forward

Do not think of the current project as:

"a finished FL security platform."

Think of it as:

A fully specified/simulated FL security architecture whose core control flow has been designed around deterministic mock clients, with blockchain-backed checkpoint/provenance infrastructure and a frontend demonstration, while the gateway and real vision-model/data layer remain to be integrated.

That distinction explains almost every placeholder currently present.

The architecture already has the important control loop:

TRAIN
 → AUTHENTICATE
 → AGGREGATE
 → CHECKPOINT
 → MONITOR
 → ROLLBACK

and the blockchain/provenance side:

IDENTITY
 → STAKE/DISPUTE
 → CHECKPOINT ANCHORING
 → DEVICE PASSPORT

But the real data/model + gateway + production API layer are still the next major integration step. The documents explicitly identify those as deferred rather than silently pretending they already exist.
BlockFedEDAuth-R — Complete Project Context, Research Direction & Current Gaps
1. What the project actually is

BlockFedEDAuth-R is a federated-learning security system for semiconductor surface-defect anomaly detection.

The project originally started from FedEDAuth, which applies federated learning to counterfeit IC detection and authenticates clients using the distribution of their model embeddings.

The project deliberately moved away from that exact task.

Original direction

FedEDAuth:

64 × 64 package photographs
        ↓
authentic vs counterfeit classifier
        ↓
federated learning
        ↓
embedding-based client authentication
Current direction

BlockFedEDAuth-R:

high-resolution semiconductor microscopy
        ↓
surface-defect anomaly detection
        ↓
federated learning
        ↓
client authentication
        ↓
multi-round drift detection
        ↓
rollback to known-good checkpoint
        ↓
blockchain-anchored provenance/accountability

The major motivation for the change was that package/label counterfeit classification was considered relatively shallow for the intended research contribution, whereas semiconductor surface anomaly detection is a harder one-class/rare-defect problem.

2. The central research idea

The project should not be presented as "we built blockchain + federated learning."

That is not sufficiently novel.

The literature review identified close prior work for almost every individual component:

FedEDAuth → embedding-based authentication
FedRecover → federated poisoning recovery
Crab → selective historical recovery
DP-RTFL → temporal checkpoints
Leash-FL → blockchain-backed FL rollback
BlockFLA → blockchain-based punishment/accountability

Therefore, none of those pieces individually constitutes the project's research contribution.

The intended novelty is the combination:

Use the authentication layer's suspicion statistics across multiple rounds as the trigger for rollback, and reuse that same drift window to cheaply identify the likely culprit client(s).

In other words:

Traditional approach:

Round
  ↓
Detect malicious client
  ↓
Remove client


BlockFedEDAuth-R:

Round 1 ─┐
Round 2  │
Round 3  │
Round 4  ├── suspicion statistics
Round 5 ─┘
          ↓
   detect accumulated drift
          ↓
      rollback
          ↓
 use same window to identify culprit

This is the actual research claim worth defending.

3. Why multi-round drift is necessary

The project is targeting a specific weakness of per-round defenses.

A malicious client does not necessarily have to submit an obviously poisoned update.

Instead:

small poisoning
small poisoning
small poisoning
small poisoning
small poisoning
        ↓
individually acceptable
        ↓
cumulative model degradation

FedEDAuth itself reportedly observed a low-intensity poisoning situation where a poisoned client's embedding distribution began overlapping with the clean cluster, making per-round detection harder.

The project therefore separates:

Per-client authentication
"Is this client's update suspicious right now?"

from:

Global drift detection
"Has the global model been degrading over the last several rounds?"

The second mechanism is the project's core.

4. Complete six-layer architecture

The intended system has six layers:

Layer	Purpose	Current state
Vision / anomaly model	Detect semiconductor defects	Open / separate track
FL aggregation	Combine client updates	FedAvg decided
Client authentication	Detect suspicious client embeddings	Adaptation required
Rollback/versioning	Detect multi-round drift + recover	Core contribution
Culprit attribution	Identify clients responsible for drift	Supporting / on hold
Blockchain	Trust, checkpoints, disputes, staking, provenance	Working infrastructure, some gaps

The data flow is:

Private client defect imagery
          ↓
     local training
          ↓
        FedAvg
          ↓
client embeddings / suspicion
          ↓
accepted updates
          ↓
global model
          ↓
reference-set monitoring
          ↓
multi-round drift
          ↓
rollback
          ↓
culprit attribution
          ↓
blockchain accountability/provenance

The blockchain never stores model weights directly.

5. Vision task

The vision problem has been explicitly changed to:

Semiconductor surface/microscopy defect anomaly detection.

This is intended to be primarily a one-class anomaly-detection problem, because normal samples greatly outnumber defective ones.

That changes the model architecture compared with FedEDAuth.

Instead of:

ResNet classifier
normal vs counterfeit

the candidate model family is:

Autoencoder
Normalizing flow
Embedding-distance model
Reconstruction-error model

or similar anomaly detectors.

6. Dataset decision is still open

Three relevant dataset directions exist.

MIIC

Characteristics:

512 × 512 grayscale SEM
wire-bond / metal layer
25,276 total images
116 anomalous

Advantages:

public
semiconductor-specific
directly fits anomaly detection

Problem:

116 anomalies / 25,276 total

is extremely imbalanced.

Once divided across multiple simulated clients, each client gets very little anomalous data.

IDA / ICME 2026 Grand Challenge

This is the richer option.

It contains high-resolution wafer-surface microscopy and seven defect categories:

scratch
dent
particle
damage
stain
bubble
chipping

It includes pixel-level masks.

The training set has:

1,173 anomalous images
2,543 instances

and the test set:

1,834 anomalous images
1,921 instances

This is much more useful for creating naturally heterogeneous clients because different clients can possess different defect distributions.

But:

Public access was not confirmed in the design document.

So this dataset should not be treated as guaranteed until access is verified.

MVTec-AD / ZJU-Leaper

Useful as a general anomaly-detection benchmark/prototyping dataset.

But it is not semiconductor-specific.

Therefore it is more suitable for:

pipeline prototyping
cross-domain baseline

rather than the final domain-specific experiment.

WM-811K / Mixtype-WM38

Large wafer dataset, but it contains wafer bin/pattern maps, not microscopy photographs.

Therefore it only makes sense if the project changes modality toward wafer-map classification.

7. Current dataset decision

The actual open decision is:

IDA/ICME available?
       │
   ┌───┴────┐
  YES       NO
   │         │
IDA/ICME   MIIC
           │
           └── possibly synthetic augmentation

If MIIC is used, the small number of anomalous examples needs to be explicitly acknowledged.

The report suggests synthetic augmentation as a possible fallback.

8. Federated learning architecture

The aggregation algorithm is decided: FedAvg.

Cyclic Weight Transfer / sequential FL was considered but is not the current design.

Reasons include:

catastrophic forgetting
client-order sensitivity
problems under non-IID data

FedAvg gives the project a standard and defensible baseline.

9. Why non-IID data matters

Real semiconductor organizations will naturally have different distributions.

For example:

Client A → mostly scratches
Client B → mostly particles
Client C → mostly dents
Client D → mostly stains

This makes federated learning naturally non-IID.

But the current implementation does not actually model this.

It currently simulates non-IID behavior using:

different random seeds
different random class centers

rather than actual defect-category data partitions.

This must eventually be replaced once the vision model/data is available.

10. Potential FedAvg improvements

These are research directions, not current implementation decisions:

FedProx

Could reduce client drift under heterogeneous data.

FedAvgM

Could introduce server-side momentum.

But these should be evaluated as ablations/baselines, not allowed to distract from the main contribution.

11. Client authentication needs adaptation

The current authentication mechanism originated from FedEDAuth.

It uses:

Mahalanobis outlier fraction
mean shift
micro-cluster separation
reference-set performance

But FedEDAuth assumes a labeled, multi-class problem.

Your new task is:

normal
+
rare heterogeneous anomalies

So the authentication layer cannot simply be copied unchanged.

The proposed adaptations include:

Option A

Build the golden distribution primarily from normal embeddings.

Option B

Maintain separate anomaly statistics.

Option C

Relate client embeddings/reconstruction errors to the client's own anomaly distribution rather than assuming a classification-style embedding geometry.

This is currently an open research/implementation decision.

12. Current authentication implementation

The existing prototype still uses the FedEDAuth-style implementation against the mock model.

The previous fixed threshold:

3.0

failed because the high-dimensional mock embeddings caused:

outlier_fraction = 1.0

for essentially everyone.

So it was replaced with a calibrated threshold:

mean(calibration scores)
+
3 × std(calibration scores)

using calibration seeds:

100–104

while golden reference clients use:

42–46

and fleet clients use:

0–7

The measured threshold is:

9.981717382468954
≈ 9.9817
≈ 9.98

The dashboard rounds this to 9.9817.

13. But the authentication numbers are not research-grade yet

The current weights:

outlier = 2.0
mean shift = 1.0
micro-cluster = 1.5
performance = 1.0

are explicitly placeholders.

They have not been tuned against real vision data.

Similarly:

reference_set_accuracy_delta = 0

throughout the current implementation because the real labeled reference dataset isn't wired into the FL rounds.

14. Golden reference assumption

The system assumes a trusted third party provides/curates the golden reference dataset.

For example:

neutral authority
       ↓
golden reference dataset
       ↓
authentication

Compromise of that golden reference is explicitly outside current scope.

This is worth remembering because otherwise reviewers can reasonably ask:

"Who decides what constitutes normal?"

The current answer is:

a neutral/trusted reference curator.

15. Rollback is the core system contribution

The rollback architecture is:

Round 1 → checkpoint
Round 2 → checkpoint
Round 3 → checkpoint
...
Round N
   ↓
monitor global behavior
   ↓
detect sustained drift
   ↓
identify beginning of drift window
   ↓
restore checkpoint immediately before drift

The key point is:

rollback is not triggered simply because one client was rejected.

It is triggered because the global model's behavior has degraded over time.

That is the conceptual difference from ordinary per-round poisoning detection.

16. What exactly is monitored for drift

The intended drift signal can involve:

outlier fraction
mean shift
reconstruction error
reference-set performance

over a sliding window.

So:

Round 13
Round 14
Round 15
Round 16
Round 17

are considered together rather than independently.

17. Checkpoint design

The intended production architecture is:

Blockchain
    │
    ├── hash
    ├── round
    └── metadata
         │
         ▼
Off-chain storage
    │
    └── actual model weights

The project explicitly rejects storing model weights on-chain because full neural-network checkpoints are too large and expensive.

18. Intended checkpoint optimization

The design eventually wants:

Full checkpoints periodically
R1 full
R2 delta
R3 delta
R4 delta
R5 full

rather than:

R1 full
R2 full
R3 full
R4 full
R5 full

It also proposes:

differential checkpoints
Merkle trees
partial verification
partial/layer rollback
pruning old checkpoints

But these are design goals, not all implemented functionality.

The actual current implementation still saves:

is_delta = False

full snapshots every round.

19. Culprit attribution

The project explicitly does not want to implement full Shapley-value attribution as the main approach.

It would be:

computationally expensive
complicated
unnecessary for every round

Instead:

drift detected
      ↓
take only affected rounds
      ↓
look at clients active in that window
      ↓
compare their update direction
against global drift direction
      ↓
rank/identify likely culprit

This is intended to be a cheap windowed attribution mechanism.

That is itself a potentially interesting supporting contribution.

However, the actual attribution-service is currently on hold.

20. Blockchain's actual purpose

The project deliberately avoids the "blockchain because blockchain" trap.

Blockchain is considered useful for four things:

1. Decentralized authentication trust

Instead of:

one trusted authentication server

eventually:

multiple validators
        ↓
consensus on client decision
2. Staking/slashing

A participant has economic collateral.

Malicious behavior can result in:

stake
 ↓
confirmed malicious behavior
 ↓
slash
3. Dispute resolution

A rejected client should not necessarily be immediately punished.

Instead:

rejection
 ↓
provisional flag
 ↓
challenge window
 ↓
finalize OR overturn

The original event remains immutable.

4. Device provenance

A semiconductor component can have a lifecycle:

foundry
 ↓
distributor
 ↓
integrator
 ↓
customer
 ↓
repair/refurbishment/etc.

The passport provides a shared multi-party history.

These are the areas where the design argues blockchain provides value beyond a conventional database.

21. What blockchain should NOT be used for

The project explicitly says that merely putting routine FL logs on-chain is not useful.

For example:

Round 1 completed
Round 2 completed
Round 3 completed

doesn't require blockchain.

A normal signed append-only database would accomplish the same thing much more cheaply.

22. Blockchain platform decision

The research discussion considered:

Public Ethereum-style

Pros:

easy development
mature tooling
Solidity/Hardhat
real gas economics
staking fits naturally

Cons:

latency
gas
public infrastructure
Permissioned Hyperledger-style

Pros:

closer to actual semiconductor consortium
known validators
predictable performance

Cons:

significantly more implementation complexity
custom staking/token economics

The current recommendation is:

Prototype on an Ethereum-style environment/testnet and describe permissioned/Hyperledger deployment as the production path.

The actual current implementation is a local Hardhat/Ethereum-style prototype, not a production permissioned blockchain.

23. Dispute model

Because blockchain records cannot simply be deleted:

bad rejection

cannot be "removed."

Instead:

Flagged
   ↓
ProvisionalRejected
   ↓
challenge
   ├── overturn
   └── finalize

The original record remains.

A later transaction records the correction.

This is important to preserve because it is part of the project's accountability design.

24. Current gateway state

The gateway does exist now.

This is a major difference from the earlier documentation.

The current system has a gateway and dashboards that can actually communicate with it.

However, the gateway has several incomplete interfaces.

25. Missing per-round suspicion endpoint

This is one of the biggest current gaps.

The backend computes:

8 clients × N rounds

of suspicion scores.

But after a round finishes, the session stores only something like:

{
    n_passed,
    n_failed,
    checkpoint
}

It does not retain the raw per-client SuspicionScore[].

Therefore:

GET /rounds/{round}/scores

does not currently exist.

Consequence

Dashboard suspicion visualizations are partly:

LIVE round counter
+
REPLAYED historical scores

rather than entirely live.

This is extremely important if you continue building the frontend.

26. Missing dispute reader

The gateway can:

create/track/finalize disputes
slash on-chain

but there is no:

GET /disputes

endpoint.

Therefore the server dispute Kanban currently uses replay data.

Planned endpoint:

GET /disputes
27. Missing stake history

Current gateway exposes current stake/balance.

But it does not have a structured historical:

StakeEvent[]

series.

Therefore:

staking economics chart
stake timeline

are still replayed.

Planned endpoint:

GET /clients/{did}/stake-history

28. Missing checkpoint list endpoint

There is similarly no proper endpoint for retrieving the checkpoint history.

Therefore:

checkpoint hash-chain graph

still relies on replay.

This is easy to miss because the checkpoint system itself exists; the missing piece is the read API.

29. DID mismatch

There are currently two DID conventions.

Real gateway:
did:bfa:client-0
did:bfa:client-1
...
Old dashboard replay data:
did:example:client-3

This was caused by the mock dashboard being created before the gateway standardized the DID format.

Correct future action

Change the mock data to:

did:bfa:client-{i}

Do not change the gateway's existing registered DIDs.

30. Gateway still has residual global state

fl-orchestrator/server/round_manager.py still contains module-level mutable defaults:

_previous_checkpoint
_default_registry
_default_store
_default_monitor

The gateway works around these by passing some state explicitly from GatewaySession.

But the underlying function still contains the old architecture.

Fully fixing this would require changing the run_round() contract so it accepts the store/monitor and returns the checkpoint appropriately.

This is technical debt, not an immediate architectural blocker.

31. Double checkpoint-store issue

There are currently effectively two checkpoint-store concepts:

run_round()
    ↓
internal _default_store

GatewaySession
    ↓
its own LocalCheckpointStore

They represent the same logical checkpoint system.

This exists because the original run_round() doesn't accept a checkpoint store parameter.

It's another residue from the earlier architecture.

32. Drift monitor isn't fully wired

Similarly:

GatewaySession
    ↓
owns DriftMonitor

but:

run_round()
    ↓
uses its own internal monitor

because the existing run_round() doesn't accept a monitor parameter.

This needs eventual cleanup if the gateway is going to expose the actual drift state directly.

33. Gateway round summaries are incomplete

run_round() returns a summary containing things like:

round
n_passed
n_failed
drift_triggered
...

but not:

per-client verdicts
Checkpoint object
full SuspicionScore list

Therefore some gateway logic currently has to infer things.

For example, dispute attribution is effectively:

8 clients
7 passed
1 failed
      ↓
the failed client is assumed to be the armed client

This is currently acceptable for the controlled demo scenario but is not a robust general attribution mechanism.

34. Artificial dashboard pacing

The gateway deliberately sleeps:

0.4 seconds per pipeline stage

so the dashboard can visually show:

training
→ embedding
→ authentication
→ aggregation
→ checkpointing
→ drift

The actual vision model's training latency is supposed to replace this eventually.

Current round execution is around:

~2.7 seconds/round

and most of that is artificial sleep rather than real computation.

This means do not use current round latency as a performance result.

35. Current economic parameters are placeholders

The gateway currently uses:

Initial stake = 1 ETH
Challenge window = 60 seconds
Slash = 10%

These are policy stubs, not experimentally justified values.

The challenge window is shortened to 2 seconds in tests.

36. Identity infrastructure is also placeholder-level

Current public keys look like:

placeholder-pubkey-client-0
placeholder-pubkey-client-1
...

There is no actual keypair infrastructure yet.

And the provenance layer currently passes signatures through without cryptographic verification.

So:

DID
+
signature

is currently an identity representation, not a cryptographically enforced identity system.

37. Passport limitations

Passport.sol does not expose:

getAllEvents()

It exposes device-specific retrieval.

So:

GET /passport/all

currently works by:

known_device_ids
    ↓
getEventsForDevice(device)
    ↓
merge results

The device IDs are tracked by the gateway session.

Also:

Passport entries don't have a round number.

Therefore you cannot reliably ask:

"show me passport events from round 12"

because there is no round association.

38. The biggest rollback limitation right now

This is probably the most important technical limitation in the entire project.

The drift detector requires:

mean suspicion
+
negative accuracy trend

But:

reference_set_accuracy_delta

is not actually wired into rounds.

Instead the FL orchestrator uses:

_PLACEHOLDER_ACCURACY = 0.9

for every round.

Therefore:

accuracy trend = 0

and the real drift condition:

mean suspicion > threshold
AND
accuracy trend < 0

cannot naturally trigger.

39. So the dashboard's drift event is synthetic

The dashboards inject:

DriftEvent
round = 17
window = 13–17
rollback target = round 11

for demonstration.

It is explicitly labelled:

synthetic (demo)

It is not evidence that the actual drift detector has successfully detected poisoning on the current mock model.

This distinction absolutely needs to survive into your final report/presentation.

40. Current dashboard architecture

The dashboards are now partially live.

Actually live
currentRound
currentStage
isPlaying
play()
pause()
step()
client DIDs
transactions
passport entries

These come from the gateway.

Still replayed

Client:

suspicionHistory
checkpoints
stakeEvents
passportEntries with round labels
fleet scores
images examined
anomalies detected

Server:

suspicionScores
checkpoints
stakeEvents
disputes

These are deterministic mock/replay data indexed using the live round counter.

41. This creates an important dashboard mental model

The dashboard is currently:

                  LIVE
                   │
            current round
                   │
             current stage
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
   LIVE gateway         MOCK REPLAY
   state                 historical detail
        │                     │
        └──────────┬──────────┘
                   ▼
              Dashboard

So a visually convincing chart does not necessarily mean its underlying historical data came from the live backend.

The project deliberately documents this rather than hiding it.

42. Dashboard reset does not really reset the system

reset() is intentionally a no-op.

It prints:

"reset() has no effect against live gateway data — restart the gateway process to reset"

This is correct behavior because pretending to reset blockchain/session state from the frontend would be misleading.

43. The two dashboards are separate applications

Client and server dashboards are not a shared React application.

Each has:

package.json
node_modules
build

and they don't import components from each other.

Some small shared concepts are intentionally duplicated.

This is deliberate architectural isolation.

44. Attribution is currently on hold

The attribution-service is not part of the active implementation path right now.

The dashboard represents it using a disabled/placeholder component.

This should not be confused with the research design: attribution remains a planned supporting component, but its implementation has been deferred.

45. Vision model is a separate track

The real vision model is also not part of the current integrated system.

Current system uses:

MockModelAdapter
seeded RNG
mock embeddings
mock weights
mock image/anomaly counts

The intended replacement point is:

shared/interfaces/model_adapter.py

So the architecture was deliberately built to allow the real model to be dropped in without redesigning the rest of the system.

46. Infrastructure is also incomplete

There is an infra/ concept/stub.

A docker-compose.yml is mentioned by the root README, but the actual infrastructure stack is not built.

So don't assume:

Docker
multi-service deployment
production networking

already exists.

47. Current assumptions

The system currently assumes:

Client population

Approximately:

5–15 organizations

with the demo using:

8 clients

rather than FedEDAuth's 50-client setup.

Golden reference

Trusted neutral third party.

Blockchain

Ethereum-style prototype.

Dataset

Either:

IDA/ICME 2026

if access is confirmed, or:

MIIC

with the small-anomaly limitation.

Rollback

Rollback only controls the system's own deployed global model.

It cannot magically modify copies of a poisoned model that have already left the system.

48. What would break when real data arrives

There are several explicit assumptions that must be recalibrated.

Non-IID distribution

Current:

seed-based synthetic heterogeneity

Future:

actual defect-category distributions

This may substantially widen the honest suspicion-score distribution.

Therefore the current:

9.9817

threshold cannot simply be retained.

It must be recalibrated.

Authentication threshold

The current:

mean + 3σ

rule has only been tested on the mock embedding geometry.

Real embeddings may have completely different distributions.

Blockchain performance

Current gas/latency numbers are prototype/testnet numbers.

They should not be presented as production blockchain performance.

Rollback evaluation

The central claim has not yet been properly benchmarked against:

plain FedAvg
FedAvg + authentication
FedAvg + full-history recovery

Those experiments still need to happen.

49. The evaluation plan

The project is supposed to measure several different things.

Vision model
precision
recall
F1
AUC-ROC
per-defect-category performance
Authentication
false-positive rate
false-negative rate
clean vs poisoned score separation
Rollback
detection latency
post-rollback recovery accuracy
storage overhead
communication overhead

compared against:

naive full checkpointing
Crab-style selective history
Attribution
precision
recall
compute cost

compared against a full Shapley baseline.

Blockchain
transaction latency
throughput
on-chain storage cost
gas/bytes per round
false-slash rate

50. Required experimental baselines

The intended baseline set is:

1. Centralized training
2. Local-only training
3. Plain FedAvg
4. FedAvg + per-round FedEDAuth-style authentication
5. FedAvg + authentication + full-history recovery
6. BlockFedEDAuth-R

The purpose is to isolate the value of:

authentication
        vs.
multi-round drift detection
        vs.
rollback strategy

rather than simply comparing the final system against nothing.

51. Recommended scope

This is extremely important for future development.

The project report explicitly recommends:

Deeply research/evaluate
Drift-triggered rollback
+
Windowed culprit attribution
Build as supporting infrastructure
Vision model
FedAvg
one-class authentication
basic blockchain
gateway
provenance

but don't attempt to conduct a full research study on every single one of those components.

The report explicitly warns that trying to rigorously research all seven areas would produce a shallow system with too many underdeveloped components.

52. The actual current project state

Putting all of this together with the previous MD files, the current state is approximately:

                    BlockFedEDAuth-R
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   BACKEND CORE        BLOCKCHAIN         DASHBOARDS
        │                  │                  │
        │                  │                  │
   ┌────┴────┐        ┌────┴────┐       ┌────┴────┐
   │ Auth    │        │ DID     │       │ Client  │
   │ FedAvg  │        │ Stake   │       │ Server  │
   │ CP      │        │ Dispute │       │         │
   │ Drift   │        │ Passport│       │         │
   │ Rollback│        │ Anchor  │       │         │
   └─────────┘        └─────────┘       └─────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                       GATEWAY
                           │
                    partially live
                           │
              ┌────────────┴────────────┐
              │                         │
        REAL/LIVE DATA             MOCK/REPLAY
              │                         │
        round control             historical scores
        clients                   checkpoint charts
        transactions              stake history
        passport                  disputes
                                  image counts
                                  suspicion history
53. What is genuinely working right now

According to these files, you can reasonably treat the following as implemented infrastructure:

Backend
Mock model abstraction
Golden reference construction
Embedding suspicion calculations
calibrated authentication threshold
client simulation
FedAvg
multi-round execution
checkpoint creation
SHA/Merkle-style checkpoint hashing
off-chain checkpoint storage
checkpoint integrity verification
checkpoint registry
drift-monitor framework
rollback executor
Hardhat blockchain integration
checkpoint anchoring
DID registry
staking
dispute contract
Passport contract
provenance API
gateway
autonomous round control
Frontend
client dashboard
server dashboard
live gateway polling
live round/stage control
blockchain transaction display
passport display
mock historical visualizations
pipeline visualization
suspicion visualization
staking visualization
dispute visualization
server system map
teacher/presentation mode

But some of those are only partially live, especially historical dashboard data.

54. What is definitely NOT yet a completed research system

These should not be represented as finished:

Real semiconductor anomaly model
Real semiconductor dataset integration
Real non-IID defect-category partitioning
One-class authentication adaptation validated on real data
Real reference-set accuracy monitoring
Empirically calibrated drift threshold
Real drift-triggered rollback experiment
Delta checkpointing
Checkpoint pruning
Windowed culprit attribution
Real DID/keypair infrastructure
Cryptographic DID signature verification
Empirically justified staking economics
Fully live dispute reader
Fully live stake history
Fully live checkpoint history
Fully live suspicion history
Production blockchain deployment
Production infrastructure/Docker

The issues document explicitly tracks these rather than hiding them.

55. The immediate missing gateway work

The already-scoped next gateway work is:

GET /rounds/{round}/scores
GET /clients/{did}/stake-history
GET /disputes

and potentially:

GET /checkpoints

The scores must be captured during step_round(), because once run_round() returns, the individual scores are otherwise lost.

Then the dashboards should stop replaying those specific datasets and use the live endpoints.

56. The immediate ML work

If the goal is to move the project from "architecture/demo" to "research system", the most consequential next transition is:

MockModelAdapter
       ↓
REAL VISION MODEL

That will force several things to change simultaneously:

real images
    ↓
real embeddings
    ↓
real anomaly scores
    ↓
real local training
    ↓
real client sample counts
    ↓
real non-IID partition
    ↓
real reference-set metrics
    ↓
real drift detection
    ↓
real rollback evaluation

This is why the current architecture deliberately uses ModelAdapter as the swap boundary.

57. The most important warning for your future build

There are three different states in this project, and you should not accidentally collapse them into one.

State 1 — Implemented infrastructure

Example:

CheckpointAnchor
FedAvg
rollback executor
gateway
Passport
dashboard

These exist.

State 2 — Implemented but synthetic

Example:

MockModelAdapter
seed-based non-IID
calibrated threshold
dashboard historical scores
synthetic DriftEvent @ round 17
artificial pipeline timing
placeholder image counts

These work mechanically but do not constitute experimental evidence.

State 3 — Designed but not implemented/validated

Example:

real vision model
one-class authentication adaptation
real reference accuracy
delta checkpoints
culprit attribution
real DID signatures
real stake economics
research evaluation

These are future work.

The Issues document was specifically created to preserve this distinction.

58. Final consolidated mental model

If you are about to continue coding this project, I would keep this model in your head:

                         REAL RESEARCH TARGET
                                │
                                ▼
                 ┌────────────────────────────┐
                 │ Semiconductor defect model │
                 │     + real non-IID data    │
                 └──────────────┬─────────────┘
                                │
                         local training
                                │
                                ▼
                             FedAvg
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
             Per-round auth          Global monitoring
                    │                       │
                    │                  sliding window
                    │                       │
                    │                       ▼
                    │                 drift detected
                    │                       │
                    │                       ▼
                    │                  ROLLBACK
                    │                       │
                    │                       ▼
                    │                known-good model
                    │                       │
                    └───────────┬───────────┘
                                │
                                ▼
                    windowed culprit attribution
                                │
                                ▼
                         blockchain layer
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
                  stake      dispute     checkpoint
                    │           │           │
                    └───────────┼───────────┘
                                ▼
                           provenance
                                │
                                ▼
                            dashboards

And the research claim sitting in the middle is:

Can cross-round changes in FedEDAuth-style client-authentication statistics detect poisoning-induced global degradation that individual-round authentication misses, and can the same detected window be reused to cheaply identify the likely culprit and roll the model back to the last known-good checkpoint?

That is the thread that ties the dataset choice, one-class authentication adaptation, FedAvg, drift monitoring, checkpointing, rollback, and attribution together. The blockchain is supporting infrastructure for trust/accountability—not the primary research novelty.

And one final practical point: the current repository is already at the stage where adding more UI/mock features is much less important than replacing the mock ML path with the real vision/data path and wiring real historical telemetry into the gateway. The existing issues explicitly identify the missing score/dispute/stake/checkpoint read APIs and the unwired reference accuracy as the major integration gaps.