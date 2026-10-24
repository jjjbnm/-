# Retzef MCP OAuth draft — implementation notes

Status: isolated draft on `feature/retzef-mcp-oauth-draft`. This is not a working OAuth server and must not be advertised as one.

## Included

- Security primitives for opaque tokens, SHA-256 token digests, strict Bearer parsing, PKCE S256, scope allowlisting, HTTPS redirect validation and bounded expiry.
- A read-only JSON-RPC MCP core with authenticated profile and TikTok-status tool contracts.
- A fail-closed access-token validator that looks up only a SHA-256 token digest in an injected Redis-compatible store, then checks subject, expiry, revocation, audience and allowlisted scopes.
- Node unit tests and a GitHub Actions workflow for the draft.

## Token record contract

The token store expects a Redis-compatible `get(key)` function. It looks up `retzef:mcp:access:<sha256-hex-of-opaque-token>`. The stored JSON record must contain `subject`, `scopes`, `audience`, `expiresAt` (Unix seconds), and optionally `revoked`. Store only token digests, never raw bearer tokens. The authorization issuer must create this record only after a valid authorization-code + PKCE flow and must atomically consume one-time codes.

## Required before connecting to the live site

1. Review existing login, profile storage, banned-account handling, and Vercel route conventions. Do not use the site's client-readable `retzef_profile_id` cookie as authentication.
2. Implement a separate OAuth authorization server with authorization-code flow, PKCE S256, exact registered redirect URI matching, state, consent, CSRF protections, rate limits, and short-lived single-use authorization codes.
3. Implement code redemption atomically and bind codes to client, redirect URI, PKCE challenge, user subject, resource audience, and granted scopes.
4. Add protected-resource and authorization-server metadata endpoints and validate resource/audience requirements for the MCP client.
5. Add a Streamable HTTP MCP endpoint with bounded JSON-RPC request bodies, origin/host checks, CORS allowlisting, timeouts and explicit method handling.
6. Defensively resolve client ID metadata URLs: HTTPS only, validate all DNS answers against loopback/private/link-local/reserved ranges, re-check redirects (prefer disabling redirects), and enforce response/time/size caps to prevent SSRF.
7. Use separate preview secrets and a preview deployment. Never log bearer tokens, authorization codes, client secrets or PKCE verifiers.
8. Add integration tests for Redis atomicity, replay, wrong audience/scope, expired/revoked tokens, banned users, cross-user access and actual ChatGPT OAuth handshake.
9. Only enable production after explicit review and approval.

## Security note

These helpers are not a substitute for a complete OAuth implementation. They do not issue tokens, validate user login, connect to Redis by themselves, or implement the MCP HTTP transport. The JSON-RPC core requires a trusted server-side `context.auth`; never accept an auth object supplied by the client. Do not mount it on a public route until the full flow is implemented and tested.

## Run tests

`node --test test/retzef-mcp-security.test.js test/retzef-mcp-core.test.js test/retzef-mcp-token-store.test.js`


## Authorization-code draft (not yet wired to HTTP routes)

Added `lib/retzef-mcp-oauth-codes.js` with an isolated authorization-code issuer and redeemer:
- Codes are high-entropy, opaque, and stored under a SHA-256 digest only.
- Authorization codes expire after 90 seconds and are bound to client ID, exact registered HTTPS redirect URI, PKCE S256 challenge, subject, audience, and allowlisted scopes.
- Redemption requires an injected `redis.consume(key)` operation that atomically reads and deletes the record. Do not implement this as separate GET and DEL operations.
- The module does not authenticate the end user, render consent, register OAuth clients, mint access tokens, or expose HTTP endpoints. It is not production-ready until a real Redis atomic-consume adapter and the full browser OAuth flow are implemented and tested.
- Never trust a browser-supplied subject. The eventual authorization route must derive it from a verified server-side session, not the `retzef_profile_id` cookie.
