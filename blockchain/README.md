# blockchain

Fully standalone from the ML side — build this in parallel with everything
else, starting immediately. See report Section 5.6 for the full
Ethereum-style-testnet vs. Hyperledger-style trade-off; scaffolded here for
a public/testnet-style prototype first (recommended in the report).

## Contracts to build (contracts/)
- `DIDRegistry.sol` — client identity registration.
- `CheckpointAnchor.sol` — records {round_number, weights_hash,
  off_chain_uri} per round; this is the ENTIRE on-chain footprint of the
  rollback mechanism — never weights themselves.
- `Staking.sol` — stake / slash logic.
- `Dispute.sol` — provisional-flag -> challenge-window -> finalize/overturn
  pattern (see report Section 5.6, false-positive handling).
- `Passport.sol` — device lifecycle passport (provenance-api writes here).

## Build now
- `scripts/deploy.py` — deploy all contracts to a local Hardhat/Anvil
  testnet (see infra/docker-compose.yml).
- `client/chain_client.py` — thin Python wrapper (web3.py) other services
  import; e.g. `rollback-service` calls
  `chain_client.anchor_checkpoint(checkpoint)`.
- Everything here is testable today with dummy hashes and dummy DIDs —
  zero dependency on the vision model or even on real training data.

## Build Log

- [A0] Hardhat TypeScript project scaffolded (hardhat 2 + toolbox hh2 + typescript 5, empty contracts/) — files: blockchain/package.json, blockchain/hardhat.config.ts, blockchain/tsconfig.json, blockchain/contracts/ (empty).
- [A1] CheckpointAnchor contract + tests (array-indexed checkpoints, hash+URI only, no access control) — files: blockchain/contracts/CheckpointAnchor.sol, blockchain/test/CheckpointAnchor.test.ts.
- [A2] DIDRegistry contract + tests (unique-DID registration with owner + timestamp) — files: blockchain/contracts/DIDRegistry.sol, blockchain/test/DIDRegistry.test.ts.
- [A3] Staking contract + tests (OZ v5 Ownable, owner-only slash with payout, no dispute logic) — files: blockchain/contracts/Staking.sol, blockchain/test/Staking.test.ts.
- [A4] Dispute contract + tests (provisional-flag -> overturn/finalize, flags never deleted) — files: blockchain/contracts/Dispute.sol, blockchain/test/Dispute.test.ts.
- [A5] Passport contract + tests (validated lifecycle event types, per-device entry index) — files: blockchain/contracts/Passport.sol, blockchain/test/Passport.test.ts.
- [A6] Deployment script writing {address, abi, deployedAt} artifacts to deployments/ (not run; needs a node in A7) — files: blockchain/scripts/deploy.ts, blockchain/package.json.
- [A7] End-to-end deployment smoke test (local node, 5 deployments, CheckpointAnchor round-trip) — files: blockchain/scripts/smoke_test.ts, blockchain/deployments/localhost/*.json.
