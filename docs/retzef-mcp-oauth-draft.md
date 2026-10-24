# Retzef MCP OAuth — feature-branch implementation

Status: implementation draft on `feature/retzef-mcp-oauth-draft`. It is not deployed and must not be advertised as a live OAuth service until preview integration tests pass.

## Routes added

- `GET/POST /api/oauth/authorize`: verifies the signed Retzef session, checks the stored profile and banned status, validates the OAuth request, renders a consent page, and issues a short-lived authorization code after approval.
- `POST /api/oauth/token`: redeems authorization codes with PKCE S256 and issues opaque bearer access tokens.
- `POST /api/mcp`: authenticated JSON-RPC MCP endpoint with read-only tools `retzef_get_my_profile` and `retzef_get_my_tiktok_status`.
- `/.well-known/oauth-authorization-server` (implemented under `api/.well-known/oauth-authorization-server.js`) and `/.well-known/oauth-protected-resource` (under `api/.well-known/oauth-protected-resource.js`): metadata endpoints.
- `lib/retzef-mcp-session.js`: HMAC-signed, HttpOnly, Secure, SameSite=Lax session cookie primitive. TikTok callback now issues this cookie only after profile storage succeeds and only when a strong session secret is configured. The old `retzef_profile_id` cookie is retained for site compatibility but is never trusted by MCP OAuth.

## Required Vercel environment variables

- `RETZEF_SESSION_SECRET`: at least 32 bytes of random secret material. Generate a new unique value; never reuse a public string or commit it.
- `RETZEF_MCP_CLIENT_ID`: a client identifier for the registered MCP client.
- `RETZEF_MCP_REDIRECT_URIS`: exact comma-separated HTTPS redirect URI(s) registered for that client. Copy these from the MCP client configuration; do not guess them.
- `RETZEF_MCP_AUDIENCE`: optional; defaults to `https://chi-liart-74.vercel.app/api/mcp`.
- Existing `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or the supported Upstash aliases) must be configured.

Do not set production values or deploy until the exact ChatGPT redirect URI is known and reviewed. No secret values belong in source control.

## Security controls

- Authorization code is opaque, hashed at rest, expires after 90 seconds, and is bound to exact client ID, redirect URI, PKCE S256 challenge, subject, audience, scopes and state.
- Code consumption is atomic through a single Upstash Lua `EVAL` operation. It must not be replaced with separate GET and DEL calls.
- Access tokens are opaque; only their SHA-256 digest is stored. Access tokens expire after 10 minutes and are bound to an audience and allowlisted scopes.
- The OAuth authorization route derives identity from the signed session cookie, checks the stored profile and rejects banned accounts. It does not trust browser-supplied usernames or the legacy unsigned username cookie.
- The consent form uses a one-time CSRF value bound to the session and a five-minute pending request.
- The MCP endpoint does not accept identity or scopes from tool arguments. It returns only the authenticated user's profile and TikTok connection status.

## Still required before production

1. Configure the exact ChatGPT OAuth redirect URI and test the complete browser handshake against a preview deployment.
2. Confirm Vercel routing for both `.well-known` endpoints and test the actual OAuth metadata URLs.
3. Verify the deployment environment has the session secret and Redis variables without printing them.
4. Add rate limits for authorization and token endpoints, plus operational monitoring without logging credentials.
5. Add end-to-end tests for real Upstash behavior, code replay, expired/revoked tokens, banned accounts, cross-user access and the actual ChatGPT MCP handshake.
6. Review MCP transport compatibility with the current ChatGPT client requirements. The endpoint currently implements authenticated JSON-RPC over POST; full Streamable HTTP compatibility and optional transport methods still need integration verification.
7. Review the allowed Origin policy against actual MCP client behavior before production.
8. Only merge and deploy after explicit review and approval.

## Run unit tests

`node --test test/retzef-mcp-security.test.js test/retzef-mcp-core.test.js test/retzef-mcp-token-store.test.js test/retzef-mcp-oauth-codes.test.js test/retzef-mcp-upstash.test.js test/retzef-mcp-session.test.js test/retzef-mcp-oauth-config.test.js`

Unit tests use mocks and do not contact the live database or ChatGPT. A green CI run is not proof of a successful live OAuth handshake.
