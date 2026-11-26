# External service availability

## Chess.com game links

The import function caps concurrent lookups within each running instance, respects upstream rate-limit responses, and cancels work when the client disconnects. The function deadline is 12 seconds, with an 8-second lookup deadline. The per-instance cap complements a shared limit at the edge.

In Vercel Firewall, review the existing rule for the exact path `/api/import-pgn` with the `GET` method. If a rule is missing, start with a fixed window of 12 requests per 60 seconds keyed by IP. Monitor normal import success and 429 responses after enabling it and adjust based on observed traffic. This policy applies only to the Chess.com link endpoint. Users can still import PGN directly when a lookup is limited. [Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)

## Cloud archive creation

The migration allows up to three new archives per source network per UTC day. It leaves reads and writes to existing archives outside that creation allowance and preserves the existing overall storage and retention limits. It uses the Cloudflare-supplied client address on the hosted Supabase Data API. It stores a daily hash of the IPv4 address or IPv6 /64 and removes older buckets the next time an archive is created. New archive creation returns 503 when gateway origin metadata is unavailable, so a missing header cannot silently disable the creation cap. [Supabase API logs fields](https://supabase.com/kb/troubleshooting/discovering-and-interpreting-api-errors-in-the-logs-7xREI9) · [Cloudflare HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)

Before applying the migration to production, verify in a Supabase staging project that a normal browser sync receives the gateway address and can create, read, and update a test archive. Deploy the client change first so 429 responses have a readable message. Then apply the migration and monitor creation errors. If the hosted gateway does not provide the address, stop the rollout. The new trigger can be disabled independently while diagnosing the gateway, and the existing archive function and records remain in place.
