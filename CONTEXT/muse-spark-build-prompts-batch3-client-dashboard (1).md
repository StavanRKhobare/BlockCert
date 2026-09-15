# BlockFedEDAuth-R — Muse Spark 1.3 Build Prompts, Batch 3, Epic CD

Covers: **Client Dashboard** only. Server Dashboard (Epic SD) follows once
this is built and reviewed, per your sequencing call. Stack: React +
TypeScript + Vite + Tailwind + recharts + @xyflow/react + framer-motion +
Vitest/React Testing Library.

## Ground rules (same spirit as Batch 1's Section 0 — restate for Muse Spark)

1. One story at a time. Don't build ahead.
2. Every story's TypeScript types must match this doc's type definitions
   exactly — same field names, same shapes. If a real backend field is
   missing something a UI idea needs, stop and say so instead of inventing
   a field.
3. Verification convention, adapted for frontend: wherever behavior can be
   asserted (data renders correctly given mock state, a click updates the
   right element, play/pause changes displayed round) — write a Vitest +
   React Testing Library test and print `[STORY_ID] key=value` +
   `STATUS=PASS/FAIL` the same way the Python stories did. Wherever
   something is purely visual/aesthetic (a color looks right, an animation
   feels smooth) — do NOT fake an automated assertion for it. Instead
   print `[STORY_ID] manual_check_needed=<short description>` and move on;
   these get eyeballed by the user, not a test runner.
4. Commit after every story, one commit each, README build log per module
   (same as the Python epics).

## Repo layout this epic adds

```
dashboard-client/
  src/
    types/
      schemas.ts              (CD1)
    mock/
      roundFeed.ts             (CD2)
      useRoundFeed.ts           (CD2)
    components/
      PipelineFlowchart.tsx     (CD3)
      SuspicionHistoryChart.tsx (CD4)
      FleetStanding.tsx         (CD5)
      StakeTrustPanel.tsx       (CD6)
      ContributionVolume.tsx    (CD7)
      PassportSubmissions.tsx   (CD8)
      DeviceLookup.tsx          (CD8)
      TeacherModeToggle.tsx     (CD9)
      Legend.tsx                (CD9)
    App.tsx                     (CD9)
  tests/
    (one test file per component, colocated per Vitest convention)
```

## Story CD0 — Project setup

**Prompt for Muse Spark:**
> Scaffold `dashboard-client/` with `npm create vite@latest . --
> --template react-ts`. Install `tailwindcss` (+ init config), `recharts`,
> `@xyflow/react`, `framer-motion`, `vitest`, `@testing-library/react`,
> `@testing-library/jest-dom`, `jsdom`. Configure Vitest in `vite.config.ts`
> (`test: { environment: 'jsdom', globals: true }`). Confirm the dev server
> starts (`npm run dev`, check it binds without error, then stop it) and a
> trivial placeholder test passes (`expect(true).toBe(true)` in
> `src/App.test.tsx`). Print `[CD0] dev_server_starts=<bool>
> placeholder_test_passes=<bool>` then `[CD0] STATUS=PASS/FAIL`.

**Commit:** `[CD0] dashboard-client project setup`

## Story CD1 — Types mirroring the backend schemas

**Prompt for Muse Spark:**
> Write `src/types/schemas.ts` with TypeScript interfaces matching
> `shared/interfaces/schemas.py` EXACTLY — same field names (keep Python's
> `snake_case` field names as-is, do not convert to `camelCase`, so a
> future real API response maps onto these types with zero translation
> layer):
> ```ts
> export interface ClientDID {
>   did: string;
>   public_key: string;
>   display_name?: string;
>   stake_balance: number;
> }
> export interface SuspicionScore {
>   client_did: string;
>   round_number: number;
>   outlier_fraction: number;
>   mean_shift: number;
>   micro_cluster_score: number;
>   reference_set_accuracy_delta: number;
>   combined_score: number;
>   passed: boolean;
> }
> export type AuthDecision = "accepted" | "provisionally_rejected" | "finalized_rejected" | "overturned";
> export interface Checkpoint {
>   round_number: number;
>   weights_hash: string;
>   parent_hash: string | null;
>   off_chain_uri: string;
>   is_delta: boolean;
>   reference_set_metrics: Record<string, unknown>;
>   timestamp: number;
> }
> export interface DriftEvent {
>   window_start_round: number;
>   window_end_round: number;
>   trigger_reason: string;
>   reverted_to_checkpoint_hash: string;
> }
> export interface StakeEvent {
>   client_did: string;
>   event_type: "staked" | "slashed" | "restored";
>   amount: number;
>   reason?: string;
>   round_number?: number;
> }
> export interface PassportEntry {
>   device_id: string;
>   event_type: "repair" | "resale" | "refurbishment" | "recycling" | "inspection";
>   evidence_hash: string;
>   model_version_hash: string;
>   ai_prediction?: number;
>   actor_did: string;
>   signature: string;
>   timestamp: number;
> }
> // Frontend-only for now — the real backend does not yet emit granular
> // pipeline-stage events; gateway will need to add this later. Flagged
> // here, not silently assumed.
> export type RoundPipelineStage =
>   | "idle"
>   | "local_training"
>   | "computing_embeddings"
>   | "authenticating"
>   | "aggregating"
>   | "checkpointing"
>   | "drift_check"
>   | "broadcasting";
> ```
> Write `src/types/schemas.test.ts` — a compile-time-only check (TypeScript
> itself is the test here): construct one valid object literal of each
> interface, assign it to a typed `const`, and export nothing (if it
> compiles, the shapes are self-consistent). Run `npx tsc --noEmit`, print
> `[CD1] typecheck_passes=<bool>` then `[CD1] STATUS=PASS/FAIL`.

**Commit:** `[CD1] TypeScript types mirroring shared/interfaces/schemas.py`

## Story CD2 — Mock round feed (the single data source every panel reads from)

**Prompt for Muse Spark:**
> Write `src/mock/roundFeed.ts`: a deterministic, pre-generated 20-round
> scenario for ONE client (`client_did = "did:example:client-3"`,
> mirroring the fl-orchestrator's own C5 test scenario) — rounds 1-11
> clean/honest, rounds 12-20 with this client's own `SuspicionScore`
> showing a spike (`combined_score` jumping from the ~7.8-9.7 honest band
> to ~25-26, `passed: false`) consistent with the REAL calibrated numbers
> already measured in Story B4.5 (`calibrated_threshold ≈ 9.98`) — use
> those actual numbers, don't invent new ones. Generate: an array of 20
> `SuspicionScore` objects (one per round, for this client), an array of
> `Checkpoint` objects (one full snapshot per round, `parent_hash` chained
> round-to-round exactly like Story D2.5's real behavior, `is_delta:
> false` throughout per that story's design), a couple of `StakeEvent`
> entries (e.g. a `"staked"` event at round 1, a `"slashed"` event
> triggered at round 12 when this client first fails), and 2-3
> `PassportEntry` objects this client has submitted at arbitrary rounds.
> Also generate the `RoundPipelineStage` sequence this client cycles
> through EVERY round (`idle → local_training → computing_embeddings →
> authenticating → aggregating → checkpointing → drift_check →
> broadcasting → idle`), each stage lasting a fixed mock duration (e.g.
> 800ms) — this is what CD3's flowchart will animate through.
>
> Write `src/mock/useRoundFeed.ts`: a React hook
> `useRoundFeed()` returning `{ currentRound: number, currentStage:
> RoundPipelineStage, isPlaying: boolean, play: () => void, pause: () =>
> void, reset: () => void, step: () => void, suspicionHistory:
> SuspicionScore[], checkpoints: Checkpoint[], stakeEvents: StakeEvent[],
> passportEntries: PassportEntry[] }`. When playing, it advances through
> the pre-generated pipeline-stage sequence on the fixed mock interval,
> incrementing `currentRound` each time it completes a full stage cycle,
> and exposes only the slice of `suspicionHistory`/`checkpoints`/etc. up
> to `currentRound` (so panels genuinely show data "as of now," not the
> whole future scenario at once — this is what makes replay mode feel
> live). `step()` advances exactly one stage without needing `isPlaying`.
> `reset()` returns to round 0/`idle`. **This hook is the ONLY thing every
> other component in this epic is allowed to read scenario data from — no
> component should import `roundFeed.ts` directly.** This is the single
> swap point: replacing this hook's internals with real gateway polling
> later requires no changes to any component that consumes it.
> Write `src/mock/useRoundFeed.test.ts`: render the hook (via
> `@testing-library/react`'s `renderHook`), call `step()` 9 times (one full
> stage cycle), assert `currentRound` incremented by exactly 1 and
> `currentStage` returned to `"idle"`; assert `suspicionHistory` length
> grows by exactly 1 per completed round, never more; call `reset()`,
> assert `currentRound === 0`. Print `[CD2] stage_cycle_correct=<bool>
> history_length_matches_round=<bool> reset_works=<bool>` then
> `[CD2] STATUS=PASS/FAIL`.

**Commit:** `[CD2] Mock round feed + useRoundFeed hook`

## Story CD3 — My Round Pipeline flowchart

**Prompt for Muse Spark:**
> Write `src/components/PipelineFlowchart.tsx` using `@xyflow/react`: 8
> nodes in a horizontal flow, one per `RoundPipelineStage` (excluding
> `"idle"`), connected in sequence with directed edges. Consume
> `currentStage` from `useRoundFeed()` (Story CD2) — the node matching
> `currentStage` gets a visually distinct highlighted style (different
> fill color, a `framer-motion` pulse/glow animation) applied via a
> conditional className or style prop; all other nodes stay in a neutral
> "not yet reached" or "already completed" style depending on whether
> their stage index is before or after the current one in the sequence
> (so completed stages look visually different from not-yet-reached ones,
> not just "not currently highlighted"). Each node's label is 1-3 words
> max (e.g. "Local Training", "Authenticating") — no paragraph
> descriptions on the diagram itself; put a small `title` tooltip
> attribute with one sentence for hover, per the "minimal text on the
> diagram, more on hover" rule from the brainstorm. Write
> `src/components/PipelineFlowchart.test.tsx`: render with the mock feed's
> `step()` called a few times, assert the node corresponding to the
> current stage has the highlighted CSS class/style applied and the
> previous stage's node does not. Print `[CD3] correct_node_highlighted=<bool>`
> then `[CD3] STATUS=PASS/FAIL`. Also print
> `[CD3] manual_check_needed=confirm the pulse animation reads as "active"
> at a glance, not distracting` — this part needs your eyes, not a test.

**Commit:** `[CD3] Animated round-pipeline flowchart`

## Story CD4 — My Suspicion History chart

**Prompt for Muse Spark:**
> Write `src/components/SuspicionHistoryChart.tsx` using `recharts`: a
> `LineChart` of `combined_score` per round from `useRoundFeed()`'s
> `suspicionHistory`, X axis = `round_number`, a horizontal
> `ReferenceLine` at the calibrated threshold (`y=9.9817...`, the real
> Story B4.5 number — import it as a named constant, do not hardcode it
> inline in multiple places), points colored per `passed` (green if true,
> red if false). Clicking a point opens an expanded panel below the chart
> showing that round's `outlier_fraction`, `mean_shift`,
> `micro_cluster_score` as three small labeled bars or numbers — this is
> the "why was I accepted/rejected" breakdown. Write
> `src/components/SuspicionHistoryChart.test.tsx`: render with the mock
> feed advanced to round 15 (past the attacker-activation point), assert
> the chart shows 15 data points, assert clicking the round-15 point
> reveals its three component values matching the mock data exactly.
> Print `[CD4] point_count_correct=<bool> click_expand_correct=<bool>`
> then `[CD4] STATUS=PASS/FAIL`.

**Commit:** `[CD4] Suspicion history chart with per-round breakdown`

## Story CD5 — My Standing vs. the Fleet

**Prompt for Muse Spark:**
> Write `src/components/FleetStanding.tsx`: since `useRoundFeed()` (Story
> CD2) only generates data for ONE client, extend `roundFeed.ts` (Story
> CD2, revise it — this is expected, not a new story, since CD5 needs
> fleet-wide context CD2 didn't originally include) to also generate 7
> additional honest clients' `combined_score` per round using the REAL
> honest-band numbers from the B4.5 diagnostic (`7.8-9.7` range,
> mirroring the actual 8 values already measured:
> `[8.9265, 7.7989, 8.6812, 9.7005, 8.2001, 7.8533, 9.3369, 8.5529]`).
> Add `fleetScoresThisRound: number[]` to `useRoundFeed()`'s return value.
> `FleetStanding.tsx` computes and displays this client's percentile rank
> among the 8 for the current round (e.g. "lower than 6 of 8 clients this
> round") as a simple horizontal bar/gauge, with no other client's
> identity shown — anonymized by design. Write
> `src/components/FleetStanding.test.tsx`: at round 15 (client-3
> poisoned), assert the percentile calculation places client-3's score
> correctly relative to the known fleet numbers (it should rank highest/
> most-suspicious). Print `[CD5] percentile_correct=<bool>` then
> `[CD5] STATUS=PASS/FAIL`.

**Commit:** `[CD5] Fleet-standing percentile panel (+ fleet data added to mock feed)`

## Story CD6 — My Stake & Trust

**Prompt for Muse Spark:**
> Write `src/components/StakeTrustPanel.tsx`: current stake balance
> (running total from `useRoundFeed()`'s `stakeEvents`, up to
> `currentRound`), a horizontal timeline strip of stake events
> (staked/slashed/restored, color-coded), and a simple trust gauge
> computed as `(rounds passed) / (rounds participated so far)` as a
> percentage. Write `src/components/StakeTrustPanel.test.tsx`: at round 20,
> assert the running balance reflects the mock `stakeEvents` exactly
> (initial stake minus the round-12 slash), assert the trust percentage
> equals `11/20` (11 passing rounds out of 20 total, per the mock
> scenario's honest-then-poisoned pattern). Print
> `[CD6] balance_correct=<bool> trust_pct_correct=<bool>` then
> `[CD6] STATUS=PASS/FAIL`.

**Commit:** `[CD6] Stake & trust panel`

## Story CD7 — My Contribution Volume

**Prompt for Muse Spark:**
> Write `src/components/ContributionVolume.tsx`: cumulative "images
> examined" and "anomalies detected" counters for this client (extend
> `roundFeed.ts` once more — add `images_examined_this_round: number` and
> `anomalies_detected_this_round: number` to the mock per-round data,
> reasonable placeholder numbers, e.g. 50 images/round with anomaly counts
> in the low single digits — clearly commented as placeholder pending the
> real vision model), shown as running totals plus a small bar chart of
> per-round anomaly counts. Write
> `src/components/ContributionVolume.test.tsx`: assert the cumulative
> totals at round 10 equal the sum of the first 10 mock rounds' values
> exactly. Print `[CD7] cumulative_totals_correct=<bool>` then
> `[CD7] STATUS=PASS/FAIL`.

**Commit:** `[CD7] Contribution volume panel`

## Story CD8 — Passport Submissions + Device Lookup

**Prompt for Muse Spark:**
> Write `src/components/PassportSubmissions.tsx`: a list of this client's
> own `passportEntries` from `useRoundFeed()`, each row showing
> `event_type`, `evidence_hash` (truncated with a "copy full hash" button),
> `timestamp`. Write `src/components/DeviceLookup.tsx`: a search input;
> since there's no real device database yet, searching matches against
> the mock `passportEntries`' `device_id`s only (case-insensitive
> substring match) and displays matching entries in the same row format —
> comment clearly that a real implementation would call
> `provenance-api`'s `get_passport_history` (Story P2) via gateway, not
> search a local array. Write component tests for both: submit list
> renders all mock entries; device search returns only matching entries
> and an empty state for a non-matching query. Print
> `[CD8] submissions_render_correct=<bool> search_filters_correct=<bool>
> empty_state_shown=<bool>` then `[CD8] STATUS=PASS/FAIL`.

**Commit:** `[CD8] Passport submissions list + device lookup search`

## Story CD9 — App shell, teacher mode, shared legend

**Prompt for Muse Spark:**
> Write `src/components/Legend.tsx`: a small fixed-position legend —
> green=pass/healthy, red=fail/slashed, amber=pending/disputed — used
> consistently by every panel built so far (go back and confirm CD3-CD8's
> color choices actually match this legend; fix any that don't rather
> than leaving the legend aspirational). Write
> `src/components/TeacherModeToggle.tsx`: a toggle that, when on, adds a
> `teacher-mode` class to the app root; add CSS rules (Tailwind
> `@layer` or plain CSS) that increase font sizes and add labeled
> annotation callouts on at least the `PipelineFlowchart` and
> `SuspicionHistoryChart` components when that class is present — this is
> the presentation-mode layer for your evaluation, not a separate app.
> Write `src/App.tsx`: single-page layout assembling every component
> from CD3-CD8 plus the play/pause/step/reset controls from
> `useRoundFeed()` (Story CD2) exposed as visible buttons, plus `Legend`
> and `TeacherModeToggle`. Write `src/App.test.tsx`: render the full app,
> assert every panel from CD3-CD8 is present in the DOM, assert clicking
> "play" then waiting advances `currentRound` (use Vitest's fake timers
> rather than a real 800ms wait). Print `[CD9] all_panels_present=<bool>
> play_advances_round=<bool>` then `[CD9] STATUS=PASS/FAIL`. Also print
> `[CD9] manual_check_needed=confirm teacher mode visually reads as a
> clear presentation layer, not just slightly bigger text`.

**Commit:** `[CD9] App shell, teacher mode, shared legend`

## Story CD10 — Full regression suite

**Prompt for Muse Spark:**
> Run `npx vitest run` for the whole `dashboard-client/` project. Print
> `[CD10] total=<N> passed=<N> failed=<N>` then `[CD10] STATUS=PASS` only
> if `failed == 0`. Also run `npx tsc --noEmit` one more time across the
> whole project and print `[CD10] typecheck_clean=<bool>`.

**Commit:** `[CD10] dashboard-client full test suite green`

---

## What's deferred to Epic SD (Server Dashboard) or later

- All server-side panels from the brainstorm (Living System Map, Suspicion
  Heatmap, FedAvg visualizer, Checkpoint Hash-Chain Graph, Blockchain
  Explorer, Dispute Kanban, Staking Economics, system-wide Provenance
  Ledger) — none of them are built here.
- A real gateway-backed data source, replacing `useRoundFeed()`'s mock
  internals — noted as the single swap point (Story CD2), not attempted
  yet since gateway doesn't exist.
- `RoundPipelineStage` becoming a real backend-emitted signal rather than
  a frontend-only mock sequence — depends on gateway's eventual design.
- Culprit-attribution UI anywhere — on hold per your standing call.
