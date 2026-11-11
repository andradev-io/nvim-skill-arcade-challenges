# Skill Arcade score API

A Cloudflare Worker + D1 database. It keeps the best result per user and challenge and serves a leaderboard.
Identity is a **Keycloak access token**, checked with the realm's public keys (no secret). Nothing about the account
is stored: a user is only a derived **user code** like `K7QMD-3XPV9`.

| Route | Auth | What |
| --- | --- | --- |
| `GET /api/leaderboard?challenge=<id>&limit=20` | none | top results: user code, keys, ms |
| `GET /api/me` | Bearer | your user code and best results |
| `POST /api/score` | Bearer | `{ "challenge": "bracket-the-word", "keys": 7, "ms": 4200 }`, kept when better (fewer keys, then less time) |

Scores are claims made by the client (the plugin runs on the user's machine), so treat the board as an honor system.

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

- `CLOUDFLARE_API_TOKEN`: a token with *Workers Scripts: Edit* and *D1: Edit* (the "Edit Cloudflare Workers" template works).
  The custom domain below also needs *Workers Routes: Edit* on the `andradev.io` zone, and possibly *DNS: Edit*
- `CLOUDFLARE_ACCOUNT_ID`
- `D1_DATABASE_ID`: the id printed by `wrangler d1 create` (kept out of the repository; the workflow writes it into `wrangler.toml` at deploy time)
- `KEYCLOAK_ISSUER`: the realm issuer URL (also kept out of the repository and written in at deploy time)
- `USER_CODE_SALT`: any long random string (pushed to the worker as a Cloudflare secret)

The Worker answers on its own domain, `https://api.arcade.nvim.andradev.io` (the `routes` line in `wrangler.toml`), so that
is the value of the site's `ARCADE_API_URL` secret. The site also reads the same `KEYCLOAK_ISSUER` secret at build time
for its sign-in button; see the main README.

The client ids and allowed origins stay in `wrangler.toml`. Create the database once
(`npx wrangler d1 create skill-arcade`), put its id in the `D1_DATABASE_ID` secret, and the workflow does the rest;
the repository only ever contains the placeholder.

Tests (`worker/src/worker.test.ts`) run with the site's `npm test`; `npx tsc -p worker` type-checks.
