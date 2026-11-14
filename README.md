# River Room ♠

A browser-based, play-money **no-limit Texas Hold’em cash game**. Take a seat at a fixed nine-seat table with one to eight computer opponents, each with a different playing style.

**Play:** deployment link will be added after publication.

## Run locally

Requires Node.js 22+ for development/tests and Python 3 for the optional local server. There are no runtime JavaScript dependencies and no build step.

```sh
git clone https://github.com/jtk3/river-room.git
cd river-room
npm ci
npm run dev
```

Open http://localhost:5173. Alternatively, serve `dist/` with any static web server. Opening the HTML directly as a `file:` URL does not support the ES modules.

```sh
npm run check
npm test
```

The tests cover hand evaluation, betting rules, side pots, tied pots and odd chips, short all-ins, heads-up positions, save/resume, bot legality and information boundaries, 800 randomized hands across all table sizes, and interface interactions using Happy DOM. The evaluator also checks every one of the **2,598,960 five-card combinations** against the standard category counts and compares 1,000 seven-card deals with an exhaustive best-of-five result. Happy DOM verifies behavior; it does not verify browser rendering or layout.

## At the table

- 5/10 blinds, 1,000-chip buy-ins, no rake or ante.
- Fixed nine-seat layout; unused seats stay empty, and the button skips them.
- One to eight opponents: tight aggressive, loose aggressive, calling station, rock, balanced, maniac, tricky, and casual.
- Full betting rounds, minimum raises, cumulative short all-in reopening, automatic runouts, side pots, exact ties and odd-chip distribution.
- “Raise to” means your total contribution on this street. Presets offer minimum, half-pot, pot, and all-in sizes; every raise is checked by the engine.
- Fold / check / call / raise controls, pace adjustment, pause, recent hand history, session result, and in-game rules and opponent guides.
- F folds, C checks/calls, R raises to the displayed amount. Shortcuts do not fire while an input, button, or dialog is focused.
- Computer players automatically rebuy after busting. You can rebuy when your stack is empty, between hands.

## Resume a game

Every action saves the complete state, including the current deal and next actor, to this browser’s `localStorage`. Reloading resumes that state. Closing a help dialog resumes computer action; Pause stops it until Resume is selected. Starting a new table replaces the saved session. Saves do not sync between devices and can be removed by clearing browser data. If storage is unavailable or a save is invalid, the interface shows a warning.

This is a casual local game: the saved state includes hidden cards and the shuffled deck so the same hand can resume. It is not an adversarial multiplayer or real-money system. Computer decision inputs explicitly exclude opponents’ hole cards, burns, and the actual deck. Bots use Monte Carlo equity estimates over unknown cards, with different calling thresholds, aggression, bluff rates, and bet sizing. They are varied recreational opponents, not solver-level opponents.

## Code map

```text
dist/
  index.html          Accessible table interface, setup and rules dialogs
  styles.css          Felt table, seat layout, cards and responsive styling
  app.js              Browser controller, rendering and computer turn scheduling
  engine/
    cards.js          Card representation, shuffle and hand evaluation
    holdem.js         Cash-game state, legal actions, betting and pot settlement
    bots.js           Equity sampling and opponent personalities
    storage.js        Versioned save validation and localStorage adapter
test/
  engine.test.js      Rules, accounting, bots and save/resume tests
  evaluator.test.js   Exhaustive five-card distribution test
  interface.test.js   DOM interaction tests
.openai/hosting.json  Static hosting configuration
```

Cards are integers 0–51, with clubs, diamonds, hearts, spades in blocks of 13 and ranks 2–A. Player IDs are indexes in clockwise player order; `seat` is a fixed physical seat, with the human at seat 0. Chips use whole integers. `act()` and `startHand()` return cloned state, so rejected actions leave their input intact. Pot settlement uses contribution bands and eligibility; adjacent bands with the same eligibility form a single pot. Uncalled chips are returned separately. Betting rights use the price at which a full raise would reopen action for each player, supporting cumulative short all-ins.

## Adding features later

Keep the current boundaries instead of introducing a universal game framework:

- **Tournaments:** add a session module for blind schedules, elimination and table changes. Reuse cards/evaluation and extract the existing cash-only rebuy policy when a second format needs it.
- **Other variants:** create a sibling rules module with its own dealing and action rules. Reuse card utilities where applicable; do not assume every variant shares Hold’em’s hand selection.
- **Mobile app:** reuse the plain JavaScript engine and bot modules from a dedicated mobile interface or wrapper. They have no DOM dependencies. The current browser view has responsive styling, but has not yet had device or touch-browser QA.
- **Multiplayer:** requires authoritative server state and private per-player views; localStorage is not a security boundary.

The standard poker betting rules are implemented as documented under **How to play** in the app. Useful references: [Poker TDA rules](https://www.pokertda.com/view-poker-tda-rules/) for raise and reopening conventions and [Robert’s Rules of Poker](https://www.pagat.com/de/docs/RobsPkrRules11.pdf) for no-limit betting. Physical table procedures such as misdeals, string bets, and verbal declarations are handled by the digital dealer or action controls.

The optional Google Fonts stylesheet has system font fallbacks. All game code and card artwork are included locally. No accounts, analytics, payments, or backend are needed.

## License

[MIT](LICENSE) © 2026 jtk3.
