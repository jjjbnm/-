# Retzef MCP OAuth draft — implementation notes

Status: isolated draft on `feature/retzef-mcp-oauth-draft`. This is not a working OAuth server and must not be advertised as one.

## Included

- Dependency-free security primitives for opaque tokens, SHA-256 token digests, strict Bearer parsing, PKCE S256, scope allowlisting, HTTPS redirect URI checks, and bounded token expiry.
- A standalone read-only JSON-RPC core for MCP initialization, ping, tool discovery, and two authenticated read-only tool contracts.
- Node built-in tests for the security helpers and JSON-RPC authorization boundaries.

## Required before connecting this to the live site

1. Review existing login, profile storage, banned-account handling, and Vercel route conventions before integrating. Do not use the site's client-readable `retzef_profile_id` cookie as authentication.
2. Add a separate OAuth authorization server with authorization-code flow, PKCE S256, exact registered redirect URI matching, state, consent, CSRF protections, rate limits, and short-lived single-use authorization codes.
3. Store only hashes of opaque authorization codes and access tokens. Consume codes atomically (Redis GETDEL or a Lua compare-and-delete), bind them to client, redirect URI, PKCE challenge, user subject, resource audience, and granted scopes.
4. Add protected-resource and authorization-server metadata endpoints and implement the resource indicator/audience checks required by the chosen MCP client.
5. Add a Streamable HTTP MCP endpoint with JSON-RPC validation, bounded request bodies, origin/host checks, CORS allowlisting, request timeouts, and explicit method handling. Do not expose write/post/delete actions in the first iteration.
6. Resolve Client ID Metadata Document URLs defensively: HTTPS only, validate every DNS result against loopback/private/link-local/reserved ranges, re-check redirects (prefer disabling them), and enforce response/time/size caps to prevent SSRF.
7. Use separate environment secrets and a separate preview deployment. Never log bearer tokens, auth codes, client secrets, or PKCE verifiers.
8. Add integration tests for Redis atomicity, replay attempts, wrong audience, wrong scope, expired/revoked tokens, banned users, cross-user access, malformed JSON-RPC, and the actual ChatGPT OAuth handshake.
9. Only enable production after explicit review and approval.

## Security note

The helper modules are not a substitute for a complete OAuth implementation. They do not issue or validate access tokens, connect to Redis, authenticate users, or implement the MCP HTTP transport. The JSON-RPC core requires a trusted server-side `context.auth`; never pass a client-supplied auth object. Do not mount it on a public route until the complete flow is implemented and tested.

## Run the tests

`node --test test/retzef-mcp-security.test.js test/retzef-mcp-core.test.js`
