# Client Portal Encryption — Design Spec

**Date:** 2026-06-19  
**Status:** Approved

## Overview

Password-protect per-client HTML pages on a GitHub Pages static site using StatiCrypt (AES-256). Unencrypted source lives only on the developer's machine; only encrypted output is committed and served publicly.

## Folder Structure

```
mark-smart-traffic.github.io/
├── index.html
├── public/
│   └── clients/
│       └── [client-name]/       ← encrypted HTML (committed, served by GitHub Pages)
├── public-encrypted/            ← gitignored, plain source files
│   └── clients/
│       └── [client-name]/
├── scripts/
│   └── encrypt.js
├── .env                         ← gitignored
├── .gitignore
└── package.json
```

`public-encrypted/` is never committed. `public/` contains only encrypted output.

## Secrets (.env)

```bash
MASTER_SECRET=<64-char hex, randomly generated at setup>

CLIENT_ACME_PASSWORD=<randomly generated per client>
CLIENT_GLOBEX_PASSWORD=<randomly generated per client>
```

- `MASTER_SECRET`: cryptographically random 32-byte hex string, available for future admin/signing use.
- Per-client passwords: independently generated random strings, one per client.
- Naming convention: folder name uppercased, hyphens → underscores. `big-client` → `CLIENT_BIG_CLIENT_PASSWORD`.

## Encryption Script (`scripts/encrypt.js`)

Runs via Node.js. Steps:

1. Load `.env` via `dotenv`.
2. Read subdirectories of `public-encrypted/clients/`.
3. For each client, resolve `CLIENT_[NAME]_PASSWORD` — abort with a descriptive error if missing.
4. Run StatiCrypt programmatically (Node API, not CLI) on every `.html` file, outputting to `public/clients/[name]/`.
5. Exit non-zero on any failure.

Does not clean up stale output files — removal is manual to avoid accidental data loss.

## Pre-commit Hook (`.git/hooks/pre-commit`)

- Runs `node scripts/encrypt.js`.
- On success, stages `public/` with `git add public/` automatically.
- Exits non-zero to block the commit if encryption fails.
- Written with LF line endings (required for Git's bash on Windows).
- Does not run on push or in CI — encryption is a local-only step.

## Adding a New Client

1. Create `public-encrypted/clients/[name]/` and add HTML files.
2. Add `CLIENT_[NAME]_PASSWORD=<random>` to `.env`.
3. Run `git commit` — the hook encrypts, stages, and includes the output.

## Out of Scope

- CI/CD encryption (local pre-commit only)
- Automatic cleanup of removed client output
- Per-page passwords within a client folder (one password per client)
