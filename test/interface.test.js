import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import * as holdem from "../public/game/engine/holdem.js";
import * as bots from "../public/game/engine/bots.js";
import * as cards from "../public/game/engine/cards.js";
import * as storage from "../public/game/engine/storage.js";
import { handResults } from "../public/game/engine/career.js";
const html = readFileSync(
  new URL("../public/game/index.html", import.meta.url),
  "utf8",
).replace(/<script[\s\S]*?<\/script>/g, "");
const app = readFileSync(
  new URL("../public/game/app.js", import.meta.url),
  "utf8",
).replace(/^import[\s\S]*?;\n/gm, "");
function setup(saved) {
  const window = new Window({
    url: "https://river-room.test",
    settings: {
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
    },
  });
  window.document.write(html);
  let id = 0;
  const timers = new Map();
  window.setTimeout = (fn) => {
    timers.set(++id, fn);
    return id;
  };
  window.clearTimeout = (id) => timers.delete(id);
  window.fetch = async () => ({ ok: false });
  Object.assign(window, holdem, bots, cards, {
    handResults,
    chooseAction: (v) => ({ action: v.legal.check ? "check" : "call" }),
    loadGame: () => storage.loadGame(window.localStorage),
    saveGame: (s) => storage.saveGame(s, window.localStorage),
  });
  if (saved)
    window.localStorage.setItem(storage.SAVE_KEY, JSON.stringify(saved));
  window.eval(`(()=>{${app}\n})()`);
  const $ = (id) => window.document.getElementById(id);
  return {
    window,
    $,
    tick() {
      const entry = timers.entries().next().value;
      if (!entry) return false;
      timers.delete(entry[0]);
      entry[1]();
      return true;
    },
    state: () => JSON.parse(window.localStorage.getItem(storage.SAVE_KEY)),
    close: () => window.happyDOM.abort(),
  };
}
test("setup, nine fixed seats, legal human actions, bots, hand completion, and next hand", async () => {
  const ui = setup();
  try {
    assert.equal(ui.$("setupDialog").open, true);
    ui.$("opponents").value = "1";
    ui.$("opponents").dispatchEvent(new ui.window.Event("input"));
    assert.equal(ui.$("opponentCount").textContent, "1");
    ui.$("setupForm").dispatchEvent(
      new ui.window.Event("submit", { cancelable: true }),
    );
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ui.$("setupDialog").open, false);
    assert.equal(ui.window.document.querySelectorAll(".seat").length, 9);
    assert.equal(ui.window.document.querySelectorAll(".seat.empty").length, 7);
    assert.equal(ui.state().actor, 0);
    assert.equal(ui.$("liveActions").hidden, false);
    assert.match(ui.$("callButton").textContent, /Call 5/);
    assert.equal(
      ui.window.document.querySelectorAll(".seat:not(.hero) .card.back").length,
      2,
    );
    ui.$("raiseAmount").value = "19";
    ui.$("raiseButton").click();
    assert.equal(ui.state().currentBet, 10);
    assert.match(ui.$("announcement").textContent, /whole-chip/);
    ui.$("callButton").click();
    assert.equal(ui.state().actor, 1);
    assert.equal(ui.$("liveActions").hidden, true);
    let safety = 0;
    while (ui.state().phase !== "complete") {
      assert.ok(safety++ < 100);
      if (ui.state().actor === 0) ui.$("callButton").click();
      else assert.ok(ui.tick());
    }
    assert.equal(ui.$("betweenActions").hidden, false);
    assert.equal(ui.$("dealButton").textContent, "Next hand →");
    assert.match(ui.$("announcement").textContent, /wins|split/);
    ui.$("dealButton").click();
    assert.equal(ui.state().hand, 2);
  } finally {
    await ui.close();
  }
});
test("pause and dialogs suspend bots; resume continues; exact local game resumes on reload", async () => {
  const saved = holdem.startHand(holdem.createGame(5));
  const ui = setup(saved);
  try {
    assert.equal(ui.$("setupDialog").open, false);
    assert.match(ui.$("announcement").textContent, /Welcome back/);
    assert.deepEqual(ui.state(), saved);
    ui.$("pauseButton").click();
    assert.equal(ui.tick(), false);
    assert.equal(ui.$("pauseButton").textContent, "Resume");
    ui.$("pauseButton").click();
    ui.$("rulesButton").click();
    assert.equal(ui.$("rulesDialog").open, true);
    assert.equal(ui.tick(), false);
    ui.$("rulesDialog").close();
    assert.equal(ui.tick(), true);
    const after = ui.state(),
      reload = setup(after);
    try {
      assert.deepEqual(reload.state(), after);
    } finally {
      await reload.close();
    }
    ui.$("newButton").click();
    assert.equal(ui.$("resetWarning").hidden, false);
    ui.$("setupDialog").close();
    assert.equal(ui.state().hand, 1);
  } finally {
    await ui.close();
  }
});
test("keyboard shortcuts act only when no form field, button, or dialog is focused", async () => {
  const saved = holdem.startHand(holdem.createGame(1)),
    ui = setup(saved);
  try {
    ui.$("raiseAmount").dispatchEvent(
      new ui.window.KeyboardEvent("keydown", { key: "f", bubbles: true }),
    );
    assert.equal(ui.state().phase, "preflop");
    ui.$("rulesButton").click();
    ui.window.document.body.dispatchEvent(
      new ui.window.KeyboardEvent("keydown", { key: "f", bubbles: true }),
    );
    assert.equal(ui.state().phase, "preflop");
    ui.$("rulesDialog").close();
    ui.window.document.body.dispatchEvent(
      new ui.window.KeyboardEvent("keydown", { key: "f", bubbles: true }),
    );
    assert.equal(ui.state().phase, "complete");
    assert.equal(ui.state().players[0].folded, true);
  } finally {
    await ui.close();
  }
});
test("corrupt save recovers into a fresh setup with a visible warning", async () => {
  const ui = setup({ version: 999 });
  try {
    assert.equal(ui.$("setupDialog").open, true);
    assert.match(ui.$("saveStatus").textContent, /could not be read/);
  } finally {
    await ui.close();
  }
});
