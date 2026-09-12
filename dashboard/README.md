# dashboard

Visualizes: per-round suspicion scores, drift/rollback events and their
attributed culprit, stake balances and disputes, provenance passport
lookup. Talks only to gateway/'s API — build against its mock-backed
responses now, nothing changes when the real model is plugged in.

## Build Log

- [CD0] dashboard-client project setup (scaffolded at `dashboard/client/` per user call — Vite react-ts, Tailwind v3 pinned, recharts + @xyflow/react + framer-motion, Vitest + RTL + jsdom; `vite.config.ts` test env jsdom + globals) — files: `dashboard/client/` scaffold + config (`vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `src/test/setup.ts`, `src/App.test.tsx`, `.gitignore`). Note: deviates from prompt's top-level `dashboard-client/` path by user decision.
- [CD1] TypeScript types mirroring shared/interfaces/schemas.py (snake_case preserved, zero-translation-layer) — files: `dashboard/client/src/types/schemas.ts`, `dashboard/client/src/types/schemas.test.ts`. Note: one trivial runtime `it` added to the test file only because Vitest fails a test file with zero tests; the real check remains `tsc --noEmit`.
- [CD2] Mock round feed + useRoundFeed hook (single data source; slices expose only completed rounds) — files: `dashboard/client/src/mock/roundFeed.ts`, `dashboard/client/src/mock/useRoundFeed.ts`, `dashboard/client/src/mock/useRoundFeed.test.ts`. Notes: (a) step-cycle is 8 steps/round (7 stages + idle), not the prompt's "9 times", per user decision; (b) suspicion tuples are REAL measured auth-pipeline values (honest 7.78-9.37, poisoned 25.49-26.39, threshold 9.98), hashes are documented precomputed sha256; reference accuracy series + ai_predictions are illustrative mock dressing, flagged in-file.
