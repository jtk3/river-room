# River Room ♠

A browser-based, play-money no-limit Texas Hold’em cash game. The deployed game supports one human and one to eight computer opponents. The source is MIT licensed.

## Game and player data

Game state remains in browser local storage. Starting a table snapshots the current shared computer-player settings so a running table does not change after an administrator edits the roster. Existing version-1 saves continue to load. Old stock bot names migrate to the renamed roster; a deliberately configured name is not changed.

The owner administration interface at `/game/admin/index.html` requires ChatGPT sign-in with the site owner's configured email. The server validates identity and the request origin before accepting roster changes, validates all slider values, and uses version checks to reject stale edits. Set `RIVER_OWNER_EMAIL` as a secret environment variable in the site hosting settings; do not commit credentials.

Career rankings are public and based on completed hands after the feature goes live. The human player may choose an optional public nickname. Browser-generated results are not independently verified and should not be treated as an anti-cheat or real-money system. There is no cross-device identity recovery. Computer entries are recorded even if the human player remains anonymous. Results are queued in browser storage and sent with idempotent hand IDs; they may be lost if the browser's data is removed before successful delivery. Historical results store the roster version used for the hand. Tournament statistics are not implemented.

## Development

Requires Node.js 22.13 or later and npm. Install with `npm ci`, run checks with `npx tsc --noEmit` and `node --test`, and build with `npm run build`. The site uses a server-backed Sites deployment with a D1 database binding named `DB`. Schema migrations are in `drizzle/`. Local migrations use the commands documented by the Sites runtime; do not apply production migrations by hand.

The static game is in `public/game/`; poker engine code has no browser DOM dependency. API routes live in `app/api/`. The leaderboard does not verify the client-reported outcome. Any future online multiplayer or real-money project needs a server-authoritative game engine.
