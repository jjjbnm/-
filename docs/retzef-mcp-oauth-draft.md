# Retzef MCP OAuth — rebuilt feature-branch implementation

Status: rebuilt on feature/retzef-mcp-oauth-draft; not yet merged or live in Production.

## OAuth flow
- Dynamic Client Registration: POST /api/oauth/register accepts public clients using HTTPS redirect URIs, authorization-code grant, code response, and token_endpoint_auth_method=none.
- Authorization: GET/POST /api/oauth/authorize requires the signed Retzef session, checks the stored profile and banned status, validates the registered client and exact redirect URI, uses PKCE S256, state, a one-time CSRF value, and a five-minute pending request.
- Token: POST /api/oauth/token redeems one-time authorization codes and issues opaque bearer tokens with a 10-minute TTL.
- MCP: POST /api/mcp exposes only authenticated read-only profile and TikTok-status tools.
- Metadata: /.well-known/oauth-authorization-server advertises registration, authorization, and token endpoints; /.well-known/oauth-protected-resource advertises the canonical MCP resource.

## Production configuration
- RETZEF_SESSION_SECRET must be a newly generated random secret with at least 32 bytes of entropy. Configure it in Vercel Production before using OAuth. Never commit or print it.
- Existing Upstash/Redis variables (KV_REST_API_URL and KV_REST_API_TOKEN, or supported aliases) must be present in Production.
- Optional RETZEF_MCP_ISSUER and RETZEF_MCP_AUDIENCE default to https://chi-liart-74.vercel.app and https://chi-liart-74.vercel.app/api/mcp.
- No fixed client ID or guessed ChatGPT callback URL is needed; clients register and receive a unique ID.

## Security
- Only HTTPS redirect URIs are accepted; redirect URI matching is exact.
- Client metadata and pending requests are stored in Redis; client IDs are SHA-256 hashed for Redis keys.
- Authorization codes are short-lived, hashed at rest, bound to client, redirect URI, PKCE, state, audience and scopes, and consumed atomically.
- Access tokens are opaque, hashed at rest, audience-bound and short-lived.
- The unsigned legacy retzef_profile_id cookie is not accepted as an identity credential. MCP OAuth uses the signed retzef_session cookie only.
- Existing TikTok and Discord callback handlers remain intact; only the internal route dispatcher was extended.

## Validation
Run node --test test/retzef-mcp-*.test.js. Unit tests use mocked Redis; green CI is not proof of a live ChatGPT handshake. Before production deployment, verify the Vercel Production session secret, real metadata endpoints, current ChatGPT transport compatibility, and end-to-end authorization/token/tool calls.
