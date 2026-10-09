# Pinned API contract

Source: `x40-link/api` commit `e54521f91a0d9199e9b3c1d7a5bb644ca11629e0` (verified 2026-10-09).

| File | SHA-256 |
| --- | --- |
| `short_link.openapi.json` | `d6d17e21b570b0c24aae6c3a975abad4d39f06d3d16126f77a8d6354d22e7897` |
| `http.md` | `a5c951a6664fb07e5541420df3537cb16c52a30439fa58818147a422b9cc530b` |
| `short_link.proto` | `e98b957216a7f759707cba6cd5a28bd6f0b07d55c51d77412ce2c4fa9a937918` |

`task generate:contract` downloads these files into ignored local paths and verifies each hash. `task contract:refresh` forces a fresh download. Recheck API main for changes before live integration. The generated OpenAPI has no server or OAuth issuer information; this extension does not infer those values from the schema.
