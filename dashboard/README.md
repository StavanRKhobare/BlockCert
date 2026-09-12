# dashboard

Visualizes: per-round suspicion scores, drift/rollback events and their
attributed culprit, stake balances and disputes, provenance passport
lookup. Talks only to gateway/'s API — build against its mock-backed
responses now, nothing changes when the real model is plugged in.

## Build Log

- [CD0] dashboard-client project setup (scaffolded at `dashboard/client/` per user call — Vite react-ts, Tailwind v3 pinned, recharts + @xyflow/react + framer-motion, Vitest + RTL + jsdom; `vite.config.ts` test env jsdom + globals) — files: `dashboard/client/` scaffold + config (`vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `src/test/setup.ts`, `src/App.test.tsx`, `.gitignore`). Note: deviates from prompt's top-level `dashboard-client/` path by user decision.
