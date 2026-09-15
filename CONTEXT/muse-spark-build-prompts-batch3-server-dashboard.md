# BlockFedEDAuth-R — Muse Spark 1.3 Build Prompts, Batch 3, Epic SD

Covers: **Server Dashboard** — a separate app from `dashboard-client`
(Epic CD), not a shared package. Same deliberate-duplication philosophy as
`passport_client.py` vs. `rollback-service`'s `chain_client.py`: keeping
each app's own copy of small shared bits (types, Legend, TeacherModeToggle)
means changing one never risks breaking the other. Same stack as Epic CD:
React + TypeScript + Vite + Tailwind + recharts + @xyflow/react +
framer-motion + Vitest/React Testing Library.

## Ground rules

Identical to Epic CD's Section 0 — one story at a time, types must match
this doc exactly, `[STORY_ID] key=value` + `STATUS=PASS/FAIL` for anything
assertable, `manual_check_needed=...` for anything purely visual, one
commit per story, README build log.

## Critical consistency requirement (read before SD2)

`dashboard-client` and `dashboard-server` are two different apps but they
must tell the SAME story if demoed side by side — both must derive from
identical underlying scenario numbers: the real B4.5 calibrated threshold
(`9.9817...`), the real 8-client honest-band scores
(`[8.9265, 7.7989, 8.6812, 9.7005, 8.2001, 7.8533, 9.3369, 8.5529]`), and
`client-3` turning poisoned (`~25-26` combined score) from round 12
onward. Do NOT invent a different scenario for the server side — copy the
same underlying numbers Story CD5 used.

**One deliberate exception:** the real `DriftMonitor` (Story D3) has never
actually triggered a rollback in any test so far, because reference-set
accuracy is still a hardcoded placeholder constant (`_PLACEHOLDER_ACCURACY
= 0.9`), so its trend is always flat and the AND-condition can never fire —
this is documented, expected behavior, not a bug. For the Checkpoint
Hash-Chain / Drift Monitor panels (Story SD6) to be demonstrable at all, the
mock feed injects ONE synthetic `DriftEvent` around round 17 purely for UI
illustration — clearly commented in code as `// SYNTHETIC for dashboard
demo purposes only — the real drift monitor cannot yet trigger this given
the placeholder reference-set accuracy; remove/replace once real accuracy
data exists`. Do not present this as if it reflects real measured system
behavior anywhere in the UI copy — the point is to show what the UI *will*
display once it's real, honestly labeled as a stand-in.

## Repo layout this epic adds

```
dashboard-server/
  src/
    types/
      schemas.ts                (SD1)
    mock/
      serverFeed.ts              (SD2)
      useServerFeed.ts            (SD2)
    components/
      SystemMap.tsx                (SD3)
      SuspicionHeatmap.tsx          (SD4)
      FedAvgVisualizer.tsx           (SD5)
      DriftMonitorGate.tsx            (SD6)
      CheckpointChainGraph.tsx         (SD6)
      BlockchainExplorer.tsx            (SD7)
      DisputeKanban.tsx                  (SD7)
      StakingEconomics.tsx                (SD8)
      ProvenanceLedger.tsx                 (SD9)
      AttributionPlaceholder.tsx            (SD10)
      TeacherModeToggle.tsx                  (SD11, own copy)
      Legend.tsx                              (SD11, own copy)
    App.tsx                                    (SD11)
  tests/
```

## Story SD0 — Project setup

**Prompt for Muse Spark:**
> Identical to Story CD0, but scaffold `dashboard-server/` as a SEPARATE
> app (own `package.json`, own `node_modules`, do not reference
> `dashboard-client/` from here in any way). Print
> `[SD0] dev_server_starts=<bool> placeholder_test_passes=<bool>` then
> `[SD0] STATUS=PASS/FAIL`.

**Commit:** `[SD0] dashboard-server project setup`

## Story SD1 — Types

**Prompt for Muse Spark:**
> Write `src/types/schemas.ts` — copy the exact same interfaces as Epic
> CD's Story CD1 (`ClientDID`, `SuspicionScore`, `AuthDecision`,
> `Checkpoint`, `DriftEvent`, `StakeEvent`, `PassportEntry`) field-for-field
> identical. Add THREE new types that only exist for this app's
> demo/explorer purposes (not mirrored from any backend schema — flag them
> as such in a code comment): `interface TransactionRecord { tx_hash:
> string; block_number: number; gas_used: number; function_called: string;
> contract_name: string; timestamp: number; }`, `type DisputeStatus =
> "provisionally_rejected" | "challenge_window" | "finalized_rejected" |
> "overturned";`, `interface Dispute { dispute_id: number; client_did:
> string; round_number: number; reason: string; status: DisputeStatus;
> deadline: number; }`. Also add `type SystemStage = "collecting_updates" |
> "authenticating_all" | "aggregating" | "checkpointing" |
> "anchoring_chain" | "drift_monitoring" | "broadcasting";` (the
> system-wide analog of Epic CD's per-client `RoundPipelineStage` — also
> frontend-only for now, same caveat as CD1's note about gateway needing
> to eventually emit this). Print `[SD1] typecheck_passes=<bool>` (via
> `npx tsc --noEmit`) then `[SD1] STATUS=PASS/FAIL`.

**Commit:** `[SD1] TypeScript types (shared schemas + explorer-only types)`

## Story SD2 — Mock server-wide feed

**Prompt for Muse Spark:**
> Write `src/mock/serverFeed.ts`: the SAME 20-round, 8-client scenario as
> Epic CD (see this doc's "Critical consistency requirement" above for the
> exact numbers — copy them, do not regenerate) but from the server's
> vantage point: all 8 clients' `SuspicionScore` per round (not just
> client-3's), the full `Checkpoint` chain, all `StakeEvent`s, a
> `Dispute[]` array (one dispute filed for client-3 at round 12, status
> progressing `provisionally_rejected` → `challenge_window` → (at round 15)
> `finalized_rejected`), a `TransactionRecord[]` mock feed (one entry per
> checkpoint anchored, plus one per stake/dispute event — invented but
> plausible-looking hex hashes/gas numbers, clearly fine since this is
> demo data), and the ONE synthetic `DriftEvent` at round 17 per the
> consistency-requirement note above. Also generate the `SystemStage`
> cycle (7 stages, same fixed-duration pattern as Epic CD's per-client
> stage cycle). Write `src/mock/useServerFeed.ts`: same shape/pattern as
> Epic CD's `useRoundFeed` (Story CD2) — `currentRound`, `currentStage`,
> play/pause/step/reset, and sliced arrays of everything above up to
> `currentRound`. Same rule as CD2: this is the ONLY data-source import
> allowed anywhere else in this app. Write
> `src/mock/useServerFeed.test.ts`: assert stage cycling and round
> incrementing work the same way CD2's test verified; assert the
> synthetic drift event appears in the feed only once `currentRound >=
> 17`; assert all 8 clients' scores are present each round, not just
> client-3's. Print `[SD2] stage_cycle_correct=<bool>
> all_8_clients_present=<bool> synthetic_drift_appears_at_17=<bool>` then
> `[SD2] STATUS=PASS/FAIL`.

**Commit:** `[SD2] Mock server-wide feed + useServerFeed hook`

## Story SD3 — Living System Map

**Prompt for Muse Spark:**
> Write `src/components/SystemMap.tsx` using `@xyflow/react`: 6 nodes
> laid out to mirror the six-layer architecture (Vision/Anomaly Model,
> FL Aggregation, Client Authentication, Rollback & Versioning, Culprit
> Attribution [grayed out, non-interactive — Story SD10 handles its
> content], Blockchain Layer), connected with edges matching the real
> data flow (client → auth → aggregation → checkpoint/rollback →
> blockchain). The node matching the current `SystemStage` (mapped:
> `collecting_updates`/`authenticating_all` → Client Authentication node,
> `aggregating` → FL Aggregation node, `checkpointing`/`drift_monitoring`
> → Rollback & Versioning node, `anchoring_chain` → Blockchain Layer node,
> `broadcasting` → back to FL Aggregation) pulses/highlights via
> `framer-motion`, same visual language as Epic CD's `PipelineFlowchart`
> (Story CD3) so a viewer seeing both dashboards recognizes the pattern.
> Clicking a node scrolls to/expands that layer's detailed panel further
> down the page (SD4-SD9). Write
> `src/components/SystemMap.test.tsx`: assert the correct node highlights
> for a few different `currentStage` values via the mapping above. Print
> `[SD3] stage_to_node_mapping_correct=<bool>` then `[SD3] STATUS=PASS/FAIL`.
> Print `[SD3] manual_check_needed=confirm this reads as the dashboard's
> visual anchor, not just another panel`.

**Commit:** `[SD3] Living system map`

## Story SD4 — Suspicion Heatmap

**Prompt for Muse Spark:**
> Write `src/components/SuspicionHeatmap.tsx`: a grid, clients (rows) ×
> rounds (columns, up to `currentRound`), each cell colored by that
> client's `combined_score` that round relative to the calibrated
> threshold (e.g. a green→amber→red scale, red once `combined_score`
> exceeds threshold). Build this as plain `<div>`/SVG rects in a CSS grid
> — do NOT reach for a separate heatmap charting library, `recharts`
> doesn't have a built-in one and this doesn't need it. Hovering a cell
> shows that exact score as a tooltip. Write
> `src/components/SuspicionHeatmap.test.tsx`: at `currentRound=20`, assert
> client-3's cells from round 12 onward render with the "over threshold"
> color and every other client's cells throughout stay in the "under
> threshold" color. Print `[SD4] attacker_row_correctly_colored=<bool>
> honest_rows_correctly_colored=<bool>` then `[SD4] STATUS=PASS/FAIL`.

**Commit:** `[SD4] Suspicion heatmap`

## Story SD5 — FedAvg Aggregation Visualizer

**Prompt for Muse Spark:**
> Write `src/components/FedAvgVisualizer.tsx` using `@xyflow/react`: 8
> small "client" nodes on the left, edges flowing into one central
> "Global Model" node on the right, edges animated (`@xyflow/react`
> supports animated edges natively) only for clients that PASSED
> authentication that round (excluded clients' edges render dimmed/dashed,
> not animated — visually distinguishing "contributed" from "rejected,
> didn't contribute" at a glance). Add a toggle button: "Compare to
> centralized training" — when on, replace the diagram with a simple
> side-by-side callout (a sentence or two, not a full second diagram) that
> a centralized approach would require pooling all 8 clients' raw data in
> one place, contrasted with this diagram showing only weight updates
> flowing. Write `src/components/FedAvgVisualizer.test.tsx`: at round 15,
> assert client-3's edge renders as dimmed/non-animated while the other 7
> render as animated. Print `[SD5] excluded_client_edge_dimmed=<bool>
> honest_clients_animated=<bool>` then `[SD5] STATUS=PASS/FAIL`.

**Commit:** `[SD5] FedAvg aggregation visualizer`

## Story SD6 — Drift Monitor AND-gate + Checkpoint Hash-Chain Graph

**Prompt for Muse Spark:**
> Write `src/components/DriftMonitorGate.tsx`: two small indicator lights
> labeled "Sustained Suspicion" and "Accuracy Declining", each lit
> (green/red or on/off styling) based on whether the mock feed's current
> window state would satisfy each half of Story D3's real AND-condition —
> compute this from the same `suspicionHistory`/`referenceAccuracy`-style
> data the mock feed exposes, don't just hardcode the lights' states. A
> third light, "ROLLBACK TRIGGERED", only lights up when BOTH of the first
> two are lit AND `currentRound >= 17` (the synthetic drift event's
> round). Write `src/components/CheckpointChainGraph.tsx` using
> `@xyflow/react`: nodes = checkpoints in a horizontal chain, edges =
> `parent_hash` links; at the synthetic drift event's round, add a visibly
> distinct branch/revert edge from the current checkpoint back to
> whichever earlier checkpoint the (synthetic) `DriftEvent` names as
> `reverted_to_checkpoint_hash`, styled differently (e.g. dashed, red) from
> the normal forward-chain edges. Write tests for both: `DriftMonitorGate`
> — assert the third light is off before round 17 and on at/after it (given
> the synthetic event); `CheckpointChainGraph` — assert the revert edge
> only appears once `currentRound >= 17` and points to the correct node.
> Print `[SD6] and_gate_logic_correct=<bool>
> revert_edge_appears_correctly=<bool>` then `[SD6] STATUS=PASS/FAIL`.

**Commit:** `[SD6] Drift monitor AND-gate + checkpoint hash-chain graph`

## Story SD7 — Blockchain Explorer + Dispute Kanban

**Prompt for Muse Spark:**
> Write `src/components/BlockchainExplorer.tsx`: a DID/stake table (8
> clients, current stake balance each, from the mock feed), a scrolling
> `TransactionRecord` feed (most recent first), and a simple incrementing
> block-height ticker (mock — just count up as `currentRound` advances).
> Write `src/components/DisputeKanban.tsx`: three columns
> ("Provisional"/"Challenge Window"/"Finalized or Overturned"), one card
> per `Dispute` from the mock feed, the card for client-3's round-12
> dispute animating (via `framer-motion`'s layout animations) from column
> to column as `currentRound` advances past the mock scenario's status
> transitions (see Story SD2's dispute progression). Write tests for both:
> `BlockchainExplorer` — assert the stake table matches mock balances
> exactly; `DisputeKanban` — assert the dispute card is in the correct
> column for a few different `currentRound` values (e.g. column
> "Provisional" at round 12, "Finalized or Overturned" at round 15+).
> Print `[SD7] stake_table_correct=<bool> dispute_card_column_correct=<bool>`
> then `[SD7] STATUS=PASS/FAIL`. Print
> `[SD7] manual_check_needed=confirm the Kanban card's column transition
> animation is smooth, not jarring`.

**Commit:** `[SD7] Blockchain explorer + dispute Kanban`

## Story SD8 — Staking Economics

**Prompt for Muse Spark:**
> Write `src/components/StakingEconomics.tsx`: total value currently
> staked across all 8 clients (a number, from the mock feed), a
> `recharts` bar chart of slashing events over the 20 rounds, and a
> one-line "security budget" framing computed as (total staked) ÷ (number
> of clients) × (some illustrative "% of clients an attacker would need to
> control" — e.g. show the number for controlling 1 client, since that's
> what the mock scenario actually demonstrates, not an invented larger
> percentage). Write `src/components/StakingEconomics.test.tsx`: assert
> the total staked figure matches the mock feed's running total exactly
> at a given round. Print `[SD8] total_staked_correct=<bool>` then
> `[SD8] STATUS=PASS/FAIL`.

**Commit:** `[SD8] Staking economics panel`

## Story SD9 — System-wide Provenance Ledger

**Prompt for Muse Spark:**
> Write `src/components/ProvenanceLedger.tsx`: a scrolling feed of EVERY
> `PassportEntry` across all devices in the mock feed (not filtered to one
> device — that was Epic CD's `DeviceLookup`, this is the system-wide
> view), most recent first, each row showing `device_id`, `event_type`,
> `actor_did`, truncated `evidence_hash`. Write
> `src/components/ProvenanceLedger.test.tsx`: assert the feed shows
> entries from multiple distinct `device_id`s (confirming this genuinely
> aggregates across devices, unlike CD8's single-device search). Print
> `[SD9] multi_device_feed_correct=<bool>` then `[SD9] STATUS=PASS/FAIL`.

**Commit:** `[SD9] System-wide provenance ledger`

## Story SD10 — Culprit Attribution placeholder

**Prompt for Muse Spark:**
> Write `src/components/AttributionPlaceholder.tsx`: a grayed-out,
> non-interactive panel/nav entry labeled "Culprit Attribution — coming
> soon" with no functional content, per the standing decision to leave
> `attribution-service` on hold. Write a trivial render test confirming it
> displays the label and contains no interactive elements (no buttons, no
> clickable rows). Print `[SD10] placeholder_renders=<bool>
> no_interactive_elements=<bool>` then `[SD10] STATUS=PASS/FAIL`.

**Commit:** `[SD10] Culprit attribution placeholder`

## Story SD11 — App shell, teacher mode, shared legend

**Prompt for Muse Spark:**
> Same pattern as Epic CD's Story CD9, but this app's own copies of
> `Legend.tsx` and `TeacherModeToggle.tsx` (identical color scheme —
> green/red/amber — to Epic CD's, so switching between the two dashboards
> doesn't require relearning anything, per the brainstorm's cross-cutting
> requirement; copy the file, don't import across apps). Assemble
> `src/App.tsx` from every component built in SD3-SD10, plus the mock
> feed's play/pause/step/reset controls exposed as buttons. Write
> `src/App.test.tsx`: assert every panel from SD3-SD10 is present, assert
> play/pause advances the round (fake timers, not a real wait). Print
> `[SD11] all_panels_present=<bool> play_advances_round=<bool>` then
> `[SD11] STATUS=PASS/FAIL`.

**Commit:** `[SD11] App shell, teacher mode, shared legend`

## Story SD12 — Full regression suite

**Prompt for Muse Spark:**
> Run `npx vitest run` across `dashboard-server/`. Print
> `[SD12] total=<N> passed=<N> failed=<N>` then `[SD12] STATUS=PASS` only
> if `failed == 0`. Run `npx tsc --noEmit`, print
> `[SD12] typecheck_clean=<bool>`.

**Commit:** `[SD12] dashboard-server full test suite green`

---

## The full remaining picture, beyond this epic

- **`gateway` — not started at all yet.** Both dashboards are currently,
  deliberately, mock-data-only (same swap-in pattern used throughout this
  whole build). Gateway is what will eventually replace `useRoundFeed`/
  `useServerFeed`'s mock internals with real polling — that's a real,
  sizeable epic on its own (auth/fl/rollback/blockchain/provenance
  orchestration, plus the deferred Dispute/Staking-triggering wiring from
  our earlier discussion, plus emitting the `RoundPipelineStage`/
  `SystemStage` signals both dashboards currently fake). Worth its own
  detailed doc when you're ready, same rigor as this one.
- **Swapping both dashboards from mock to real data** — deferred until
  gateway exists; each app's single swap point (`useRoundFeed`/
  `useServerFeed`) is exactly where that change lands, touching no
  components.
- **`attribution-service`** — on hold, your standing call; both dashboards
  already have a clearly labeled placeholder slot ready for it.
- **`vision-model`** — your teammate's parallel track; once it implements
  `ModelAdapter`, the images-examined/anomalies-detected numbers currently
  marked as mock placeholders (Story CD7) become real, again with no UI
  changes needed.

Want gateway's detailed epic next?
