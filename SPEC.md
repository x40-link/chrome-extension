# x40 Chrome extension: implementation handoff

**Status:** Agreed product scope. Implementation may proceed against local mocks. Public Chrome Web Store submission is blocked by the issues in [Release gates](#release-gates).

## Outcome

Build a Chrome Manifest V3 extension for x40 users, including users of self-hosted x40 instances. Its single job is to create a short link. A right-click on a page or link is the immediate path; the toolbar popup offers a small form when the user wants to edit the destination, short-link domain, or slug. The extension never needs link browsing, editing, deletion, history, or analytics.

Deliver source, a reproducible build, automated tests that need no live API, store assets and listing copy, setup instructions, and a reviewable release package. Do not publish or describe a mock-only or otherwise nonfunctional build as ready for the public Store.

## Contract and precedence

1. The source of truth is [the generated OpenAPI 3.1 document on `x40-link/api` main](https://github.com/x40-link/api/blob/main/docs/openapi/x40/link/v1alpha/short_link.openapi.json), verified at commit `e54521f91a0d9199e9b3c1d7a5bb644ca11629e0` on 2026-10-09. Pin the version used by contract tests and recheck it before live integration.
2. Use the [HTTP reference](https://github.com/x40-link/api/blob/main/docs/reference/http.md) and [protobuf source](https://github.com/x40-link/api/blob/main/x40/link/v1alpha/short_link.proto) for semantics the generated schema does not express. The older `x40.link` implementation is historical context, not a substitute for this contract.
3. The OpenAPI document has no `servers`, `securitySchemes`, or operation `security`. The protobuf declares the Create scope, but token acquisition, issuer, audience, client registration, and self-hosted identity discovery remain undefined. Track this in [API issue #14](https://github.com/x40-link/api/issues/14); do not invent an OAuth flow in this extension.
4. The hosted API base URL is initially `https://api.x40.link`, based on the existing service configuration. Treat it as a configurable product default, not a `servers` value supplied by OpenAPI. The hosted default short-link domain is **`x40.link`**.

## User journeys

### First use and settings

- Show a concise setup state before any create action can run. Prefill the hosted API base URL and `x40.link` as the default short-link domain. Let users replace both independently for one active self-hosted instance.
- Provide a field to paste a valid bearer token. There is no in-extension OAuth flow in this version. Explain that the token must authorize `CreateShortLink`; avoid claiming that the extension can issue one.
- Persist configuration and, for this development phase, the manually entered token across browser restarts in local extension storage. This is an explicit interim choice, **not a publish-ready credential-storage resolution**. See [Release gates](#release-gates).
- When the API origin changes, request its exact host permission first. On a successful switch, clear the old token before any request can go to the new origin. A denied permission leaves the previous working configuration and token intact.
- The published build accepts HTTPS API URLs only. Unpacked development builds may also accept loopback HTTP (`localhost` or `127.0.0.1`) for the local mock. Reject credentials in URLs, URL fragments, and unexpected path/query components of an API base URL. Normalize a trailing slash.
- Validate a default domain as a hostname without a scheme, path, query, or port. Domain ownership is determined by the API on Create; there is no domain-discovery endpoint to call.
- Provide a clear sign-out/reset action that deletes the token and transient result data. Do not use `chrome.storage.sync` for credentials.

### Right-click: immediate creation

- Offer **Shorten this page** for page context and **Shorten this link** for link context. The link item uses the clicked link target; the page item uses the page URL. Do not shorten selected text.
- Submit the exact captured HTTP(S) destination, including its query string and fragment. Do not strip tracking parameters or rewrite the destination. Never send `chrome:`, `file:`, `data:`, or other non-HTTP(S) URLs to the API.
- Use the configured default domain and omit `path` to request a generated suffix. Do not open a confirmation form before this request.
- On success, attempt to copy the server-returned `shortUrl`, then show a **system notification** containing that URL and either “Copied” or a **Copy** action if copying failed. Use the x40 icon and concise copy; the operating system controls the notification's appearance. If notifications are suppressed by the OS, keep the result reachable from the toolbar and show a brief action-badge state.
- On failure, show a clear system notification. Its **Open form** action opens the same editor with the original destination prefilled. Do not claim success, copy a guessed URL, or discard the destination.

### Toolbar popup: custom creation

- The toolbar action opens a compact form with **Destination URL** (prefilled with the active page's HTTP(S) URL when available), **Short domain** (prefilled from settings), and **Slug** (optional). Users can paste or edit any destination.
- Empty Slug omits the API `path` field and asks the server to generate one. A nonempty slug maps to a source path beginning with `/`; preserve the user's significant path characters and avoid double encoding. The API is authoritative for canonicalization and conflicts. The UI should explain that a custom path may already be taken.
- Show inline validation for malformed destination, domain, and slug; disable duplicate submission while a request is active. Do not use a separate validation request before Create unless it helps a concrete interaction and is covered by tests.
- On success, show the returned `shortUrl` in a result area with Copy and Open actions, attempt automatic copy, and show the same system notification used by right-click. Do not create a persistent link history.
- On an API or network failure, retain all form fields and map known errors to the relevant input or credential setting. Offer retry for recoverable failures. Long URLs and long server messages must not break the popup.

## HTTP integration

Only `CreateShortLink` is in scope. Build one typed API adapter so popup and context-menu actions use the same request, response, cancellation, timeout, and error handling.

```http
POST {apiBaseUrl}/v1alpha/domains/{domain}/shortLinks?requestId={uuid}
Authorization: Bearer {token}
Content-Type: application/json

{"destinationUrl":"https://example.org/article?ref=mail#section"}
```

For a custom slug, include `"path":"/chosen-slug"` in the **same unwrapped ShortLink JSON body**. The generated OpenAPI placeholder is named `{parent}` but occupies only the single domain segment in this route; do not substitute `domains/example.com` into it. Percent-encode path and query values correctly. The result is a ShortLink JSON object; use its server-computed `shortUrl`, never a locally assembled short URL. Require an HTTP(S) `shortUrl` and show a recoverable protocol error if the response is malformed. In production the API defines `shortUrl` as canonical HTTPS.

The declared scope is `api.x40.link/scopes/x40.link.v1alpha.ShortLinkService.CreateShortLink`. Do not request List/Get/Update/Delete scopes or endpoints. `destinationUrl` is required. Omitted `path` generates an unused suffix; explicit `/` claims the root path. The API returns a synchronous result and the public redirect is a separate 307 endpoint.

Generate a `requestId` of at most 36 ASCII characters once per user submission. Reuse that value when retrying a request whose response may have been lost; create a new value for a new submission. The contract retains successful idempotent results for 24 hours. Do not automatically retry a confirmed validation or authorization failure. Handle HTTP status, `google.rpc.Status` when present, non-JSON error bodies, timeouts, and offline conditions. The OpenAPI does not enumerate status mappings; avoid coupling user messages to one undocumented HTTP code. In particular, handle duplicate custom paths, domain access denial, invalid/expired tokens, and missing Create scope without losing form input.

## Local mock and testing

- Include a local, deterministic HTTP mock for the Create route, with configurable port and resettable state. It accepts a documented **test-only** bearer token, applies domain/path validation and authorization fixtures, generates a suffix when `path` is absent, rejects duplicate explicit paths, supports `requestId` replay, and returns the documented ShortLink shape or `google.rpc.Status` errors.
- The mock also serves a redirect endpoint so tests can follow a created link and observe a 307 to the exact destination. Loopback HTTP and loopback short URLs are allowed only for local tests; production must trust the API's canonical HTTPS `shortUrl`.
- Keep mock selection out of the production build. The extension must use the configured API origin; it must never silently fall back to fixtures after a failed live request. Mock fixtures and tokens are plainly labeled nonproduction.
- Contract-test request route, unwrapped JSON body, omitted versus explicit `path`, bearer header, response parsing, idempotency replay, and representative error responses against the pinned OpenAPI plus the HTTP/proto semantic references.
- Run browser-level journeys against the local mock: first-use configuration and host grant; right-click page and link; toolbar form with generated and custom paths; duplicate slug; invalid/expired token; network loss and retry; clipboard success/failure; notification action; browser restart with retained interim token; instance switch that clears the token. Verify the mock redirect reaches the full destination.
- Check popup layout and keyboard use at narrow widths, long URLs, large text, and light/dark preferences. No live API, real credential, or external x40 service is required by CI.

## Architecture and permissions

- Use Manifest V3 and TypeScript. Keep UI components small and share design tokens and the API adapter. Bundle all executable code; do not load remote scripts.
- A service worker owns context menus, API calls, notifications, and credential use. Popup/options UI passes requests through narrow typed messages. Never send the token to a content script or page. An offscreen document may implement clipboard copying according to Chrome's MV3 pattern.
- Request only permissions needed for the agreed journeys: context menus, storage, notifications, action/tab access for the current page, and the offscreen/clipboard permissions required by the chosen copy implementation. Declare the hosted API host; request access to a self-hosted HTTPS origin at runtime rather than granting all hosts at install. Explain the clipboard and host-access warnings in setup and Store materials.
- Restrict `chrome.storage.local` access to trusted extension contexts where supported. This reduces exposure but **does not encrypt the stored token or close [issue #1](https://github.com/x40-link/chrome-extension/issues/1)**. Do not log tokens, full Authorization headers, or sensitive destination URLs. Do not add analytics, trackers, or local link history.
- Set a strict extension content security policy. Validate all data crossing message and API boundaries. Treat API error messages as untrusted text, never HTML.

## Visual and content direction

Use a compact Material 3-inspired hierarchy adapted to a browser popup: near-white `#FAFAF7` background, white surfaces, dark espresso `#3C3432` text, and a muted accessible blue-teal primary chosen and documented in shared tokens. Reserve mustard `#D9B45B` and terracotta `#D98B6C` for small accents. Define semantic light and dark tokens, typography, spacing, shape, focus, error, and notification icon colours centrally. Use the restrained geometric character of the Android visual-design guidance, without importing Android navigation or weightlifting motifs. Keep the form calm and readable; colour must not be the only state cue.

Create a distinct x40 icon that remains recognizable at 16, 32, 48, and 128 px. System notifications cannot be styled as Material cards, so use their icon, title, text, and actions consistently with the popup. Support keyboard navigation, visible focus, accessible names, contrast, reduced motion, long URLs, and zoom. English copy is sufficient for the first release, but centralize strings for later localization.

## Release gates

Implementation and mock-backed tests may finish before these external decisions. **Do not submit to the public Chrome Web Store or mark the release publish-ready while any gate is open.**

| Gate | Tracking issue | Evidence to close |
| --- | --- | --- |
| Replace interim plaintext persistent token storage with a compliant persistent sign-in design, or make another explicitly approved compliant choice. Chrome says extension storage is not encrypted; its Web Store FAQ requires strong encryption for stored user data. | [Extension #1](https://github.com/x40-link/chrome-extension/issues/1) | Security review, implementation and restart/sign-out tests, accurate disclosures. |
| Publish and verify the selected privacy policy URL `https://x40.link/privacy` (HTTP 404 on 2026-10-09). | [Extension #2](https://github.com/x40-link/chrome-extension/issues/2), [site #107](https://github.com/x40-link/x40.link/issues/107) | Live HTTPS policy that matches final data flows and Store Privacy answers. |
| Define a usable source of Create-scoped tokens for hosted and self-hosted users. The extension currently accepts tokens but cannot issue them. | [Extension #3](https://github.com/x40-link/chrome-extension/issues/3), [API #14](https://github.com/x40-link/api/issues/14) | Documented user setup and successful first-use/expiry/scope tests. |
| Verify the compatible live hosted API and real redirects; mocks alone are for development and CI. | [Extension #4](https://github.com/x40-link/chrome-extension/issues/4) | Successful end-to-end live Create and redirect checks, plus reviewer instructions. |

Before submission, also provide a truthful Store name, description, screenshots, icons, single-purpose and permission explanations, a support contact, privacy disclosures, and reviewer test instructions/credentials where required. Build the release zip from a clean checkout, run typecheck/lint/tests/browser journeys, inspect the manifest and packaged files for secrets and mock endpoints, and verify the live policy URL. The repository should contain the repeatable build and release checklist; actual Store publication is a separate owner action.

## Acceptance checklist for the implementing agent

- A user can install an unpacked development build, configure a hosted or self-hosted instance, paste a test token, and create a working mock short link through both right-click contexts and the toolbar form.
- The right-click path uses the saved default domain, omits `path`, preserves the complete destination, and presents a system notification with the returned link and accurate copy state.
- The form accepts destination/domain/optional slug, uses the documented Create request, shows the returned URL, and preserves input on every failure.
- Instance switching cannot send an old token to a new host; denied host permission cannot corrupt the previous configuration.
- Automated contract and browser tests pass without a live x40 API. A production build has no mock fallback, test token, or remote executable code.
- Source, setup instructions, assets, listing draft, and release checklist are complete. The four tracked release gates remain visible and are not claimed closed until their evidence exists.
