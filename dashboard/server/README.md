# dashboard-server

Server Dashboard (Epic SD) — fleet-wide operator view: system pipeline map,
per-client suspicion heatmap, FedAvg aggregation visualizer, drift-monitor
gate + checkpoint hash-chain graph, blockchain explorer (transactions,
disputes, staking economics), provenance ledger, attribution placeholder.

Separate app from `dashboard/client/` (Epic CD) by design — own
package.json, own node_modules, no imports from the client app. Small
shared bits (types, Legend, TeacherModeToggle) are deliberately duplicated
per copy, same philosophy as `passport_client.py` vs. rollback-service's
`chain_client.py`: changing one app never risks breaking the other.

Consistency contract with the client app: both dashboards derive from
identical underlying scenario numbers — the real B4.5 calibrated threshold
(~9.98), the measured 8-client honest-band scores, client-3 turning
poisoned (~25-26) from round 12 onward. See `src/mock/serverFeed.ts`
(SD2) for provenance notes.

## Build Log

- [SD0] dashboard-server project setup (scaffolded at `dashboard/server/` — Vite react-ts, Tailwind v3 pinned, recharts + @xyflow/react + framer-motion, Vitest + RTL + jsdom; `vite.config.ts` test env jsdom + globals; `src/test/setup.ts` ResizeObserver stub carried over from CD for xyflow-in-jsdom; Tailwind directives at top level — CD0's media-query scoping bug not repeated) — files: `dashboard/server/` scaffold + config (`package.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `src/test/setup.ts`, `src/index.css`, `src/App.test.tsx`). Note: deviates from prompt's top-level `dashboard-server/` path the same way CD0 did (`dashboard/client/` precedent).
