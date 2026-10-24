# Retzef MCP OAuth draft — implementation notes

Status: isolated draft on `feature/retzef-mcp-oauth-draft`. This is not a working OAuth server and must not be advertised as one.

## Included

- Security primitives for opaque tokens, SHA-256 token digests, strict Bearer parsing, PKCE S256, scope allowlisting, HTTPS redirect validation and bounded expiry.
- A read-only JSON-RPC MCP core with authenticated profile and TikTok-status tool contracts.
- A fail-closed access-token validator that looks up only a SHA-256 token digest in an injected Redis-compatible store, then checks subject, expiry, revocation, audience and allowlisted scopes.
- An isolated authorization-code issuer/redeemer; codes expire after 90 seconds and bind client, exact redirect URI, PKCE challenge, subject, audience and scopes.
- An Upstash REST adapter for GET, SET with TTL/NX, and atomic one-time code consumption via a single Lua EVAL request.
- Node unit tests and GitHub Actions tests.

## Upstash adapter

`lib/retzef-mcp-upstash.js` reads `KV_REST_API_URL` / `UPSTASH_REDIS_REST_URL` and `KV_REST_API_TOKEN` / `UPSTASH_REDIS_REST_TOKEN` by default. It only accepts HTTPS URLs and never logs credentials. The `consume(key)` method runs a short Lua script using EVAL to read and delete a one-time code atomically. Do not replace this with separate GET and DEL calls.

The adapter is not connected to any public route yet. Unit tests use a mocked fetch; they do not contact the live database.

## Token record contract

The token store expects a Redis-compatible `get(key)` function. It looks up `retzef:mcp:access:<sha256-hex-of-opaque-token>`. The stored JSON record must contain `subject`, `scopes`, `audience`, `expiresAt` (Unix seconds), and optionally `revoked`. Store only token digests, never raw bearer tokens. The authorization issuer must create this record only after a valid authorization-code + PKCE flow.

## Required before connecting to the live site

1. Implement and validate a real user login/session for OAuth. Do not trust the client-readable `retzef_profile_id` cookie as authentication; it is an unsigned username, not proof of identity.
2. Add a browser authorization route with state/CSRF protections, explicit consent, exact registered redirect URI matching, and rate limits. Derive the subject only from a verified server-side session, never request input.
3. Add code redemption and access-token issuance, with atomic code consumption, short-lived tokens and revocation.
4. Register trusted OAuth clients and resource audiences; implement authorization-server and protected-resource metadata.
5. Implement the MCP Streamable HTTP endpoint with bounded JSON-RPC bodies, Origin/Host checks, CORS allowlisting, timeouts and explicit method handling.
6. Defensively resolve client metadata URLs: HTTPS only, validate DNS answers against loopback/private/link-local/reserved ranges, re-check redirects (prefer disabling redirects), and enforce response/time/size caps to prevent SSRF.
7. Use preview-only secrets and preview deployments. Never log bearer tokens, authorization codes, client secrets or PKCE verifiers.
8. Add integration tests for Redis atomicity, replay, wrong audience/scope, expired/revoked tokens, banned users, cross-user access and an actual ChatGPT OAuth handshake.
9. Only enable production after explicit review and approval.

## Security note

These helpers are not a complete OAuth implementation. They do not authenticate the end user, render consent, register clients, mint access tokens, or expose HTTP endpoints. The JSON-RPC core requires a trusted server-side `context.auth`; never accept an auth object supplied by a client. Do not mount it on a public route until the full flow is implemented and tested.

## Run tests

`node --test test/retzef-mcp-security.test.js test/retzef-mcp-core.test.js test/retzef-mcp-token-store.test.js test/retzef-mcp-oauth-codes.test.js test/retzef-mcp-upstash.test.js`
