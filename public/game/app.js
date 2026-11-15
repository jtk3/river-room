import {
  createGame,
  startHand,
  act,
  legalActions,
  botView,
  pot,
  rebuy,
  BOT_NAMES,
  STYLES,
} from "./engine/holdem.js";
import { chooseAction } from "./engine/bots.js";
import { rank, suit, RANKS } from "./engine/cards.js";
import { loadGame, saveGame } from "./engine/storage.js";
import { handResults } from "./engine/career.js";
const $ = (id) => document.getElementById(id),
  fmt = (n) => n.toLocaleString("en-US");
let game,
  timer,
  paused = false,
  saveError = "",
  notice = "",
  pace = 600;
try {
  game = loadGame();
  if (game) notice = "Welcome back. Your table is just as you left it.";
} catch {
  saveError =
    "The saved game could not be read. Start a new table to continue.";
}
const hasSave = !!game;
game ||= createGame(5);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const SUITS = ["♣", "♦", "♥", "♠"];
function card(c, back = false) {
  if (back)
    return '<span class="card back" aria-label="Face-down card"></span>';
  if (c === null) return '<span class="card ghost" aria-hidden="true"></span>';
  return `<span class="card ${[1, 2].includes(suit(c)) ? "red" : ""}" aria-label="${rank(c) === 14 ? "Ace" : RANKS[c % 13]} of ${["clubs", "diamonds", "hearts", "spades"][suit(c)]}"><span>${RANKS[c % 13]}</span><em>${SUITS[suit(c)]}</em></span>`;
}
const seatPositions = Array.from({ length: 9 }, (_, i) => {
  const a = ((90 + i * 40) * Math.PI) / 180;
  return { x: 50 + 43 * Math.cos(a), y: 50 + 39 * Math.sin(a) };
});
function persist() {
  try {
    saveGame(game);
    saveError = "";
  } catch {
    saveError = "Saving unavailable. Keep this tab open to continue this game.";
  }
}
const CAREER_QUEUE = "river-room.pending-career.v1";
const CAREER_ID = "river-room.career-id.v1";
function getCareerId() {
  let id=localStorage.getItem(CAREER_ID);
  if(!id){id=crypto.randomUUID();localStorage.setItem(CAREER_ID,id);}
  return id;
}
let flushingCareerQueue = false;
async function flushCareerQueue() {
  if(flushingCareerQueue)return;
  flushingCareerQueue=true;
  try {
    while(true){
      const queue=JSON.parse(localStorage.getItem(CAREER_QUEUE)||"[]");
      if(!queue.length)break;
      const item=queue[0];
      const response=await fetch('/api/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});
      if(!response.ok)break;
      // Re-read after network I/O so hands queued in the meantime are preserved.
      const latest=JSON.parse(localStorage.getItem(CAREER_QUEUE)||"[]");
      localStorage.setItem(CAREER_QUEUE,JSON.stringify(latest.filter(e=>e.id!==item.id)));
    }
  } catch { /* Local game remains playable; retry when connectivity returns. */ }
  finally { flushingCareerQueue=false; }
}
function recordCareer(completed) {
  const c=completed.career;
  if(!c || !Array.isArray(c.startStacks) || c.recordedHand===completed.hand)return;
  try {
    const deltas=handResults(c.startStacks,completed.players.map(p=>p.stack));
    const players=completed.players.flatMap((p,i)=>i===0
      ? (c.nickname ? [{id:`human:${c.playerId}`,name:c.nickname,kind:'human',net:deltas[i]}] : [])
      : [{id:`bot:${i-1}`,name:p.name,kind:'bot',net:deltas[i]}]);
    const event={id:`${c.tableId}:${completed.hand}`,tableId:c.tableId,handNumber:completed.hand,rosterVersion:c.rosterVersion,players};
    const queue=JSON.parse(localStorage.getItem(CAREER_QUEUE)||"[]");
    if(!queue.some(e=>e.id===event.id))queue.push(event);
    localStorage.setItem(CAREER_QUEUE,JSON.stringify(queue));
    c.recordedHand=completed.hand;
    void flushCareerQueue();
  } catch { saveError='Career result could not be saved; your game remains playable.'; }
}
function beginHand() {
  const startStacks=game.players.map(p=>p.id && p.stack===0 ? 1000 : p.stack);
  const next=startHand(game);
  if(!next.career) {
    try {next.career={tableId:crypto.randomUUID(),playerId:getCareerId(),nickname:'',rosterVersion:0};} catch { /* unavailable storage */ }
  }
  if(next.career)next.career.startStacks=startStacks;
  if(next.phase === "complete") recordCareer(next);
  update(next);
}
function update(next) {
  if(next.phase==='complete' && game.phase!=='complete')recordCareer(next);
  game = next;
  notice = "";
  persist();
  render();
  renderProfiles();
  schedule();
}
function render() {
  const done = game.phase === "complete",
    waiting = game.phase === "waiting",
    hero = game.players[0];
  $("pot").textContent = fmt(done ? game.finalPot : pot(game));
  $("board").innerHTML = Array.from({ length: 5 }, (_, i) =>
    card(game.board[i] ?? null),
  ).join("");
  $("streetLabel").textContent = waiting
    ? "YOUR SEAT IS WAITING"
    : `HAND ${game.hand} · ${done ? (game.showdown ? "SHOWDOWN" : "HAND COMPLETE") : game.phase.toUpperCase()}`;
  const winners = new Set(
    game.awards.filter((a) => !a.refund).flatMap((a) => a.winners),
  );
  $("seats").innerHTML = seatPositions
    .map(({ x, y }, seat) => {
      const p = game.players.find((p) => p.seat === seat),
        style = `left:clamp(44px, ${x}%, calc(100% - 44px));top:${y}%`;
      if (!p)
        return `<div class="seat empty" style="${style}" data-seat="${seat}"><div class="empty-seat">＋</div><div class="empty-text">OPEN SEAT</div></div>`;
      const reveal = p.id === 0 || (done && game.showdown && !p.folded),
        isWinner = done && winners.has(p.id);
      const cards = (p.hole || []).map((c) => card(c, !reveal)).join("");
      return `<div class="seat ${p.id === 0 ? "hero" : ""} ${p.folded ? "folded" : ""} ${game.actor === p.id ? "active" : ""} ${isWinner ? "winner" : ""}" style="${style}" data-seat="${seat}" aria-label="${escape(p.name)}, ${escape(p.style)}, ${p.stack} chips${game.actor === p.id ? ", acting" : ""}"><div class="seat-cards">${cards}</div><div class="seat-shell"><div class="seat-top"><span class="avatar">${p.id === 0 ? "♠" : escape(p.name[0])}</span><div class="seat-name">${escape(p.name)}<small>${escape(p.style)}</small></div></div><div class="seat-stack">${fmt(p.stack)}</div>${game.button === p.id ? '<span class="dealer" title="Dealer button">D</span>' : ""}</div><div class="seat-action">${isWinner ? "✦ WINNER" : game.actor === p.id ? (paused ? "Paused" : p.id === 0 ? "Your turn" : "Thinking…") : escape(p.lastAction || "Ready to play")}</div>${p.bet ? `<span class="seat-bet">${fmt(p.bet)}</span>` : ""}</div>`;
    })
    .join("");
  $("heroStack").textContent = fmt(hero.stack);
  $("handCount").textContent = game.hand;
  // The hero's buy-ins are tracked separately because bots can also rebuy.
  const heroBuyins = game.heroBuyins || 1000;
  const net = hero.stack + hero.total - heroBuyins;
  $("net").textContent = (net > 0 ? "+" : "") + fmt(net);
  $("net").className = net > 0 ? "positive" : net < 0 ? "negative" : "";
  $("history").innerHTML = game.log.length
    ? game.log
        .slice()
        .reverse()
        .map(
          (line) =>
            `<li class="${/wins|split/.test(line) ? "win" : ""}">${escape(line)}</li>`,
        )
        .join("")
    : "<li>Welcome to River Room. Take a seat to start your session.</li>";
  $("saveStatus").textContent =
    saveError || "● Automatically saved on this browser";
  $("saveStatus").className = saveError ? "negative" : "";
  const legal = legalActions(game, 0),
    yourTurn = !!legal;
  $("liveActions").hidden = !yourTurn;
  $("betweenActions").hidden = !(done || waiting);
  $("turnDot").classList.toggle("lit", yourTurn);
  $("dealButton").hidden = hero.stack === 0;
  $("rebuyButton").hidden = hero.stack > 0;
  $("dealButton").textContent = waiting ? "Deal me in →" : "Next hand →";
  $("pauseButton").textContent = paused ? "Resume" : "Pause";
  $("historyBadge").textContent = paused ? "PAUSED" : "LIVE";
  if (yourTurn) {
    $("actionTitle").textContent = paused ? "Your turn · paused" : "Your move.";
    $("actionHint").textContent = legal.toCall
      ? `${fmt(legal.call)} to call${legal.call < legal.toCall ? " · all-in" : ""} · Pot odds ${Math.round((legal.call / (pot(game) + legal.call)) * 100)}%`
      : "Check for free, or put the table to a decision.";
    $("callButton").innerHTML =
      `${legal.check ? "Check" : `Call ${fmt(legal.call)}`} <kbd>C</kbd>`;
    $("raiseButton").disabled = !legal.canRaise;
    $("raiseBox").hidden = !legal.canRaise;
    $("raiseButton").innerHTML =
      `${game.currentBet === 0 ? "Bet" : "Raise"} <kbd>R</kbd>`;
    for (const el of [$("raiseAmount"), $("raiseRange")]) {
      el.min = legal.minRaiseTo;
      el.max = legal.maxRaiseTo;
      el.value = legal.minRaiseTo;
    }
  } else if (done || waiting) {
    $("actionTitle").textContent =
      hero.stack === 0
        ? "A fresh stack awaits."
        : waiting
          ? "Make yourself at home."
          : "Ready for another hand?";
    $("actionHint").textContent =
      hero.stack === 0
        ? "Rebuy 1,000 play chips to keep your seat."
        : waiting
          ? "Take your seat and meet the table."
          : "The dealer button moves clockwise.";
  } else {
    const p = game.players[game.actor];
    $("actionTitle").textContent = paused
      ? "The table is paused."
      : `${p.name} is considering…`;
    $("actionHint").textContent = paused
      ? "Resume when you’re ready."
      : p.style + " · Your cards stay private.";
  }
  if (done) {
    const award = game.awards.filter((a) => !a.refund);
    $("announcement").textContent =
      notice ||
      award
        .map(
          (a) =>
            `${a.winners.map((id) => game.players[id].name).join(" & ")} ${a.winners.length > 1 ? "split" : "wins"} ${fmt(a.amount)}${a.hand === "Uncontested" ? "" : ` · ${a.hand}`}`,
        )
        .join("  |  ");
  } else
    $("announcement").textContent =
      notice ||
      (yourTurn
        ? "The action is on you."
        : waiting
          ? "Good cards. Better company."
          : paused
            ? "Take your time. We’ll keep your seat."
            : "");
  $("resetWarning").hidden = game.hand === 0;
}
function schedule() {
  clearTimeout(timer);
  if (
    paused ||
    game.actor === null ||
    game.actor === 0 ||
    document.querySelector("dialog[open]")
  )
    return;
  timer = setTimeout(() => {
    try {
      const decision = chooseAction(botView(game, game.actor));
      update(act(game, game.actor, decision.action, decision.amount));
    } catch (e) {
      paused = true;
      notice =
        "The table paused after an unexpected error. Your last valid action is saved.";
      render();
      console.error(e);
    }
  }, pace);
}
function human(action) {
  if (paused || !legalActions(game, 0)) return;
  try {
    let amount;
    if (action === "raise") {
      amount = Number($("raiseAmount").value);
      const legal = legalActions(game, 0);
      if (
        !Number.isSafeInteger(amount) ||
        amount < legal.minRaiseTo ||
        amount > legal.maxRaiseTo
      ) {
        $("raiseAmount").reportValidity();
        notice = `Choose a whole-chip total from ${fmt(legal.minRaiseTo)} to ${fmt(legal.maxRaiseTo)}.`;
        $("announcement").textContent = notice;
        return;
      }
    }
    update(act(game, 0, action, amount));
  } catch (e) {
    $("announcement").textContent = e.message;
  }
}
$("foldButton").onclick = () => human("fold");
$("callButton").onclick = () =>
  human(legalActions(game, 0)?.check ? "check" : "call");
$("raiseButton").onclick = () => human("raise");
$("raiseAmount").oninput = () => {
  $("raiseRange").value = $("raiseAmount").value;
};
$("raiseRange").oninput = () => {
  $("raiseAmount").value = $("raiseRange").value;
};
for (const button of document.querySelectorAll("[data-size]"))
  button.onclick = () => {
    const l = legalActions(game, 0);
    if (!l) return;
    const p = game.players[0],
      base = p.bet + l.toCall;
    const sizes = {
      min: l.minRaiseTo,
      half: base + Math.ceil((pot(game) + l.call) / 2),
      pot: base + pot(game) + l.call,
      all: l.maxRaiseTo,
    };
    const amount = Math.min(
      l.maxRaiseTo,
      Math.max(l.minRaiseTo, sizes[button.dataset.size]),
    );
    $("raiseAmount").value = amount;
    $("raiseRange").value = amount;
  };
$("dealButton").onclick = () => {
  paused = false;
  beginHand();
};
$("rebuyButton").onclick = () => {
  update(rebuy(game));
};
$("pauseButton").onclick = () => {
  paused = !paused;
  render();
  schedule();
};
$("pace").onchange = () => {
  pace = Number($("pace").value);
  schedule();
};
function openDialog(id) {
  clearTimeout(timer);
  $(id).showModal();
}
$("newButton").onclick = () => {
  $("opponents").value = game.players.length - 1;
  $("opponentCount").textContent = game.players.length - 1;
  openDialog("setupDialog");
};
$("rulesButton").onclick = () => openDialog("rulesDialog");
$("playersButton").onclick = () => openDialog("playersDialog");
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.querySelector("[data-close]").onclick = () => dialog.close();
  dialog.addEventListener("close", schedule);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  });
}
$("opponents").oninput = () =>
  ($("opponentCount").textContent = $("opponents").value);
$("setupForm").onsubmit = async (e) => {
  e.preventDefault();
  paused = false;
  const nickname=($("careerName")?.value || '').trim();
  if (nickname.length > 32 || /[\u0000-\u001f\u007f]/.test(nickname)) {
    $("careerName").setCustomValidity('Use a nickname with up to 32 printable characters.');
    $("careerName").reportValidity();
    return;
  }
  $("careerName")?.setCustomValidity('');
  let roster=null, rosterVersion=0;
  try { const response=await fetch('/api/players',{cache:'no-store'}); if(response.ok){const data=await response.json();roster=data.players;rosterVersion=data.version;} } catch { /* Preserve offline play with original defaults. */ }
  try { game = createGame(Number($("opponents").value),roster); }
  catch { game = createGame(Number($("opponents").value)); rosterVersion=0; }
  try { game.career={tableId:crypto.randomUUID(),playerId:getCareerId(),nickname,rosterVersion}; } catch { /* Browser storage unavailable. */ }
  $("setupDialog").close();
  beginHand();
};
const descriptions = [
  "Selective before the flop, decisive after it. Expect thoughtful pressure with strong hands.",
  "Plays a wide range and makes you pay to see the next card. Give this player room to bluff.",
  "Curiosity has a price. Calls often, raises rarely, and likes to see a showdown.",
  "Patience is the whole strategy. A bet from this seat deserves some respect.",
  "A measured mix of value, caution, and the occasional bluff. Harder to pin down.",
  "Big bets, wide ranges, and very little hesitation. A lively seat at any table.",
  "Changes gears and looks for spots to apply unexpected pressure.",
  "Here for a good time. A little loose, a little cautious, and always interested.",
];
function renderProfiles() {
  $("playerProfiles").innerHTML = game.players.slice(1).map((player,i) =>
    `<div class="profile"><h3>${escape(player.name)}</h3><small>${escape(player.style)}</small><p>${descriptions[i]}</p></div>`).join("");
}
renderProfiles();
document.addEventListener("keydown", (e) => {
  if (
    e.repeat ||
    e.altKey ||
    e.ctrlKey ||
    e.metaKey ||
    /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) ||
    document.querySelector("dialog[open]")
  )
    return;
  const key = e.key.toLowerCase();
  if (!["f", "c", "r"].includes(key) || !legalActions(game, 0)) return;
  e.preventDefault();
  human(
    key === "f"
      ? "fold"
      : key === "c"
        ? legalActions(game, 0).check
          ? "check"
          : "call"
        : "raise",
  );
});
window.addEventListener("pagehide", () => {
  if (game.hand > 0) persist();
});
void flushCareerQueue();
render();
if (!hasSave) openDialog("setupDialog");
else schedule();
