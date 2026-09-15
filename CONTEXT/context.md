BlockFedEDAuth-R
Drift-Triggered, Blockchain-Anchored Rollback for Federated Anomaly Detection in
Semiconductor Defect Inspection
A Final-Year Project Report: System Design, Related Work, Open Decisions, and Research Directions
Prepared as a working project specification and literature-grounded design document, compiled from an extended
design discussion.
How to read this document. This report consolidates a design discussion into a structured specification. Every
major design choice is presented as an explicit decision point with options and trade-offs rather than a single
prescribed answer, because several choices are still open. Sections 6 and 9 are the most important for
planning: Section 6 lays out the specific research directions available at each layer of the system, and Section 9
is an unvarnished assessment of scope, novelty, and feasibility for a single-student final-year timeline.
BlockFedEDAuth-R Project Report
Page 11. Executive Summary
The starting point for this project is a recent paper, FedEDAuth: Federated Embedding Distribution
Authentication for Counterfeit IC Detection (Lodge et al., 2026), which filters malicious clients out of a federated
learning (FL) pipeline for counterfeit integrated-circuit detection, before their poisoned updates can be
aggregated into the global model. The original evaluation used 64× 64 pixel package-level photographs and a
supervised authentic-vs-counterfeit classifier.
Over the course of this design discussion, the project direction shifted in three material ways, each of which is
carried through this report:
• Vision task: moved away from package/label classification (assessed as a comparatively shallow vision
problem for a research-grade project) toward semiconductor surface defect anomaly detection on
higher-resolution microscopy imagery — a harder, more defensible, and more data-rich problem.
• Central research contribution: rather than re-implementing FedEDAuth's authentication math as the
novelty, the project's core evaluated claim is now a cross-round, drift-triggered rollback mechanism:
detecting when the global model has quietly degraded over several rounds (not just within one round) and
reverting to a prior good checkpoint, anchored via blockchain-recorded hashes rather than on-chain weights.
• Blockchain's role was re-scoped away from being a decorative audit log toward a small number of places
where it is argued to add real value: decentralizing trust away from a single authentication server,
staking/slashing as an economic deterrent, dispute resolution for false positives, and a device-provenance
passport layer downstream of the FL system.
This report is organized so that each layer of the system — dataset/vision, FL aggregation, authentication,
rollback/versioning, culprit attribution, and blockchain — is discussed with its relevant prior work, the decision(s)
still open, and the specific research question that could be tackled there. Section 9 gives a candid assessment
of which of these are realistic to pursue in depth within a single final-year project, and recommends a scoped
minimum viable system.
2. Problem Statement and Motivation
Counterfeit and defective components entering the semiconductor supply chain are a persistent, costly, and
safety-relevant problem. Federated learning is attractive for supply-chain-wide defect/counterfeit detection
because it lets mutually distrustful organizations (fabs, distributors, assembly houses) jointly improve a shared
detection model without pooling proprietary imagery. However, FL's open participation model creates an attack
surface: a single compromised or careless participant can inject poisoned updates that degrade the shared
model, and this can happen slowly and subtly enough to evade single-round detection.
Two compounding weaknesses motivate this project specifically:
• Existing per-round defenses (FedAvg, trimmed mean, Krum, and FedEDAuth's own embedding-based
authentication) evaluate each client's contribution largely in isolation, round by round. None of them are
designed to catch a slow, low-intensity drift that stays under each round's detection threshold but
accumulates into real damage — a failure mode the FedEDAuth paper itself observed at its lowest tested
poisoning intensity (50%), where one poisoned client began to overlap with the clean cluster.
BlockFedEDAuth-R Project Report
Page 2• Once a poisoned update is aggregated, there is no way to 'undo' it from the model's weights directly. The
only recourse is recovery: rolling back to, or reconstructing, a known-good prior state. This is a distinct
research problem from detection, and is comparatively less mature in the literature when combined with a
decentralized, multi-organization trust setting.
The project therefore targets the intersection of three research threads that individually exist in the literature but
are not, to the depth searched for this report, combined the way this project proposes: (i)
embedding-distribution-based client authentication, (ii) checkpoint-based poisoning recovery, and (iii)
blockchain-anchored accountability for federated learning.
3. Related Work
3.1 Federated learning for hardware/IC security
FedEDAuth (Lodge et al., 2026) and its predecessor byzantine-poisoning study (Lodge, Tambe, Aklekar &
Saqib, IEEE PAINE 2025) establish that federated learning can reach over 94% accuracy on counterfeit IC
classification while remaining vulnerable to a stealthy scratch-trigger poisoning attack that evades FedAvg,
trimmed-mean, and Krum aggregation. FedEDAuth's fix is a separate authentication server that scores each
client's embedding distribution (from a fixed, shared Vision Transformer) against a golden reference using
outlier fraction, class mean shift, and a micro-cluster score, filtering suspicious clients before aggregation. The
paper explicitly names its own centralization of this authentication server as an open weakness.
3.2 Sequential vs. parallel federated learning
FedAvg (McMahan et al., 2017) is the standard parallel aggregation scheme: clients train independently and
simultaneously on a shared model snapshot, and the server averages their resulting weights. An alternative,
sequential family exists — Cyclic Weight Transfer (Chang et al., 2018) and related serial FL methods — where
a single model is passed from client to client, each training on top of the last. The literature is consistent that
serial/sequential methods are more compute-efficient per round but are meaningfully more prone to
catastrophic forgetting and are sensitive to client visit order, especially under non-IID data (Cyclical Weight
Consolidation, 2024; Sharp Bounds for Sequential Federated Learning on Heterogeneous Data, 2025). This
project currently targets FedAvg as the aggregation scheme (see Section 5.2), with sequential/CWT-style
training noted as a possible future direction rather than the current design.
3.3 Recovering / rolling back federated models after poisoning
This is the most directly relevant prior-art cluster to the project's proposed central contribution:
• FedRecover (Cao, Jia, Zhang & Gong, IEEE S&P; 2023) was among the first to formalize recovering an
accurate global model after malicious clients are identified, using the server's stored historical update
information rather than retraining from scratch.
• Crab (“Towards Efficient and Certified Recovery from Poisoning Attacks in Federated Learning”, 2024)
improves on this with selective historical information and adaptive rollback to a historical model that was not
significantly affected by malicious clients (rather than the original model), with a theoretical bound on how far
the recovered model differs from a full retrain.
BlockFedEDAuth-R Project Report
Page 3• PDLRecover (2025) extends recovery to a decentralized, privacy-preserving setting using machine
unlearning, and FAUN (“Adversarial Update-Based Federated Unlearning for Poisoned Model Recovery”,
2026) proposes a lightweight adversarial-optimization approach that needs only a short window of malicious
updates rather than full history.
• DP-RTFL (Talluri, 2025) introduces a “Temporal Checkpoint Manifold” — a distributed, chronologically
ordered log of global model states enabling precise rollback — paired with lightweight hash-based integrity
commitments rather than full zero-knowledge proofs.
• Leash-FL (“Lightweight ECC-Based Self-Healing Federated Learning Framework for Secure IIoT Networks”,
Sensors, 2025) is the closest published system to this project's proposal: it combines lightweight client
authentication with blockchain-backed checkpoint rollback, reporting over 85% accuracy retained with
50% malicious clients and recovery up to 3× faster than anomaly-screening-only baselines.
Implication: blockchain-anchored FL checkpoint rollback is not a novel idea in isolation — Leash-FL already
published it, with strong results. Any submission built around this must explicitly differentiate itself (Section 6.2
proposes where that differentiation can come from) rather than presenting rollback itself as the contribution.
3.4 Blockchain for FL accountability
BlockFLA (Desai, Ozdayi & Kantarcioglu, ACM CODASPY 2021) is the closest prior art to the project's
blockchain-authentication idea: a hybrid blockchain architecture (combining public/Ethereum-style and
private/Hyperledger-style components) in which smart contracts automatically detect and punish attackers via
monetary penalties, evaluated with both FedAvg and SignSGD aggregation. Reviewers/participants can report
a suspected malicious model, triggering a penalty smart contract that excludes it from aggregation and holds its
submitter accountable. A 2022 survey (Lo et al.) describes a related trustworthy FL framework focused on
accountability and equitable reward distribution. Implication: the “blockchain punishes bad actors” component
of this project's design is also not new; BlockFLA must be cited and differentiated from directly.
3.5 Datasets
Two dataset families were evaluated for the vision task and are compared in Section 5.1: the MIIC dataset
(Huang et al., ICIP 2021, NTU) — 512×512 grayscale SEM images of the wire-bond/metal layer, only 116
anomalous of 25,276 total — and the newly released IDA/ICME 2026 Grand Challenge dataset
(arXiv:2607.04675, 2026), which is substantially larger and richer.
4. Proposed System Overview
The system, provisionally named BlockFedEDAuth-R (the ‘-R’ for its rollback focus), has six layers. Each is
expanded with its own decision points in Section 5.
#LayerRoleStatus
1Vision / anomaly
modelDetects surface defects from microscopy images on
each client's local data.Open — dataset TBD (5.1)
2FL aggregationCombines client updates into a shared global model.Decided: FedAvg (5.2)
3Client authenticationScreens client embeddings for statistical poisoning signs
before their update is trusted.Open — needs one-class
adaptation (5.3)
4Rollback & versioningDetects multi-round drift in the global model and reverts
to a prior good checkpoint.Core contribution (5.4)
BlockFedEDAuth-R Project Report
Page 4#LayerRoleStatus
5Culprit attributionIdentifies which client(s) most likely caused a detected
drift.Supporting, scoped down (5.5)
6Blockchain layerDecentralizes trust, anchors checkpoint hashes, handles
staking/slashing, disputes, and provenance.Open — platform TBD (5.6)
Data flow, in brief: each client trains locally on its private defect imagery (Layer 1) and participates in FedAvg
rounds (Layer 2). Before each round's update is trusted, its embeddings are screened (Layer 3). Independently
of per-round screening, the global model's own behavior on a held-out reference set is tracked across a sliding
window of rounds (Layer 4); when it drifts beyond a threshold, the system rolls back to the last checkpoint
before the drift began, and a lightweight windowed check (Layer 5) narrows down which recent client(s) most
likely caused it. All checkpoint hashes, authentication decisions, rollback events, and (if pursued)
staking/slashing actions are recorded through the blockchain layer (Layer 6), which never stores model weights
directly.
5. Component-by-Component Design and Decision Points
5.1 Vision task and dataset
Decision made: the vision task is semiconductor surface/microscopy defect detection, not package-label
counterfeit classification. This is a harder, one-class-leaning problem (defects are rare relative to normal
samples) rather than a roughly-balanced binary classification problem, which changes the client-side model
family from a classifier (e.g. ResNet-18) toward reconstruction-based or embedding-distance-based anomaly
detectors (autoencoders, normalizing flows, or distance-to-reference scoring similar to what FedEDAuth already
uses for authentication, but now applied to the task itself).
Dataset options
DatasetModality / sizeAnomaliesFit for this project
MIIC (Huang et al.,
ICIP 2021, NTU)512×512 grayscale SEM,
wire-bond/metal layer,
25,276 images total116 anomalous —
extremely imbalancedConfirmed public and directly
matches the anomaly-detection
framing, but very few positive
examples limits how much can be
learned or evaluated per simulated
client; splitting 116 anomalies across
several non-IID clients leaves very
little signal per client.
IDA / ICME 2026
Grand Challenge
(arXiv:2607.04675,
2026)High-resolution
wafer-surface microscopy, 7
defect categories (scratch,
dent, particle, damage,
stain, bubble, chipping),
pixel-level instance masksTrack 1: 1,173
anomalous in training
(2,543 instances) + 1,834
anomalous in test (1,921
instances) — roughly 10×
more anomalous images
than MIICMuch richer: multiple defect
categories (useful for simulating
different clients seeing different
defect distributions — natural
non-IID), severity grading as a
bonus task, and deliberately
multi-scenario construction. Public
download access for the full dataset
was not confirmed at time of writing
and should be verified directly with
the challenge organizers before
committing to it.
BlockFedEDAuth-R Project Report
Page 5DatasetModality / sizeAnomaliesFit for this project
MVTec-AD /
ZJU-Leaper (general
industrial anomaly
benchmarks)Varies; widely used in
anomaly-detection literatureSmall per category,
similar imbalance profile
to MIICUseful as an additional
cross-domain baseline or for
prototyping the anomaly-detection
pipeline before committing to a
semiconductor-specific dataset, but
not semiconductor-specific.
WM-811K /
Mixtype-WM38 (wafer
bin/defect maps)811K+ categorical wafer bin
maps (pattern shapes
across a wafer), not
photographicLarge and well-balanced
across pattern classesDifferent modality entirely (structured
pattern maps, not microscopy
photos) — useful only if the project
pivots to wafer-map pattern
classification rather than
surface-image defect detection.
Open decision: confirm public access to the IDA/ICME 2026 dataset; if unavailable, fall back to MIIC with an
explicit, stated limitation about anomaly count, or combine MIIC with synthetic augmentation (similar to how the
FedEDAuth paper synthetically produced its counterfeit indicators) to increase usable positive samples per
simulated client.
5.2 Federated learning aggregation
Decision made: FedAvg (parallel aggregation), not Cyclic Weight Transfer, as the core scheme, pending any
concrete evidence found during the project that CWT outperforms FedAvg for this specific task and data
distribution. This avoids CWT's documented catastrophic-forgetting and order-sensitivity risk under non-IID
data, at the cost of losing CWT's “one clean checkpoint per client” property — meaning checkpointing (Section
5.4) will be per-round rather than per-client, and culprit attribution (Section 5.5) cannot rely on the model literally
being that client's exact output.
Because real fab data is close to non-IID by construction (different clients naturally seeing different defect
category distributions), plain FedAvg's known weakness under heterogeneous data is directly relevant here.
Established mitigations worth evaluating as part of the FedAvg baseline, not as the paper's core contribution,
include FedProx (proximal-term regularization to limit client drift) and server-side momentum variants
(FedAvgM). These are candidate research-direction items in Section 6.1.
5.3 Client authentication (adapted FedEDAuth)
FedEDAuth's suspicion-score math (outlier fraction via Mahalanobis distance, class mean shift, micro-cluster
score) was built around a labeled, multi-class golden reference. In a one-class anomaly-detection setting, there
typically is no clean, separate “counterfeit” class to compute a reference distribution against — only a “normal”
class and rare, diverse anomalies. Adapting this is itself a concrete piece of work: candidate approaches
include computing the reference distribution only over the normal class and treating anomaly-embedding
statistics separately, or reframing outlier/shift/cluster metrics relative to the client's own reconstruction-error
distribution rather than a classification embedding.
Open decision: whether this adaptation is developed as its own evaluated sub-contribution or implemented at
“working, not deeply benchmarked” depth, per the scope discussion in Section 9.
5.4 Rollback and versioning — core contribution
What triggers a rollback
BlockFedEDAuth-R Project Report
Page 6Rather than only asking “is this client suspicious this round” (FedEDAuth's scope), the global model's own
performance/embedding behavior on the golden reference set is tracked across a sliding window of rounds. A
sustained drift in outlier fraction, mean shift, or reconstruction error over that window — even if no single round
crossed the per-round threshold — triggers a rollback to the last checkpoint recorded before the drift began.
This is designed specifically to catch the low-intensity poisoning case the FedEDAuth paper itself found could
evade per-round detection at high poisoning density.
How checkpoints are stored efficiently
• Never store full weights on-chain. On-chain storage cost scales with bytes written and is priced punitively;
a full model checkpoint (tens of MB) is not merely expensive but categorically infeasible on-chain on any
general-purpose chain.
• Store only a hash + round number + metrics per round on-chain (a fixed, small cost regardless of model
size). This is the pattern used uniformly across the rollback/recovery literature reviewed in Section 3.3
(DP-RTFL, Leash-FL).
• Store the actual weights off-chain (IPFS, or another content-addressed / conventional store).
Content-addressing gives tamper-evidence for free: the retrieval hash is recomputed and compared against
the on-chain record, so integrity does not require also storing the payload on-chain.
• Reduce storage cost further with delta/differential checkpointing — store only what changed relative to
the previous checkpoint rather than a full snapshot every round, materializing full snapshots only periodically
as recovery anchors.
• Structure each checkpoint as a Merkle tree over layers/parameter groups rather than one flat hash, so
that verification, delta computation, and (potentially) partial/layer-level rollback can operate on just the
affected branch rather than the whole model.
• Prune on a sliding window. Once a checkpoint is fully superseded and no longer a plausible rollback
target, discard its full off-chain payload and keep only its on-chain hash as a historical record.
Evaluation questions for this component
• Does drift-triggered (multi-round) rollback recover accuracy after a low-intensity attack that per-round-only
filtering misses, and how much faster/cheaper is this than retraining from scratch or than full-history recovery
methods (FedRecover-style)?
• How does detection latency (rounds elapsed before rollback triggers) trade off against the drift threshold's
false-positive rate on benign, naturally-noisy non-IID clients?
• What is the storage/communication overhead of the hash-chain + delta-checkpoint scheme relative to naive
full-checkpoint-every-round and relative to Crab's selective-history approach?
5.5 Culprit attribution — scoped down, supporting role
Full Shapley-value-based contribution attribution (a well-studied but expensive and, per a 2025 stability study
found during this project's literature search, somewhat volatile technique) is not recommended as a project
focus — it is its own deep research area and running it continuously across all training history is unnecessary
for this project's goals. Instead, attribution is scoped to only the small window of rounds flagged by a rollback
trigger (Section 5.4): a cheap, distance-based similarity score (how closely a client's submitted update direction
matches the direction the global model drifted in) is computed only for clients active in that window. This directly
reuses the rollback trigger to make an otherwise-expensive problem cheap, and is one of the more genuinely
distinguishing design choices available to this project (see Section 6.3).
5.6 Blockchain layer
BlockFedEDAuth-R Project Report
Page 7Where blockchain is argued to add real value (and where it does not)
Based on the design discussion, blockchain does not meaningfully strengthen the FL math itself — a rejected
or accepted client contributes (or doesn't) the same amount to the model whether the decision is logged in a
normal database or an immutable ledger. Its genuine value in this system is scoped to four specific jobs:
MechanismWhat it actually doesWould a normal database suffice
instead?
Decentralized
authentication trustRemoves the need for any single participating
company to host (and be implicitly trusted to
operate honestly) the authentication server, via
multiple independent validators agreeing before a
client is accepted or rejected.No — this is the one place a single
trusted-server database cannot substitute,
because the whole point is removing that
single trusted party among mutually
distrustful competitors.
Staking / slashingEconomic deterrent: participants post collateral that
is forfeited on confirmed malicious behavior, shifting
the attacker's cost-benefit calculation before an
attack, not after.Partially — the economic mechanism itself
needs a settlement layer with real value at
stake; a plain database cannot enforce
forfeiture without a trusted operator.
Dispute resolution /
non-repudiationSigned, multi-party-witnessed record lets competing
organizations resolve blame (e.g., whose update
caused a rollback) without relying on one side's
internal logs.No — the value here is specifically that no
single party's database is treated as ground
truth.
Device / component
provenance
passportTracks a verified chip's status across foundry →
distributor → integrator → end customer, a genuine
multi-party, no-single-authority provenance
problem.No — this is blockchain's best-established
real-world use case and the strongest
natural fit in this whole architecture.
Plain audit logging
of every roundRecording routine, non-disputed events with no
economic or multi-party trust stakes.Yes — this is the “namesake blockchain”
trap; a signed, append-only log in a normal
database achieves the same practical
outcome with far less overhead.
Handling false positives on an append-only ledger
Since
entries
cannot
be
deleted,
mistaken
rejections/slashes
are
handled
with
a
provisional-flag-plus-challenge-window pattern (analogous to optimistic-rollup dispute periods): a failed
authentication produces a provisional flag, not an instant final slash; a challenge window allows the flagged
client or other validators to dispute it; only an unchallenged or upheld flag finalizes. The original flag is never
erased — a later “overturned” transaction is appended alongside it, so the ledger's current state reflects the
correction without rewriting history.
Platform choice: public/Ethereum-style vs. permissioned/Hyperledger-style
DimensionPublic / Ethereum-style (testnet)Permissioned / Hyperledger-style
Who can join /
validateOpen (or open-ish on testnet); anyone can run a
node.Closed consortium — only approved
organizations (fabs, distributors) run nodes;
matches this project's actual multi-company
scenario more directly.
Cost modelReal (or testnet-simulated) gas fees per
transaction; storage and computation are priced
to discourage bloat — relevant context for
justifying the hash-only, off-chain-weights
design.No public gas market; costs are the consortium's
own infrastructure, so per-transaction economics
are not a natural fit for demonstrating “why not
store weights on-chain” unless deliberately
modeled.
BlockFedEDAuth-R Project Report
Page 8DimensionPublic / Ethereum-style (testnet)Permissioned / Hyperledger-style
Staking / slashing
token economicsNative to the ecosystem — ERC-20 style stake
tokens and slashing are well-trodden patterns
with existing tooling and prior academic
examples (BlockFLA itself used a hybrid
public/private architecture).Requires bespoke design — permissioned
chains do not have a default token economy, so
staking would need custom implementation (e.g.,
a consortium-issued token or off-chain escrow
with on-chain attestation).
Throughput /
latencyPublic testnets are slower and less predictable.Generally faster and more predictable for a small,
known validator set — Leash-FL specifically
reports its permissioned-style layer
outperforming Ethereum-based systems on
latency/throughput.
Fit for a student
project timelineLarge existing tooling ecosystem (Solidity,
Hardhat/Truffle, public testnets like Sepolia)
makes a working prototype faster to stand up.More realistic to the actual multi-company
scenario, but more implementation overhead
(Fabric chaincode, network setup) for a
solo/small-team timeline.
Recommendation for a first working prototype: build on a public Ethereum-style testnet for speed of
development and tooling maturity, explicitly note in the report that a permissioned architecture (as BlockFLA
itself uses in hybrid form, and as Leash-FL argues performs better) would be the production-appropriate choice
for real rival semiconductor companies, and treat that migration as future work rather than something that
needs to be built now.
BlockFedEDAuth-R Project Report
Page 96. Research Directions, Mapped to Each Open Question
This section answers directly: at which specific points can this project bring a genuine improvement over
existing work, organized by the four areas raised during the design discussion.
6.1 Improvements in analyzing / adapting FedAvg
• Quantify how FedAvg's known non-IID sensitivity specifically interacts with the drift-detection signal used for
rollback — does heterogeneity across clients widen the 'normal drift' band enough to hide real
poisoning-induced drift, or make benign clients look falsely suspicious? This is a concrete, testable question
the reviewed literature does not appear to answer directly.
• Evaluate whether a lightweight non-IID mitigation (FedProx-style proximal regularization) changes the
drift-detector's false-positive rate, as an ablation rather than a headline contribution.
• Compare plain FedAvg against FedAvg with the adapted one-class FedEDAuth authentication layer (Section
5.3) as a baseline table, to establish how much the authentication layer alone buys before rollback is even
introduced.
6.2 Improvements in how rollback occurs (the project's proposed core claim)
• Multi-round drift detection as the rollback trigger, versus the existing literature's approach of triggering
recovery only after a client has already been identified as malicious by a separate detector (FedRecover,
Crab) — this project's angle is to use the authentication layer's own statistics, tracked over time, as the
trigger itself, rather than treating detection and recovery as fully separate stages.
• Direct empirical comparison against Crab's selective-history approach and Leash-FL's similarity-governed
screening: does window-based drift triggering recover faster, cheaper, or more accurately under the specific
low-intensity poisoning regime the base FedEDAuth paper flagged as its own weak spot?
• Explicit differentiation from Leash-FL required: Leash-FL already does blockchain-backed checkpoint
rollback with ECC-based lightweight authentication. This project's differentiator, if pursued, is the
drift-over-a-window trigger condition tied specifically to the FedEDAuth-style suspicion metrics, applied to a
one-class anomaly-detection task rather than Leash-FL's intrusion-detection/IIoT setting.
6.3 Improvements in identifying the culprit client
• Rather than general-purpose Shapley-value attribution (expensive, and shown to be volatile in recent work),
scope attribution to only the rounds inside a triggered rollback window, using a cheap
similarity-to-drift-direction score. Evaluating whether this windowed, cheap approach identifies the correct
culprit as reliably as full Shapley-based methods, at a fraction of the compute, is a concrete, testable
research question that appears open in the literature reviewed here.
• If time allows, compare against a lightweight Shapley approximation (e.g. Monte Carlo sampling) computed
only within the same restricted window, to isolate whether the benefit comes from the windowing itself or
from abandoning Shapley altogether.
6.4 Where blockchain logging is genuinely significant (not namesake)
• Decentralized authentication consensus: replacing FedEDAuth's single trusted authentication server with
a small multi-validator scheme (e.g., a threshold of independent validators must agree on a client's suspicion
score before it is accepted or rejected) is a concrete systems contribution not present in the base paper, and
is a more defensible use of blockchain than logging alone.
BlockFedEDAuth-R Project Report
Page 10• Staking/slashing as an economic ablation: measure whether adding real (or simulated) economic stakes
changes the induced pool of participating clients' behavior in a testbed — this is closer to a
mechanism-design/game-theoretic evaluation than a pure systems one, and BlockFLA already provides a
template for the empirical methodology.
• Dispute-window false-positive handling: quantify how large a challenge window is needed to keep the
false-slash rate acceptable given the adapted one-class authentication layer's own false-positive rate
(Section 5.3) — a direct, testable link between two components of the system that does not appear to be
evaluated together in the reviewed literature.
• Provenance passport: lowest-risk, best-precedented blockchain use case here; likely worth implementing
as working infrastructure and describing, without needing deep empirical evaluation to justify its inclusion.
BlockFedEDAuth-R Project Report
Page 117. Explicit Assumptions
• Simulated clients represent distinct organizations (fabs / inspection stations) with genuinely non-IID local
defect-category distributions, following the pattern of FedEDAuth's own simulated repair-shop framing.
• A small number of simulated clients (on the order of 5–15) is used for the primary experiments, reflecting
both the realistic number of semiconductor supply-chain partners in a consortium and practical training-time
constraints, rather than FedEDAuth's 50-client simulation.
• The authentication server's golden reference dataset is assumed to be curated by a neutral, trusted third
party (mirroring FedEDAuth's own assumption), and its potential compromise is treated as future work, not
evaluated directly.
• On-chain components are prototyped on a public testnet for development speed; production-grade
permissioned deployment is discussed but not required to be built.
• The dataset used for the anomaly-detection task is either the IDA/ICME 2026 dataset (pending confirmed
public access) or MIIC with an explicitly stated small-sample-size limitation.
• “Rollback” refers to reverting the deployed global model to a previous checkpoint's weights; it does not imply
modifying already-distributed copies of a poisoned model outside the system's own control.
8. Evaluation Plan
8.1 Metrics
ComponentMetrics
Anomaly detection modelPrecision, recall, F1, AUC-ROC on held-out defect imagery; per-defect-category
breakdown.
Authentication layerFalse positive / false negative rate on suspicion classification; separation margin
between clean and poisoned client scores (as in the base paper's Figure 5-style
plot).
Rollback mechanismDetection latency (rounds until trigger), post-rollback accuracy recovery vs. clean
baseline, storage/communication overhead vs. naive full-checkpointing and vs.
Crab-style selective history.
Culprit attributionPrecision/recall of correctly identifying the actual poisoned client(s) within a
triggered window; compute cost vs. full Shapley baseline.
Blockchain layerTransaction latency/throughput, on-chain storage cost (bytes/gas per round),
dispute-window false-slash rate.
8.2 Baselines to compare against
•
•
•
•
Centralized (non-federated) training — upper bound.
Local-only training per client — lower bound.
Plain FedAvg, no authentication, no rollback.
FedAvg + per-round-only FedEDAuth-style authentication (no drift tracking) — isolates the value added by
multi-round drift detection specifically.
BlockFedEDAuth-R Project Report
Page 12• FedAvg + per-round authentication + full-history recovery (FedRecover-style) — isolates the value added by
windowed/selective checkpointing versus full-history methods.
9. Honest Assessment: Novelty, Feasibility, and Scope Risk
This section restates, in report form, the candid evaluation given during the design discussion, because it
materially affects what should and should not be attempted.
9.1 Novelty risk
Nearly every individual mechanism proposed here has close, recent, published prior art: FedEDAuth for
authentication, Crab/FedRecover/DP-RTFL for checkpoint-based recovery, Leash-FL specifically for
blockchain-anchored FL rollback, and BlockFLA specifically for blockchain-based punishment of FL attackers.
None of these individually constitute a defensible new contribution on their own. The one combination that does
not appear to already exist in the reviewed literature is: (a) using the authentication layer's own suspicion
statistics, tracked across a rolling window rather than per-round, as the rollback trigger itself, and (b) reusing
that same triggered window to make culprit attribution cheap. This narrow combination, not the individual
pieces, is the project's actual claim to novelty and should be stated as such explicitly in any paper draft.
9.2 Scope risk
The full system as discussed touches seven substantial sub-problems: anomaly-detection modeling, FL
orchestration, one-class authentication adaptation, drift-triggered rollback, windowed culprit attribution,
multi-validator decentralized authentication, and staking/slashing/dispute mechanics. Attempting to build and
rigorously evaluate all seven to the standard of the papers cited in Section 3 is not realistic within a single
final-year project timeline. Spreading effort evenly across all of them risks a shallow, unconvincing
implementation of each — the specific failure mode a reviewer at IEEE Access level would flag as “a systems
demo with too many undercooked parts.”
9.3 Recommended scope
Build and rigorously evaluate Section 5.4/5.5 (drift-triggered rollback and windowed attribution) as the
core, benchmarked contribution, with full baseline comparisons per Section 8.2. Implement the remaining layers
— the vision model, FedAvg orchestration, one-class authentication adaptation, and a basic blockchain layer
(Section 5.6, prototyped on a public testnet) — as working supporting infrastructure, described in the report and
demonstrated end-to-end, but not each individually benchmarked against its own literature to the same depth.
This keeps the system genuinely end-to-end and demonstrable (satisfying the “working product” requirement)
while keeping the empirical/research burden concentrated on one defensible, evaluable claim (satisfying the
“research paper level understanding” requirement).
BlockFedEDAuth-R Project Report
Page 1310. Summary of Open Decisions
DecisionOptionsStatus
DatasetMIIC (confirmed access, few anomalies) vs. IDA/ICME 2026 (richer,
access unconfirmed) vs. hybrid/augmented MIICOpen — verify
IDA/ICME
2026 access
first
FL aggregation
schemeFedAvg vs. Cyclic Weight Transfer (sequential) vs. hybridDecided:
FedAvg,
pending
contrary
evidence
Core evaluated
contributionDrift-triggered rollback vs. equal depth across all componentsDecided:
drift-triggered
rollback +
windowed
attribution
Blockchain platformPublic/Ethereum-style testnet vs. permissioned/Hyperledger-style
consortiumOpen — reco
mmendation:
prototype on
public testnet,
discuss
permissioned
as production
path
Authentication
adaptation depthFull evaluated sub-contribution vs. working-but-not-benchmarkedOpen —
depends on
remaining
timeline after
core
contribution is
built
Client count for
simulation5–15 (repair-shop-style) vs. 50 (matching base paper)Recommende
d: 5–15, for
tractability and
clearer
per-client
attribution
signal
11. References
[1] Lodge, N., Aklekar, D., Chadalavada, V., Tambe, N., Gholami, S., Alam, M., & Saqib, F. (2026). FedEDAuth:
Federated Embedding Distribution Authentication for Counterfeit IC Detection. arXiv:2605.15885.
[2] Lodge, N., Tambe, N., Aklekar, D., & Saqib, F. (2025). Counterfeit IC Detection via Federated Learning:
Exposure to Byzantine Data Poisoning. IEEE Physical Assurance and Inspection of Electronics (PAINE).
[3] McMahan, B., Moore, E., Ramage, D., Hampson, S., & y Arcas, B. A. (2017). Communication-Efficient Learning
of Deep Networks from Decentralized Data. AISTATS.
BlockFedEDAuth-R Project Report
Page 14[4] Chang, K., et al. (2018). Distributed Deep Learning Networks Among Institutions for Medical Imaging (origin of
Cyclic Weight Transfer / CWT).
[5] Anonymous / authors as published (2024). Cyclical Weight Consolidation: Towards Solving Catastrophic
Forgetting in Serial Federated Learning. arXiv:2405.10647.
[6] Authors as published (2025). Sharp Bounds for Sequential Federated Learning on Heterogeneous Data.
arXiv:2405.01142.
[7] Cao, X., Jia, J., Zhang, Z., & Gong, N. Z. (2023). FedRecover: Recovering from Poisoning Attacks in Federated
Learning using Historical Information. IEEE Symposium on Security and Privacy. arXiv:2210.10936.
[8] Jiang, Y., Shen, J., et al. (2024). Towards Efficient and Certified Recovery from Poisoning Attacks in Federated
Learning (Crab). arXiv:2401.08216.
[9] Authors as published (2025). PDLRecover: Privacy-Preserving Decentralized Model Recovery with Machine
Unlearning. arXiv:2506.15112.
[10] Zhao, W., et al. (2026). Adversarial Update-Based Federated Unlearning for Poisoned Model Recovery
(FAUN). arXiv:2605.02110.
[11] Talluri, A. (2025). DP-RTFL: Differentially Private Resilient Temporal Federated Learning for Trustworthy AI in
Regulated Industries. arXiv:2505.23813.
[12] Authors as published (2025). Lightweight ECC-Based Self-Healing Federated Learning Framework for Secure
IIoT Networks (Leash-FL). Sensors, DOI: 10.3390/s25226867.
[13] Desai, H. B., Ozdayi, M. S., & Kantarcioglu, M. (2021). BlockFLA: Accountable Federated Learning via Hybrid
Blockchain Architecture. ACM CODASPY. arXiv:2010.07427.
[14] Lo, S. K., et al. (2022). Trustworthy federated learning framework for accountability and equitable reward
distribution (as cited in blockchain-FL literature reviews).
[15] Huang, Y., et al. (2021). Joint Anomaly Detection and Inpainting for Microscopy Images via Deep
Self-Supervised Learning (origin of the MIIC dataset). IEEE ICIP.
[16] Authors as published (2026). ICME 2026 Grand Challenge on Cross-Scenario Defect Detection and
Fine-Grained Severity Grading for High-Precision Manufacturing (IDA/ICME 2026 dataset). arXiv:2607.04675.
[17] Blockchain-for-FL systemic surveys and design-choice reviews consulted for background: Blockchain for
Federated Learning Toward Secure Distributed Machine Learning Systems: A Systemic Survey; Blockchained
Federated Learning for Internet of Things: A Comprehensive Survey, ACM Computing Surveys; Blockchain-Based
Federated Learning System: A Survey on Design Choices.
Note on reference accuracy: entries above were verified via direct web search during this project's design
discussion wherever a specific arXiv ID, DOI, or venue could be confirmed; author lists for a few entries
(marked “authors as published”) were not fully confirmed and should be re-verified against the primary source
before use in a formal submission's bibliography.
BlockFedEDAuth-R Project Report
Page 15