# BlockFedEDAuth-R — Issues, Considerations, Assumptions & Incomplete Builds

> **Purpose:** single consolidated record of every known gap, placeholder, assumption,
> synthetic construct, incomplete build, and technical-debt item accumulated across
> Epics A–D, P (provenance), G (gateway), CD (client dashboard) and SD (server dashboard)
> up to commit `893bf48 [SD-G11]`. To be read alongside `gateway/README.md`,
> `dashboard/client/README.md`, `dashboard/server/README.md`, `gateway/routers/status.py`
> (`GET /status/limitations`) and the Project Report (`CONTEXT/context.md`).
>
> **Principle throughout:** every issue below is *documented, not hidden*. Where a
> prompt asked for something impossible given what actually exists, the build chose
> "stop and say" (honest label, explicit gap, concrete follow-up) over silent invention.
> That discipline is the reason this file is long.

---

## 1. Spec gaps discovered — the direct cause of mock fallback in dashboards

These are **not Muse Spark inventions** — they are omissions in the gateway spec (G0–G9)
identified during the G10/G11 swap and explicitly acknowledged by the spec author.
The follow-up epic G12 is scoped to close them.

### 1.1 Per-round suspicion scores are computed but never persisted

- **Where:** `gateway/session.py` + `fl-orchestrator/server/round_manager.py`.
- **What:** `authenticate_round()` computes a full `list[SuspicionScore]` (8 clients × N
  combined scores) every round and uses it to filter who contributes to FedAvg. But
  `session.round_history` stores only the *summary* `{n_passed, n_failed, checkpoint}`
  — never the raw per-client score list. `session.py:60-80` documents this.
- **Consequence:** No endpoint can serve "scores for round R" without new persistence.
  Both dashboards' heatmaps / suspicion history / FedAvg visualizer therefore **must**
  fall back to deterministic replay (`roundFeed.ts` / `serverFeed.ts`) sliced by the live
  `currentRound`. The live counter is real; the per-cell scores are mock replay.
- **Follow-up (G12):** `GET /rounds/{round}/scores` — capture the score list into
  `session.py` at `step_round()` time (unrecoverable after `run_round` returns, same
  boundary as G2's stats).

### 1.2 No reader for disputes

- **Where:** `gateway/session.py` (`open_disputes`), `gateway/routers/` (no `GET /disputes`).
- **What:** G6 tracks disputes in `session.open_disputes` and correctly finalizes/slashes
  on-chain, but **never wrote a GET endpoint** to expose them.
- **Consequence:** The server dispute Kanban has no real endpoint to poll — stays on mock
  replay (3 status snapshots of dispute_id 1 at rounds 12/13/15).
- **Follow-up:** `GET /disputes` (G12).

### 1.3 No stake-event history

- **Where:** `gateway/session.py` (`transaction_log` exists, but no structured `StakeEvent[]`);
  on-chain `Staking.sol` exposes only `balanceOf`, not history.
- **What:** Nothing in G0–G9 tracks or exposes a `StakeEvent` history — only current balance
  via `GET /clients`.
- **Consequence:** `StakingEconomics` / `StakeTrustPanel` / explorer stake tables have no real
  event series to chart — stay on mock replay (staked@1 / slashed@12).
- **Follow-up:** `GET /clients/{did}/stake-history` — new session-side event log + endpoint (G12).
- **Identical pattern:** No checkpoint list endpoint either (hash-chain graph stays on replay).

### 1.4 DID format mismatch — mock predates gateway

- **Where:** `dashboard/*/src/mock/*Feed.ts` (`did:example:client-3`) vs
  `gateway/session.py:157` (`did:bfa:client-{i}`, established G2, already registered on-chain).
- **What:** The mock convention (CD2/SD2) was set long before G2 fixed the real registration
  format; never reconciled.
- **Consequence:** Even after G12 lands real scores, rows won't join until replay identities are
  rewritten. Documented build-log consequence (heatmaps show unscored until then).
- **Follow-up:** Standardize on `did:bfa:client-{i}` everywhere — **fix mock data, never touch
  gateway's already-registered, already-tested real DIDs** (G12 follow-up after G12).

---

## 2. Gateway — explicit placeholders, residues, and design debts

### 2.1 Fl-orchestrator globals still exist (gateway fixes the caller, not the callee)

- `fl-orchestrator/server/round_manager.py` keeps `_previous_checkpoint`,
  `_default_registry`, `_default_store`, `_default_monitor` as module-level mutable defaults.
  Tests reset them between runs — flagged fragile in C4/C5 review.
- `GatewaySession` fixes this *properly at the call site*: every `run_round` call passes
  `previous_checkpoint` + `checkpoint_registry` from `self`; `session.py` references **zero**
  module globals in code (grep-verified, docstring 1). Zero `fl-orchestrator` changes.
- **Residual:** the callee's own defaults persist. Full removal needs a `run_round` return-contract
  change (return the `Checkpoint`, accept `store`/`monitor`). Tracked as
  `run-round-residual-globals` in `GET /status/limitations`.

### 2.2 Double checkpoint store

- `run_round()` takes **no** `checkpoint_store` param (persists via its internal `_default_store`).
  `GatewaySession` still constructs and owns a `LocalCheckpointStore` for gateway-side reads
  (`verify_integrity`, future routers). Two stores, one logical checkpoint — same residue class
  as the missing monitor param. Flagged upstream; zero fl-orchestrator changes in this story.

### 2.3 Drift monitor owned but not wired

- `GatewaySession` owns a `DriftMonitor` for its whole life per design, but `run_round` ingests
  into its **own internal monitor** (no monitor param exists). Same residue; held for
  session-lifetime status reads and the future direct wiring.

### 2.4 Summary carries totals only — attribution-by-elimination

- `run_round` summary is `{round, n_passed, n_failed, drift_triggered, ...}` — no per-client
  verdicts, no `Checkpoint` object. Consequence:
  - G2/G6 file disputes against the *armed* client by elimination (only possible failure source;
    honest fleet passes) — one open dispute per DID.
  - `client_stats.passed` advances for **all** clients only on clean rounds; on dirty rounds it
    **holds** (never guesses). Documented in `session.py:362-371`.
  - G5/G6 anchor/file/slash via `transaction_log` rather than return values.
  - Head checkpoint reconstructed session-side from `checkpoint_registry` diff + summary totals.

### 2.5 Artificial pacing

- `GatewaySession.advance_stage()` sleeps `0.4s` per stage so dashboards polling at 1s can
  observe progression. Comment states: real training latency from the vision model replaces this.
  G4 autonomous loop deliberately does **not** use `run_in_threadpool` (measured ~2.7s/round is
  mostly yielding sleeps + ms compute — re-evaluate when the vision model changes the blocking profile).

### 2.6 Placeholder economics & identity (all in `GET /status/limitations`)

| Item | Location | Nature |
|---|---|---|
| Initial stake `1_000_000_000_000_000_000` wei (1 ETH) | `session.py:98` | Arbitrary placeholder; no tokenomics |
| Challenge window `60s` | `session.py:103` | Placeholder, needs empirical tuning; tests override to `2s` |
| Slash `10%` per finalized rejection | `session.py:107` | Policy stub; no overturn exists so every filed dispute finalizes as rejected |
Affects G5/G6/G8. All flagged in code comments + build log + status endpoint.

- **Dummy pubkeys:** `placeholder-pubkey-client-{i}` — no keypair infra (G2 known gap).
- **No DID signature verification** — `provenance-api` passes `signature` through unverified
  (deferred to gateway).

### 2.7 Contract shadowing fix

- Creating `gateway/chain_bridge/` shadowed `rollback-service`'s top-level `chain_bridge` for
  plain imports and broke G0. **Renamed to `gateway/chain_clients/`** mid-G2 — zero importlib hacks,
  G0 green again. `session.py:55` documents it.

### 2.8 Passport "list all" — no contract method

- `Passport.sol` exposes only `getEventsForDevice` + `getEvent` (verified in contract).
  `GET /passport/all` therefore replays per-device histories for `session.known_device_ids`
  (tracked on `POST /passport/events`, oldest-first) merged newest-first. **Entries carry no
  `round` field**, so no round slicing is possible — documented in routers + session + build logs.

---

## 3. Drift / rollback — placeholder accuracy makes the real path untriggerable

- `fl-orchestrator/server/round_manager.py: _PLACEHOLDER_ACCURACY = 0.9` — flat constant because
  B3's `reference_set_accuracy_delta` is **not wired into rounds** (needs golden labeled images from
  the vision model). Consequence: `DriftMonitor`'s `accuracy_trend < 0` half can never fire on the
  real path; `window personal` (`driftThreshold=2.0`) therefore never calibrated against real data.
- **Dashboard honesty:** G8 limitations endpoint + G11/SD11 build logs label this explicitly.
  Both dashboards inject **one synthetic `DriftEvent` at round 17** (`window 13–17`, reverts to
  round-11 anchor) *purely for UI demo* — never presented as measured behavior, header + copy
  say "synthetic (demo)" throughout.

---

## 4. Dashboards — what is live, what is replay, what is synthetic

### 4.1 Live vs. replay split (identical discipline in both apps)

**LIVE after G10/G11** (polled, not invented):
- `currentRound` / `currentStage` (stage *mapped*, not invented — unknown falls back to `idle`)
- `isPlaying` from `GET /rounds/autonomous/status`
- `play()` → `POST /rounds/autonomous/start`, `pause()` → `/stop`, `step()` → `POST /rounds/step`
- Client DIDs from `GET /clients` (`did:bfa:…`)
- `transactions` passed through field-identical to `TransactionRecord`
- `passportEntries` from `GET /passport/all` (real, but unindexed by round — see §2.8)

**REPLAY (mock data indexed by the live counter, clearly labeled):**
- **Client:** `suspicionHistory`, `checkpoints`, `stakeEvents`, `passportEntries` (per-entry rounds),
  `fleetScoresThisRound`, `images_examined`/`anomalies_detected` (CD7 volume)
- **Server:** `suspicionScores` (all 8×20), `checkpoints`, `stakeEvents`, `disputes`
- Server adds an additive `dataSource` discriminator: live counter + synthetic flag + replay slices.
  **Fourteen downstream keys are byte-identical** so no component needed changes.

**Why replay:** the three endpoints above don't exist yet (§1) and the checkpoint list doesn't either.

### 4.2 reset() — honest no-op

- `reset()` in both hooks is a **no-op with a verbatim console warning**:
  `"reset() has no effect against live gateway data — restart the gateway process to reset"` (client)
  / `"reset() has no effect ..."` (server). Prevents pretending to reset on-chain/session state.

### 4.3 synthetic drift event

- Persists at `window_end_round = 17` (by explicit requirement), gated on the *event* not the round
  number. Pure function `evaluateDriftGate()`/`buildRoundSignals()` still asserts the real arithmetic
  (window 5, `mean > 2.0 AND trend < 0`).

### 4.4 Known consequence — identity join gap

- Replay rows still use `did:example:…`; live gateway uses `did:bfa:…`. Documented in both
  `use*Feed.ts` headers and server README: heatmap cells show unscored until G12's real scores land
  **and** the replay DIDs are migrated. Intentionally not patched over.

### 4.5 Deliberate duplication

- Client and server dashboards are **separate apps** (own `package.json`, own `node_modules`,
  no cross-app imports). Small shared bits (`types`, `Legend`, `TeacherModeToggle`) are copied,
  same philosophy as `passport_client.py` vs. `rollback-service/chain_client.py`.

### 4.6 Frontend testing choices

- Tests mock `fetch` (G10's documented option — fast, no live gateway needed).
- `jsdom` has no layout; xyflow edge geometry is suppressed under zero-size viewports — edge SVG
  itself is **not asserted** in jsdom (documented in-file as "would be fake").
- Tailwind `v3` pinned; `ResizeObserver` stub fixed to report dimensions for xyflow.
- `npm run build` is the stricter gate here (`tsc -b` caught an unused-var that `tsc --noEmit` missed).

---

## 5. Auth / FL / rollback / blockchain — upstream debts carried forward

### 5.1 Auth-service

- **B4 fixed `threshold=3.0` failed:** `outlier_fraction` saturates at `1.0` for every client in
  high dimensions (random cluster centers) — every client failed. **B4.5** replaced it with a
  **data-driven calibrated threshold** `mean + k*std` over calibration clients (seeds 100–104,
  non-overlapping with golden ref 42–46 or fleet 0–7), read as `reference_stats["calibrated_threshold"]`.
  Measured `9.981717382468954` (`~9.9817` / `~9.98` depending on rounding); honest band
  `[8.7462, 7.5985, 8.4854, 9.3716, 7.7873, 7.7806, 9.1614, 8.3007]`.
- `reference_set_accuracy_delta = 0.0` throughout (B3 exists but unwired — see §3).
- `combine_scores` weights `{outlier:2.0, shift:1.0, cluster:1.5, perf:1.0}` are **placeholders**
  (Section 7 of the design doc), never tuned.
- `micro_cluster_score` uses `reference_stats["embeddings"]` exactly — not resampled from
  `mean`/`covariance` (would erase multi-cluster structure).

### 5.2 FL orchestrator

- `make_clients(n)` simulates non-IID by distinct random seeds (different class-centers), not a
  real data partition by defect category — noted as must-replace when the vision model lands.
- `fedavg` raises `ValueError` on empty input (all rejected) — caller skips the round.
- Delta-chain replay **deferred**: `checkpoint_round` always does `is_delta=False` full snapshots;
  `checkpoint_store/delta.py` exists but round-chaining for partial restore is not orchestrated yet.
  Build log documents the deferral.

### 5.3 Rollback / blockchain contracts

- `CheckpointAnchor` never stores weights (hash + URI only).
- `DIDRegistry` / `Staking` / `Dispute` / `Passport` signatures honored exactly (including A5.1
  `signature` added to Passport). `Staking.slash` is `Ownable`-gated.
- Challenge window typed as `uint256 challengeWindowSeconds` awaiting real tuning.

---

## 6. Modules on hold — standing scope decisions (not forgotten)

| Module | Status | What dashboards show instead | Notes |
|---|---|---|---|
| `attribution-service` | **On hold** (standing call pre-batch1) | `AttributionPlaceholder` (SD10): grayed, zero interactive elements, mirrors SD3's grayed map node; system-map attribution node non-interactive | Windowed culprit scoring (Section 5.5 of report) scoped as supporting contribution |
| `vision-model` | **Separate teammate track** | Mock image/anomaly counts in client dashboard (CD7: `~50 images/round`, low single-digit anomalies) + mock embeddings/weights everywhere (`MockModelAdapter`, seeded RNG) | Swap point: `shared/interfaces/model_adapter.py` |
| `infra/` | Stub | — | `docker-compose.yml` mentioned in root README; not built |
| Gateway vision wiring | Deferred | Artificial pacing slumbers | See §2.5 |

---

## 7. Assumptions made explicit

- Golden reference curated by a neutral third party (FedEDAuth assumption); compromise out of scope.
- Small consortium (`5–15` clients; demos use 8) — realistic for fabs/distributors, not FedEDAuth's 50.
- Public Ethereum-style testnet for speed; production-grade permissioned (Hybrid/Hyperledger) path
  discussed in `CONTEXT/context.md` Section 5.6, not built.
- `PassportEntry.device_id` is opaque; no canonical device registry besides gateway's session-scoped
  `known_device_ids` (resets when the gateway process restarts — same as all session state).
- `CALIBRATED_THRESHOLD` displayed as `9.9817` in dashboards (formatted) but measured as
  `9.981717382468954` in auth-service — both cite the same measurement.

---

## 8. Risks & what would change if assumptions break

- **Non-IID realism:** seed-based non-IID is a weak stand-in; real defect-category partition by client
  could widen the honest band enough to overlap the attacker — recalibration needed.
- **Threshold stability:** the `k=3.0` sigma rule is unvalidated on real imagery; any shift in embedding
  geometry requires rerunning `calibrate_threshold`.
- **Blockchain performance:** Leash-FL already notes permissioned layers outperform Ethereum on
  latency/throughput — current gas/byte-per-round numbers are testnet-only.
- **Evaluation debt (Section 8.2 of report):** baselines vs. plain FedAvg / FedAvg+auth / FedAvg+full
  recovery are recommended but not yet run for the drift-triggered claim.
- **Checkpoint storage:** delta replay + windowed pruning are designed but not yet load-tested.

---

## 9. Planned follow-ups (already scoped, not vague "later")

1. **G12** — three new gateway endpoints:
   - `GET /rounds/{round}/scores` (persist scores in session)
   - `GET /clients/{did}/stake-history` (session-side stake event log)
   - `GET /disputes` (reader for `open_disputes`)
   — plus checkpoint list if desired. Scores must be captured at step time (unrecoverable after).
2. **CD-G12 / SD-G12** — point `SuspicionHeatmap`, `StakingEconomics`, `DisputeKanban`
   (and client `SuspicionHistoryChart`, etc.) at the new endpoints; remove the corresponding
   replay slices.
3. **Migrate replay DIDs** `did:example:* → did:bfa:client-{i}` (after G12 verifies live joins).

---

## 10. File index — where each consideration lives

| Concern | Files |
|---|---|
| Missing scores / disputes / stake endpoints | `gateway/session.py`, `gateway/routers/*.py`, `dashboard/*/src/mock/use*Feed.ts` |
| Synthetic drift @17 + placeholder accuracy | `fl-orchestrator/server/round_manager.py`, `rollback-service/drift_monitor/window_tracker.py`, `dashboard/*/src/mock/*Feed.ts`, `gateway/routers/status.py` |
| DID mismatch | `dashboard/*/src/mock/*Feed.ts`, `gateway/session.py:156`, `gateway/chain_clients/did_client.py` |
| Session state & residuals | `gateway/session.py` (module docstring + comments) |
| Challenge window / slash / stake placeholders | `gateway/session.py:95-107`, `gateway/routers/status.py` |
| Chain client shadowing fix | `gateway/chain_clients/` (renamed from `chain_bridge`) |
| Passport list-all gap | `gateway/routers/passport.py:GET /passport/all`, `gateway/session.py:record_device()`, `blockchain/contracts/Passport.sol` |
| Honest no-op reset | `dashboard/*/src/mock/use*Feed.ts` |
| Attribution on hold | `dashboard/server/src/components/AttributionPlaceholder.tsx` |
| Vision non-IID stub | `fl-orchestrator/client_sim/partition.py`, `shared/mock_model/mock_adapter.py` |
| Threshold calibration | `auth-service/scoring/calibration.py`, `auth-service/tests/test_calibration.py` |
| Limitations catalog | `gateway/routers/status.py` (`GET /status/limitations`, 10 entries) |
| Volatile deployment artifacts | `blockchain/deployments/localhost/*.json` (rewritten each `deploy:localhost`) |
| Ephemeral checkpoint data | `checkpoint_data/`, `gateway/checkpoint_data/` (`.npz` per hash) |

---

## 11. Repo hygiene introduced alongside this file

- Root `.gitignore` now ignores all `.venv`/`venv`/`.env`, `__pycache__`, `*.pyc`, `node_modules`,
  `dist`, `checkpoint_data/`, IDE/dirt files, so the `.venv` folders already present in
  `gateway/`, `rollback-service/`, `auth-service/`, `fl-orchestrator/`, `provenance-api/`
  and the local `.npz` checkpoint blobs no longer appear as untracked noise.
- `CONTEXT/` (this report + the 6 batch prompt docs + the project report PDF) is now tracked
  and committed — previously untracked/previously-deleted root copies reconciled.
- `RUNBOOK.md` and root `README.md` updated to reflect the **actual** current runnable surface
  (gateway + both dashboards), not the pre-gateway state they still described.
- Hardhat deployments remain volatile by design — re-run `npm run deploy:localhost` whenever the
  local node restarts.

---

*Generated 2026-09-15 — against commit `893bf48` with status-panel and file-level evidence.
Update this file (remove the retired entry) whenever a limitation above is actually retired,
with the retiring commit cited in that removal.*
