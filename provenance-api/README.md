# provenance-api

Downstream device/component lifecycle passport. Depends only on
blockchain/, not on the FL system at all — fully buildable in parallel.

## Build now
- CRUD-ish API over `PassportEntry` (see shared/interfaces/schemas.py):
  submit lifecycle event -> hash evidence -> write to blockchain/client ->
  return passport lookup by device_id.
- No vision model dependency whatsoever.

## Build Log

- [P0] Python package setup (requirements incl. web3, importable subpackages, shared/ import path via tests/conftest.py, local .venv, thorough .gitignore) — files: provenance-api/requirements.txt, provenance-api/chain_bridge/__init__.py, provenance-api/tests/__init__.py, provenance-api/tests/conftest.py, provenance-api/.gitignore.
- [P1] Passport chain bridge via PassportClient (live-node integration test, entry IDs from contract events) — files: provenance-api/chain_bridge/passport_client.py, provenance-api/tests/test_passport_client.py.
- [P2] Public entrypoint (fail-fast validation, hashed evidence, chronological history) — files: provenance-api/entrypoint.py, provenance-api/tests/test_entrypoint.py.
