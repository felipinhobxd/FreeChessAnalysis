# Community full-game ingest operations

## Request path

The browser sends opted-in, imported-game samples to the `ingest-review` Edge Function. The function validates the request and legal chess mainline, derives a subnet bucket from the trusted `cf-connecting-ip` header, HMACs client/network/game identifiers with the server-side secret, and calls the private Postgres RPC using the service-role key.

The service-role key must remain exclusively in Supabase Edge Function secrets. Never add it to `dist/`, a public environment variable, a test fixture, or a client bundle.

## Current safeguards

| Boundary | Value / behavior |
| --- | --- |
| Request body | 128 KiB maximum |
| Pre-validation request budget | 15 requests per minute per IPv4 /24 or IPv6 /64 subnet |
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

The 128 KiB body limit is enforced while reading the stream, regardless of a missing or understated `Content-Length`; overflow cancels further reads. It limits accumulated body bytes, not the total number or duration of requests.

The daily database quotas still count only new game hashes, preserving duplicate acknowledgements and the existing sample quota contract. A separate shared PostgreSQL request budget now runs before chess replay: it allows up to 15 requests per minute for each trusted IPv4 /24 or IPv6 /64 subnet. This budget counts every request, including invalid submissions and duplicate-only retries, and is independent of the daily new-game quotas. Its HMAC key rotates daily and the minute-window rows are cleaned up by the existing retention job. Because the counter is stored in Postgres, it is shared across Edge Function instances rather than relying on per-isolate memory. The precheck itself still reaches Supabase/Postgres, so it reduces repeated expensive chess replays but does not replace an edge-level WAF or gateway limiter. A provider-level rule can reject abusive traffic before it reaches the function and should be considered as an additional layer.

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

## Platform logging and privacy

The hosted Supabase Edge Function log stream currently includes request metadata such as `cf-connecting-ip`, request IDs, user-agent, and Cloudflare network metadata. The application HMACs the client and subnet identifiers before sending them to Postgres, but that does **not** remove the original request metadata from Supabase's own operational logs.

The privacy notice should distinguish between:
- the community dataset stored by the application (which stores HMAC-protected client/network keys, not plaintext IP addresses); and
- request metadata processed or retained by the hosting provider's operational logging.

Review who can access project logs and the provider's log-retention settings before describing IP handling as anonymous or claiming the IP is never collected.

## User-facing privacy disclosure

The consent screen uses consent revision v3. Earlier accepted choices are not carried forward because the disclosure now explains that Supabase operational logs may include the request IP address and network/request metadata. A refusal in the most recent valid legacy revision remains disabled.

Migration considers the latest valid stored revision (v2 before v1). Its refusal remains disabled; its acceptance requires a fresh v3 choice, even when v1 was declined. Pending samples and stale enabled preferences are cleared before that fresh choice.

The user-facing wording distinguishes two data paths:

- The community game dataset stores HMAC-protected subnet identifiers, not plaintext IP addresses.
- Supabase operational request logs are separate and may contain the source IP and request/network metadata. Their access and retention follow Supabase controls and project settings. Do not promise a specific log-retention period unless it has been independently verified.

The consent copy also distinguishes intermediate FEN positions (not uploaded) from the starting FEN, which is stored only when required to reconstruct a non-standard initial position.
