# Release checklist — gates open

## External gates

- [ ] [Extension #1](https://github.com/x40-link/chrome-extension/issues/1): replace interim plaintext persistent token storage with a reviewed compliant design, or explicitly approve another compliant choice. Verify restart, expiry, and sign-out behavior and update disclosures.
- [ ] [Extension #2](https://github.com/x40-link/chrome-extension/issues/2) / [site #107](https://github.com/x40-link/x40.link/issues/107): publish and verify `https://x40.link/privacy` over HTTPS, aligned with actual extension data flows and Store answers.
- [ ] [Extension #3](https://github.com/x40-link/chrome-extension/issues/3) / [API #14](https://github.com/x40-link/api/issues/14): document a usable Create-scoped token source for hosted and self-hosted users. Test first use, expiry, and missing scope.
- [ ] [Extension #4](https://github.com/x40-link/chrome-extension/issues/4): run a compatible live hosted Create and follow its real 307 redirect; write reviewer instructions and provide credentials where required.

## Final submission preparation

1. Run `task contract:refresh` to re-fetch the OpenAPI, HTTP reference, and protobuf at the pinned commit in [contract/PIN.md](contract/PIN.md); compare hashes. Review API main for changes before live integration.
2. From a clean checkout, run `task setup` and `task validate`.
3. Inspect `dist/manifest.json`: MV3, strict CSP, hosted HTTPS grant, runtime optional HTTPS hosts, and no loopback HTTP permissions. Inspect all `dist/` files for credentials, mock endpoints, test fixture tokens, remote scripts, trackers, and unnecessary permissions.
4. Run `task package` from that clean checkout. Inspect `release/x40-review-only.zip` and its `extension/` directory. The generated screenshots and ZIP are CI artifacts, not committed files. This script creates a review artifact only; rename and submit only after all gates close and the owner approves publication.
5. Finalize [STORE_LISTING.md](STORE_LISTING.md): truthful descriptions, reviewed screenshots/icons, permission and single-purpose explanations, support contact, privacy answers, live policy URL, and reviewer test instructions/credentials.
6. Have the owner perform the separate Chrome Web Store submission. Record the submitted version and evidence for all gates.

Current mock-backed tests do not establish live API compatibility or public Store readiness.
