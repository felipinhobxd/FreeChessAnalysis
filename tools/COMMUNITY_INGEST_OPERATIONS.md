# Community full-game ingest operations

## Request path

The browser sends opted-in, imported-game samples to the `ingest-review` Edge Function. The function validates the request and legal chess mainline, derives a subnet bucket from the trusted `cf-connecting-ip` header, HMACs client/network/game identifiers with the server-side secret, and calls the private Postgres RPC using the service-role key.

The service-role key must remain exclusively in Supabase Edge Function secrets. Never add it to `dist/`, a public environment variable, a test fixture, or a client bundle.

## Current safeguards

| Boundary | Value / behavior |
| --- | --- |
| Request body | 128 KiB maximum |
| Samples per request | 1 to 5 |
| Game mainline | 8 to 500 plies |
| Per-client quota | 100 new samples per UTC day |
| Per-subnet quota | 500 new samples per UTC day |
| Subnet grouping | IPv4 /24, IPv6 /64 |
| Dataset capacity | 40,000 game samples |
| Retention | 180 days |
| Database RPC timeout | 8 seconds |
| Retry response | HTTP 429 with `Retry-After` until the next UTC day |
| Database access | `service_role` only; no anonymous or authenticated table access |

The public Edge Function currently uses `verify_jwt=false` by design. Its publishable API key and Origin allowlist are browser-request controls, not user authentication: non-browser clients can reproduce those headers. Abuse resistance therefore relies on strict validation, trusted edge IP subnet quotas, per-client quotas, request size limits, and database-side capacity/retention controls. The per-client UUID can be reset by a hostile client and is not an identity credential.

## Data trust boundary

The server verifies that each recorded UCI mainline is legal and that packed move metadata, classification counts, hashes, and adjacent position scores are structurally consistent. These checks do not prove Stockfish produced the submitted evaluations. Treat engine scores, classifications, accuracy, estimates, and PGN ratings as unverified client submissions unless a future server-side reanalysis or trusted attestation marks them verified.

## CI and deployment checks

The repository CI runs:
- Node unit tests, including HTTP request/response tests with an injected PostgREST boundary
- Playwright Chromium end-to-end tests for the application
- PostgreSQL integration tests for the migrations/RPC
- `deno check` for the deployed Edge Function entrypoint and its Deno/NPM import map

Before deploying a new function version, verify that the production migrations include the 40,000-row capacity and 180-day retention policy, confirm the required Supabase secrets exist, and verify that `cf-connecting-ip` is present in hosted Edge Function requests. Deploy all files in `supabase/functions/ingest-review/`, not just `index.ts`.

A deployment is a separate production action. A green GitHub/Vercel status does not mean the Supabase Edge Function has been deployed.
