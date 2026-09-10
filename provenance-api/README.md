# provenance-api

Downstream device/component lifecycle passport. Depends only on
blockchain/, not on the FL system at all — fully buildable in parallel.

## Build now
- CRUD-ish API over `PassportEntry` (see shared/interfaces/schemas.py):
  submit lifecycle event -> hash evidence -> write to blockchain/client ->
  return passport lookup by device_id.
- No vision model dependency whatsoever.
