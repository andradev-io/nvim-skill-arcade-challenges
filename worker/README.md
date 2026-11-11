# Skill Arcade score API

A Cloudflare Worker + D1 database. It keeps the best result per user and challenge and serves a leaderboard.
Identity is a **Keycloak access token**, checked with the realm's public keys (no secret). Nothing about the account
is stored: a user is only a derived **user code** like `K7QMD-3XPV9`.

| Route | Auth | What |
| --- | --- | --- |
| `GET /api/leaderboard?challenge=<id>&limit=20` | none | top results: user code, keys, ms |
| `GET /api/me` | Bearer | your user code, whether you are an admin, and best results |
| `POST /api/score` | Bearer | `{ "challenge": "bracket-the-word", "keys": 7, "ms": 4200 }`, kept when better (fewer keys, then less time) |
| `POST /api/event` | none (site origin only) | anonymous usage count: `{ "type": "view", "path": "home" }` or `{ "type": "play", "challenge": "<id>", "done": false }` |
| `GET /api/admin/stats?days=30` | Bearer, admin | the numbers behind the site's Admin page |

Scores are claims made by the client (the plugin runs on the user's machine), so treat the board as an honor system.

## Usage counts and the Admin page

The site reports page views and challenge starts / finishes to `POST /api/event`. Per day the Worker keeps: views per
page, a **daily visitor hash** (day + salt + address + browser, 8 bytes of SHA-256; the day is part of it, so it cannot
be followed from one day to the next, and rows older than 90 days are deleted) and starts / finishes per challenge. The
address itself, cookies and accounts are never stored. Requests that send `DNT: 1` or `Sec-GPC: 1`, or that do not come
from an allowed site origin, are not counted.

`#/admin` on the site draws the charts. It is for the user codes listed in the **`ADMIN_USER_CODES`** secret (comma
separated): sign in once, copy your player code from the Account page, and put it in the secret. Anyone else gets 403.

## Keycloak

1. Realm with the GitHub identity provider. In the provider's first-broker-login flow do not import what you do not need.
2. Client `arcade-site`: public, Standard flow with PKCE, redirect URI and web origin `https://arcade.nvim.andradev.io/*`.
3. Client `arcade-plugin`: public, **OAuth 2.0 Device Authorization Grant** enabled (the plugin signs in without a browser inside Neovim).
4. Optional: a mapper that emits a `user_code` claim. Without it the worker derives the code from `sub`.
5. Tokens must be RS256 (the default).

## Deploy

```bash
cd worker
npx wrangler d1 create skill-arcade          # copy the database_id into wrangler.toml
npx wrangler d1 execute skill-arcade --remote --file=schema.sql
# edit wrangler.toml: KEYCLOAK_ISSUER, ALLOWED_CLIENTS, ALLOWED_ORIGINS (and the optional route)
npx wrangler secret put USER_CODE_SALT       # optional: makes derived codes unguessable from a subject id
npx wrangler deploy
```

### Deploy from GitHub instead

`.github/workflows/worker.yml` deploys on every push to `main` that touches `worker/`. Only these are secret, and
they live in the repository's GitHub secrets (Settings, Secrets and variables, Actions):

- `CLOUDFLARE_API_TOKEN`: a token with *Workers Scripts: Edit* and *D1: Edit* (the "Edit Cloudflare Workers" template works)
- `CLOUDFLARE_ACCOUNT_ID`
- `D1_DATABASE_ID`: the id printed by `wrangler d1 create` (kept out of the repository; the workflow writes it into `wrangler.toml` at deploy time)
- `KEYCLOAK_ISSUER`: the realm issuer URL (also kept out of the repository and written in at deploy time)
- `USER_CODE_SALT`: any long random string (pushed to the worker as a Cloudflare secret)
- `ADMIN_USER_CODES`: your player code from the site's Account page, comma separated for several (pushed to the worker as a Cloudflare secret; opens the Admin page)

The site reads the same `KEYCLOAK_ISSUER` secret at build time (plus `ARCADE_API_URL`, the Worker's address) for its
sign-in button; see the main README.

The client ids and allowed origins stay in `wrangler.toml`. Create the database once
(`npx wrangler d1 create skill-arcade`), put its id in the `D1_DATABASE_ID` secret, and the workflow does the rest;
the repository only ever contains the placeholder.

Tests (`worker/src/worker.test.ts`) run with the site's `npm test`; `npx tsc -p worker` type-checks.
