# x40 Chrome extension

Implementation handoff: [SPEC.md](SPEC.md). It defines the agreed user journeys, API and mock contracts, visual direction, tests, and public-release gates.

**Status: development handoff.** The unpacked build works with the local mock. Public Chrome Web Store submission is blocked by the four gates in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## Requirements

- Node.js 22 or newer and pnpm 11.19.0
- Task 3.50.0 or newer
- Chromium for the Playwright browser test (`pnpm exec playwright install chromium`)
- Python 3 for the deterministic review ZIP

## Run against the local mock

```bash
task setup
task build:dev
task mock
```

In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/`. The development build grants loopback host access at install for headless browser tests. In the popup, set the API base URL to `http://127.0.0.1:8787`, short domain to `x40.test`, and bearer token to **`x40-test-create-only`**. This token is a nonproduction fixture accepted only by the local mock. Change the mock port with `PORT=8888 task mock` and use that port in setup. The mock state resets on restart or `POST /__reset`.

Use either **Shorten this page** or **Shorten this link** from the context menu, or open the toolbar form. The mock returns a loopback short URL; opening it produces HTTP 307 to the exact destination. Do not mistake this local fixture for a live x40 service.

The extension sends every Create to the configured API origin. It has no fixture fallback. For a self-hosted HTTPS instance, change the API base URL and short domain independently. Chrome asks for access to that API host. A denied grant keeps the old account. The token field accepts an existing bearer token with `api.x40.link/scopes/x40.link.v1alpha.ShortLinkService.CreateShortLink`; the extension does not obtain one. Changing the API origin clears the previous token. **Sign out / reset** removes the token and transient result.

The development build permits HTTP only on `localhost` and `127.0.0.1`. The production build permits HTTPS API origins only and declares only the hosted API host at install. Self-hosted hosts are optional runtime permissions. Browser host warnings reflect where the extension can send a Create request; the clipboard write warning reflects automatic copying of the returned link. The extension does not read the clipboard. The service worker owns the token, API requests, notifications, and clipboard handoff. No content script receives credentials.

## Build and test

```bash
task generate
task lint
task test
task browser
task validate
task screenshots
task package
```

`task generate` renders icon PNGs and downloads the three pinned API files with SHA-256 verification. A valid local contract cache works offline; a clean checkout needs GitHub access to fetch the pinned source, never a live x40 API. The generated PNGs, contract copies, screenshots, `dist/`, and review ZIP are ignored by Git. The committed [contract pin](contract/PIN.md), SVG, and scripts reproduce them.

`task test` runs pinned contract, adapter, mock, and worker journey tests. `task browser` launches a temporary Chromium profile with the unpacked development extension and local mock. A development-only message bridge dispatches page/link context cases inside the real service worker; the worker tests also exercise Chrome's context-menu event handler. The bridge is absent from the production package. `task validate` runs all checks and finishes with a production `dist/` manifest. `task screenshots` generates 1280×800 review images. `task package` builds `release/x40-review-only.zip`; it is a review artifact, not a public Store submission. Recheck the [contract pin](contract/PIN.md) before live integration.

The popup uses shared light and dark tokens in [theme.css](assets/theme.css). Primary blue teal `#286D77` was chosen for readable white-on-primary controls; mustard and terracotta remain small icon accents. The icon source is [icon.svg](assets/icon.svg); `task generate:icons` produces sizes 16, 32, 48, and 128 px. Generated Store screenshots show a development build with example data and must be replaced or reviewed after live integration. CI uploads screenshots and the review ZIP as a PR run artifact.
