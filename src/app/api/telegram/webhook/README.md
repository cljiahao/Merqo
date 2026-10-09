# Telegram webhook

POST receives updates for Merqo's shared customer and vendor bot. Verify the configured webhook secret with a constant-time comparison before parsing the body or creating a database client.

/start resolves an unexpired link token, then deletes and returns it before linking the customer or vendor. Concurrent deliveries compete for the same row. Failed linking after token consumption requires a fresh link; malformed payloads, unsupported commands and /start failures are acknowledged with 200.

/privacy sends the published notice links. /stop clears customer consent and pending notification references through the service-only RPC. A failed consent write returns 503 so Telegram retries the idempotent withdrawal; successful withdrawal returns 200. Missing, incorrect or unconfigured webhook authentication returns 401.

route.test.ts covers authorization, token races, both link kinds, malformed updates, privacy replies and consent-write failure retries. The connection tables remain server-owned; notification endpoints resolve only consenting customers.
