# Chrome Web Store listing draft — not for submission

**Name:** x40 Short Link

**Short description:** Create an x40 short link from the current page, a link, or a compact toolbar form.

**Detailed description:** Create a short link on your x40 domain without leaving the page. Right-click a page or link for immediate creation, or open the toolbar form to edit the destination, short domain, and optional slug. The extension copies the returned short URL when the browser allows it and shows the result in a notification and the toolbar. It supports one active hosted or self-hosted x40 API origin. Bring an existing CreateShortLink bearer token; this version cannot issue one. It does not browse, edit, delete, or analyze your links.

**Single purpose:** Create one x40 short link from a user-selected or user-entered HTTP(S) destination.

**Permission explanations:**

- `contextMenus`: show the two right-click create actions.
- `storage`: keep the selected instance, default domain, and manually pasted token across restarts; keep the most recent result only for the current browser session.
- `notifications`: report success or failure and offer Copy or Open form.
- `activeTab`: prefill the toolbar editor from the active page after the user opens it.
- `offscreen`: copy a returned URL to the clipboard from the service worker's offscreen document. The extension does not read the clipboard.
- `clipboardWrite`: allow the offscreen document to write the server-returned short URL without another click.
- `https://api.x40.link/*`: send a Create request to the hosted default API.
- Optional `https://*/*`: request access to the exact selected self-hosted API host when the user changes instances. Chrome's manifest pattern enables choosing a host; the extension requests only the selected host at runtime.

**Privacy disclosure draft:** The extension sends the user-selected destination URL, chosen short domain and optional slug, a random request ID, and a bearer token to the configured x40 API origin. The local extension stores the configured origin, domain, and manually pasted token across browser restarts. This interim token storage is not encrypted and blocks public submission pending [issue #1](https://github.com/x40-link/chrome-extension/issues/1). The latest result and notification actions are kept only in session storage. There are no trackers, analytics, or link history in the extension. Final Store Privacy answers must be reviewed against the final credential flow and live [privacy policy](https://x40.link/privacy).

**Support URL:** https://github.com/x40-link/chrome-extension/issues

**Privacy policy URL selected, currently blocked:** https://x40.link/privacy

**Screenshots for review:** `task screenshots` generates `assets/store/setup-development.png` and `assets/store/editor-development.png` (1280×800). CI uploads them as a PR run artifact. They show development UI and example values. Recheck copy and capture final screenshots after the release gates close.

**Reviewer instructions:** Pending a usable hosted Create-scoped token source and successful live Create/redirect verification. The `x40-test-create-only` token works only with the local mock and is not a live reviewer credential. Do not submit this draft until the four release gates close.
