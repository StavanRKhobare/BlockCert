# gateway

FastAPI service that wires fl-orchestrator, auth-service, rollback-service,
attribution-service, blockchain/client, and provenance-api together behind
one API surface and drives the round lifecycle end to end.

## Build last (of the non-vision modules)
Once modules 1-7 (see root README) each work standalone against mocks,
wire them here. This is also what dashboard/ talks to. Because everything
below it is already interface-driven, this can be fully built and
demoed end-to-end BEFORE the real vision model exists.
