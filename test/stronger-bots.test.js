import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame,startHand,act,botView,legalActions } from '../public/game/engine/holdem.js';
import { startingStrength,positionScore,rangeWeight,estimateEquity,chooseAction } from '../public/game/engine/bots.js';
import { SAVE_KEY,loadGame,saveGame } from '../public/game/engine/storage.js';
const card=(rank,suit)=>suit*13+rank-2;
const AA=[card(14,0),card(14,1)],sevenTwo=[card(7,0),card(2,1)];
const raise={playerId:1,street:'preflop',action:'raise',amount:100,playerBet:0,potBefore:50,board:[]};
function rng(seed=9){return ()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296)}
test('premium preflop holdings and betting-sensitive ranges are ranked plausibly',()=>{
 assert.ok(startingStrength(AA)>startingStrength(sevenTwo));
 assert.ok(rangeWeight(AA,[raise])>rangeWeight(sevenTwo,[raise]));
 assert.equal(rangeWeight(AA,[]),1);
});
test('position follows dealer and action order, including heads-up',()=>{
 const players=Array.from({length:6},(_,id)=>({id}));
 assert.equal(positionScore({players,button:0,phase:'preflop'},3),0);
 assert.equal(positionScore({players,button:0,phase:'preflop'},2),1);
 assert.equal(positionScore({players,button:0,phase:'flop'},1),0);
 assert.equal(positionScore({players,button:0,phase:'flop'},0),1);
 assert.equal(positionScore({players:players.slice(0,2),button:0,phase:'preflop'},0),0);
 assert.equal(positionScore({players:players.slice(0,2),button:0,phase:'flop'},0),1);
});
test('actions expose only public history and survive save/resume',()=>{
 let s=startHand(createGame(2),rng());const actor=s.actor;
 const l=legalActions(s,actor);s=act(s,actor,l.toCall?'call':'check');
 const view=botView(s,s.actor);assert.equal(view.actionHistory.length,1);
 assert.equal(view.actionHistory[0].playerId,actor);assert.deepEqual(view.actionHistory[0].board,[]);
 assert.equal(JSON.stringify(view).includes('deck'),false);assert.equal(JSON.stringify(view).includes('burns'),false);
 assert.equal(view.players.some(p=>Object.hasOwn(p,'hole')),false);
 const mem=new Map(),store={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)};
 saveGame(s,store);assert.deepEqual(loadGame(store).actionHistory,s.actionHistory);
 const legacy=structuredClone(s);delete legacy.actionHistory;mem.set(SAVE_KEY,JSON.stringify(legacy));
 const restored=loadGame(store);assert.deepEqual(botView(restored,restored.actor).actionHistory,[]);
 const next=act(restored,restored.actor,legalActions(restored).toCall?'call':'check');assert.equal(next.actionHistory.length,1);
});
test('range estimation and all opponent decisions remain legal',()=>{
 const rand=rng(1234);for(let n=2;n<=9;n++){
  let s=startHand(createGame(n-1),rand),moves=0;
  while(s.phase!=='complete'&&moves++<100){const v=botView(s,s.actor);const eq=estimateEquity(v,rand,20);assert.ok(eq>=0&&eq<=1);const choice=chooseAction(v,rand);s=act(s,s.actor,choice.action,choice.amount);}
  assert.equal(s.phase,'complete');
 }
});
